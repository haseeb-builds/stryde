// Proves that a REAL agent executes REAL work through Stryde's CONTROLLED plane.
//
// This is the one capability that cannot be honestly claimed from a stub: it
// delegates through the real authenticated API, runs the real dispatcher, and
// lets a real Hermes agent perform a real unit of work. Success is judged only
// by an artifact the agent actually produced and that we read back ourselves.
//
// Honesty rules baked into the assertions:
//   - a SUCCEEDED job MUST have a non-empty artifact list;
//   - the artifact content must satisfy the completion condition;
//   - the observation must attribute the result to CONTROLLED_EXECUTION, never
//     to the user;
//   - no claim may reach VERIFIED on the strength of a worker result.
//
// Requires: a dev server on BASE_URL, and `npm run worker:hermes` listening.
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

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const created = await api("/api/v1/pursuits", "POST", { title: `E2E REAL WORKER ${stamp}` });
assert.equal(created.status, 201, `pursuit create failed: ${JSON.stringify(created.json)}`);
const pursuitId = (created.json.pursuit as Json).id as string;
const sessionRes = await api(`/api/v1/pursuits/${pursuitId}/conversations`, "POST", { title: "real worker" });
assert.equal(sessionRes.status, 201, `session create failed: ${JSON.stringify(sessionRes.json)}`);
const sessionId = ((sessionRes.json.session as Json | undefined)?.id) as string;
ok("pursuit and conversation created through the authenticated API");

