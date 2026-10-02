import { ACTOR_TYPES, normalizeActor, normalizeWorkerType, WORKER_TYPES, type ActorType, type WorkerType } from "./actor.ts";

export const WORK_MODES = [
  "ASK_USER",
  "RESEARCH_WEB",
  "RETRIEVE_SOURCE",
  "ANALYZE",
  "DRAFT",
  "DECIDE",
  "CREATE_ACTION",
  "EXECUTE_TOOL",
  "WAIT",
  "RECHECK",
  "STOP",
] as const;

export type WorkMode = (typeof WORK_MODES)[number];

export const WORK_STATUSES = [
  "DISCOVERING",
  "READY",
  "WAITING_USER",
  "WORKING",
  "WAITING_EXTERNAL",
  "COMPLETE",
  "STALLED",
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

export const AVAILABLE_WORK_MODES = [
  "ASK_USER",
  "ANALYZE",
  "DRAFT",
  "DECIDE",
  "WAIT",
  "RECHECK",
  "STOP",
] as const;

export type NextMove = {
  mode: WorkMode;
  actor: ActorType;
  worker_type: WorkerType | null;
  title: string;
  why: string;
  expected_change: string;
  stryde_can_do: string;
  user_needs_to_do: string;
  completion_condition: string;
};

export type WorkingState = {
  version: 1;
  status: WorkStatus;
  objective: string | null;
  understanding: string;
  known: string[];
  unknowns: string[];
  bottleneck: string | null;
  next_move: NextMove | null;
};

const MAX_TEXT = 2_000;
const MAX_ITEMS = 8;

export const WORKING_STATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "status",
    "objective",
    "understanding",
    "known",
    "unknowns",
    "bottleneck",
    "next_move",
  ],
  properties: {
    version: { type: "integer", enum: [1] },
    status: {
      type: "string",
      enum: WORK_STATUSES,
    },
    objective: {
      anyOf: [{ type: "string", maxLength: MAX_TEXT }, { type: "null" }],
    },
    understanding: { type: "string", minLength: 1, maxLength: MAX_TEXT },
    known: {
      type: "array",
      maxItems: MAX_ITEMS,
      items: { type: "string", minLength: 1, maxLength: MAX_TEXT },
    },
    unknowns: {
      type: "array",
      maxItems: MAX_ITEMS,
      items: { type: "string", minLength: 1, maxLength: MAX_TEXT },
    },
    bottleneck: {
      anyOf: [{ type: "string", maxLength: MAX_TEXT }, { type: "null" }],
    },
    next_move: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: [
            "mode",
            "actor",
            "worker_type",
            "title",
            "why",
            "expected_change",
            "stryde_can_do",
            "user_needs_to_do",
            "completion_condition",
          ],
          properties: {
            mode: { type: "string", enum: WORK_MODES },
            actor: { type: "string", enum: ACTOR_TYPES },
            worker_type: { anyOf: [{ type: "string", enum: WORKER_TYPES }, { type: "null" }] },
            title: { type: "string", minLength: 1, maxLength: 300 },
            why: { type: "string", minLength: 1, maxLength: MAX_TEXT },
            expected_change: { type: "string", minLength: 1, maxLength: MAX_TEXT },
            stryde_can_do: { type: "string", minLength: 1, maxLength: MAX_TEXT },
            user_needs_to_do: { type: "string", minLength: 1, maxLength: MAX_TEXT },
            completion_condition: { type: "string", minLength: 1, maxLength: MAX_TEXT },
          },
        },
        { type: "null" },
      ],
    },
  },
} as const;

