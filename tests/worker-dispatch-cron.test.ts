import assert from "node:assert/strict";
import test from "node:test";
import { isWorkerDispatchAuthorized, boundedResult } from "../lib/worker-dispatch-runner.ts";

test("worker dispatch auth: rejects unauthorized invocation when secrets are set", () => {
  const env: NodeJS.ProcessEnv = {
    CRON_SECRET: "test-cron-secret",
    STRYDE_WORKER_SECRET: "test-worker-secret",
    NODE_ENV: "production",
  };

  assert.equal(isWorkerDispatchAuthorized(null, null, env), false);
  assert.equal(isWorkerDispatchAuthorized("Bearer wrong", null, env), false);
  assert.equal(isWorkerDispatchAuthorized(null, "wrong-secret", env), false);
});

test("worker dispatch auth: accepts Bearer CRON_SECRET authorization", () => {
  const env: NodeJS.ProcessEnv = {
    CRON_SECRET: "test-cron-secret-12345",
    NODE_ENV: "production",
  };

  assert.equal(isWorkerDispatchAuthorized("Bearer test-cron-secret-12345", null, env), true);
  assert.equal(isWorkerDispatchAuthorized("Bearer wrong", null, env), false);
});

test("worker dispatch auth: accepts x-stryde-worker-secret header authorization", () => {
  const env: NodeJS.ProcessEnv = {
    STRYDE_WORKER_SECRET: "test-worker-secret-67890",
    NODE_ENV: "production",
  };

  assert.equal(isWorkerDispatchAuthorized(null, "test-worker-secret-67890", env), true);
  assert.equal(isWorkerDispatchAuthorized(null, "wrong-secret", env), false);
});

test("boundedResult: caps results larger than 200KB safely without throwing", () => {
  const small = { key: "value", count: 123 };
  assert.deepEqual(boundedResult(small), small);

  const largeString = "a".repeat(250_000);
  const large = { text: largeString };
  const truncated = boundedResult(large) as { truncated: boolean; preview: string; original_size_bytes: number };
  assert.equal(truncated.truncated, true);
  assert.ok(truncated.preview.length <= 195_000);
  assert.ok(truncated.original_size_bytes > 200_000);
});
