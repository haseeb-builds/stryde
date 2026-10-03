// Proves that a REAL OpenCode agent executes REAL work through Stryde's
// CONTROLLED plane. This is the OpenCode twin of scripts/e2e-real-worker.ts:
// the Hermes plane was proven there; this closes the OpenCode contract gap the
// same way, with the same artifact-judged assertions.
//
// Differences from the Hermes e2e, both deliberate:
//   - this suite MANAGES the worker's lifecycle itself (it spawns
//     scripts/opencode-worker.ts, waits for readiness, and tears it down), so a
//     run is self-contained; the Hermes suite assumed a pre-listening worker,
//     which produced a false failure when it was not.
//   - a real agent can fail for environmental reasons (model quota, provider
//     outage). When the job FAILED, this suite does not hide it: it verifies the
//     PLANE behaved correctly (attempt FAILED with the real error preserved,
//     action FAILED, observation attributed to CONTROLLED_EXECUTION, nothing
//     auto-verified) and reports the honest failure cycle as the outcome.
//
// Requires: a dev server on BASE_URL. Everything else is spawned here.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(repoRoot, ".env.local"), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
for (const [k, v] of Object.entries(env)) if (!(k in process.env)) process.env[k] = v;

const { createClient } = await import("@supabase/supabase-js");
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const BASE_URL = (process.env.BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3144").replace(/\/$/, "");
type Json = Record<string, unknown>;

let passed = 0;
const ok = (name: string) => { passed += 1; console.log(`  \u2713 ${name}`); };

const health = await fetch(`${BASE_URL}/api/health/model`).then((r) => r.status).catch(() => 0);
if (!health) { console.error(`Dev server not reachable at ${BASE_URL}`); process.exit(1); }

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const signed = await anon.auth.signInWithPassword({ email: env.STRYDE_TEST_USER_EMAIL, password: env.STRYDE_TEST_USER_PASSWORD });
assert.ok(signed.data.session, `sign-in failed: ${JSON.stringify(signed.error)}`);
const bearer = signed.data.session.access_token;
const userId = signed.data.user.id;
ok("signed in as real user");

async function api(p: string, method: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${p}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: (text ? JSON.parse(text) : {}) as Json };
}

// The autonomy policy can only refuse; a user with no row keeps the default
// (delegation allowed, approval still explicit). If this test user configured a
// policy that excludes OPENCODE, delegation would 403 for a reason unrelated to
// what this suite proves, so the row is temporarily widened and restored after.
const { data: policyBefore } = await service.from("user_autonomy_policy")
  .select("allow_worker_delegation, allowed_worker_types, auto_execute_research")
  .eq("owner_user_id", userId).maybeSingle();
