import { WORK_STATUSES } from "./work-controller.ts";

// Model output is a proposal, never canonical state. A provider that drops an
// enum (the Gemini REST API rejects non-string enums, so geminiSchema removes
// them) will occasionally emit a status or mode outside the allowed set. Those
// fields are presentation/coordination fields, not user authority and not
// durable fact, so a drifted value is repaired to the closest safe meaning
// instead of discarding an otherwise valid proposal. Anything that would
// change what the user is asked to do is still validated strictly below.
const STATUS_ALIASES: Record<string, (typeof WORK_STATUSES)[number]> = {
  INITIAL: "DISCOVERING",
  NEW: "DISCOVERING",
  DISCOVER: "DISCOVERING",
  PLANNING: "DISCOVERING",
  IN_PROGRESS: "WORKING",
  INPROGRESS: "WORKING",
  ACTIVE: "WORKING",
  DOING: "WORKING",
  RUNNING: "WORKING",
  WAITING: "WAITING_EXTERNAL",
  BLOCKED: "STALLED",
  PAUSED: "STALLED",
  STUCK: "STALLED",
  DONE: "COMPLETE",
  COMPLETED: "COMPLETE",
  FINISHED: "COMPLETE",
  AWAITING_USER: "WAITING_USER",
  NEEDS_USER: "WAITING_USER",
};

// Accepts either a WorkStatus or a mode/actor synonym and returns the canonical
// value, or undefined when the value cannot be safely mapped. Callers treat
// undefined as invalid rather than guessing.
export function normalizeWorkStatus(value: unknown): (typeof WORK_STATUSES)[number] | undefined {
  if (typeof value !== "string") return undefined;
  const upper = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!upper) return undefined;
  if ((WORK_STATUSES as readonly string[]).includes(upper)) return upper as (typeof WORK_STATUSES)[number];
  return STATUS_ALIASES[upper];
}

