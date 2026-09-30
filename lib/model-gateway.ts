import { validateModelProposal, type ModelProposal } from "./orchestration.ts";
import { WORKING_STATE_SCHEMA, buildWorkControllerPrompt, validateWorkingState, type WorkingState } from "./work-controller.ts";
import { extractMessagePrefix, readSseData, readSseFrames } from "./conversation-stream.ts";
import { getModelRouter } from "./model-provider.ts";

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const MAX_OUTPUT_CHARS = 20_000;
const MAX_CONVERSATION_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 8_000;
// The turn must fit the full ConversationTurn (message, options, focus, and the
// complete WorkingState projection) including model reasoning overhead; the
// previous 1,000-token budget truncated every capable provider mid-JSON.
export const MAX_CONVERSATION_TURN_OUTPUT_TOKENS = 2_600;

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
  work: WorkingState;
};

export type ConversationStreamEvent =
  | { type: "message_delta"; content: string }
  | { type: "complete"; turn: ConversationTurn; provider: string; model: string }
  | { type: "error"; message: string };

const MODEL_PROPOSAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "understanding", "diagnosis", "intervention", "proposed_response"],
  properties: {
    path: { type: "string", enum: ["CLEAR", "UNCLEAR"] },
    understanding: { type: "string", minLength: 1, maxLength: 8000 },
    diagnosis: {
      anyOf: [{ type: "string", maxLength: 8000 }, { type: "null" }],
    },
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
    proposed_response: {
      anyOf: [{ type: "string", maxLength: 8000 }, { type: "null" }],
    },
  },
} as const;

const CONVERSATION_TURN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["message", "question", "options", "ready_for_reasoning", "focus", "work"],
  properties: {
    message: { type: "string", minLength: 1, maxLength: 8000 },
    question: {
      anyOf: [{ type: "string", maxLength: 4000 }, { type: "null" }],
    },
    options: {
      type: "array",
      maxItems: 5,
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
    focus: {
      anyOf: [{ type: "string", maxLength: 2000 }, { type: "null" }],
    },
    work: WORKING_STATE_SCHEMA,
  },
} as const;

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Model returned non-JSON structured output");
  }
}

function toGeminiSchema(schema: unknown): unknown {
  if (typeof schema !== "object" || schema === null) return schema;
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);

  const source = schema as Record<string, unknown>;
  const variants = Array.isArray(source.anyOf) ? source.anyOf as unknown[] : null;
  if (variants) {
    const nonNull = variants.find((item) => {
      if (typeof item !== "object" || item === null) return false;
      return (item as Record<string, unknown>).type !== "null";
    });
    const hasNull = variants.some((item) =>
      item === null ||
      (typeof item === "object" && item !== null && (item as Record<string, unknown>).type === "null"),
    );
    if (nonNull && typeof nonNull === "object" && hasNull) {
      const converted = toGeminiSchema(nonNull) as Record<string, unknown>;
      if (typeof converted.type === "string") {
        return { ...converted, type: [converted.type, "null"] };
      }
      return converted;
    }
  }

  const converted: Record<string, unknown> = {};
  const type = source.type;
  if (typeof type === "string") converted.type = type;
  else if (Array.isArray(type)) {
    converted.type = type;
  }

  for (const key of ["description", "title", "enum", "format", "minimum", "maximum"]) {
    if (source[key] !== undefined) converted[key] = source[key];
  }
  if (source.properties && typeof source.properties === "object") {
    converted.properties = Object.fromEntries(
      Object.entries(source.properties as Record<string, unknown>).map(([key, value]) => [key, toGeminiSchema(value)]),
    );
  }
  if (Array.isArray(source.required)) converted.required = source.required;
  if (source.additionalProperties !== undefined) converted.additionalProperties = source.additionalProperties;
  if (source.items !== undefined) converted.items = toGeminiSchema(source.items);
  if (source.prefixItems !== undefined) converted.prefixItems = toGeminiSchema(source.prefixItems);

  return converted;
}

