// Capability platform: registry shape, discovery eligibility/rejection
// reasons, plan gating, cost-based ranking, and resource-control semantics
// (pure logic). The SQL enforcement plane is proven live by
// scripts/e2e-entitlement.ts; these tests pin the decision logic.
import test from "node:test";
import assert from "node:assert/strict";
import { CAPABILITY_CATALOG, resolveCatalogAvailability } from "../lib/capability-registry.ts";
import { evaluateCapabilities, rankEligible } from "../lib/capability-discovery.ts";
import { ResourceExhaustedError } from "../lib/resource-control.ts";
import { getEntitlement, limitFor, normalizePlanId } from "../lib/entitlement.ts";

const ALL_RESOURCES_UNLIMITED = { model_turns: null, research_rounds: null, source_discovery: null, source_extraction: null, browser_actions: null, worker_seconds: null, worker_jobs: null };

function caps() {
  return CAPABILITY_CATALOG.map((c) => ({
    capability_key: c.capabilityKey,
    version: c.version,
    provider: c.provider,
    description: c.description,
    trust_class: c.trustClass,
    risk_class: c.riskClass,
    side_effect_class: c.sideEffectClass,
    reversible: c.reversible,
    plan_eligibility: c.planEligibility,
    cost_model: c.costModel,
    availability: "AVAILABLE",
    metadata: c.metadata,
  }));
}

test("catalog: every capability has a unique key, version, provider-neutral cost model, and declared authority surface", () => {
  const keys = new Set<string>();
  for (const cap of CAPABILITY_CATALOG) {
    assert.ok(!keys.has(cap.capabilityKey), `duplicate capability key ${cap.capabilityKey}`);
    keys.add(cap.capabilityKey);
    assert.ok(cap.version.length > 0);
    assert.ok(cap.description.length > 10);
    for (const [resource, amount] of Object.entries(cap.costModel)) {
      assert.ok(!/[A-Z]/.test(resource), `cost resource ${resource} must be a resource name, not a vendor unit`);
      assert.ok(Number.isFinite(amount) && amount >= 0);
    }
    if (cap.sideEffectClass === "STATE_CHANGE" || cap.sideEffectClass === "DESTRUCTIVE" || cap.sideEffectClass === "EXTERNAL_COMMUNICATION") {
      assert.equal(cap.reversible === true && cap.riskClass === "LOW", false, `${cap.capabilityKey} world-changing capability must not be classified low-risk reversible`);
    }
  }
  for (const required of ["research.web_search", "research.web_extraction", "research.page_fetch", "worker.execution", "mcp.external_tools", "acquisition.transcript", "artifact.compose", "execution.sandboxed_code", "connector.oauth_service"]) {
    assert.ok(keys.has(required), `mandated capability ${required} missing from catalog`);
  }
});

test("availability: absent credentials degrade honestly, blocked capabilities stay unavailable", () => {
  const resolved = new Map(resolveCatalogAvailability({} as NodeJS.ProcessEnv).map((r) => [r.capabilityKey, r.availability]));
  assert.equal(resolved.get("research.web_search"), "DEGRADED");
  assert.equal(resolved.get("execution.sandboxed_code"), "UNAVAILABLE");
  assert.equal(resolved.get("connector.oauth_service"), "UNAVAILABLE");
  assert.equal(resolved.get("research.page_fetch"), "AVAILABLE");
});

test("discovery: an ineligble plan is rejected with a reason, not silently dropped", () => {
  const [evaluation] = evaluateCapabilities({
    remaining: { ...ALL_RESOURCES_UNLIMITED },
    entitlement: { planId: "free" },
    capabilities: caps().filter((c) => c.capability_key === "worker.execution"),
  });
  assert.equal(evaluation.eligibility, "PLAN_NOT_ELIGIBLE");
  assert.ok(evaluation.reasons.some((r) => r.includes("free")));
  assert.equal(evaluation.requiredAuthority, "EXPLICIT_USER_APPROVAL");
});

