// Research planner + evidence-graph classification (Phases 7-8).
import test from "node:test";
import assert from "node:assert/strict";
import { planResearchRound, classifyResults, buildResearchReceipt } from "../lib/research-planner.ts";

test("planner: proceeds on the cheapest sufficient lane and reserves its cost", () => {
  const plan = planResearchRound({
    remaining: { research_rounds: 5, source_discovery: 40 },
    availableLanes: ["research.web_search", "research.page_fetch"],
    priorEvidenceCount: 0,
    priorContradictions: 0,
  });
  assert.equal(plan.decision, "PROCEED");
  if (plan.decision === "PROCEED") {
    assert.equal(plan.operations[0].capabilityKey, "research.web_search");
    assert.equal(plan.operations[0].estimatedCost.source_discovery, 5);
  }
});

test("planner: stops when evidence is already sufficient without contradictions", () => {
  const plan = planResearchRound({
    remaining: { research_rounds: 9, source_discovery: 90 },
    availableLanes: ["research.web_search"],
    priorEvidenceCount: 3,
    priorContradictions: 0,
  });
  assert.equal(plan.decision, "STOP_SUFFICIENT");
});

test("planner: budget exhaustion stops honestly — a provider failure is never evidence absence", () => {
  const plan = planResearchRound({
    remaining: { research_rounds: 0 },
    availableLanes: ["research.web_search"],
    priorEvidenceCount: 0,
    priorContradictions: 0,
  });
  assert.equal(plan.decision, "STOP_BUDGET");
  if (plan.decision === "STOP_BUDGET") assert.match(plan.reason, /exhausted|configured/);
});

test("planner: contradictions keep the planner going past the sufficient threshold", () => {
  const plan = planResearchRound({
    remaining: { research_rounds: 9, source_discovery: 90 },
    availableLanes: ["research.web_search"],
    priorEvidenceCount: 4,
    priorContradictions: 1,
    maxRounds: 5,
  });
  assert.equal(plan.decision, "PROCEED");
});

test("planner: no configured lane is a budget stop, not a silent no-op", () => {
  const plan = planResearchRound({
    remaining: { research_rounds: 9 },
    availableLanes: [],
    priorEvidenceCount: 0,
    priorContradictions: 0,
  });
  assert.equal(plan.decision, "STOP_BUDGET");
});

test("evidence graph: same content under two URIs is syndication, not corroboration", () => {
  const classified = classifyResults(
    [
      { url: "https://a.example/post", content_sha256: "sha-1" },
      { url: "https://b.example/copy", content_sha256: "sha-1" },
      { url: "https://c.example/orig", content_sha256: "sha-2" },
    ],
    [{ uri: "https://a.example/post", content_sha256: "sha-1" }],
  );
  assert.equal(classified[0].novelty, "DUPLICATE");
  assert.equal(classified[1].novelty, "SYNDICATED");
  assert.equal(classified[1].canonicalUri, "https://a.example/post");
  assert.equal(classified[2].novelty, "NOVEL");
});

test("evidence graph: a repeated URL with unknown content is a duplicate, not new evidence", () => {
  const classified = classifyResults(
    [{ url: "https://a.example/post" }],
    [{ uri: "https://a.example/post", content_sha256: null }],
  );
  assert.equal(classified[0].novelty, "DUPLICATE");
});

test("receipt: novelty counts aggregate and stop reasons are preserved", () => {
  const receipt = buildResearchReceipt({
    query: "q",
    planner: { decision: "STOP_SUFFICIENT", reason: "covered" },
    execution: null,
    classified: [
      { url: "u1", novelty: "NOVEL", canonicalUri: null },
      { url: "u2", novelty: "SYNDICATED", canonicalUri: "u1" },
      { url: "u3", novelty: "DUPLICATE", canonicalUri: "u3" },
    ],
  });
  assert.deepEqual(receipt.novelty, { novel: 1, duplicate: 1, syndicated: 1 });
  assert.equal(receipt.stoppedBecause, "covered");
});