function extractGeminiText(response: unknown): string {
  if (typeof response !== "object" || response === null) {
    throw new Error("Gemini returned an invalid response envelope");
  }
  const candidates = (response as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("Gemini response is missing candidates");
  }
  const content = candidates[0] && typeof candidates[0] === "object"
    ? (candidates[0] as { content?: unknown }).content
    : null;
  const parts = content && typeof content === "object" ? (content as { parts?: unknown }).parts : null;
  if (!Array.isArray(parts)) throw new Error("Gemini response is missing content");
  const text = parts
    .filter((part) => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string")
    .map((part) => (part as { text: string }).text)
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned no text output");
  if (text.length > MAX_OUTPUT_CHARS) throw new Error("Model output exceeded the allowed size");
  return text;
}

function extractChatText(response: unknown): string {
  if (typeof response !== "object" || response === null) {
    throw new Error("Model returned an invalid response envelope");
  }
  const choices = (response as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("Model response is missing choices");
  }
  const message = choices[0] && typeof choices[0] === "object" ? (choices[0] as { message?: unknown }).message : null;
  const content = message && typeof message === "object" ? (message as { content?: unknown }).content : null;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Model returned no text output");
  }
  const text = content.trim();
  if (text.length > MAX_OUTPUT_CHARS) throw new Error("Model output exceeded the allowed size");
  return text;
}

function extractChatDelta(response: unknown): string {
  if (typeof response !== "object" || response === null) return "";
  const choices = (response as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0 || typeof choices[0] !== "object" || choices[0] === null) return "";
  const delta = (choices[0] as { delta?: unknown }).delta;
  if (typeof delta !== "object" || delta === null) return "";
  const content = (delta as { content?: unknown }).content;
  return typeof content === "string" ? content : "";
}

