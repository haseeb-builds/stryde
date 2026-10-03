import { createHash } from "node:crypto";

// Proactive continuity, planning half. This module is pure: no database, no
// model, no environment. It decides WHO should be nudged and WHAT the nudge
// says; app/api/cron/continuity/route.ts owns every read and write.
//
// Authority rules (see docs/DECISIONS.md D3): a cron has no user session, so a
// nudge is only ever a SYSTEM-authored message in the pursuit's existing
// conversation. It never changes working_state and never creates or resolves
// Actions, Decisions, Claims, or capability grants.

// An IN_PROGRESS/WAITING_EXTERNAL task older than this is "stale in flight".
export const STALE_ACTION_MS = 48 * 60 * 60 * 1000;

// A conversation with no messages for this long is "idle" and fair game for a
// nudge, as long as its next move is not terminal.
export const IDLE_SESSION_MS = 3 * 24 * 60 * 60 * 1000;

// At most one nudge per pursuit per this window, regardless of which rule
// wants to fire.
export const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// How far back the cron looks for earlier nudges when feeding the cooldown.
// Strictly a query window: any earlier nudge is older than the cooldown anyway.
export const NUDGE_MARKER_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

// Nudge messages carry this marker in conversation_message.metadata so later
// runs can find them. The logical turn key itself cannot be matched by prefix
// in SQL: the physical turn_key column is a uuid (see migration
// 20260926180000_conversation_server_owned_idempotency.sql), so the readable
// key lives here.
export const NUDGE_MARKER_KIND = "continuity_nudge";

// Working-state statuses that mean the pursuit is closed out or stuck beyond a
// nudge's help. Mirrors lib/work-controller.ts WorkStatus.
const TERMINAL_WORKING_STATUSES = new Set(["COMPLETE", "STALLED"]);

// Next-move modes that mean there is nothing to continue. DONE/FAILED are
// kept for forward compatibility; the live ontology (WORK_MODES in
// lib/work-controller.ts) has neither today. STOP is deliberately NOT here: a
// stopped pursuit is exactly the kind a person may want to be asked about.
const TERMINAL_NEXT_MOVE_MODES = new Set(["DONE", "FAILED"]);

// The action statuses a nudge may reference as "in flight". WAITING_EXTERNAL
// is not a legal value of action.status today (the column check allows only
// PROPOSED/IN_PROGRESS/COMPLETED/FAILED/CANCELLED), but external waiting is
// expressible through the working state and future migrations may widen the
// check; planning on it costs nothing and the route filter is harmless.
export const NUDGEABLE_ACTION_STATUSES = ["IN_PROGRESS", "WAITING_EXTERNAL"] as const;

