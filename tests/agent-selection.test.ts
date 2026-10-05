import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvePreferredWorkers } from "../lib/agent-selection.ts";

const ALL = ["HERMES", "OPENCODE", "BROWSER"] as const;

test("no preference means Stryde chooses across everything available", () => {
  const result = resolvePreferredWorkers({ preferred: null, source: "STRYDE_AUTO" }, ALL);
  assert.deepEqual(result.allowed, [...ALL]);
  assert.match(result.note ?? "", /weigh task fit/);
});

test("a preferred, connected agent narrows the allocation to it", () => {
  const result = resolvePreferredWorkers({ preferred: "OPENCODE", source: "PURSUIT_OVERRIDE" }, ALL);
  assert.deepEqual(result.allowed, ["OPENCODE"]);
  assert.match(result.note ?? "", /prefers the OPENCODE agent/);
});

test("a preferred but unconnected agent degrades to the available set, never an error", () => {
  const result = resolvePreferredWorkers({ preferred: "BROWSER", source: "GLOBAL_PREFERENCE" }, ["HERMES"]);
  assert.deepEqual(result.allowed, ["HERMES"]);
  assert.match(result.note ?? "", /not connected right now/);
});
