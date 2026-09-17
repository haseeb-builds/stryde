import { validateModelProposal, type ModelProposal } from "@/lib/orchestration";

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
const MAX_OUTPUT_CHARS = 20_000;
const MAX_CONVERSATION_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 8_000;

type ModelGatewayResult = {
  proposal: ModelProposal;
  provider: string;
  model: string;
};

type ConversationMessage = {
  role: "user" | "stryde";
  content: string;
};

type ConversationOption = {
  label: string;
  value: string;
};

export type ConversationTurn = {
  message: string;
  question: string | null;
  options: ConversationOption[];
  ready_for_reasoning: boolean;
  focus: string | null;
};

const MODEL_PROPOSAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "understanding", "diagnosis", "intervention", "proposed_response"],
  properties: {
    path: { type: "string", enum: ["CLEAR", "UNCLEAR"] },
    understanding: { type: "string", minLength: 1, maxLength: 8000 },
    diagnosis: { anyOf: [{ type: "string", maxLength: 8000 }, { type: "null" }] },
    intervention: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "rationale"],
          properties: {
            kind: { type: "string", enum: ["ANSWER", "DECISION", "HUMAN_ACTION", "CONTROLLED_ACTION", "WAIT"] },
            rationale: { type: "string", minLength: 1, maxLength: 8000 },
          },
        },
        { type: "null" },
      ],
    },
    proposed_response: { anyOf: [{ type: "string", maxLength: 8000 }, { type: "null" }] },
  },
} as const;

const CONVERSATION_TURN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["message", "question", "options", "ready_for_reasoning", "focus"],
  properties: {
    message: { type: "string", minLength: 1, maxLength: 8000 },
    question: { anyOf: [{ type: "string", maxLength: 4000 }, { type: "null" }] },
    options: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value"],
        properties: {
          label: { type: "string", minLength: 1, maxLength: 300 },
          value: { type: "string", minLength: 1, maxLength: 1000 },
        },
      },
    },
    ready_for_reasoning: { type: "boolean" },
    focus: { anyOf: [{ type: "string", maxLength: 2000 }, { type: "null" }] },
  },
} as const;

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Model returned non-JSON structured output");
  }
}

function extractChatText(response: unknown): string {
  if (typeof response !== "object" || response === null) throw new Error("Model returned an invalid response envelope");
  const choices = (response as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) throw new Error("Model response is missing choices");
  const message = choices[0] && typeof choices[0] === "object" ? (choices[0] as { message?: unknown }).message : null;
  const content = message && typeof message === "object" ? (message as { content?: unknown }).content : null;
  if (typeof content !== "string" || !content.trim()) throw new Error("Model returned no text output");
  const text = content.trim();
  if (text.length > MAX_OUTPUT_CHARS) throw new Error("Model output exceeded the allowed size");
  return text;
}

function getModelConfig() {
  const provider = (process.env.STRYDE_MODEL_PROVIDER ?? "openrouter").trim().toLowerCase();
  if (provider !== "openrouter") throw new Error(`Unsupported STRYDE_MODEL_PROVIDER: ${provider}`);
  const apiKey = process.env.STRYDE_MODEL_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing model configuration: STRYDE_MODEL_API_KEY");
  const baseUrl = (process.env.STRYDE_MODEL_BASE_URL ?? DEFAULT_OPENROUTER_BASE_URL).replace(/\/$/, "");
  const model = (process.env.STRYDE_MODEL_NAME ?? DEFAULT_OPENROUTER_MODEL).trim();
  if (!model) throw new Error("Missing model configuration: STRYDE_MODEL_NAME");
  return { provider, apiKey, baseUrl, model };
}

async function callStructuredModel(
  schemaName: string,
  schema: object,
  input: string,
): Promise<{ parsed: unknown; provider: string; model: string }> {
  const { provider, apiKey, baseUrl, model } = getModelConfig();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Stryde",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: input }],
      response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
      provider: { require_parameters: true, allow_fallbacks: true },
      plugins: [{ id: "response-healing" }],
      temperature: 0,
      stream: false,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    throw new Error(`Model request failed (${response.status}): ${detail}`);
  }
  const envelope: unknown = await response.json();
  const text = extractChatText(envelope);
  return { parsed: parseJsonText(text), provider, model };
}

export async function runModelProposal(prompt: string): Promise<ModelGatewayResult> {
  const result = await callStructuredModel("stryde_model_proposal", MODEL_PROPOSAL_SCHEMA, prompt);
  return { proposal: validateModelProposal(result.parsed), provider: result.provider, model: result.model };
}

function sanitizeConversation(messages: ConversationMessage[]): ConversationMessage[] {
  return messages
    .slice(-MAX_CONVERSATION_MESSAGES)
    .map((item) => ({ role: item.role, content: item.content.trim().slice(0, MAX_MESSAGE_CHARS) }))
    .filter((item) => item.content.length > 0);
}

