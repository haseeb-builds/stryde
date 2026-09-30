import { readSseData, readSseFrames } from "./conversation-stream.ts";

export async function consumeConversationStream<T>(
  response: Response,
  onDelta: (content: string) => void,
  onComplete: (turn: T) => void,
): Promise<T> {
  if (!response.body) throw new Error("Conversation stream was unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completedTurn: T | undefined;
  const consume = (frame: string) => {
    const data = readSseData(frame);
    if (!data) return;
    const event = JSON.parse(data) as { type?: string; content?: string; turn?: T; error?: string; message?: string };
    if (event.type === "message_delta" && typeof event.content === "string") onDelta(event.content);
    else if (event.type === "complete" && event.turn !== undefined) {
      completedTurn = event.turn;
      onComplete(event.turn);
    } else if (event.type === "error") throw new Error(event.error ?? event.message ?? "Conversation stream failed.");
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = readSseFrames(buffer);
      buffer = parsed.remainder;
      parsed.frames.forEach(consume);
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer);
  } finally {
    reader.releaseLock();
  }
  if (completedTurn === undefined) throw new Error("Conversation stream ended before completion.");
  return completedTurn;
}