const REQUIRED_LINE = "REAL WORKER PRODUCED THIS";
const workerMove = {
  version: 1,
  status: "WORKING",
  objective: "Prove a real agent executes real work.",
  understanding: "Until now the CONTROLLED plane has only been proven against a stub worker.",
  known: ["The control plane leases, records, and finalizes work."],
  unknowns: ["Whether a real agent can complete a real unit of work."],
  bottleneck: "No real executor has ever run.",
  next_move: {
    mode: "DRAFT",
    actor: "WORKER",
    worker_type: "HERMES",
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
ok("WORKER next move seeded");

const delegated = await api(`/api/v1/pursuits/${pursuitId}/actions/delegate-worker`, "POST", { session_id: sessionId, approved: true });
assert.equal(delegated.status, 201, `delegation failed: ${JSON.stringify(delegated.json)}`);
const jobId = (delegated.json.job as Json).id as string;
const actionId = (delegated.json.action as Json).id as string;
ok("approved delegation committed a real CONTROLLED job");

// Drive the real dispatcher to completion.
//
// This suite does NOT spawn the hermes worker: an operator runs
// `npm run worker:hermes` separately. That worker now FAILS CLOSED without
// STRYDE_HERMES_TOKEN (lib/worker-server-auth.ts), so this suite passes the
// operator's token through to the dispatcher's gateway, and checks that the
// worker is reachable WITH it before doing anything else.
const { spawn } = await import("node:child_process");
console.log("  ... running the real dispatcher against the real agent (this executes real work)");
const workerUrl = process.env.STRYDE_HERMES_URL ?? "http://127.0.0.1:8899";
const workerToken = process.env.STRYDE_HERMES_TOKEN?.trim();
assert.ok(workerToken, "STRYDE_HERMES_TOKEN is required: the hermes worker fails closed without it (lib/worker-server-auth.ts)");
const workerProbe = await fetch(`${workerUrl}/work/__probe__`, { headers: { Authorization: `Bearer ${workerToken}` } })
  .then((r) => r.status).catch(() => 0);
assert.ok(workerProbe > 0, "hermes worker is not answering authenticated requests at " + workerUrl + " (got " + workerProbe + "); is `npm run worker:hermes` running with the same STRYDE_HERMES_TOKEN?");
const run = await new Promise<{ code: number | null; output: string }>((resolve) => {
  const child = spawn(process.execPath, ["--experimental-strip-types", "scripts/worker-dispatcher.ts"], {
    cwd: repoRoot,
    env: { ...process.env, STRYDE_HERMES_URL: workerUrl, STRYDE_HERMES_TOKEN: workerToken, STRYDE_WORKER_ONCE: "1", STRYDE_WORKER_POLL_MS: "500", STRYDE_WORKER_MAX_RUNTIME_MS: "300000" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (c) => { output += String(c); });
  child.stderr.on("data", (c) => { output += String(c); });
  child.on("close", (code) => resolve({ code, output }));
});
assert.equal(run.code, 0, `dispatcher failed: ${run.output}`);

let job: Json | undefined;
for (let i = 0; i < 20 && !job; i++) {
  const { data } = await service.from("job").select("status, resolved_at").eq("id", jobId).maybeSingle();
  job = data as Json | null ?? undefined;
  if (job && !["SUCCEEDED", "FAILED", "UNKNOWN", "CANCELLED"].includes(String(job.status))) job = undefined;
  if (!job) await new Promise((r) => setTimeout(r, 2000));
}
assert.ok(job, `job never reached a terminal state`);

// The point of this suite: a real agent must have produced real output.
if (job!.status !== "SUCCEEDED") {
  const { data: attempt } = await service.from("attempt").select("terminal_resolution, error_details").eq("job_id", jobId).maybeSingle();
  const { data: obs } = await service.from("observation").select("content").order("created_at", { ascending: false }).limit(1).maybeSingle();
  console.error(`Real worker did not succeed. attempt=${JSON.stringify(attempt)} observation=${JSON.stringify(obs)}`);
  assert.fail("real agent run did not SUCCEED");
}
ok("real job SUCCEEDED");

const { data: finalAction } = await service.from("action").select("status, execution_mode").eq("id", actionId).maybeSingle();
assert.equal(finalAction!.execution_mode, "CONTROLLED");
assert.equal(finalAction!.status, "COMPLETED", "CONTROLLED action should be finalized by the trusted plane");
ok("CONTROLLED action finalized COMPLETED");

const { data: attemptRow } = await service.from("attempt")
  .select("terminal_resolution, external_correlation_id").eq("job_id", jobId).maybeSingle();
assert.equal(attemptRow!.terminal_resolution, "SUCCEEDED");
assert.ok(attemptRow!.external_correlation_id, "a real run must carry a worker correlation id");
ok("attempt recorded SUCCEEDED with a real worker correlation id");

const { data: observations } = await service.from("observation")
  .select("content, observation_kind, source_type")
  .eq("owner_user_id", userId).order("created_at", { ascending: false }).limit(20);
const workerObs = (observations ?? []).find((o) => o.source_type === "CONTROLLED_EXECUTION");
assert.ok(workerObs, "no CONTROLLED_EXECUTION observation was recorded");
const content = workerObs!.content as Json;
const result = (content.result as Json | undefined) as Json | undefined;
const artifacts = (result?.result as Json | undefined)?.artifacts as Array<{ path: string; bytes: number; preview: string }> | undefined;
assert.ok(Array.isArray(artifacts) && artifacts.length > 0, "a SUCCEEDED real run must carry artifacts; an empty artifact list means the agent did nothing");
ok(`real artifacts recorded (${artifacts!.length}): ${artifacts!.map((a) => a.path).join(", ")}`);

const proof = artifacts!.find((a) => a.path.replace(/\\/g, "/") === "proof.md");
assert.ok(proof, `expected a proof.md artifact, got ${artifacts!.map((a) => a.path).join(", ")}`);
assert.ok(proof!.preview.includes(REQUIRED_LINE), "the artifact does not satisfy the completion condition");
assert.ok(proof!.bytes > 0, "artifact is empty");
ok("artifact content satisfies the completion condition");

assert.notEqual(workerObs!.source_type, "USER_REPORTED", "a worker result must never be laundered as a user report");
ok("result attributed to CONTROLLED_EXECUTION, not the user");

const { data: claims } = await service.from("claim").select("id, epistemic_status").eq("pursuit_id", pursuitId);
for (const c of claims ?? []) {
  assert.notEqual(c.epistemic_status, "VERIFIED", "a worker result must never self-verify");
}
ok("no claim was auto-verified from worker output");

console.log(`\nE2E REAL WORKER PASSED: ${passed} boundaries verified against a real agent.`);
console.log(`Evidence artifacts: pursuit ${pursuitId}, action ${actionId}, job ${jobId}`);
