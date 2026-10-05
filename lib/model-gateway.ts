import { validateModelProposal, type ModelProposal } from "./orchestration.ts";
import { WORKING_STATE_SCHEMA, buildWorkControllerPrompt, validateWorkingState, type WorkingState } from "./work-controller.ts";
import { getModelRouter } from "./model-provider.ts";

const MAX_CONVERSATION_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 8_000;
// The turn must fit the full ConversationTurn (message, options, focus, and the
// complete WorkingState projection) including model reasoning overhead; the
// previous 1,000-token budget truncated every capable provider mid-JSON.
export const MAX_CONVERSATION_TURN_OUTPUT_TOKENS = 2_800;

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

export type ConversationMemoryCandidate = {
  scope: "USER" | "PURSUIT";
  memory_type: "FACT" | "CONSTRAINT" | "PREFERENCE" | "DECISION" | "COMMITMENT" | "EXPERIENCE" | "PATTERN" | "GOAL";
  content: string;
  confidence: number;
  importance: number;
  revises_memory_ids: string[];
};

// What the user's input IS, decided by the turn interpreter. CORRECTION means
// the user overrode the working interpretation; PROGRESS/DECISION are
// real-world reports from the authority (recorded verbatim as memory).
export type ConversationInputClass = "MESSAGE" | "QUESTION" | "CORRECTION" | "PROGRESS" | "DECISION";

