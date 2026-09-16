import { validateModelProposal, type ModelProposal } from "@/lib/orchestration";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";
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
    diagnosis: { type: ["string", "null"], maxLength: 8000 },
    intervention: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["kind", "rationale"],
      properties: {
        kind: {
          type: "string",
          enum: ["ANSWER", "DECISION", "HUMAN_ACTION", "CONTROLLED_ACTION", "WAIT"],
        },
        rationale: { type: "string", minLength: 1, maxLength: 8000 },
      },
    },
    proposed_response: { type: ["string", "null"], maxLength: 8000 },
  },
} as const;

const CONVERSATION_TURN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["message", "question", "options", "ready_for_reasoning", "focus"],
  properties: {
    message: { type: "string", minLength: 1, maxLength: 8000 },
    question: { type: ["string", "null"], maxLength: 4000 },
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
    focus: { type: ["string", "null"], maxLength: 2000 },
  },
} as const;

function extractResponseText(response: unknown): string {
  if (typeof response !== "object" || response === null) {
    throw new Error("Model returned an invalid response envelope");
  }

  const candidate = response as { output?: unknown };
  if (!Array.isArray(candidate.output)) {
    throw new Error("Model response is missing output");
  }

  const chunks: string[] = [];
  for (const item of candidate.output) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) chunks.push(text);
    }
  }

  const text = chunks.join("\n").trim();
  if (!text) throw new Error("Model returned no text output");
  if (text.length > MAX_OUTPUT_CHARS) throw new Error("Model output exceeded the allowed size");
  return text;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Model returned non-JSON structured output");
  }
}

function getModelConfig() {
  const provider = (process.env.STRYDE_MODEL_PROVIDER ?? "openai").trim().toLowerCase();
  if (provider !== "openai") {
    throw new Error(`Unsupported STRYDE_MODEL_PROVIDER: ${provider}`);
  }

  const apiKey = (process.env.STRYDE_MODEL_API_KEY ?? process.env.OPENAI_API_KEY)?.trim();
  if (!apiKey) throw new Error("Missing model configuration: STRYDE_MODEL_API_KEY");

  const baseUrl = (process.env.STRYDE_MODEL_BASE_URL ?? DEFAULT_OPENAI_BASE_URL).replace(/\/$/, "");
  const model = (process.env.STRYDE_MODEL_NAME ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL).trim();
  if (!model) throw new Error("Missing model configuration: STRYDE_MODEL_NAME");

  return { provider, apiKey, baseUrl, model };
}

async function callStructuredModel(
  schemaName: string,
  schema: object,
  input: string,
): Promise<{ parsed: unknown; provider: string; model: string }> {
  const { provider, apiKey, baseUrl, model } = getModelConfig();

  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input,
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    throw new Error(`Model request failed (${response.status}): ${detail}`);
  }

  const envelope: unknown = await response.json();
  const text = extractResponseText(envelope);
  return { parsed: parseJson(text), provider, model };
}

export async function runModelProposal(prompt: string): Promise<ModelGatewayResult> {
  const result = await callStructuredModel("stryde_model_proposal", MODEL_PROPOSAL_SCHEMA, prompt);
  return {
    proposal: validateModelProposal(result.parsed),
    provider: result.provider,
    model: result.model,
  };
}

function sanitizeConversation(messages: ConversationMessage[]): ConversationMessage[] {
  return messages
    .slice(-MAX_CONVERSATION_MESSAGES)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((item) => item.content.length > 0);
}

function validateConversationTurn(value: unknown): ConversationTurn {
  if (typeof value !== "object" || value === null) throw new Error("Conversation turn must be an object");
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.message !== "string" || !candidate.message.trim()) throw new Error("Conversation message is required");
  if (candidate.message.length > 8000) throw new Error("Conversation message is too long");

  const question = candidate.question === null || candidate.question === undefined
    ? null
    : typeof candidate.question === "string" && candidate.question.trim()
      ? candidate.question.trim().slice(0, 4000)
      : null;

  if (!Array.isArray(candidate.options)) throw new Error("Conversation options must be an array");
  const options = candidate.options.slice(0, 5).map((option) => {
    if (typeof option !== "object" || option === null) throw new Error("Invalid conversation option");
    const item = option as Record<string, unknown>;
    if (typeof item.label !== "string" || !item.label.trim()) throw new Error("Conversation option label is required");
    if (typeof item.value !== "string" || !item.value.trim()) throw new Error("Conversation option value is required");
    return { label: item.label.trim().slice(0, 300), value: item.value.trim().slice(0, 1000) };
  });

  if (typeof candidate.ready_for_reasoning !== "boolean") throw new Error("ready_for_reasoning must be boolean");
  const focus = candidate.focus === null || candidate.focus === undefined
    ? null
    : typeof candidate.focus === "string" && candidate.focus.trim()
      ? candidate.focus.trim().slice(0, 2000)
      : null;

  return {
    message: candidate.message.trim(),
    question,
    options,
    ready_for_reasoning: candidate.ready_for_reasoning,
    focus,
  };
}

export async function runConversationTurn(input: {
  pursuitTitle: string;
  situation: unknown;
  conversation: ConversationMessage[];
  userMessage: string;
}): Promise<{ turn: ConversationTurn; provider: string; model: string }> {
  const userMessage = input.userMessage.trim();
  if (!userMessage) throw new Error("userMessage must be non-empty");
  if (userMessage.length > MAX_MESSAGE_CHARS) throw new Error("userMessage is too long");

  const history = sanitizeConversation([
    ...input.conversation,
    { role: "user", content: userMessage },
  ]);

  const workingContext = JSON.stringify({
    pursuit_title: input.pursuitTitle,
    canonical_situation: input.situation,
    conversation: history,
  });

  const prompt = [
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
    "Return structured JSON only matching the ConversationTurn contract.",
    "Set ready_for_reasoning=true only when there is enough understanding to run the canonical reasoning kernel without inventing missing facts.",
    "If ready_for_reasoning=true, message should briefly summarize the current understanding and what Stryde is ready to work on.",
    "",
    `WORKING_CONTEXT: ${workingContext}`,
  ].join("\n");

  const result = await callStructuredModel("stryde_conversation_turn", CONVERSATION_TURN_SCHEMA, prompt);
  return {
    turn: validateConversationTurn(result.parsed),
    provider: result.provider,
    model: result.model,
  };
}

export type { ConversationMessage };
