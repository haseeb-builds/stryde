import assert from "node:assert/strict";
import test from "node:test";

// Model output is a proposal. The Gemini REST API rejects non-string enums, so
// geminiSchema() strips `enum: [1]` and `enum: [...]` before sending a schema.
// A provider can therefore return a drifted-but-recoverable status. These tests
// pin the repair boundary: tolerant on coordination fields, strict on authority.
import { normalizeWorkStatus } from "../lib/working-state-normalization.ts";
import { validateWorkingState } from "../lib/work-controller.ts";

test("canonical statuses pass through unchanged", () => {
  for (const status of ["DISCOVERING", "READY", "WAITING_USER", "WORKING", "WAITING_EXTERNAL", "COMPLETE", "STALLED"]) {
    assert.equal(normalizeWorkStatus(status), status);
  }
});

test("case and separator drift is normalized", () => {
  assert.equal(normalizeWorkStatus("initial"), "DISCOVERING");
  assert.equal(normalizeWorkStatus("IN_PROGRESS"), "WORKING");
  assert.equal(normalizeWorkStatus("waiting-external"), "WAITING_EXTERNAL");
  assert.equal(normalizeWorkStatus("  Complete  "), "COMPLETE");
});

test("unknown status is not silently invented", () => {
  assert.equal(normalizeWorkStatus("teleporting"), undefined);
  assert.equal(normalizeWorkStatus(""), undefined);
  assert.equal(normalizeWorkStatus(null), undefined);
  assert.equal(normalizeWorkStatus(7), undefined);
  assert.equal(normalizeWorkStatus({}), undefined);
});

test("an unknown status never resolves to a terminal claim", () => {
  for (const bad of ["teleporting", "", null, 1]) {
    assert.notEqual(normalizeWorkStatus(bad), "COMPLETE");
    assert.notEqual(normalizeWorkStatus(bad), "VERIFIED");
  }
});

// ---------------------------------------------------------------------------
// validateWorkingState: the optional `verify` payload on next_move. It carries
// the target of a mechanical VERIFY_WEB URL check; the validator normalizes it
// but never uses it to upgrade a claim — adjudication stays human.
// ---------------------------------------------------------------------------

function workingStateWithMove(nextMove: unknown) {
  return {
    version: 1,
    status: "WORKING",
    objective: "Settle the apartment claim",
    understanding: "A reported claim can be settled against one public page.",
    known: ["A claim exists in this pursuit"],
    unknowns: [],
    bottleneck: null,
    next_move: nextMove,
  };
}

const strydeMove = {
  actor: "STRYDE",
  worker_type: null,
  title: "Check the listing page",
  why: "The claim can be settled by one public page.",
  expected_change: "The claim gains mechanical evidence.",
  stryde_can_do: "Fetch the page and compare the literal text.",
  user_needs_to_do: "Nothing.",
  completion_condition: "The URL check is recorded as evidence.",
};

test("a VERIFY_WEB move with verify fields is accepted and normalized", () => {
  const state = validateWorkingState(workingStateWithMove({
    mode: "VERIFY_WEB",
    ...strydeMove,
    verify: {
      claim_id: "  claim-1  ",
      url: "  https://example.com/listing  ",
      expect_text: "  Berlin Apartment  ",
    },
  }));
  assert.deepEqual(state.next_move?.verify, {
    claim_id: "claim-1",
    url: "https://example.com/listing",
    expect_text: "Berlin Apartment",
  });
});

test("verify with an empty field is rejected, not silently repaired", () => {
  assert.throws(() =>
    validateWorkingState(workingStateWithMove({
      mode: "VERIFY_WEB",
      ...strydeMove,
      verify: { claim_id: "claim-1", url: "https://example.com/listing", expect_text: "   " },
    })),
  );
  assert.throws(() =>
    validateWorkingState(workingStateWithMove({
      mode: "VERIFY_WEB",
      ...strydeMove,
      verify: { claim_id: "", url: "https://example.com/listing", expect_text: "Berlin Apartment" },
    })),
  );
});

test("a verify field on another mode is kept without erroring", () => {
  const verify = { claim_id: "claim-1", url: "https://example.com/listing", expect_text: "Berlin Apartment" };
  const state = validateWorkingState(workingStateWithMove({
    mode: "ANALYZE",
    ...strydeMove,
    verify,
  }));
  assert.deepEqual(state.next_move?.verify, verify);
});

test("moves without verify keep it absent deterministically", () => {
  const analyze = validateWorkingState(workingStateWithMove({
    mode: "ANALYZE",
    ...strydeMove,
  }));
  assert.equal(analyze.next_move?.verify, undefined);

  // A VERIFY_WEB proposal without the mechanical target is still a valid move;
  // the work route's guard decides whether anything executes.
  const verifyWeb = validateWorkingState(workingStateWithMove({
    mode: "VERIFY_WEB",
    ...strydeMove,
  }));
  assert.equal(verifyWeb.next_move?.mode, "VERIFY_WEB");
  assert.equal(verifyWeb.next_move?.verify, undefined);
});

test("verify must be an object or null", () => {
  assert.throws(() =>
    validateWorkingState(workingStateWithMove({
      mode: "VERIFY_WEB",
      ...strydeMove,
      verify: "https://example.com/listing",
    })),
  );
  const state = validateWorkingState(workingStateWithMove({
    mode: "VERIFY_WEB",
    ...strydeMove,
    verify: null,
  }));
  assert.equal(state.next_move?.verify, null);
});