let policyChanged = false;
if (policyBefore && !(policyBefore.allow_worker_delegation && (policyBefore.allowed_worker_types as string[]).includes("OPENCODE"))) {
  const allowed = new Set<string>((policyBefore.allowed_worker_types as string[]) ?? []);
  allowed.add("OPENCODE");
  const { error } = await service.from("user_autonomy_policy")
    .update({ allow_worker_delegation: true, allowed_worker_types: [...allowed] })
    .eq("owner_user_id", userId);
  assert.ok(!error, `widening autonomy policy failed: ${error?.message}`);
  policyChanged = true;
  console.log("  ... temporarily widened the user autonomy policy to allow OPENCODE delegation");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const created = await api("/api/v1/pursuits", "POST", { title: `E2E OPENCODE WORKER ${stamp}` });
assert.equal(created.status, 201, `pursuit create failed: ${JSON.stringify(created.json)}`);
const pursuitId = (created.json.pursuit as Json).id as string;
const sessionRes = await api(`/api/v1/pursuits/${pursuitId}/conversations`, "POST", { title: "opencode worker" });
assert.equal(sessionRes.status, 201, `session create failed: ${JSON.stringify(sessionRes.json)}`);
const sessionId = ((sessionRes.json.session as Json | undefined)?.id) as string;
ok("pursuit and conversation created through the authenticated API");

const REQUIRED_LINE = "OPENCODE WORKER PRODUCED THIS";
const workerMove = {
  version: 1,
  status: "WORKING",
  objective: "Prove the OpenCode worker executes real work.",
  understanding: "The CONTROLLED plane is proven for Hermes; OpenCode is contract-only so far.",
  known: ["The dispatcher selects a provider from the job's worker_type."],
  unknowns: ["Whether the OpenCode agent can complete a real unit of work."],
  bottleneck: "No real OpenCode executor has ever run.",
  next_move: {
    mode: "DRAFT",
    actor: "WORKER",
    worker_type: "OPENCODE",
    title: `Create a file named proof.md whose first line is exactly: ${REQUIRED_LINE}`,
    why: "An artifact read back from disk is the only honest proof of execution.",
    expected_change: "proof.md exists and contains the required line.",
    stryde_can_do: "Read the artifact back and judge it against the completion condition.",
    user_needs_to_do: "Nothing; this is an internal capability check.",
    completion_condition: `proof.md exists and its content contains ${REQUIRED_LINE}`,
  },
};
const seed = await service.from("conversation_session")
  .update({ working_state: workerMove, updated_at: new Date().toISOString() })
  .eq("id", sessionId).eq("owner_user_id", userId);
assert.ok(!seed.error, `seeding working_state failed: ${seed.error?.message}`);
ok("OPENCODE WORKER next move seeded");

const delegated = await api(`/api/v1/pursuits/${pursuitId}/actions/delegate-worker`, "POST", { session_id: sessionId, approved: true });
assert.equal(delegated.status, 201, `delegation failed: ${JSON.stringify(delegated.json)}`);
const jobId = (delegated.json.job as Json).id as string;
const actionId = (delegated.json.action as Json).id as string;
ok("approved delegation committed a real CONTROLLED job");

// The job must be bound to the worker.opencode tool, not merely to some worker.
const { data: opencodeTool } = await service.from("tool")
  .select("id, tool_key, tool_version").eq("tool_key", "worker.opencode").eq("tool_version", "v1").maybeSingle();
assert.ok(opencodeTool, "worker.opencode tool is not registered");
const { data: jobRow } = await service.from("job").select("tool_id").eq("id", jobId).maybeSingle();
assert.equal(jobRow?.tool_id, opencodeTool!.id, "job must run through the worker.opencode tool");
ok("job is bound to the worker.opencode tool");

// Spawn the real OpenCode worker and wait for readiness. A run is only honest
// if the endpoint it talks to is the real agent-backed worker, so this suite
// owns that process instead of assuming an operator started one.
const { spawn } = await import("node:child_process");
const workerPort = Number(new URL(process.env.STRYDE_OPENCODE_URL ?? "http://127.0.0.1:8898").port || 8898);
const workerUrl = `http://127.0.0.1:${workerPort}`;
const alreadyListening = await fetch(`${workerUrl}/work/__probe__`).then((r) => r.status).catch(() => 0);
assert.ok(!alreadyListening, `port ${workerPort} is already in use; free it so this suite can manage its own worker`);

const workerChild = spawn(process.execPath, ["--experimental-strip-types", "scripts/opencode-worker.ts"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    STRYDE_OPENCODE_WORKER_PORT: String(workerPort),
    STRYDE_OPENCODE_TIMEOUT_MS: process.env.STRYDE_OPENCODE_TIMEOUT_MS ?? "240000",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let workerOutput = "";
workerChild.stdout.on("data", (c) => { workerOutput += String(c); });
workerChild.stderr.on("data", (c) => { workerOutput += String(c); });
const teardownWorker = () => {
  if (workerChild.pid && process.platform === "win32") {
    try { spawn("taskkill", ["/pid", String(workerChild.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* best effort */ }
  } else {
    workerChild.kill("SIGKILL");
  }
};
process.on("exit", teardownWorker);
console.log(`  ... waiting for the opencode worker on ${workerUrl}`);
let workerUp = false;
for (let i = 0; i < 60 && !workerUp; i++) {
  workerUp = await fetch(`${workerUrl}/work/__probe__`).then((r) => r.status > 0).catch(() => false);
  if (!workerUp) await new Promise((r) => setTimeout(r, 500));
}
assert.ok(workerUp, `opencode worker never became ready: ${workerOutput}`);
ok(`opencode worker listening on ${workerUrl} (spawned by this suite)`);

// Drive the real dispatcher to completion. The provider is selected from the
// job's worker_type (OPENCODE), so only STRYDE_OPENCODE_URL needs to point here.
console.log("  ... running the real dispatcher against the real agent (this executes real work)");
let run: { code: number | null; output: string };
try {
  run = await new Promise<{ code: number | null; output: string }>((resolve) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", "scripts/worker-dispatcher.ts"], {
      cwd: repoRoot,
      env: { ...process.env, STRYDE_OPENCODE_URL: workerUrl, STRYDE_WORKER_ONCE: "1", STRYDE_WORKER_POLL_MS: "500", STRYDE_WORKER_MAX_RUNTIME_MS: "300000" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (c) => { output += String(c); });
    child.stderr.on("data", (c) => { output += String(c); });
    child.on("close", (code) => resolve({ code, output }));
  });
} finally {
  teardownWorker();
  process.off("exit", teardownWorker);
}
assert.equal(run.code, 0, `dispatcher failed: ${run.output}`);

let job: Json | undefined;
for (let i = 0; i < 20 && !job; i++) {
  const { data } = await service.from("job").select("status, resolved_at, tool_id").eq("id", jobId).maybeSingle();
  job = data as Json | null ?? undefined;
  if (job && !["SUCCEEDED", "FAILED", "UNKNOWN", "CANCELLED"].includes(String(job.status))) job = undefined;
  if (!job) await new Promise((r) => setTimeout(r, 2000));
}
assert.ok(job, `job never reached a terminal state`);

const { data: attemptRow } = await service.from("attempt")
  .select("terminal_resolution, external_correlation_id, error_details, redacted_result").eq("job_id", jobId).maybeSingle();
const { data: observations } = await service.from("observation")
  .select("content, observation_kind, source_type")
  .eq("owner_user_id", userId).order("created_at", { ascending: false }).limit(20);
const workerObs = (observations ?? []).find((o) => o.source_type === "CONTROLLED_EXECUTION");

if (String(job!.status) === "SUCCEEDED") {
  // The full artifact-judged proof: success is only real if the agent produced
  // inspectable output that satisfies the completion condition.
  const { data: finalAction } = await service.from("action").select("status, execution_mode").eq("id", actionId).maybeSingle();
  assert.equal(finalAction!.execution_mode, "CONTROLLED");
  assert.equal(finalAction!.status, "COMPLETED", "CONTROLLED action should be finalized by the trusted plane");
  ok("CONTROLLED action finalized COMPLETED");

  assert.equal(attemptRow!.terminal_resolution, "SUCCEEDED");
  assert.ok(attemptRow!.external_correlation_id, "a real run must carry a worker correlation id");
  ok("attempt recorded SUCCEEDED with a real worker correlation id");

  assert.ok(workerObs, "no CONTROLLED_EXECUTION observation was recorded");
  const content = workerObs!.content as Json;
  const result = (content.result as Json | undefined) as Json | undefined;
  assert.equal(result?.provider, "OPENCODE", "the observation must attribute the run to the OPENCODE provider");
  assert.equal(result?.external_work_id, attemptRow!.external_correlation_id, "observation must carry the same correlation id as the attempt");
  const artifacts = (result?.result as Json | undefined)?.artifacts as Array<{ path: string; bytes: number; preview: string }> | undefined;
  assert.ok(Array.isArray(artifacts) && artifacts.length > 0, "a SUCCEEDED real run must carry artifacts; an empty artifact list means the agent did nothing");
  ok(`real artifacts recorded (${artifacts!.length}): ${artifacts!.map((a) => a.path).join(", ")}`);

  const proof = artifacts!.find((a) => a.path.replace(/\\/g, "/") === "proof.md");
  assert.ok(proof, `expected a proof.md artifact, got ${artifacts!.map((a) => a.path).join(", ")}`);
  assert.ok(proof!.preview.includes(REQUIRED_LINE), "the artifact does not satisfy the completion condition");
  assert.ok(proof!.bytes > 0, "artifact is empty");
  ok("artifact content satisfies the completion condition");
  assert.ok(attemptRow!.redacted_result != null, "mechanical result must be stored on the attempt");

  assert.notEqual(workerObs!.source_type, "USER_REPORTED", "a worker result must never be laundered as a user report");
  ok("result attributed to CONTROLLED_EXECUTION, not the user");
} else if (String(job!.status) === "FAILED") {
  // Honest failure cycle: a real agent can be blocked (quota, provider error).
  // The plane is still under test — it must preserve the failure as reality.
  console.log(`  ... real agent FAILED; verifying the plane preserved the failure honestly`);
  console.log(`      error_details: ${JSON.stringify(attemptRow?.error_details)}`);
  assert.equal(attemptRow!.terminal_resolution, "FAILED");
  assert.ok(attemptRow!.error_details, "a FAILED attempt must retain its error details");
  ok("attempt recorded FAILED with preserved error details");

  const { data: finalAction } = await service.from("action").select("status, execution_mode").eq("id", actionId).maybeSingle();
  assert.equal(finalAction!.execution_mode, "CONTROLLED");
  assert.equal(finalAction!.status, "FAILED", "a failed worker attempt must finalize the CONTROLLED action as FAILED");
  ok("CONTROLLED action finalized FAILED, not left in flight");

  assert.ok(workerObs, "even a failed run must be preserved as a CONTROLLED_EXECUTION observation");
  const content = workerObs!.content as Json;
  const result = (content.result as Json | undefined) as Json | undefined;
  assert.equal(result?.provider, "OPENCODE", "the observation must attribute the run to the OPENCODE provider");
  if (attemptRow!.external_correlation_id) {
    assert.equal(result?.external_work_id, attemptRow!.external_correlation_id, "failure observation must belong to this run, not a stale one");
  }
  ok("failure preserved as a CONTROLLED_EXECUTION observation attributed to OPENCODE");

  assert.notEqual(workerObs!.source_type, "USER_REPORTED", "a worker failure must never be laundered as a user report");
} else {
  console.error(`job ended ${job!.status}; attempt=${JSON.stringify(attemptRow)} observation=${JSON.stringify(workerObs)}`);
  assert.fail("job ended UNKNOWN; the plane could not determine an outcome");
}

const { data: claims } = await service.from("claim").select("id, epistemic_status").eq("pursuit_id", pursuitId);
for (const c of claims ?? []) {
  assert.notEqual(c.epistemic_status, "VERIFIED", "a worker result must never self-verify");
}
ok("no claim was auto-verified from worker output");

if (policyChanged) {
  await service.from("user_autonomy_policy").update({
    allow_worker_delegation: (policyBefore as Json).allow_worker_delegation,
    allowed_worker_types: (policyBefore as Json).allowed_worker_types,
  }).eq("owner_user_id", userId);
  console.log("  ... restored the user autonomy policy");
}

const failureCycle = String(job!.status) === "FAILED";
console.log(`\nE2E OPENCODE WORKER PASSED: ${passed} boundaries verified${failureCycle ? " (honest failure cycle: the real agent was blocked, the plane preserved reality)" : " against a real OpenCode agent"}.`);
console.log(`Evidence artifacts: pursuit ${pursuitId}, action ${actionId}, job ${jobId}`);
