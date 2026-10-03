import assert from "node:assert/strict";
import { test } from "node:test";
import { validateConversationTurn } from "../lib/model-gateway.ts";
import { WORKING_STATE_SCHEMA } from "../lib/work-controller.ts";

function baseTurn(overrides: Record<string, unknown> = {}) {
  return {
    message: "Here is where things stand.",
    question: null,
    options: [],
    ready_for_reasoning: false,
    focus: "the moving plan",
    input_class: "MESSAGE",
    memory_candidates: [],
    work: {
      version: 1,
      status: "DISCOVERING",
      objective: "move apartments",
      understanding: "The user is planning an apartment move.",
      known: ["lease ends june 1"],
      unknowns: [],
      bottleneck: null,
      next_move: {
        mode: "ASK_USER",
        actor: "STRYDE",
        worker_type: null,
        title: "clarify the timeline",
        why: "the date is still unknown",
        expected_change: "a confirmed moving date",
        stryde_can_do: "ask one focused question",
        user_needs_to_do: "answer when ready",
        completion_condition: "a date is known",
      },
    },
    ...overrides,
  };
}

// validateWorkingState may require more than the minimal object above in
// future; construct through the real schema so the contract test fails here,
// not obscurely, if that happens.
test("base turn fixture satisfies the working state schema", () => {
  assert.doesNotThrow(() => validateConversationTurn(baseTurn()));
});

test("missing or unknown input_class degrades to MESSAGE instead of failing the turn", () => {
  const without = baseTurn();
  delete (without as Record<string, unknown>).input_class;
  assert.equal(validateConversationTurn(without).input_class, "MESSAGE");

  const drift = baseTurn({ input_class: "SOMETHING_ELSE" });
  assert.equal(validateConversationTurn(drift).input_class, "MESSAGE");

  assert.equal(validateConversationTurn(baseTurn({ input_class: "CORRECTION" })).input_class, "CORRECTION");
});

test("memory candidates accept revises_memory_ids and trim to three", () => {
  const turn = validateConversationTurn(
    baseTurn({
      memory_candidates: [
        {
          scope: "USER",
          memory_type: "CONSTRAINT",
          content: "no dairy",
          confidence: 0.8,
          importance: 0.7,
          revises_memory_ids: ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", "33333333-3333-3333-3333-333333333333", "44444444-4444-4444-4444-444444444444"],
        },
      ],
    }),
  );
  assert.equal(turn.memory_candidates.length, 1);
  assert.equal(turn.memory_candidates[0].revises_memory_ids.length, 3);
});

test("memory candidates without revises_memory_ids normalize to an empty list", () => {
  const turn = validateConversationTurn(
    baseTurn({
      memory_candidates: [
        { scope: "PURSUIT", memory_type: "FACT", content: "lease ends june 1", confidence: 0.6, importance: 0.5 },
      ],
    }),
  );
  assert.deepEqual(turn.memory_candidates[0].revises_memory_ids, []);
});

test("WORKING_STATE_SCHEMA still validates the embedded work object shape", () => {
  assert.equal(WORKING_STATE_SCHEMA.type, "object");
});
