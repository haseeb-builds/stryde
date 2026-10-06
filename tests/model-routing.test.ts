// Task-aware model routing (Phase 12) — pure logic.
import test from "node:test";
import assert from "node:assert/strict";
import { taskClassFor, modelOverrideForTask } from "../lib/model-routing.ts";

test("routing: routine transformations are FAST, decisions and synthesis are STRONG", () => {
  assert.equal(taskClassFor("stryde_source_adaptation"), "FAST");
  assert.equal(taskClassFor("stryde_model_proposal"), "FAST");
  assert.equal(taskClassFor("stryde_conversation_turn"), "STRONG");
  assert.equal(taskClassFor("stryde_work_controller"), "STRONG");
  assert.equal(taskClassFor("stryde_adaptive_work_controller"), "STRONG");
  assert.equal(taskClassFor("stryde_something_new"), "STRONG", "unknown tasks fail toward quality");
});

test("routing: no overrides configured means no override — provider default serves", () => {
  assert.equal(modelOverrideForTask("stryde_conversation_turn", {} as unknown as NodeJS.ProcessEnv), undefined);
  assert.equal(modelOverrideForTask("stryde_source_adaptation", {} as unknown as NodeJS.ProcessEnv), undefined);
});

test("routing: overrides apply per task class only", () => {
  const env = { STRYDE_MODEL_FAST: "cheap-model", STRYDE_MODEL_STRONG: "strong-model" } as unknown as NodeJS.ProcessEnv;
  assert.equal(modelOverrideForTask("stryde_source_adaptation", env), "cheap-model");
  assert.equal(modelOverrideForTask("stryde_conversation_turn", env), "strong-model");
});
