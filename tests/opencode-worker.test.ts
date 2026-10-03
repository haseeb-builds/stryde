import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { collectArtifacts, decideWorkerOutcome } from "../scripts/opencode-worker.ts";

// Pins the epistemic rules of the OpenCode worker. These are the same rules the
// proven Hermes worker runs under, and they are the plane's contract:
//   - exit 0 with NO artifacts = FAILED (a worker that did nothing is not a success);
//   - killed by timeout = UNKNOWN, never FAILED and never SUCCEEDED;
//   - non-zero exit = FAILED with stderr retained;
//   - artifacts present + exit 0 = SUCCEEDED with the artifact list.

const ARTIFACT = [{ path: "proof.md", bytes: 25, preview: "OPENCODE WORKER PRODUCED THIS" }];

test("a run killed by timeout is UNKNOWN, never FAILED and never SUCCEEDED", () => {
  const outcome = decideWorkerOutcome({ timedOut: true, code: null, stdout: "partial", stderr: "", artifacts: [] });
  assert.equal(outcome.status, "UNKNOWN");
  assert.match(outcome.error ?? "", /runtime budget/);
  assert.equal(outcome.result.timed_out, true);
});

test("a child killed by an untracked signal (null code) is UNKNOWN too", () => {
  const outcome = decideWorkerOutcome({ timedOut: false, code: null, stdout: "", stderr: "", artifacts: ARTIFACT });
  assert.equal(outcome.status, "UNKNOWN", "even with artifacts on disk, a killed run has no known outcome");
  assert.equal(outcome.result.timed_out, true);
});

test("exit 0 with no artifacts is FAILED, not an empty success", () => {
  const outcome = decideWorkerOutcome({ timedOut: false, code: 0, stdout: "I decided not to write files", stderr: "", artifacts: [] });
  assert.equal(outcome.status, "FAILED");
  assert.match(outcome.error ?? "", /produced no artifacts/);
  assert.equal(outcome.result.artifacts.length, 0);
});

test("non-zero exit is FAILED with the stderr retained", () => {
  const stderr = "progress lines...\nError: The model `no-such-model` does not exist or you do not have access to it.";
  const outcome = decideWorkerOutcome({ timedOut: false, code: 1, stdout: "", stderr, artifacts: [] });
  assert.equal(outcome.status, "FAILED");
  assert.match(outcome.error ?? "", /exited with code 1/);
  assert.ok(outcome.result.stderr?.includes("does not exist or you do not have access"), "the real error must survive into the result");
});

test("oversized stderr is bounded, not dropped", () => {
  const outcome = decideWorkerOutcome({ timedOut: false, code: 2, stdout: "", stderr: "x".repeat(50_000), artifacts: [] });
  assert.equal(outcome.status, "FAILED");
  assert.ok((outcome.result.stderr ?? "").length <= 4_000, "stderr must be size-bounded before storage");
});

test("artifacts present with exit 0 is SUCCEEDED and carries the artifact list", () => {
  const outcome = decideWorkerOutcome({ timedOut: false, code: 0, stdout: "Created proof.md", stderr: "", artifacts: ARTIFACT });
  assert.equal(outcome.status, "SUCCEEDED");
  assert.equal(outcome.error, null);
  assert.deepEqual(outcome.result.artifacts, ARTIFACT);
  assert.ok(outcome.result.stdout?.includes("Created proof.md"));
});

test("timeout wins over a zero exit code: a killed run is never repainted as success", () => {
  const outcome = decideWorkerOutcome({ timedOut: true, code: 0, stdout: "", stderr: "", artifacts: ARTIFACT });
  assert.equal(outcome.status, "UNKNOWN");
});

test("collectArtifacts reads real files and skips hidden entries", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "stryde-opencode-worker-test-"));
  try {
    writeFileSync(path.join(dir, "proof.md"), "OPENCODE WORKER PRODUCED THIS");
    writeFileSync(path.join(dir, ".opencode"), "hidden session state");
    mkdirSync(path.join(dir, "nested"));
    writeFileSync(path.join(dir, "nested", "out.txt"), "nested artifact");

    const artifacts = collectArtifacts(dir);
    const names = artifacts.map((a) => a.path.replace(/\\/g, "/")).sort();

    assert.ok(names.includes("proof.md"), `proof.md missing from ${names.join(", ")}`);
    assert.ok(names.includes("nested/out.txt"), `nested artifact missing from ${names.join(", ")}`);
    assert.ok(!names.some((n) => n.includes(".opencode")), "hidden entries must not be reported as artifacts");
    const proof = artifacts.find((a) => a.path === "proof.md");
    assert.equal(proof?.bytes, "OPENCODE WORKER PRODUCED THIS".length);
    assert.ok(proof?.preview.includes("OPENCODE WORKER PRODUCED THIS"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("collectArtifacts tolerates a missing directory", () => {
  assert.deepEqual(collectArtifacts(path.join(tmpdir(), "stryde-opencode-worker-does-not-exist")), []);
});
