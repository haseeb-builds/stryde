import assert from "node:assert/strict";
import test from "node:test";

// Proactive continuity planning: who gets nudged, when, and in what words.
// These tests pin the pure core; the cron route's reads and writes are pinned
// by the migration constraints it cites inline (turn_key uuid + per-session
// uniqueness, sequence_no = max+1).
import {
  continuityTurnKey,
  continuityTurnKeyToUuid,
  IDLE_SESSION_MS,
  NUDGE_COOLDOWN_MS,
  planContinuityNudges,
  STALE_ACTION_MS,
  type ContinuityPlanningInput,
} from "../lib/continuity.ts";

const NOW = new Date("2026-10-03T18:00:00.000Z");
const HOURS = 60 * 60 * 1000;
const DAYS = 24 * HOURS;

const PURSUIT_A = "11111111-1111-4111-8111-111111111111";
const PURSUIT_B = "22222222-2222-4222-8222-222222222222";
const SESSION_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function baseInput(overrides: Partial<ContinuityPlanningInput> = {}): ContinuityPlanningInput {
  return {
    now: NOW,
    actions: [],
    sessions: [],
    recentNudges: [],
    ...overrides,
  };
}

function session(pursuitId: string, sessionId: string, lastMessageAt: Date, workingState: ContinuityPlanningInput["sessions"][number]["workingState"]) {
  return { id: sessionId, pursuitId, lastMessageAt, workingState };
}

test("constants are the durations the rules promise", () => {
  assert.equal(STALE_ACTION_MS, 48 * 60 * 60 * 1000);
  assert.equal(IDLE_SESSION_MS, 3 * 24 * 60 * 60 * 1000);
  assert.equal(NUDGE_COOLDOWN_MS, 24 * 60 * 60 * 1000);
});

test("a stale in-flight task on a pursuit with a live conversation gets nudged", () => {
  const plans = planContinuityNudges(
    baseInput({
      actions: [
        { id: "act-1", pursuitId: PURSUIT_A, kind: "CONTROLLED", status: "IN_PROGRESS", updatedAt: new Date(NOW.getTime() - STALE_ACTION_MS - HOURS) },
      ],
      sessions: [session(PURSUIT_A, SESSION_A, new Date(NOW.getTime() - HOURS), null)],
    }),
  );
  assert.equal(plans.length, 1);
  assert.equal(plans[0].pursuitId, PURSUIT_A);
  assert.equal(plans[0].sessionId, SESSION_A);
  assert.equal(plans[0].turnKey, `continuity-2026-10-03-${PURSUIT_A}`);
  assert.match(plans[0].message, /still open/);
});

test("a fresh in-flight task is not nudged", () => {
  const plans = planContinuityNudges(
    baseInput({
      actions: [
        { id: "act-1", pursuitId: PURSUIT_A, kind: "HUMAN", status: "IN_PROGRESS", updatedAt: new Date(NOW.getTime() - 2 * HOURS) },
      ],
      sessions: [session(PURSUIT_A, SESSION_A, new Date(NOW.getTime() - HOURS), null)],
    }),
  );
  assert.equal(plans.length, 0);
});

test("an idle conversation with a live next move gets nudged", () => {
  const plans = planContinuityNudges(
    baseInput({
      sessions: [
        session(PURSUIT_A, SESSION_A, new Date(NOW.getTime() - IDLE_SESSION_MS - DAYS), {
          next_move: { mode: "DRAFT", actor: "STRYDE", title: "draft the trip shortlist" },
        }),
      ],
    }),
  );
  assert.equal(plans.length, 1);
  assert.equal(plans[0].sessionId, SESSION_A);
  assert.match(plans[0].message, /draft the trip shortlist/);
});

test("an idle conversation with no next move is not nudged", () => {
  const plans = planContinuityNudges(
    baseInput({
      sessions: [session(PURSUIT_A, SESSION_A, new Date(NOW.getTime() - IDLE_SESSION_MS - DAYS), { next_move: null })],
    }),
  );
  assert.equal(plans.length, 0);
});

test("a conversation whose next move is terminal is not nudged", () => {
  for (const mode of ["DONE", "FAILED"]) {
    const plans = planContinuityNudges(
      baseInput({
        sessions: [
          session(PURSUIT_A, SESSION_A, new Date(NOW.getTime() - IDLE_SESSION_MS - DAYS), { next_move: { mode, actor: "STRYDE" } }),
        ],
      }),
    );
    assert.equal(plans.length, 0, `mode ${mode} must be terminal`);
  }
});