function validateConversationTurn(value: unknown): ConversationTurn {
  if (typeof value !== "object" || value === null) throw new Error("Conversation turn must be an object");
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.message !== "string" || !candidate.message.trim()) throw new Error("Conversation message is required");
  if (!Array.isArray(candidate.options)) throw new Error("Conversation options must be an array");
  const options = candidate.options.slice(0, 4).map((option) => {
    if (typeof option !== "object" || option === null) throw new Error("Invalid conversation option");
    const item = option as Record<string, unknown>;
    if (typeof item.label !== "string" || !item.label.trim()) throw new Error("Conversation option label is required");
    if (typeof item.value !== "string" || !item.value.trim()) throw new Error("Conversation option value is required");
    return { label: item.label.trim().slice(0, 300), value: item.value.trim().slice(0, 1000) };
  });
  const question = candidate.question === null || candidate.question === undefined ? null : typeof candidate.question === "string" && candidate.question.trim() ? candidate.question.trim().slice(0, 4000) : null;
  const focus = candidate.focus === null || candidate.focus === undefined ? null : typeof candidate.focus === "string" && candidate.focus.trim() ? candidate.focus.trim().slice(0, 2000) : null;
  if (typeof candidate.ready_for_reasoning !== "boolean") throw new Error("ready_for_reasoning must be boolean");
  return {
    message: candidate.message.trim().slice(0, 8000),
    question,
    options,
    ready_for_reasoning: candidate.ready_for_reasoning,
    focus,
  };
}

function buildConversationPrompt(input: {
  pursuitTitle: string;
  situation: unknown;
  conversation: ConversationMessage[];
  userMessage: string;
}): string {
  const userMessage = input.userMessage.trim();
  if (!userMessage) throw new Error("userMessage must be non-empty");
  if (userMessage.length > MAX_MESSAGE_CHARS) throw new Error("userMessage is too long");
  const history = sanitizeConversation([...input.conversation, { role: "user", content: userMessage }]);
  const workingContext = JSON.stringify({
    pursuit_title: input.pursuitTitle,
    canonical_situation: input.situation,
    conversation: history,
  });

  return [
    "You are Stryde, a persistent situational-intelligence system.",
    "Your job in this turn is to help the user understand and move a real situation forward.",
    "This is a conversation, not a questionnaire. The user may be vague, contradictory, emotional, incomplete, or unsure how to explain themselves.",
    "Absorb ambiguity rather than turning it into extra work for the user.",
    "First make a best-effort interpretation of what the user is saying. Then add useful understanding, framing, a recommendation, or a next move.",
    "Ask a question only when the answer would materially change what Stryde should do next.",
    "Do not automatically end with a question. A strong turn can end with a concrete next move or a useful observation.",
    "Do not restate the user's message in polished customer-support language.",
    "Avoid phrases such as 'I hear you've been...', 'Thanks for clarifying...', 'To give you the most useful guidance...', or other generic support-bot acknowledgements unless they are genuinely necessary.",
    "Do not make the user define concepts that Stryde can reasonably help unpack itself.",
    "When the user says 'I don't know', make a concrete provisional interpretation and offer a small set of ways to discover what is actually true. Do not respond with another broad diagnostic questionnaire.",
    "Use ordinary natural prose. Usually prefer 1-4 short paragraphs. Use bullets only when they materially improve comparison, sequencing, or scanability.",
    "Do not use numbered steps unless sequence genuinely matters. Never use labels such as 'Step 1 of 3'.",
    "Options are optional. Offer at most four only when they reduce cognitive load; the user can always respond in their own words.",
    "Keep the response proportional to the user's input. Do not produce an essay when one useful paragraph will move the situation forward.",
    "Treat your interpretation as provisional when evidence is weak. Accept user corrections immediately.",
    "Do not claim external actions were executed or verified. Do not authorize side effects, permissions, budgets, or tool use.",
    "The conversation is working memory, not canonical domain state. Do not silently rewrite canonical state.",
    "Set ready_for_reasoning=true only when there is enough understanding to run the canonical reasoning kernel without inventing missing facts.",
    "Return structured JSON only matching the ConversationTurn contract. Put the complete user-facing turn in message; question is optional metadata and may be null.",
    "",
    `WORKING_CONTEXT: ${workingContext}`,
  ].join("\n");
}

export async function runConversationTurn(input: {
  pursuitTitle: string;
  situation: unknown;
  conversation: ConversationMessage[];
  userMessage: string;
}): Promise<{ turn: ConversationTurn; provider: string; model: string }> {
  const result = await callStructuredModel(
    "stryde_conversation_turn",
    CONVERSATION_TURN_SCHEMA,
    buildConversationPrompt(input),
  );
  return { turn: validateConversationTurn(result.parsed), provider: result.provider, model: result.model };
}

class MessageStreamDecoder {
  private prelude = "";
  private started = false;
  private finished = false;
  private escaping = false;
  private unicodeRemaining = 0;
  private unicodeBuffer = "";

