export type StreamConversationInput = {
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
};

type StreamEvent = { type: "chunk"; text: string } | { type: "done"; content: string } | { type: "error"; message: string };

function readFrames(buffer: string): { frames: string[]; remainder: string } {
  const frames: string[] = [];
  let remainder = buffer.replace(/\r\n/g, "\n");
  while (true) {
    const index = remainder.indexOf("\n\n");
    if (index < 0) break;
    frames.push(remainder.slice(0, index));
    remainder = remainder.slice(index + 2);
  }
  return { frames, remainder };
}

function frameData(frame: string): string | null {
  const line = frame.split("\n").find((value) => value.startsWith("data:"));
  return line ? line.slice(5).trim() : null;
}

function extractDelta(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return "";
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0 || typeof choices[0] !== "object" || choices[0] === null) return "";
  const delta = (choices[0] as { delta?: unknown }).delta;
  if (typeof delta !== "object" || delta === null) return "";
  const content = (delta as { content?: unknown }).content;
  return typeof content === "string" ? content : "";
}

export async function streamOpenRouterConversation(
  input: StreamConversationInput,
  emit: (event: StreamEvent) => void,
): Promise<void> {
  const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Stryde",
    },
    body: JSON.stringify({
      model: input.model,
      messages: [{ role: "user", content: input.prompt }],
      stream: true,
      temperature: 0,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Model request failed (${response.status}): ${(await response.text()).slice(0, 1000)}`);
  }
  if (!response.body) throw new Error("Model streaming response has no body");

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  let content = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = readFrames(buffer);
      buffer = parsed.remainder;
      for (const frame of parsed.frames) {
        const data = frameData(frame);
        if (!data || data === "[DONE]") continue;
        let payload: unknown;
        try {
          payload = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = extractDelta(payload);
        if (!delta) continue;
        content += delta;
        emit({ type: "chunk", text: delta });
      }
    }
    if (buffer.trim()) {
      const data = frameData(buffer);
      if (data && data !== "[DONE]") {
        const payload: unknown = JSON.parse(data);
        const delta = extractDelta(payload);
        if (delta) {
          content += delta;
          emit({ type: "chunk", text: delta });
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  emit({ type: "done", content });
}