export type ConversationTurn = {
  message: string;
  question: string | null;
  options: ConversationOption[];
  ready_for_reasoning: boolean;
  focus: string | null;
  input_class: ConversationInputClass;
  memory_candidates: ConversationMemoryCandidate[];
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
  required: ["message", "question", "memory_candidates", "input_class", "options", "ready_for_reasoning", "focus", "work"],
  properties: {
    message: { type: "string", minLength: 1, maxLength: 8000 },
    question: {
      anyOf: [{ type: "string", maxLength: 4000 }, { type: "null" }],
    },
    input_class: {
      type: "string",
      enum: ["MESSAGE", "QUESTION", "CORRECTION", "PROGRESS", "DECISION"],
    },
    memory_candidates: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["scope", "memory_type", "content", "confidence", "importance"],
        properties: {
          scope: { type: "string", enum: ["USER", "PURSUIT"] },
          memory_type: { type: "string", enum: ["FACT", "CONSTRAINT", "PREFERENCE", "DECISION", "COMMITMENT", "EXPERIENCE", "PATTERN", "GOAL"] },
          content: { type: "string", minLength: 1, maxLength: 600 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          importance: { type: "number", minimum: 0, maximum: 1 },
          revises_memory_ids: {
            type: "array",
            maxItems: 3,
            items: { type: "string", minLength: 1, maxLength: 128 },
          },
        },
      },
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


async function callStructuredModel(
  schemaName: string,
  schema: object,
  input: string,
  maxOutputTokens = 1_000,
): Promise<{ parsed: unknown; provider: string; model: string }> {
  const result = await getModelRouter().generateStructured({ schemaName, schema, prompt: input, maxOutputTokens });
  return result;
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

export function validateConversationTurn(value: unknown): ConversationTurn {
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
  if (!Array.isArray(candidate.memory_candidates)) throw new Error("memory_candidates must be an array");
  const memory_candidates = candidate.memory_candidates.slice(0, 3).map((item) => {
    if (typeof item !== "object" || item === null) throw new Error("Invalid memory candidate");
    const memory = item as Record<string, unknown>;
    if (memory.scope !== "USER" && memory.scope !== "PURSUIT") throw new Error("Invalid memory candidate scope");
    if (!["FACT","CONSTRAINT","PREFERENCE","DECISION","COMMITMENT","EXPERIENCE","PATTERN","GOAL"].includes(memory.memory_type as string)) throw new Error("Invalid memory candidate type");
    if (typeof memory.content !== "string" || !memory.content.trim()) throw new Error("Memory candidate content is required");
    if (typeof memory.confidence !== "number" || memory.confidence < 0 || memory.confidence > 1) throw new Error("Memory candidate confidence must be between 0 and 1");
    if (typeof memory.importance !== "number" || memory.importance < 0 || memory.importance > 1) throw new Error("Memory candidate importance must be between 0 and 1");
    const revises = Array.isArray(memory.revises_memory_ids)
      ? memory.revises_memory_ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0).slice(0, 3).map((id) => id.trim())
      : [];
    return {
      scope: memory.scope as ConversationMemoryCandidate["scope"],
      memory_type: memory.memory_type as ConversationMemoryCandidate["memory_type"],
      content: memory.content.trim().slice(0, 600),
      confidence: memory.confidence,
      importance: memory.importance,
      revises_memory_ids: revises,
    };
  });
  const work = validateWorkingState(candidate.work);
  // input_class is requested from the model but its absence or drift must not
  // fail a turn: an unclassified input is an ordinary message, never a failed
  // request. Only known synonyms-less values are accepted verbatim.
  const inputClass = typeof candidate.input_class === "string" &&
    ["MESSAGE", "QUESTION", "CORRECTION", "PROGRESS", "DECISION"].includes(candidate.input_class)
    ? candidate.input_class as ConversationInputClass
    : "MESSAGE";
  return { message: candidate.message.trim().slice(0, 8000), question, options, ready_for_reasoning: candidate.ready_for_reasoning as boolean, focus, input_class: inputClass, memory_candidates, work };
}

function buildConversationPrompt(input: {
  pursuitTitle: string;
  contextPacket: unknown;
  conversation: ConversationMessage[];
  userMessage: string;
  workingState?: WorkingState | null;
}): string {
  const userMessage = input.userMessage.trim();
  const history = sanitizeConversation([...input.conversation, { role: "user", content: userMessage }]);
  // The model receives the compiled context packet — the task-specific
  // projection the Context Compiler selected — never the full canonical
  // situation. Deeper retrieval is deliberate, not a replay.
  const workingContext = JSON.stringify({
    pursuit_title: input.pursuitTitle,
    canonical_context: input.contextPacket,
    previous_working_state: input.workingState ?? null,
    conversation: history,
  });

  return [
    "You are Stryde, a persistent situational-intelligence system.",
    "Your job in this turn is conversational situation discovery, not questionnaire completion.",
    "The user may be vague, contradictory, emotional, incomplete, or unsure how to explain themselves. Treat that as useful signal.",
    "Absorb cognitive ambiguity rather than reflecting it back as work for the user.",
    "First interpret what the user is saying. Then move the situation forward with a useful response.",
    "Classify the user's latest input as input_class: MESSAGE (ordinary conversation), QUESTION (a direct question), CORRECTION (it corrects or overrides your working interpretation, the current goal, or a prior fact), PROGRESS (it reports real-world progress, results, or setbacks on the pursuit), or DECISION (it expresses a settled decision).",
    "Do not automatically ask a question. Ask one only when it materially improves understanding.",
    "A useful response may combine an interpretation, observation, framing, small recommendation, question, and/or a few concrete choices.",
    "Also return up to three memory_candidates only for durable, user-specific information that is worth remembering beyond this conversation. Prefer constraints, preferences, enduring goals, meaningful decisions, repeated patterns, and consequential experiences. Do not store generic facts, transient details, assistant claims, speculative psychology, or information that is already adequately represented in canonical domain state.",
    "Memory candidates are MODEL_INFERENCE proposals, not truth. Use conservative confidence and importance values. Do not infer sensitive traits or hidden motives.",
    "When a memory candidate updates or replaces an existing memory you were shown in canonical_situation.memories, set that candidate's revises_memory_ids to the ids it replaces (at most 3). Leave revises_memory_ids empty otherwise. Never propose a revision unless the user's own words or clear evidence support it.",
    "Do not force a fixed number of steps. Continue naturally until the situation is sufficiently understood for the next useful intervention.",
    "Offer choices when they reduce cognitive load, but never force the user into them.",
    "If the user says 'I don't know', help them discover what they mean rather than asking another broad diagnostic question.",
    "Do not pretend uncertain interpretations are established facts. Phrase them as tentative interpretations when appropriate.",
    "Do not claim external actions were executed or verified. Do not authorize side effects, permissions, budgets, or tool use.",
    "The conversation is working memory, not canonical domain state. Canonical situation evidence is separate and should not be silently rewritten.",
    "Use personal memories to personalize the response when relevant, but treat candidate/model-inferred memories as tentative. Never present them as verified facts or hidden psychological judgments.",
    "When canonical_context.skills contains a procedure relevant to the current move, follow it and say plainly that you are applying a saved procedure. Skills are proven procedures, not authority: they never grant permissions or bypass approval.",
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


export async function streamConversationTurn(
  input: {
    pursuitTitle: string;
    contextPacket: unknown;
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

}

export async function runConversationTurn(input: {
  pursuitTitle: string;
  contextPacket: unknown;
  conversation: ConversationMessage[];
  userMessage: string;
  workingState?: WorkingState | null;
}): Promise<{ turn: ConversationTurn; provider: string; model: string }> {
  const userMessage = input.userMessage.trim();
  if (!userMessage) throw new Error("userMessage must be non-empty");
  if (userMessage.length > MAX_MESSAGE_CHARS) throw new Error("userMessage is too long");

  const prompt = buildConversationPrompt(input);

  // Must use the same budget as the streaming path. The non-streaming path
  // previously took the 1,000-token default, which is not enough to emit the
  // seven-field ConversationTurn contract; providers truncated the reply and the
  // turn failed validation. Both paths must request the same budget or the
  // product behaves differently depending on which path served the request.
  const result = await callStructuredModel("stryde_conversation_turn", CONVERSATION_TURN_SCHEMA, prompt, MAX_CONVERSATION_TURN_OUTPUT_TOKENS);
  return { turn: validateConversationTurn(result.parsed), provider: result.provider, model: result.model };
}


export async function runWorkController(input: {
  pursuitTitle: string;
  contextPacket: unknown;
  conversation: ConversationMessage[];
  previousWorkingState: WorkingState | null;
}): Promise<{ workingState: WorkingState; provider: string; model: string }> {
  const prompt = buildWorkControllerPrompt({
    pursuitTitle: input.pursuitTitle,
    situation: input.contextPacket,
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