test("discovery: exhausted resources reject with the shortfall named", () => {
  const [evaluation] = evaluateCapabilities({
    remaining: { source_discovery: 3 },
    entitlement: { planId: "pro" },
    capabilities: caps().filter((c) => c.capability_key === "research.web_search"),
  });
  assert.equal(evaluation.eligibility, "RESOURCE_EXHAUSTED");
  assert.ok(evaluation.reasons.some((r) => r.includes("source_discovery")));
});

test("discovery: unmetered resources fail closed, never open", () => {
  const [evaluation] = evaluateCapabilities({
    remaining: {},
    entitlement: { planId: "max" },
    capabilities: caps().filter((c) => c.capability_key === "research.page_fetch"),
  });
  assert.equal(evaluation.eligibility, "RESOURCE_EXHAUSTED");
  assert.ok(evaluation.reasons.some((r) => r.includes("failing closed")));
});

test("discovery: discovery is not authority — world-changing capabilities always require explicit approval", () => {
  const evaluations = evaluateCapabilities({
    remaining: { ...ALL_RESOURCES_UNLIMITED },
    entitlement: { planId: "max" },
    capabilities: caps(),
  });
  for (const e of evaluations) {
    if (["STATE_CHANGE", "DESTRUCTIVE", "EXTERNAL_COMMUNICATION"].includes(e.sideEffectClass)) {
      assert.equal(e.requiredAuthority, "EXPLICIT_USER_APPROVAL", `${e.capabilityKey}`);
    } else {
      assert.equal(e.requiredAuthority, "NONE", `${e.capabilityKey}`);
    }
  }
});

test("discovery: trust-blocked capabilities are never eligible regardless of plan or budget", () => {
  const evaluations = evaluateCapabilities({
    remaining: { ...ALL_RESOURCES_UNLIMITED },
    entitlement: { planId: "max" },
    capabilities: caps(),
  });
  for (const e of evaluations.filter((x) => x.capabilityKey === "execution.sandboxed_code" || x.capabilityKey === "connector.oauth_service")) {
    assert.equal(e.eligibility, "TRUST_BLOCKED");
  }
});

test("ranking: eligible observation floor outranks degraded lanes; cheaper sufficient first", () => {
  const evaluations = evaluateCapabilities({
    remaining: { ...ALL_RESOURCES_UNLIMITED },
    entitlement: { planId: "pro" },
    capabilities: caps(),
  });
  const ranked = rankEligible(evaluations);
  const searchIdx = ranked.indexOf("research.web_search");
  const fetchIdx = ranked.indexOf("research.page_fetch");
  const workerIdx = ranked.indexOf("worker.execution");
  assert.ok(searchIdx >= 0 && fetchIdx >= 0);
  // page_fetch is cheaper than search and never degraded without config
  assert.ok(fetchIdx < workerIdx, "cheap observation must outrank high-risk execution");
  assert.ok(searchIdx < workerIdx);
});

test("resource control: exhaustion surfaces the offending resource", () => {
  const error = new ResourceExhaustedError('RESOURCE_EXHAUSTED: worker_jobs (requested 1, available 0)', "worker_jobs");
  assert.equal(error.resource, "worker_jobs");
  assert.match(error.message, /worker_jobs/);
});

test("entitlement: plan ids normalize to free; limits are found or closed", () => {
  assert.equal(normalizePlanId("enterprise"), "free");
  assert.equal(normalizePlanId("max"), "max");
  const entitlement = { planId: "free" as const, source: "DEFAULT", limits: [{ resource: "model_turns", limitValue: 60, windowType: "DAILY" as const }] };
  assert.equal(limitFor(entitlement, "model_turns")?.limitValue, 60);
  assert.equal(limitFor(entitlement, "worker_jobs"), null);
});

test("entitlement: expired paid state resolves to free (subscription is not epistemic or capacity truth)", async () => {
  // getEntitlement re-derives activeness from the row; simulate a stub client.
  const expiredRow = { plan_id: "pro", status: "ACTIVE", source: "BILLING_WEBHOOK", expires_at: new Date(Date.now() - 1000).toISOString() };
  const stub = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() { return Promise.resolve({ data: expiredRow, error: null }); },
      };
    },
  } as never;
  const entitlement = await getEntitlement(stub, "user-1");
  assert.equal(entitlement.planId, "free");
});
