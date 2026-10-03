import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAutoResearch, checkWorkerDelegation, type AutonomyPolicy } from "../lib/autonomy-policy.ts";

test("no policy row keeps the default behavior", () => {
  assert.deepEqual(checkWorkerDelegation(null, "HERMES"), { allowed: true, reason: null });
  assert.equal(checkAutoResearch(null), true);
});

test("a policy can switch delegation off entirely", () => {
  const policy: AutonomyPolicy = {
    allow_worker_delegation: false,
    allowed_worker_types: ["HERMES"],
    auto_execute_research: true,
  };
  const decision = checkWorkerDelegation(policy, "HERMES");
  assert.equal(decision.allowed, false);
  assert.match(decision.reason ?? "", /switched off/);
});

test("a policy can restrict which worker types may run", () => {
  const policy: AutonomyPolicy = {
    allow_worker_delegation: true,
    allowed_worker_types: ["OPENCODE"],
    auto_execute_research: true,
  };
  assert.equal(checkWorkerDelegation(policy, "OPENCODE").allowed, true);
  const refused = checkWorkerDelegation(policy, "HERMES");
  assert.equal(refused.allowed, false);
  assert.match(refused.reason ?? "", /OPENCODE/);
});

test("an empty type list with delegation on refuses every worker type", () => {
  // The API rejects this configuration, but the checker must stay safe if a
  // row like this ever exists: allow with no types means nothing may run.
  const policy: AutonomyPolicy = {
    allow_worker_delegation: true,
    allowed_worker_types: [],
    auto_execute_research: true,
  };
  assert.equal(checkWorkerDelegation(policy, "HERMES").allowed, false);
});

test("a policy can switch auto research off", () => {
  assert.equal(checkAutoResearch({ allow_worker_delegation: false, allowed_worker_types: [], auto_execute_research: false }), false);
  assert.equal(checkAutoResearch({ allow_worker_delegation: false, allowed_worker_types: [], auto_execute_research: true }), true);
});