export type ContinuityAction = {
  id: string;
  pursuitId: string;
  kind: "HUMAN" | "CONTROLLED";
  status: string;
  startedAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

export type ContinuityNextMove = {
  mode?: string | null;
  actor?: string | null;
  title?: string | null;
};

export type ContinuityWorkingState = {
  status?: string | null;
  next_move?: ContinuityNextMove | null;
} | null;

export type ContinuitySession = {
  id: string;
  pursuitId: string;
  lastMessageAt: string | Date | null;
  workingState: ContinuityWorkingState;
};

export type ContinuityRecentNudge = {
  pursuitId: string;
  createdAt: string | Date;
};

export type ContinuityNudgePlan = {
  pursuitId: string;
  sessionId: string;
  turnKey: string;
  message: string;
};

export type ContinuityPlanningInput = {
  now: Date;
  actions: ContinuityAction[];
  sessions: ContinuitySession[];
  recentNudges: ContinuityRecentNudge[];
};

function toTime(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function utcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

// Deterministic per pursuit per day so a re-run of the same cron day cannot
// double-post: the physical turn_key column carries a per-session uniqueness
// guarantee for STRYDE rows (conversation_message_assistant_turn_key_idx).
export function continuityTurnKey(pursuitId: string, now: Date): string {
  return `continuity-${utcDateKey(now)}-${pursuitId}`;
}

// The turn_key column is uuid, not text, so the readable key from
// continuityTurnKey() must be mapped onto a uuid to be persisted. The mapping
// is UUIDv5 (SHA-1, RFC 4122 section 4.3) over a fixed Stryde namespace:
// same logical key in, same uuid out, forever.
const CONTINUITY_TURN_KEY_NAMESPACE = "9e58f6aa-3d1e-4f27-9a4c-5b2d8e7f1a30";

function uuidStringToBytes(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, "");
  return Buffer.from(hex, "hex");
}

export function continuityTurnKeyToUuid(turnKey: string): string {
  const digest = createHash("sha1")
    .update(uuidStringToBytes(CONTINUITY_TURN_KEY_NAMESPACE))
    .update(turnKey, "utf8")
    .digest();
  digest[6] = (digest[6] & 0x0f) | 0x50; // version 5
  digest[8] = (digest[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = digest.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function isTerminalNextMove(mode: string | null | undefined): boolean {
  return typeof mode === "string" && TERMINAL_NEXT_MOVE_MODES.has(mode.toUpperCase());
}

function isTerminalWorkingState(workingState: ContinuityWorkingState): boolean {
  if (!workingState) return false;
  if (typeof workingState.status === "string" && TERMINAL_WORKING_STATUSES.has(workingState.status)) {
    return true;
  }
  return isTerminalNextMove(workingState.next_move?.mode);
}

function isWaitingExternalWorkingState(workingState: ContinuityWorkingState): boolean {
  return workingState?.status === "WAITING_EXTERNAL";
}

// Plain words only. No internal ontology nouns: the person reading this in
// their conversation should never see "pursuit", "action", "claim", "decision",
// "job", "worker", "run", "observation", or "capability".
function staleActionMessage(kind: ContinuityAction["kind"]): string {
  if (kind === "CONTROLLED") {
    return "Hey — the thing we set in motion a couple of days ago is still open. Want us to keep going with it, adjust course, or wrap it up?";
  }
  return "Hey — the thing on your plate has been sitting for a couple of days. Still worth doing? We can keep it, tweak it, or let it go.";
}

function idleSessionMessage(workingState: ContinuityWorkingState): string {
  const title = workingState?.next_move?.title;
  if (typeof title === "string" && title.trim().length > 0) {
    return `It's been a few quiet days. Next up was "${title.trim()}" — want to pick that up, adjust it, or set it aside?`;
  }
  return "It's been a few quiet days here. Want to pick this back up, adjust the plan, or close it out?";
}

export function planContinuityNudges(input: ContinuityPlanningInput): ContinuityNudgePlan[] {
  const now = input.now.getTime();

  // One ACTIVE conversation per pursuit is a database invariant
  // (conversation_session_one_active_idx), but plan defensively: if the input
  // ever carries two, prefer the most recently used one, tie-break by id.
  const sessionByPursuit = new Map<string, ContinuitySession>();
  for (const session of input.sessions) {
    const existing = sessionByPursuit.get(session.pursuitId);
    if (!existing) {
      sessionByPursuit.set(session.pursuitId, session);
      continue;
    }
    const existingTime = toTime(existing.lastMessageAt) ?? Number.NEGATIVE_INFINITY;
    const candidateTime = toTime(session.lastMessageAt) ?? Number.NEGATIVE_INFINITY;
    if (candidateTime > existingTime || (candidateTime === existingTime && session.id < existing.id)) {
      sessionByPursuit.set(session.pursuitId, session);
    }
  }

  // Latest nudge per pursuit inside the cooldown window.
  const lastNudgeAt = new Map<string, number>();
  for (const nudge of input.recentNudges) {
    const time = toTime(nudge.createdAt);
    if (time === null) continue;
    const current = lastNudgeAt.get(nudge.pursuitId);
    if (current === undefined || time > current) lastNudgeAt.set(nudge.pursuitId, time);
  }

  const isCoolingDown = (pursuitId: string): boolean => {
    const last = lastNudgeAt.get(pursuitId);
    return last !== undefined && now - last < NUDGE_COOLDOWN_MS;
  };

  // Rule (a): a stale in-flight task on a pursuit that has a live conversation.
  // Rule (b) never fires for these pursuits: one nudge max per pursuit per run.
  const staleByPursuit = new Map<string, ContinuityAction>();
  for (const action of input.actions) {
    if (!(NUDGEABLE_ACTION_STATUSES as readonly string[]).includes(action.status)) continue;
    if (!sessionByPursuit.has(action.pursuitId)) continue;
    if (isCoolingDown(action.pursuitId)) continue;
    // No started_at exists on action today (see the v1 persistence migration);
    // updated_at is the freshness reference. A row with neither is undatable,
    // and an undatable row must not be nudged.
    const referenceTime = toTime(action.startedAt) ?? toTime(action.updatedAt);
    if (referenceTime === null) continue;
    if (now - referenceTime < STALE_ACTION_MS) continue;

    const incumbent = staleByPursuit.get(action.pursuitId);
    if (!incumbent) {
      staleByPursuit.set(action.pursuitId, action);
      continue;
    }
    const incumbentTime = toTime(incumbent.startedAt) ?? toTime(incumbent.updatedAt) ?? Number.POSITIVE_INFINITY;
    const candidateTime = referenceTime;
    if (candidateTime < incumbentTime || (candidateTime === incumbentTime && action.id < incumbent.id)) {
      staleByPursuit.set(action.pursuitId, action);
    }
  }

  const plans: ContinuityNudgePlan[] = [];
  for (const [pursuitId, action] of staleByPursuit) {
    const session = sessionByPursuit.get(pursuitId);
    if (!session) continue;
    plans.push({
      pursuitId,
      sessionId: session.id,
      turnKey: continuityTurnKey(pursuitId, input.now),
      message: staleActionMessage(action.kind),
    });
  }

  // Rule (b): an idle conversation whose recorded next step is still live.
  for (const session of input.sessions) {
    if (staleByPursuit.has(session.pursuitId)) continue;
    if (isCoolingDown(session.pursuitId)) continue;
    // External waiting is rule (a)'s territory: if the working state says the
    // pursuit is waiting on the outside world, only a stale in-flight task
    // (rule a) may speak, otherwise we would nag twice about the same wait.
    // Rule text: the recorded next step must EXIST and not be terminal. A
    // working state without one has nothing to reference (and the Work
    // Controller guarantees a next move for every non-terminal state, so its
    // absence here is drift we must not paper over).
    const nextMove = session.workingState?.next_move;
    if (typeof nextMove !== "object" || nextMove === null) continue;
    if (isWaitingExternalWorkingState(session.workingState)) continue;
    if (isTerminalWorkingState(session.workingState)) continue;

    const lastMessageTime = toTime(session.lastMessageAt);
    if (lastMessageTime === null) continue;
    if (now - lastMessageTime < IDLE_SESSION_MS) continue;

    plans.push({
      pursuitId: session.pursuitId,
      sessionId: session.id,
      turnKey: continuityTurnKey(session.pursuitId, input.now),
      message: idleSessionMessage(session.workingState),
    });
  }

  return plans.sort((a, b) => (a.pursuitId < b.pursuitId ? -1 : a.pursuitId > b.pursuitId ? 1 : 0));
}
