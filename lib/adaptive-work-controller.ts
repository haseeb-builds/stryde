import { ACTOR_TYPES, normalizeActor, normalizeWorkerType, WORKER_TYPES } from "@/lib/actor";
import { WORK_STATUSES, type NextMove, type WorkingState } from "@/lib/work-controller";

export const ADAPTIVE_WORK_MODES = [
  "ASK_USER",
  "ANALYZE",
  "DRAFT",
  "DECIDE",
  "CREATE_ACTION",
  "WAIT",
  "RECHECK",
  "STOP",
] as const;

export type AdaptiveWorkMode = (typeof ADAPTIVE_WORK_MODES)[number];

const MAX_TEXT = 2_000;
const MAX_ITEMS = 8;

export const ADAPTIVE_WORKING_STATE_SCHEMA = {
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
    status: { type: "string", enum: WORK_STATUSES },
    objective: { anyOf: [{ type: "string", maxLength: MAX_TEXT }, { type: "null" }] },
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
    bottleneck: { anyOf: [{ type: "string", maxLength: MAX_TEXT }, { type: "null" }] },
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
            mode: { type: "string", enum: ADAPTIVE_WORK_MODES },
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

export function validateAdaptiveWorkingState(value: unknown): WorkingState {
  const state = validateWorkingStateShape(value);
  if (state.next_move && !ADAPTIVE_WORK_MODES.includes(state.next_move.mode as AdaptiveWorkMode)) {
    throw new Error("Requested adaptive work mode is not enabled");
  }
  return state;
}

function validateWorkingStateShape(value: unknown): WorkingState {
  if (typeof value !== "object" || value === null) throw new Error("Working state must be an object");
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1) throw new Error("Working state version must be 1");
  if (!WORK_STATUSES.includes(candidate.status as WorkingState["status"])) {
    throw new Error("Invalid working state status");
  }

  const readText = (value: unknown, field: string, max = MAX_TEXT) => {
    if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be non-empty`);
    const normalized = value.trim();
    if (normalized.length > max) throw new Error(`${field} is too long`);
    return normalized;
  };
  const optionalText = (value: unknown, field: string) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") throw new Error(`${field} must be a string or null`);
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > MAX_TEXT) throw new Error(`${field} is too long`);
    return normalized;
  };
  const arrayText = (value: unknown, field: string) => {
    if (!Array.isArray(value) || value.length > MAX_ITEMS) throw new Error(`${field} must be an array`);
    return value.map((item, index) => readText(item, `${field}[${index}]`));
  };

  const objective = optionalText(candidate.objective, "objective");
  const understanding = readText(candidate.understanding, "understanding");
  const known = arrayText(candidate.known, "known");
  const unknowns = arrayText(candidate.unknowns, "unknowns");
  const bottleneck = optionalText(candidate.bottleneck, "bottleneck");

  let next_move: NextMove | null = null;
  if (candidate.next_move !== null && candidate.next_move !== undefined) {
    if (typeof candidate.next_move !== "object") throw new Error("next_move must be an object or null");
    const move = candidate.next_move as Record<string, unknown>;
    const mode = typeof move.mode === "string" ? move.mode : "";
    if (!ADAPTIVE_WORK_MODES.includes(mode as AdaptiveWorkMode)) {
      throw new Error("Requested adaptive work mode is not enabled");
    }
    const actor = normalizeActor(mode, move.actor);
    const worker_type = normalizeWorkerType(actor, move.worker_type);
    if (actor === "WORKER" && !worker_type) {
      throw new Error("WORKER next move requires worker_type");
    }
    next_move = {
      mode: mode as NextMove["mode"],
      actor,
      worker_type,
      title: readText(move.title, "next_move.title", 300),
      why: readText(move.why, "next_move.why"),
      expected_change: readText(move.expected_change, "next_move.expected_change"),
      stryde_can_do: readText(move.stryde_can_do, "next_move.stryde_can_do"),
      user_needs_to_do: readText(move.user_needs_to_do, "next_move.user_needs_to_do"),
      completion_condition: readText(move.completion_condition, "next_move.completion_condition"),
    };
  }

  if (candidate.status === "COMPLETE" && next_move) throw new Error("Complete working state cannot have a next move");
  if (next_move?.mode === "STOP" && candidate.status !== "COMPLETE") throw new Error("STOP is only valid for COMPLETE");
  if (candidate.status !== "COMPLETE" && candidate.status !== "STALLED" && !next_move) {
    throw new Error("Active working state requires a next move");
  }

  return { version: 1, status: candidate.status as WorkingState["status"], objective, understanding, known, unknowns, bottleneck, next_move };
}

export function buildAdaptiveWorkControllerPrompt(input: {
  pursuitTitle: string;
  situation: unknown;
  conversation: Array<{ role: "user" | "stryde"; content: string }>;
  previousWorkingState: WorkingState | null;
}) {
  const boundedConversation = input.conversation
    .slice(-16)
    .map((item) => ({ role: item.role, content: item.content.trim().slice(0, 8_000) }))
    .filter((item) => item.content.length > 0);

  return [
    "You are Stryde's Adaptive Work Controller.",
    "Your job is to continuously turn a real goal/problem plus external source material and reality feedback into the smallest executable next move.",
    "A source is evidence or a candidate method, not canonical truth. Never treat a source promise as an achieved outcome.",
    "Preserve source provenance in your understanding. Distinguish what the source explicitly says from what you infer.",
    "Adapt source methods to the user's actual situation, resources, skills, constraints, decisions, prior actions, and observed results.",
    "Do not copy a course or roadmap blindly. Identify prerequisites, assumptions, gaps, conflicts, and what must be learned by doing.",
    "The objective may be tentative. A goal candidate becomes canonical only after the user explicitly adopts it.",
    "Reality feedback outranks an unsupported source assumption. When evidence conflicts with the source, preserve the conflict and adapt the approach.",
    "User effort is scarce. Prefer work Stryde can do internally before asking the user for information or action.",
    "The episodic_memory field contains excerpts from prior pursuit conversations. Use it for continuity and unresolved context, but treat prior Stryde messages as hypotheses rather than canonical facts.",
    "The memories field contains personal/pursuit memory records. CANDIDATE and MODEL_INFERENCE memories are hypotheses, not canonical facts; prefer verified/observed evidence and never silently upgrade a memory's authority.",
    "Every next move has an actor allocation: HUMAN, STRYDE, WORKER, or CONTROLLED_TOOL. Use WORKER only when the supplied situation shows an active worker capability, and include its worker_type. Do not allocate a worker merely because delegation sounds useful.",
    "Never select EXECUTE_TOOL or RESEARCH_WEB unless the supplied runtime explicitly exposes those capabilities. Worker delegation is separate from CONTROLLED_TOOL execution.",
    "Never invent quantities, stakeholders, dates, customers, experiments, conversion rates, revenue, benchmarks, or outcomes.",
    "Sources are retrieved through the source-ingestion pathway; the controller must not claim it can fetch new sources in this runtime. For FAILED or UNSUPPORTED sources, choose ASK_USER and ask for usable material.",
    "Use RECHECK after an action/result exists and the next move is to reassess what reality says.",
    "Exactly one current next move. Do not expose a giant roadmap as the UI. You may use the source's sequence internally, but the user sees the next move.",
    "Return JSON only matching the WorkingState contract.",
    "",
    `PURSUIT_TITLE: ${input.pursuitTitle}`,
    `CANONICAL_AND_SOURCE_SITUATION: ${JSON.stringify(input.situation)}`,
    `PREVIOUS_WORKING_STATE: ${JSON.stringify(input.previousWorkingState)}`,
    `CONVERSATION: ${JSON.stringify(boundedConversation)}`,
  ].join("\n");
}