test("a conversation whose working state is COMPLETE or STALLED is not nudged", () => {
  for (const status of ["COMPLETE", "STALLED"]) {
    const plans = planContinuityNudges(
      baseInput({
        sessions: [
          session(PURSUIT_A, SESSION_A, new Date(NOW.getTime() - IDLE_SESSION_MS - DAYS), {
            status,
            next_move: { mode: "DRAFT", actor: "STRYDE" },
          }),
        ],
      }),
    );
    assert.equal(plans.length, 0, `status ${status} must be terminal`);
  }
});

test("a WAITING_EXTERNAL in-flight task yields one nudge and suppresses the idle-session nudge for the same pursuit", () => {
  const plans = planContinuityNudges(
    baseInput({
      actions: [
        { id: "act-1", pursuitId: PURSUIT_A, kind: "CONTROLLED", status: "WAITING_EXTERNAL", updatedAt: new Date(NOW.getTime() - STALE_ACTION_MS - HOURS) },
      ],
      sessions: [
        session(PURSUIT_A, SESSION_A, new Date(NOW.getTime() - IDLE_SESSION_MS - DAYS), {
          next_move: { mode: "RECHECK", actor: "STRYDE" },
        }),
      ],
    }),
  );
  assert.equal(plans.length, 1);
  assert.match(plans[0].message, /still open/);
});

test("a working state left WAITING_EXTERNAL is only ever nudged by a stale in-flight task, never by the idle rule", () => {
  const plans = planContinuityNudges(
    baseInput({
      sessions: [
        session(PURSUIT_A, SESSION_A, new Date(NOW.getTime() - IDLE_SESSION_MS - DAYS), {
          status: "WAITING_EXTERNAL",
          next_move: { mode: "RECHECK", actor: "STRYDE" },
        }),
      ],
    }),
  );
  assert.equal(plans.length, 0);
});

test("a pursuit nudged within the cooldown is not nudged again", () => {
  const recentNudge = new Date(NOW.getTime() - NUDGE_COOLDOWN_MS + HOURS);
  const plans = planContinuityNudges(
    baseInput({
      actions: [
        { id: "act-1", pursuitId: PURSUIT_A, kind: "CONTROLLED", status: "IN_PROGRESS", updatedAt: new Date(NOW.getTime() - STALE_ACTION_MS - HOURS) },
      ],
      sessions: [session(PURSUIT_A, SESSION_A, new Date(NOW.getTime() - IDLE_SESSION_MS - DAYS), { next_move: { mode: "DRAFT", actor: "STRYDE" } })],
      recentNudges: [{ pursuitId: PURSUIT_A, createdAt: recentNudge }],
    }),
  );
  assert.equal(plans.length, 0);
});

test("a nudge older than the cooldown no longer suppresses", () => {
  const plans = planContinuityNudges(
    baseInput({
      actions: [
        { id: "act-1", pursuitId: PURSUIT_A, kind: "CONTROLLED", status: "IN_PROGRESS", updatedAt: new Date(NOW.getTime() - STALE_ACTION_MS - HOURS) },
      ],
      sessions: [session(PURSUIT_A, SESSION_A, new Date(NOW.getTime() - HOURS), null)],
      recentNudges: [{ pursuitId: PURSUIT_A, createdAt: new Date(NOW.getTime() - NUDGE_COOLDOWN_MS - HOURS) }],
    }),
  );
  assert.equal(plans.length, 1);
});

test("a pursuit without a live conversation is never nudged", () => {
  const plans = planContinuityNudges(
    baseInput({
      actions: [
        { id: "act-1", pursuitId: PURSUIT_A, kind: "HUMAN", status: "IN_PROGRESS", updatedAt: new Date(NOW.getTime() - STALE_ACTION_MS - HOURS) },
      ],
      sessions: [session(PURSUIT_B, SESSION_B, new Date(NOW.getTime() - HOURS), null)],
    }),
  );
  assert.equal(plans.length, 0);
});

