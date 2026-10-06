// Sub-agent spec (Phase 13) and policy hooks (Phase 17) — pure logic.
import test from "node:test";
import assert from "node:assert/strict";
import { validateSubAgentSpec } from "../lib/sub-agent.ts";
import { isBudgetThresholdCrossed, POLICY_HOOK_EVENTS } from "../lib/policy-hooks.ts";

function validSpec() {
  return {
    objective: "Collect the three most recent pricing pages for competitor X",
    completion_condition: "Three fetched pages exist as artifacts whose titles contain 'pricing'",
    worker_type: "opencode",
    allowed_tools: ["research.page_fetch", "artifact.compose"],
    allowed_skill_ids: [],
    budget: [{ resource: "worker_jobs", expected: 1 }],
    timeout_ms: 300000,
    output_schema: null,
    parent_run_id: "run-1",
    parent_action_id: "action-1",
  };
}

test("sub-agent: a scoped spec validates with untrusted-output classification", () => {
  const result = validateSubAgentSpec(validSpec());
  assert.equal(result.valid, true, result.issues.join("; "));
  assert.equal(result.spec!.trustClassification, "UNTRUSTED_RESULT_DATA");
  assert.equal(result.spec!.parentRunId, "run-1");
});

test("sub-agent: least privilege is enforced — no tools, no budget, or absurd timeout is rejected", () => {
  assert.equal(validateSubAgentSpec({ ...validSpec(), allowed_tools: [] }).valid, false);
  assert.equal(validateSubAgentSpec({ ...validSpec(), budget: [] }).valid, false);
  assert.equal(validateSubAgentSpec({ ...validSpec(), timeout_ms: 24 * 3600_000 }).valid, false);
  assert.equal(validateSubAgentSpec({ ...validSpec(), worker_type: "unstructured" }).valid, false);
  assert.equal(validateSubAgentSpec({ ...validSpec(), objective: "" }).valid, false);
});

test("sub-agent: output is never pre-verified — no spec field can claim trust", () => {
  const result = validateSubAgentSpec({ ...validSpec(), trust_classification: "VERIFIED" });
  assert.equal(result.valid, true);
  assert.equal(result.spec!.trustClassification, "UNTRUSTED_RESULT_DATA", "trust is structural, not declarable by the caller");
});

test("policy hooks: budget threshold fires near exhaustion, never on unlimited", () => {
  assert.equal(isBudgetThresholdCrossed(5, 60), true, "5 of 60 remaining is under 10%");
  assert.equal(isBudgetThresholdCrossed(30, 60), false);
  assert.equal(isBudgetThresholdCrossed(null, 60), false, "unlimited never alarms");
  assert.equal(isBudgetThresholdCrossed(0, null), false);
});

test("policy hooks: the event vocabulary is closed", () => {
  for (const evt of POLICY_HOOK_EVENTS) assert.match(evt, /^HOOK_/);
});
