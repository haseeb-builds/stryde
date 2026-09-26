import assert from "node:assert/strict";
import test from "node:test";
import { ACTOR_TYPES, defaultActorForWorkMode, normalizeActor } from "../lib/actor.ts";

test("actor allocation has four explicit actor types", () => {
  assert.deepEqual(ACTOR_TYPES, ["HUMAN", "STRYDE", "WORKER", "CONTROLLED_TOOL"]);
});

test("default actor follows the work mode boundary", () => {
  assert.equal(defaultActorForWorkMode("CREATE_ACTION"), "HUMAN");
  assert.equal(defaultActorForWorkMode("ASK_USER"), "HUMAN");
  assert.equal(defaultActorForWorkMode("ANALYZE"), "STRYDE");
  assert.equal(defaultActorForWorkMode("EXECUTE_TOOL"), "CONTROLLED_TOOL");
});

test("unknown actor values are normalized to a safe default", () => {
  assert.equal(normalizeActor("CREATE_ACTION", "anything"), "HUMAN");
  assert.equal(normalizeActor("ANALYZE", "anything"), "STRYDE");
  assert.equal(normalizeActor("ANALYZE", "WORKER"), "WORKER");
});