function text(value: unknown, field: string, max = MAX_TEXT): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} must be non-empty`);
  if (normalized.length > max) throw new Error(`${field} is too long`);
  return normalized;
}

function optionalText(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`${field} must be a string or null`);
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > MAX_TEXT) throw new Error(`${field} is too long`);
  return normalized;
}

function items(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value.slice(0, MAX_ITEMS).map((item, index) => text(item, `${field}[${index}]`));
}

export function validateWorkingState(value: unknown): WorkingState {
  if (typeof value !== "object" || value === null) {
    throw new Error("Working state must be an object");
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1) throw new Error("Working state version must be 1");

  const rawStatus = candidate.status;
  if (!WORK_STATUSES.includes(rawStatus as WorkStatus)) {
    throw new Error("Invalid working state status");
  }
  const status = rawStatus as WorkStatus;

  const objective = optionalText(candidate.objective, "objective");
  const understanding = text(candidate.understanding, "understanding");
  const known = items(candidate.known, "known");
  const unknowns = items(candidate.unknowns, "unknowns");
  const bottleneck = optionalText(candidate.bottleneck, "bottleneck");

  let next_move: NextMove | null = null;
  if (candidate.next_move !== null && candidate.next_move !== undefined) {
    if (typeof candidate.next_move !== "object") throw new Error("next_move must be an object or null");
    const move = candidate.next_move as Record<string, unknown>;
    if (!WORK_MODES.includes(move.mode as WorkMode)) throw new Error("Invalid next move mode");
    if (!AVAILABLE_WORK_MODES.includes(move.mode as (typeof AVAILABLE_WORK_MODES)[number])) {
      throw new Error("Requested work mode is not currently available");
    }
    const actor = normalizeActor(move.mode as WorkMode, move.actor);
    const worker_type = normalizeWorkerType(actor, move.worker_type);
    if (actor === "WORKER" && !worker_type) {
      throw new Error("WORKER next move requires worker_type");
    }
    next_move = {
      mode: move.mode as WorkMode,
      actor,
      worker_type,
      title: text(move.title, "next_move.title", 300),
      why: text(move.why, "next_move.why"),
      expected_change: text(move.expected_change, "next_move.expected_change"),
      stryde_can_do: text(move.stryde_can_do, "next_move.stryde_can_do"),
      user_needs_to_do: text(move.user_needs_to_do, "next_move.user_needs_to_do"),
      completion_condition: text(move.completion_condition, "next_move.completion_condition"),
    };
  }

  if (status === "COMPLETE" && next_move) {
    throw new Error("Complete working state cannot have a next move");
  }
  if (next_move?.mode === "STOP" && status !== "COMPLETE") {
    throw new Error("STOP is only valid for a complete working state");
  }
  if (status !== "COMPLETE" && status !== "STALLED" && !next_move) {
    throw new Error("Active working state requires a next move");
  }

  return {
    version: 1,
    status,
    objective,
    understanding,
    known,
    unknowns,
    bottleneck,
    next_move,
  };
}

export function buildWorkControllerPrompt(input: {
  pursuitTitle: string;
  situation: unknown;
  conversation: Array<{ role: "user" | "stryde"; content: string }>;
  previousWorkingState: WorkingState | null;
}): string {
  const boundedConversation = input.conversation
    .slice(-16)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 8_000),
    }))
    .filter((item) => item.content.length > 0);

  return [
    "You are Stryde's Work Controller.",
    "Your job is to keep working a real situation, not to produce a static situation analysis.",
    "At every turn, maintain a working hypothesis about the situation and choose the smallest useful next move.",
    "The user's effort is scarce. Ask for information only when Stryde cannot obtain or infer it from the supplied context.",
    "When the next move can be done without the user, prefer doing or preparing that work rather than asking them a broad question.",
    "When the next move requires the user's real-world action, state exactly what they need to do and why it matters.",
    "Every next move must allocate exactly one actor: HUMAN, STRYDE, WORKER, or CONTROLLED_TOOL. Use HUMAN for user-controlled real-world work or targeted user input; use STRYDE for work performed inside Stryde; use WORKER only when an active worker capability is present in the supplied situation; use CONTROLLED_TOOL only when a registered and authorized capability is present.",
    "Separate established facts from uncertainty. Never promote a user hypothesis, example, wish, or suggestion into a fact.",
    "Never invent quantities, stakeholder agreement, access, dates, experiments, customers, outcomes, benchmarks, or success metrics.",
    "Unknowns are useful state. If a missing fact blocks progress, make resolving that fact the next move.",
    "A bottleneck is the most important current constraint or blocking uncertainty, not a generic diagnosis.",
    "The objective may be tentative if the user's goal is unclear. Do not force false precision.",
    "The previous working state is a hypothesis, not canonical truth. Correct it when the latest user message or canonical situation changes it.",
    "The canonical situation is authoritative for durable domain facts; conversation is working context.",
    "The episodic_memory field contains excerpts from prior pursuit conversations. Use it for continuity and unresolved context, but treat prior Stryde messages as hypotheses rather than canonical facts.",
    "The memories field contains personal/pursuit memory records. CANDIDATE and MODEL_INFERENCE memories are hypotheses, not canonical facts; prefer verified/observed evidence and never silently upgrade a memory's authority.",
    "Do not claim Stryde performed external work unless the supplied runtime capabilities explicitly prove it.",
    "Do not claim a web page, YouTube video, email, spreadsheet, API, or other source was fetched unless its contents are actually supplied.",
    "Worker execution is available only through an explicitly granted worker capability. Never assume a worker exists when available worker capabilities are absent from the supplied situation.",
    "Use RECHECK when the next move is to inspect the result of something the user has already done or reported.",
    "Prefer a single next move. Do not expose a multi-step roadmap as the current move.",
    "The user should be able to answer your next move simply by continuing the conversation.",
    "Return JSON only matching the WorkingState contract.",
    "",
    `PURSUIT_TITLE: ${input.pursuitTitle}`,
    `CANONICAL_SITUATION: ${JSON.stringify(input.situation)}`,
    `PREVIOUS_WORKING_STATE: ${JSON.stringify(input.previousWorkingState)}`,
    `CONVERSATION: ${JSON.stringify(boundedConversation)}`,
  ].join("\n");
}