test("the turn key is deterministic per pursuit per day and distinct across days", () => {
  const sameDay = continuityTurnKey(PURSUIT_A, new Date("2026-10-03T06:00:00.000Z"));
  const laterSameDay = continuityTurnKey(PURSUIT_A, new Date("2026-10-03T23:59:59.000Z"));
  const nextDay = continuityTurnKey(PURSUIT_A, new Date("2026-10-04T00:00:00.000Z"));
  const otherPursuit = continuityTurnKey(PURSUIT_B, NOW);

  assert.equal(sameDay, laterSameDay);
  assert.equal(sameDay, `continuity-2026-10-03-${PURSUIT_A}`);
  assert.notEqual(sameDay, nextDay);
  assert.notEqual(sameDay, otherPursuit);
  for (const key of [sameDay, nextDay, otherPursuit]) {
    assert.match(key, /^continuity-\d{4}-\d{2}-\d{2}-[0-9a-f-]{36}$/);
  }
});

test("the physical turn key is a valid, stable uuid derived from the logical key", () => {
  // conversation_message.turn_key is uuid (migration 20260926180000), so the
  // logical key must map onto one deterministically for idempotent re-runs.
  const logical = continuityTurnKey(PURSUIT_A, NOW);
  const first = continuityTurnKeyToUuid(logical);
  const second = continuityTurnKeyToUuid(logical);
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(continuityTurnKeyToUuid(continuityTurnKey(PURSUIT_A, new Date("2026-10-04T00:00:00.000Z"))), first);
});

test("nudge messages use plain words only — no internal ontology nouns", () => {
  const blocklist = ["pursuit", "claim", "action", "decision", "worker", "job", "observation", "run", "capability"];
  const scenarios: ContinuityPlanningInput[] = [
    baseInput({
      actions: [
        { id: "act-1", pursuitId: PURSUIT_A, kind: "CONTROLLED", status: "IN_PROGRESS", updatedAt: new Date(NOW.getTime() - STALE_ACTION_MS - HOURS) },
        { id: "act-2", pursuitId: PURSUIT_B, kind: "HUMAN", status: "WAITING_EXTERNAL", updatedAt: new Date(NOW.getTime() - STALE_ACTION_MS - HOURS) },
      ],
      sessions: [session(PURSUIT_A, SESSION_A, new Date(NOW.getTime() - HOURS), null), session(PURSUIT_B, SESSION_B, new Date(NOW.getTime() - HOURS), null)],
    }),
    baseInput({
      sessions: [
        session(PURSUIT_A, SESSION_A, new Date(NOW.getTime() - IDLE_SESSION_MS - DAYS), {
          next_move: { mode: "DRAFT", actor: "STRYDE", title: "the packing list" },
        }),
      ],
    }),
    baseInput({
      sessions: [session(PURSUIT_A, SESSION_A, new Date(NOW.getTime() - IDLE_SESSION_MS - DAYS), { next_move: { mode: "WAIT", actor: "USER" } })],
    }),
  ];

  const messages = scenarios.flatMap((input) => planContinuityNudges(input).map((plan) => plan.message));
  assert.ok(messages.length >= 4, `expected several message variants, got ${messages.length}`);
  for (const message of messages) {
    for (const banned of blocklist) {
      assert.doesNotMatch(message, new RegExp(`\\b${banned}\\b`, "i"), `"${banned}" must not appear in: ${message}`);
    }
    assert.match(message, /\?/, `a nudge must ask: ${message}`);
  }
});

test("at most one nudge per pursuit per run", () => {
  const plans = planContinuityNudges(
    baseInput({
      actions: [
        { id: "act-1", pursuitId: PURSUIT_A, kind: "HUMAN", status: "IN_PROGRESS", updatedAt: new Date(NOW.getTime() - STALE_ACTION_MS - HOURS) },
        { id: "act-2", pursuitId: PURSUIT_A, kind: "CONTROLLED", status: "IN_PROGRESS", updatedAt: new Date(NOW.getTime() - STALE_ACTION_MS - 5 * HOURS) },
      ],
      sessions: [
        session(PURSUIT_A, SESSION_A, new Date(NOW.getTime() - IDLE_SESSION_MS - DAYS), { next_move: { mode: "DRAFT", actor: "STRYDE" } }),
      ],
    }),
  );
  assert.equal(plans.length, 1);
  // The older in-flight task is the one referenced.
  assert.match(plans[0].message, /still open/);
});
