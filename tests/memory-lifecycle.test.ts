import assert from "node:assert/strict";
import { test } from "node:test";
import {
  memoryContentMatches,
  nextConfirmationState,
  normalizeMemoryKey,
  rankMemories,
  tokenizeMemoryContent,
} from "../lib/memory-core.ts";

// A fixed clock makes the ranking assertions fully deterministic — the
// recency score is computed against FIXED_NOW, not the real wall clock.
const FIXED_NOW = new Date("2026-10-04T12:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(FIXED_NOW.getTime() - days * 86_400_000).toISOString();
}

test("normalizeMemoryKey collapses case, punctuation, and whitespace", () => {
  assert.equal(normalizeMemoryKey("  No, Dairy! (at all)  "), "no dairy at all");
  assert.equal(normalizeMemoryKey("No DAIRY."), "no dairy");
});

test("tokenizeMemoryContent drops stopwords and short tokens", () => {
  const tokens = tokenizeMemoryContent("The candidate lives in Berlin and can only work remotely");
  assert.deepEqual(tokens, ["candidate", "lives", "berlin", "work", "remotely"]);
});

test("memoryContentMatches exact and containment, not fragments", () => {
  assert.equal(memoryContentMatches("No dairy", "no  dairy."), true);
  assert.equal(memoryContentMatches("no dairy", "no dairy because of an allergy"), true);
  assert.equal(memoryContentMatches("no dairy because of an allergy", "no dairy"), true);
  assert.equal(memoryContentMatches("prefers email", "likes phone calls"), false);
});

test("nextConfirmationState strengthens and promotes at the threshold", () => {
  const promoted = nextConfirmationState(
    { confidence: 0.7, importance: 0.4, status: "CANDIDATE" },
    { confidence: 0.5, importance: 0.6 },
  );
  assert.equal(promoted.status, "ACTIVE");
  assert.equal(promoted.confidence, 0.85);
  assert.equal(promoted.importance, 0.6);

  const stillCandidate = nextConfirmationState(
    { confidence: 0.5, importance: 0.4, status: "CANDIDATE" },
    { confidence: 0.4, importance: 0.4 },
  );
  assert.equal(stillCandidate.status, "CANDIDATE");
  assert.equal(stillCandidate.confidence, 0.65);

  const capped = nextConfirmationState(
    { confidence: 0.92, importance: 0.5, status: "ACTIVE" },
    { confidence: 0.9, importance: 0.5 },
  );
  assert.ok(capped.confidence <= 0.95);
});

function memory(overrides: Record<string, unknown>) {
  return {
    id: overrides.id as string,
    memory_scope: (overrides.memory_scope as string | undefined) ?? "PURSUIT",
    memory_type: (overrides.memory_type as string | undefined) ?? "FACT",
    status: (overrides.status as string | undefined) ?? "ACTIVE",
    content: (overrides.content as string | undefined) ?? "",
    confidence: (overrides.confidence as number | undefined) ?? 0.5,
    importance: (overrides.importance as number | undefined) ?? 0.5,
    updated_at: (overrides.updated_at as string | undefined) ?? daysAgo(0),
    last_confirmed_at: (overrides.last_confirmed_at ?? null) as string | null,
  };
}

test("rankMemories drops non-live statuses", () => {
  const ranked = rankMemories(
    [
      memory({ id: "stale", status: "STALE", content: "old thing" }),
      memory({ id: "contradicted", status: "CONTRADICTED", content: "wrong thing" }),
      memory({ id: "superseded", status: "SUPERSEDED", content: "replaced thing" }),
      memory({ id: "live", content: "real thing" }),
    ],
    {},
    FIXED_NOW,
  );
  assert.deepEqual(ranked.map((m) => m.id), ["live"]);
});

test("rankMemories prefers relevance to the current objective", () => {
  const ranked = rankMemories(
    [
      memory({ id: "irrelevant-high", content: "enjoys chess on weekends", importance: 0.9, confidence: 0.9 }),
      memory({ id: "relevant", content: "wants the berlin apartment by march", importance: 0.6, confidence: 0.6 }),
    ],
    { objective: "secure the berlin apartment" },
    FIXED_NOW,
  );
  assert.equal(ranked[0].id, "relevant");
});

test("rankMemories penalizes stale candidates harder than stale active memories", () => {
  const ranked = rankMemories(
    [
      memory({ id: "old-candidate", status: "CANDIDATE", content: "half-forgotten note", updated_at: daysAgo(30) }),
      memory({ id: "old-active", content: "long-standing reality", updated_at: daysAgo(30), last_confirmed_at: daysAgo(30) }),
    ],
    {},
    FIXED_NOW,
  );
  assert.equal(ranked[0].id, "old-active");
});

test("rankMemories applies separate user and pursuit limits", () => {
  const ranked = rankMemories(
    [
      memory({ id: "u1", memory_scope: "USER", content: "user fact one" }),
      memory({ id: "u2", memory_scope: "USER", content: "user fact two" }),
      memory({ id: "u3", memory_scope: "USER", content: "user fact three" }),
      memory({ id: "p1", memory_scope: "PURSUIT", content: "pursuit fact one" }),
    ],
    {},
    FIXED_NOW,
    { user: 2, pursuit: 1 },
  );
  assert.equal(ranked.length, 3);
  assert.ok(ranked.some((m) => m.id === "p1"));
  assert.ok(ranked.some((m) => m.id === "u1"));
  assert.ok(ranked.some((m) => m.id === "u2"));
  assert.ok(!ranked.some((m) => m.id === "u3"));
});
