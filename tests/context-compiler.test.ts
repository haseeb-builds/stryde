import assert from "node:assert/strict";
import { test } from "node:test";
import { compileContext, compileForSituation, CONTEXT_BUDGET_CHARS } from "../lib/context-compiler.ts";
import type { AdaptiveSituation } from "../lib/adaptive-situation";

function situation(overrides: Record<string, unknown> = {}): AdaptiveSituation {
  return {
    pursuit: { title: "Land my first AI-native operations client", objective_claim_id: "claim-obj" },
    claims: [{ id: "claim-obj", content: "Land my first AI-native operations client" }],
    sources: [],
    source_adaptations: [],
    observations: [],
    episodic_memory: [],
    memories: [],
    worker_capabilities: [],
    capabilities: { web_search: true },
    ...overrides,
  } as unknown as AdaptiveSituation;
}

const NOW = new Date("2026-10-05T12:00:00Z");

test("dead memories never reach a packet; active ones do", () => {
  const compiled = compileContext(situation({
    memories: [
      { id: "m-live", status: "ACTIVE", content: "User prefers async communication", importance: 0.8, confidence: 0.9, updated_at: NOW.toISOString() },
      { id: "m-dead", status: "FORGOTTEN", content: "User likes long calls", importance: 0.9, confidence: 0.9, updated_at: NOW.toISOString() },
      { id: "m-flipped", status: "CONTRADICTED", content: "User targets enterprise clients", importance: 0.9, confidence: 0.9, updated_at: NOW.toISOString() },
    ],
  }), { userMessage: "what should I do next", focus: null, objective: null }, NOW);
  const ids = compiled.packet.memories.map((m) => (m as { id: string }).id);
  assert.ok(ids.includes("m-live"));
  assert.ok(!ids.includes("m-dead"), "forgotten memories must never reach a packet");
  assert.ok(!ids.includes("m-flipped"), "contradicted memories must never reach a packet");
});

test("task-relevant observations are selected over irrelevant ones under a cap", () => {
  const observations = Array.from({ length: 10 }, (_, i) => ({
    id: `obs-unrelated-${i}`,
    observation_kind: "WEB_SEARCH_RESULT",
    content: { note: `totally unrelated topic number ${i}: gardening tips and recipes` },
    observed_at: NOW.toISOString(),
    source_type: "SYSTEM",
  }));
  observations.push({
    id: "obs-relevant",
    observation_kind: "WEB_SEARCH_RESULT",
    content: { note: "AI-native operations client outreach reply rate data" },
    observed_at: NOW.toISOString(),
    source_type: "SYSTEM",
  });
  const compiled = compileContext(situation({ observations }), { userMessage: "improve my AI-native operations client outreach", focus: null, objective: null }, NOW);
  const ids = compiled.packet.observations.map((o) => (o as { id: string }).id);
  assert.ok(ids.includes("obs-relevant"), "the task-relevant observation must be selected");
  assert.ok(ids.length <= 10);
  assert.ok(compiled.report.included.some((i) => i.id === "obs-relevant" && i.reasons.includes("TASK_MATCH")));
});

test("only the latest adaptation version per source survives (supersession)", () => {
  const compiled = compileContext(situation({
    source_adaptations: [
      { id: "a-v1", source_id: "s1", version: 1, status: "ADVISED", summary: "old strategy", created_at: "2026-09-01T00:00:00Z" },
      { id: "a-v2", source_id: "s1", version: 2, status: "ADVISED", summary: "current strategy", created_at: NOW.toISOString() },
    ],
  }), { userMessage: "what now", focus: null, objective: null }, NOW);
  const ids = compiled.packet.source_adaptations.map((a) => (a as { id: string }).id);
  assert.ok(ids.includes("a-v2"));
  assert.ok(!ids.includes("a-v1"));
  assert.ok(compiled.report.dropped.some((d) => d.kind === "adaptation" && d.id === "a-v1"));
});

test("bulky content is compressed with a recoverable-original marker and flagged", () => {
  const big = "x".repeat(5_000);
  const compiled = compileContext(situation({
    observations: [{ id: "obs-big", observation_kind: "WEB_SEARCH_RESULT", content: { note: big }, observed_at: NOW.toISOString(), source_type: "SYSTEM" }],
  }), { userMessage: "check the observation", focus: null, objective: null }, NOW);
  const record = compiled.packet.observations[0] as { content: string };
  assert.ok(record.content.length < 5_000);
  assert.match(record.content, /truncated; recoverable from source record/);
  assert.ok(compiled.report.truncated.some((t) => t.kind === "observation" && t.id === "obs-big"));
});

test("the budget is enforced: observations and episodes drop before memories", () => {
  const bigMemory = { id: "m-big", status: "ACTIVE", content: "User is preparing for an AI-native operations career move", importance: 0.9, confidence: 0.9, updated_at: NOW.toISOString() };
  const observations = Array.from({ length: 10 }, (_, i) => ({
    id: `obs-${i}`, observation_kind: "WEB_SEARCH_RESULT", content: { note: "y".repeat(4_000) }, observed_at: NOW.toISOString(), source_type: "SYSTEM",
  }));
  const episodes = Array.from({ length: 4 }, (_, i) => ({
    session_id: `sess-${i}`, title: `session ${i}`, status: "ACTIVE", updated_at: NOW.toISOString(),
    latest_user_message: "z".repeat(3_000), latest_stryde_message: "z".repeat(3_000),
  }));
  const compiled = compileContext(
    situation({ memories: [bigMemory], observations, episodic_memory: episodes }),
    { userMessage: "next move", focus: null, objective: "operations" },
    NOW,
    6_000, // tiny budget forces drops
  );
  assert.ok(compiled.report.used_chars <= 6_000, `packet must fit the budget, used ${compiled.report.used_chars}`);
  const memoryIds = compiled.packet.memories.map((m) => (m as { id: string }).id);
  assert.ok(memoryIds.includes("m-big"), "memories are the last thing dropped");
  assert.ok(compiled.report.dropped.some((d) => d.kind === "observation" || d.kind === "episode"));
});

test("the default budget is generous and a realistic situation fits without drops", () => {
  const compiled = compileContext(situation({
    memories: [{ id: "m1", status: "ACTIVE", content: "Prefers written summaries", importance: 0.7, confidence: 0.8, updated_at: NOW.toISOString() }],
    observations: [{ id: "o1", observation_kind: "WEB_SEARCH_RESULT", content: { note: "small" }, observed_at: NOW.toISOString(), source_type: "SYSTEM" }],
  }), { userMessage: "next move", focus: null, objective: null }, NOW);
  assert.equal(compiled.report.budget_chars, CONTEXT_BUDGET_CHARS);
  assert.ok(compiled.report.dropped.length === 0);
});

test("compileForSituation derives the objective from the objective claim", () => {
  const compiled = compileForSituation(situation(), { userMessage: "what about my goal" }, NOW);
  assert.equal(compiled.packet.pursuit.objective, "Land my first AI-native operations client");
});

test("the packet carries worker capabilities and capability flags", () => {
  const compiled = compileContext(situation({
    worker_capabilities: [{ worker_type: "BROWSER", tool_id: "t1", tool_version: "v1" }],
  }), { userMessage: "observe a page", focus: null, objective: null }, NOW);
  assert.equal(compiled.packet.worker_capabilities[0].worker_type, "BROWSER");
  assert.equal(compiled.packet.capabilities.web_search, true);
});