  push(fragment: string): string {
    if (this.finished || !fragment) return "";
    let source = fragment;

    if (!this.started) {
      this.prelude += source;
      const marker = /"message"\s*:\s*"/.exec(this.prelude);
      if (!marker || marker.index === undefined) {
        if (this.prelude.length > 256) this.prelude = this.prelude.slice(-256);
        return "";
      }
      source = this.prelude.slice(marker.index + marker[0].length);
      this.prelude = "";
      this.started = true;
    }

    let output = "";
    for (const char of source) {
      if (this.finished) break;

      if (this.unicodeRemaining > 0) {
        if (!/[0-9a-fA-F]/.test(char)) {
          throw new Error("Model returned invalid unicode escape in message");
        }
        this.unicodeBuffer += char;
        this.unicodeRemaining -= 1;
        if (this.unicodeRemaining === 0) {
          output += String.fromCharCode(Number.parseInt(this.unicodeBuffer, 16));
          this.unicodeBuffer = "";
          this.escaping = false;
        }
        continue;
      }

      if (this.escaping) {
        const escapes: Record<string, string> = {
          '"': '"',
          "\\": "\\",
          "/": "/",
          b: "\b",
          f: "\f",
          n: "\n",
          r: "\r",
          t: "\t",
        };
        if (char === "u") {
          this.unicodeRemaining = 4;
          this.unicodeBuffer = "";
          continue;
        }
        const decoded = escapes[char];
        if (decoded === undefined) throw new Error("Model returned invalid escape in message");
        output += decoded;
        this.escaping = false;
        continue;
      }

      if (char === "\\") {
        this.escaping = true;
      } else if (char === '"') {
        this.finished = true;
      } else {
        output += char;
      }
    }

    return output;
  }
}

function readSseFrames(buffer: string): { frames: string[]; remainder: string } {
  const frames: string[] = [];
  let working = buffer.replace(/\r\n/g, "\n");
  while (true) {
    const separator = working.indexOf("\n\n");
    if (separator < 0) break;
    frames.push(working.slice(0, separator));
    working = working.slice(separator + 2);
  }
  return { frames, remainder: working };
}

function getSseData(frame: string): string | null {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  return data || null;
}

function getDeltaContent(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return "";
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0 || typeof choices[0] !== "object" || choices[0] === null) return "";
  const delta = (choices[0] as { delta?: unknown }).delta;
  if (typeof delta !== "object" || delta === null) return "";
  const content = (delta as { content?: unknown }).content;
  return typeof content === "string" ? content : "";
}

export async function streamConversationTurn(
  input: {
    pursuitTitle: string;
    situation: unknown;
    conversation: ConversationMessage[];
    userMessage: string;
  },
  onComplete: (turn: ConversationTurn) => Promise<void> | void,
): Promise<{ stream: ReadableStream<Uint8Array>; provider: string; model: string }> {
  const { provider, apiKey, baseUrl, model } = getModelConfig();
  const prompt = buildConversationPrompt(input);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Stryde",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_schema", json_schema: { name: "stryde_conversation_turn", strict: true, schema: CONVERSATION_TURN_SCHEMA } },
      provider: { require_parameters: true, allow_fallbacks: true },
      temperature: 0,
      stream: true,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    throw new Error(`Model request failed (${response.status}): ${detail}`);
  }
  if (!response.body) throw new Error("Model streaming response has no body");

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const decoder = new TextDecoder();
      const messageDecoder = new MessageStreamDecoder();
      const rawParts: string[] = [];
      let buffer = "";

      const emit = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const consumeFrame = (frame: string) => {
        const data = getSseData(frame);
        if (!data || data === "[DONE]") return;
        let payload: unknown;
        try {
          payload = JSON.parse(data);
        } catch {
          return;
        }
        const content = getDeltaContent(payload);
        if (!content) return;
        rawParts.push(content);
        const visible = messageDecoder.push(content);
        if (visible) emit("chunk", { text: visible });
      };

      try {
        const reader = response.body!.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = readSseFrames(buffer);
          buffer = parsed.remainder;
          for (const frame of parsed.frames) consumeFrame(frame);
        }
        buffer += decoder.decode();
        const parsed = readSseFrames(`${buffer}\n\n`);
        for (const frame of parsed.frames) consumeFrame(frame);

        const raw = rawParts.join("").trim();
        if (!raw || raw.length > MAX_OUTPUT_CHARS) throw new Error("Model returned an empty or oversized conversation turn");
        const turn = validateConversationTurn(parseJsonText(raw));
        await onComplete(turn);
        emit("done", { turn, provider, model });
        controller.close();
      } catch (error) {
        emit("error", { message: error instanceof Error ? error.message : "Conversation failed" });
        controller.close();
      }
    },
  });

  return { stream, provider, model };
}

export type { ConversationMessage };