function extractGeminiDelta(response: unknown): string {
  if (typeof response !== "object" || response === null) return "";
  const candidates = (response as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0 || typeof candidates[0] !== "object" || candidates[0] === null) return "";
  const content = (candidates[0] as { content?: unknown }).content;
  const parts = content && typeof content === "object" ? (content as { parts?: unknown }).parts : null;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((part) => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string")
    .map((part) => (part as { text: string }).text)
    .join("");
}

function getModelConfig() {
  const provider = (process.env.STRYDE_MODEL_PROVIDER ?? "gemini").trim().toLowerCase();
  if (provider !== "openrouter" && provider !== "groq" && provider !== "gemini") {
    throw new Error(`Unsupported STRYDE_MODEL_PROVIDER: ${provider}`);
  }

  const apiKey = process.env.STRYDE_MODEL_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing model configuration: STRYDE_MODEL_API_KEY");

  const defaultBaseUrl = provider === "groq"
    ? DEFAULT_GROQ_BASE_URL
    : provider === "gemini"
      ? DEFAULT_GEMINI_BASE_URL
      : DEFAULT_OPENROUTER_BASE_URL;
  const defaultModel = provider === "groq"
    ? DEFAULT_GROQ_MODEL
    : provider === "gemini"
      ? DEFAULT_GEMINI_MODEL
      : DEFAULT_OPENROUTER_MODEL;
  const baseUrl = (process.env.STRYDE_MODEL_BASE_URL ?? defaultBaseUrl).replace(/\/$/, "");
  const model = (process.env.STRYDE_MODEL_NAME ?? defaultModel).trim();
  if (!model) throw new Error("Missing model configuration: STRYDE_MODEL_NAME");

  if (provider === "groq" && /openrouter\.ai/i.test(baseUrl)) {
    throw new Error("Invalid model configuration: Groq provider cannot use an OpenRouter base URL");
  }
  if (provider === "openrouter" && /groq\.com|googleapis\.com/i.test(baseUrl)) {
    throw new Error("Invalid model configuration: OpenRouter provider cannot use a Groq or Gemini base URL");
  }
  if (provider === "groq" && /googleapis\.com/i.test(baseUrl)) {
    throw new Error("Invalid model configuration: Groq provider cannot use a Gemini base URL");
  }
  if (provider === "gemini" && /openrouter\.ai|groq\.com/i.test(baseUrl)) {
    throw new Error("Invalid model configuration: Gemini provider cannot use an OpenRouter or Groq base URL");
  }

  return { provider, apiKey, baseUrl, model };
}

async function callStructuredModel(
  schemaName: string,
  schema: object,
  input: string,
  maxOutputTokens = 1_000,
): Promise<{ parsed: unknown; provider: string; model: string }> {
  const result = await getModelRouter().generateStructured({ schemaName, schema, prompt: input, maxOutputTokens });
  return result;
  /* legacy transport retained below only as a temporary source reference */
  const { provider, apiKey, baseUrl, model } = getModelConfig();

  if (provider === "gemini") {
    const response = await fetch(
      `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: input }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens,
            thinkingConfig: { thinkingBudget: 1_024 },
            responseMimeType: "application/json",
            responseSchema: toGeminiSchema(schema),
          },
        }),
        signal: AbortSignal.timeout(45_000),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1000);
      throw new Error(`Model request failed (${response.status}): ${detail}`);
    }

    const envelope: unknown = await response.json();
    return {
      parsed: parseJsonText(extractGeminiText(envelope)),
      provider,
      model,
    };
  }

  const modelInput = provider === "openrouter"
    ? [
        input,
        "",
        "Return one JSON object only.",
        "The JSON object MUST conform to this contract:",
        JSON.stringify(schema),
      ].join("\n")
    : input;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Stryde",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: modelInput }],
      ...(provider === "groq"
        ? {
            response_format: {
              type: "json_schema",
              json_schema: {
                name: schemaName,
                strict: true,
                schema,
              },
            },
          }
        : {
            response_format: {
              type: "json_object",
            },
          }),
      ...(provider === "openrouter"
        ? {
            provider: {
              require_parameters: true,
              allow_fallbacks: true,
            },
            plugins: [{ id: "response-healing" }],
          }
        : {}),
      temperature: 0,
      ...(provider === "groq" ? { reasoning_effort: "low" } : {}),
      max_tokens: provider === "groq" ? Math.min(maxOutputTokens, 800) : maxOutputTokens,
      stream: false,
    }),
    signal: AbortSignal.timeout(45_000),
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
  const options = candidate.options.slice(0, 5).map((option) => {
    if (typeof option !== "object" || option === null) throw new Error("Invalid conversation option");
    const item = option as Record<string, unknown>;
    if (typeof item.label !== "string" || !item.label.trim()) throw new Error("Conversation option label is required");
    if (typeof item.value !== "string" || !item.value.trim()) throw new Error("Conversation option value is required");
    return { label: item.label.trim().slice(0, 300), value: item.value.trim().slice(0, 1000) };
  });
  const question = candidate.question === null || candidate.question === undefined ? null : typeof candidate.question === "string" && candidate.question.trim() ? candidate.question.trim().slice(0, 4000) : null;
  const focus = candidate.focus === null || candidate.focus === undefined ? null : typeof candidate.focus === "string" && candidate.focus.trim() ? candidate.focus.trim().slice(0, 2000) : null;
  if (typeof candidate.ready_for_reasoning !== "boolean") throw new Error("ready_for_reasoning must be boolean");
  const work = validateWorkingState(candidate.work);
  return { message: candidate.message.trim().slice(0, 8000), question, options, ready_for_reasoning: candidate.ready_for_reasoning, focus, work };
}

function buildConversationPrompt(input: {
  pursuitTitle: string;
  situation: unknown;
  conversation: ConversationMessage[];
  userMessage: string;
  workingState?: WorkingState | null;
}): string {
  const userMessage = input.userMessage.trim();
  const history = sanitizeConversation([...input.conversation, { role: "user", content: userMessage }]);
  const workingContext = JSON.stringify({
    pursuit_title: input.pursuitTitle,
    canonical_situation: input.situation,
    previous_working_state: input.workingState ?? null,
    conversation: history,
  });

  return [
    "You are Stryde, a persistent situational-intelligence system.",
    "Your job in this turn is conversational situation discovery, not questionnaire completion.",
    "The user may be vague, contradictory, emotional, incomplete, or unsure how to explain themselves. Treat that as useful signal.",
    "Absorb cognitive ambiguity rather than reflecting it back as work for the user.",
    "First interpret what the user is saying. Then move the situation forward with a useful response.",
    "Do not automatically ask a question. Ask one only when it materially improves understanding.",
    "A useful response may combine an interpretation, observation, framing, small recommendation, question, and/or a few concrete choices.",
    "Do not force a fixed number of steps. Continue naturally until the situation is sufficiently understood for the next useful intervention.",
    "Offer choices when they reduce cognitive load, but never force the user into them.",
    "If the user says 'I don't know', help them discover what they mean rather than asking another broad diagnostic question.",
    "Do not pretend uncertain interpretations are established facts. Phrase them as tentative interpretations when appropriate.",
    "Do not claim external actions were executed or verified. Do not authorize side effects, permissions, budgets, or tool use.",
    "The conversation is working memory, not canonical domain state. Canonical situation evidence is separate and should not be silently rewritten.",
    "When the user corrects your interpretation, accept the correction and use it as the new working signal.",
    "Never use a progress label such as 'Step 1 of 3'. The interaction is adaptive.",
    "Alongside the conversational response, return an updated WorkingState projection. It is working state, not canonical truth.",
    "The WorkingState must identify known facts, material unknowns, the current bottleneck, and one smallest useful next move.",
    "Do not output a multi-step roadmap as next_move. Keep larger plans internal.",
    "Return structured JSON only matching the ConversationTurn contract.",
    "Set ready_for_reasoning=true only when there is enough understanding to run the canonical reasoning kernel without inventing missing facts.",
    "",
    `WORKING_CONTEXT: ${workingContext}`,
  ].join("\n");
}

async function readStructuredStream(
  response: Response,
  provider: string,
  onText: (text: string) => void,
): Promise<string> {
  if (!response.body) throw new Error("Model streaming response has no body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let structuredText = "";

  const consume = (frame: string) => {
    const data = readSseData(frame);
    if (!data || data === "[DONE]") return;
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      throw new Error("Model returned malformed streaming data");
    }
    const delta = provider === "gemini" ? extractGeminiDelta(payload) : extractChatDelta(payload);
    if (!delta) return;
    structuredText += delta;
    onText(structuredText);
    if (structuredText.length > MAX_OUTPUT_CHARS) throw new Error("Model output exceeded the allowed size");
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
  if (!structuredText.trim()) throw new Error("Model returned no structured output");
  return structuredText;
}

export async function streamConversationTurn(
  input: {
    pursuitTitle: string;
    situation: unknown;
    conversation: ConversationMessage[];
    userMessage: string;
    workingState?: WorkingState | null;
  },
  emit: (event: ConversationStreamEvent) => void,
  signal?: AbortSignal,
): Promise<{ turn: ConversationTurn; provider: string; model: string }> {
  const userMessage = input.userMessage.trim();
  if (!userMessage) throw new Error("userMessage must be non-empty");
  if (userMessage.length > MAX_MESSAGE_CHARS) throw new Error("userMessage is too long");

  const router = getModelRouter();
  let streamedText = "";
  const result = await router.streamStructured({ schemaName: "stryde_conversation_turn", schema: CONVERSATION_TURN_SCHEMA, prompt: buildConversationPrompt(input), maxOutputTokens: MAX_CONVERSATION_TURN_OUTPUT_TOKENS, signal, onText: (text) => { streamedText = text; }});
  const streamedTurn = validateConversationTurn(parseJsonText(streamedText));
  emit({ type: "message_delta", content: streamedTurn.message });
  emit({ type: "complete", turn: streamedTurn, provider: result.provider, model: result.model });
  return { turn: streamedTurn, provider: result.provider, model: result.model };

  const { provider, apiKey, baseUrl, model } = getModelConfig();
  const schema = CONVERSATION_TURN_SCHEMA;
  const prompt = buildConversationPrompt(input);
  const modelInput = provider === "openrouter"
    ? [prompt, "", "Return one JSON object only.", "The JSON object MUST conform to this contract:", JSON.stringify(schema)].join("\n")
    : prompt;
  const body = provider === "gemini"
    ? {
        contents: [{ parts: [{ text: modelInput }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 1_000, thinkingConfig: { thinkingBudget: 1_024 }, responseMimeType: "application/json", responseSchema: toGeminiSchema(schema) },
      }
    : {
        model,
        messages: [{ role: "user", content: modelInput }],
        ...(provider === "groq"
          ? { response_format: { type: "json_schema", json_schema: { name: "stryde_conversation_turn", strict: true, schema } } }
          : { response_format: { type: "json_object" } }),
        ...(provider === "openrouter" ? { provider: { require_parameters: true, allow_fallbacks: true }, plugins: [{ id: "response-healing" }] } : {}),
        temperature: 0,
        ...(provider === "groq" ? { reasoning_effort: "low" } : {}),
        max_tokens: provider === "groq" ? 800 : 1_000,
        stream: true,
      };
  const url = provider === "gemini"
    ? `${baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`
    : `${baseUrl}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: provider === "gemini"
      ? { "Content-Type": "application/json", "x-goog-api-key": apiKey }
      : { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Stryde" },
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Model request failed (${response.status}): ${(await response.text()).slice(0, 1000)}`);

  let previousMessage = "";
  const structuredText = await readStructuredStream(response, provider, (text) => {
    const message = extractMessagePrefix(text);
    if (message.length > previousMessage.length && message.startsWith(previousMessage)) {
      emit({ type: "message_delta", content: message.slice(previousMessage.length) });
      previousMessage = message;
    }
  });
  const turn = validateConversationTurn(parseJsonText(structuredText));
  emit({ type: "complete", turn, provider, model });
  return { turn, provider, model };
}

export async function runConversationTurn(input: {
  pursuitTitle: string;
  situation: unknown;
  conversation: ConversationMessage[];
  userMessage: string;
  workingState?: WorkingState | null;
}): Promise<{ turn: ConversationTurn; provider: string; model: string }> {
  const userMessage = input.userMessage.trim();
  if (!userMessage) throw new Error("userMessage must be non-empty");
  if (userMessage.length > MAX_MESSAGE_CHARS) throw new Error("userMessage is too long");

  const prompt = buildConversationPrompt(input);

  const result = await callStructuredModel("stryde_conversation_turn", CONVERSATION_TURN_SCHEMA, prompt);
  return { turn: validateConversationTurn(result.parsed), provider: result.provider, model: result.model };
}


export async function runWorkController(input: {
  pursuitTitle: string;
  situation: unknown;
  conversation: ConversationMessage[];
  previousWorkingState: WorkingState | null;
}): Promise<{ workingState: WorkingState; provider: string; model: string }> {
  const prompt = buildWorkControllerPrompt({
    pursuitTitle: input.pursuitTitle,
    situation: input.situation,
    conversation: input.conversation,
    previousWorkingState: input.previousWorkingState,
  });
  const result = await callStructuredModel("stryde_work_controller", WORKING_STATE_SCHEMA, prompt, 2_200);
  return {
    workingState: validateWorkingState(result.parsed),
    provider: result.provider,
    model: result.model,
  };
}

export type { ConversationMessage };
