import test from "node:test";
import assert from "node:assert/strict";
import {
  fallbackHumanObservation,
  validateHumanObservation,
} from "../lib/human-observation.ts";

test("validates a structured human observation", () => {
  const observation = validateHumanObservation({
    summary: "Three interviews were completed.",
    what_happened: "The user spoke with three people about the stated problem.",
    evidence: ["Two people independently described the problem."],
    user_claims: ["The user thinks the problem is common."],
    uncertainties: ["The sample is small."],
    blockers: [],
    implications: ["More evidence is needed before changing the target."],
    suggested_follow_up: null,
  });

  assert.equal(observation.summary, "Three interviews were completed.");
  assert.deepEqual(observation.blockers, []);
});

test("rejects malformed observations instead of allowing partial model output", () => {
  assert.throws(
    () => validateHumanObservation({
      summary: "Something happened",
      what_happened: "The user reported something.",
      evidence: [],
      user_claims: [],
      uncertainties: [],
      blockers: [],
      // missing implications and suggested_follow_up
    }),
    /implications must be an array/,
  );
});

test("fallback preserves the raw report as user-reported evidence", () => {
  const observation = fallbackHumanObservation({
    report: "I spoke to three people and two had the problem.",
    terminalStatus: "COMPLETED",
  });

  assert.equal(observation.summary, "I spoke to three people and two had the problem.");
  assert.deepEqual(observation.evidence, [
    "I spoke to three people and two had the problem.",
  ]);
  assert.match(
    observation.uncertainties[0],
    /could not run the structured interpretation/i,
  );
  assert.deepEqual(observation.user_claims, []);
});

test("failed actions keep the report as a blocker rather than discarding it", () => {
  const observation = fallbackHumanObservation({
    report: "Nobody replied and I could not get the sample.",
    terminalStatus: "FAILED",
  });

  assert.deepEqual(observation.blockers, [
    "Nobody replied and I could not get the sample.",
  ]);
});
