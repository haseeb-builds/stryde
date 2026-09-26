import assert from "node:assert/strict";
import test from "node:test";
import { assertWorkerToolBinding, parseWorkerJobArguments, workerTypeForToolKey } from "../lib/worker-contract.ts";

test("worker job arguments are bounded and typed", () => {
  const args = parseWorkerJobArguments({
    worker_type: "HERMES",
    instruction: "Research the supplied question.",
    context: { pursuit_id: "p1" },
    idempotency_key: "job-1",
  });
  assert.equal(args.worker_type, "HERMES");
  assert.equal(args.instruction, "Research the supplied question.");
});

test("worker arguments reject malformed context and unsupported workers", () => {
  assert.throws(() => parseWorkerJobArguments({ worker_type: "NOPE", instruction: "x", context: {}, idempotency_key: "1" }), /worker_type/);
  assert.throws(() => parseWorkerJobArguments({ worker_type: "HERMES", instruction: "x", context: [], idempotency_key: "1" }), /context/);
});

test("tool binding must match the frozen worker type", () => {
  const args = parseWorkerJobArguments({
    worker_type: "OPENCODE",
    instruction: "Implement the requested code change.",
    context: { repo: "stryde" },
    idempotency_key: "job-2",
  });
  assert.equal(workerTypeForToolKey("worker.opencode"), "OPENCODE");
  assert.doesNotThrow(() => assertWorkerToolBinding("worker.opencode", "v1", args));
  assert.throws(() => assertWorkerToolBinding("worker.hermes", "v1", args), /do not match/);
  assert.throws(() => assertWorkerToolBinding("worker.opencode", "v2", args), /version/);
});
