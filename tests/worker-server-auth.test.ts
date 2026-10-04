import assert from "node:assert/strict";
import test from "node:test";
import { WORKER_TYPES } from "../lib/worker-gateway.ts";
import { workerEnvPrefix } from "../lib/worker-gateway.ts";
import {
  isAuthorizedWorkerRequest,
  isKnownWorkerType,
  workerTokenEnvKey,
} from "../lib/worker-server-auth.ts";
import { workerToolKey, workerTypeForToolKey } from "../lib/worker-contract.ts";

// Pins the worker plane's inbound credential contract.
//
// Before lib/worker-server-auth.ts existed, lib/worker-gateway.ts already sent
// `Authorization: Bearer <STRYDE_<WORKER>_TOKEN>` but neither worker server
// checked it, so the credential the tool contract declares
// (tool.credential_scope = STRYDE_<WORKER>_TOKEN) was never enforced on the
// socket. These tests pin the fail-closed behaviour that closed that gap.

const auth = (value?: string) => ({ authorization: value }) as Record<string, string>;

test("the env contract is derived from the worker type, not hardcoded per branch", () => {
  for (const type of WORKER_TYPES) {
    assert.equal(workerEnvPrefix(type), `STRYDE_${type}`);
    assert.equal(workerTokenEnvKey(type), `STRYDE_${type}_TOKEN`);
    // The gateway and the server must agree on the same key by construction.
    assert.equal(workerEnvPrefix(type) + "_TOKEN", workerTokenEnvKey(type));
  }
});

test("a worker with no configured token authorizes nothing (fails closed)", () => {
  const env = {} as unknown as NodeJS.ProcessEnv;
  for (const type of WORKER_TYPES) {
    assert.equal(
      isAuthorizedWorkerRequest(type, auth("Bearer anything"), env),
      false,
      `${type} must reject every request when no token is configured`,
    );
  }
});

test("the matching bearer token is accepted and a wrong one is refused", () => {
  const env = { STRYDE_HERMES_TOKEN: "correct-horse" } as unknown as NodeJS.ProcessEnv;
  assert.equal(isAuthorizedWorkerRequest("HERMES", auth("Bearer correct-horse"), env), true);
  assert.equal(isAuthorizedWorkerRequest("HERMES", auth("Bearer wrong-horse"), env), false);
  assert.equal(isAuthorizedWorkerRequest("HERMES", auth("correct-horse"), env), false, "the Bearer scheme is required");
  assert.equal(isAuthorizedWorkerRequest("HERMES", auth("Bearer correct-hors"), env), false, "a prefix is not a token");
  assert.equal(isAuthorizedWorkerRequest("HERMES", auth("Bearer correct-horse-extra"), env), false);
  assert.equal(isAuthorizedWorkerRequest("HERMES", {}, env), false, "no header is not authorization");
});

test("one worker's token never authorizes a different worker type", () => {
  const env = { STRYDE_HERMES_TOKEN: "shared-secret" } as unknown as NodeJS.ProcessEnv;
  assert.equal(
    isAuthorizedWorkerRequest("OPENCODE", auth("Bearer shared-secret"), env),
    false,
    "a Hermes-scoped credential must not open the OpenCode worker",
  );
});

test("an unknown worker type can never pass the env or tool-key contract", () => {
  assert.equal(isKnownWorkerType("HERMES"), true);
  assert.equal(isKnownWorkerType("hermes"), false, "worker types are frozen uppercase");
  assert.equal(isKnownWorkerType("NOPE"), false);
  assert.equal(isKnownWorkerType(undefined), false);
  assert.throws(() => workerTypeForToolKey("worker.nope"), /Unsupported worker tool/);
  assert.throws(() => workerTypeForToolKey(undefined), /Unsupported worker tool/);
});

test("every worker type is addressable by a derived tool key", () => {
  for (const type of WORKER_TYPES) {
    assert.equal(workerToolKey(type), `worker.${type.toLowerCase()}`);
    assert.equal(workerTypeForToolKey(workerToolKey(type)), type);
  }
});
