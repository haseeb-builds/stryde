// Proves that a REAL headless browser executes REAL page observation through
// Stryde's CONTROLLED plane. This is the browser twin of scripts/e2e-opencode-worker.ts:
// the BROWSER worker type is declared, policy-addressable, and backed by a real
// render of a live web page, with the same artifact-judged assertions.
//
// What this suite proves that nothing else did:
//   - a CONTROLLED delegation to worker.browser reaches a real headless browser;
//   - the observation carries inspectable artifacts (page text, metadata, screenshot)
//     that satisfy a completion condition checked by content, not by status;
//   - a browser saying "done" is still only a CONTROLLED_EXECUTION observation:
//     nothing reaches VERIFIED from worker output;
//   - the SSRF guard refuses private-network targets before any navigation.
//
// Requires: a dev server on BASE_URL. The worker process is spawned and torn
// down here, exactly like the OpenCode suite.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

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

// Widen (and later restore) the autonomy policy so BROWSER delegation is
// allowed for this user; the policy can only refuse, never approve.
const { data: policyBefore } = await service.from("user_autonomy_policy")
  .select("allow_worker_delegation, allowed_worker_types, auto_execute_research")
  .eq("owner_user_id", userId).maybeSingle();
let policyChanged = false;
if (policyBefore && !(policyBefore.allow_worker_delegation && (policyBefore.allowed_worker_types as string[]).includes("BROWSER"))) {
  const allowed = new Set<string>((policyBefore.allowed_worker_types as string[]) ?? []);
  allowed.add("BROWSER");
  const { error } = await service.from("user_autonomy_policy")
    .update({ allow_worker_delegation: true, allowed_worker_types: [...allowed] })
    .eq("owner_user_id", userId);
  assert.ok(!error, `widening autonomy policy failed: ${error?.message}`);
  policyChanged = true;
  console.log("  ... temporarily widened the user autonomy policy to allow BROWSER delegation");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const created = await api("/api/v1/pursuits", "POST", { title: `E2E BROWSER WORKER ${stamp}` });
assert.equal(created.status, 201, `pursuit create failed: ${JSON.stringify(created.json)}`);
const pursuitId = (created.json.pursuit as Json).id as string;
const sessionRes = await api(`/api/v1/pursuits/${pursuitId}/conversations`, "POST", { title: "browser worker" });
assert.equal(sessionRes.status, 201, `session create failed: ${JSON.stringify(sessionRes.json)}`);
const sessionId = ((sessionRes.json.session as Json | undefined)?.id) as string;
ok("pursuit and conversation created through the authenticated API");

const TARGET_URL = process.env.STRYDE_BROWSER_E2E_URL ?? "https://example.com";
// Marker verified against the live page: example.com's rendered copy leads with
// this sentence (its old "Example Domain" heading text is no longer what the
// page yields). The completion condition is judged on real rendered content.
const EXPECTED_TEXT = process.env.STRYDE_BROWSER_E2E_EXPECT ?? "documentation examples without needing permission";
const workerMove = {
  version: 1,
  status: "WORKING",
  objective: "Observe a live web page through a real browser worker.",
  understanding: "The BROWSER worker type is declared; its runtime has never executed through the plane.",
  known: ["Page observation is the v1 bounded task class."],
  unknowns: [`What ${TARGET_URL} actually renders right now.`],
  bottleneck: "No real browser executor has ever run.",
  next_move: {
    mode: "RESEARCH_WEB",
    actor: "WORKER",
    worker_type: "BROWSER",
    title: `Observe ${TARGET_URL} and report what the page actually renders`,
    why: "An observation read back from artifacts is the only honest proof of a browser render.",
    expected_change: `The page ${TARGET_URL} is observed with extracted text and a screenshot.`,
    stryde_can_do: "Read the artifacts back and judge them against the completion condition.",
    user_needs_to_do: "Nothing; this is an internal capability check.",
    completion_condition: `The extracted page text contains: ${EXPECTED_TEXT}`,
  },
};
const seed = await service.from("conversation_session")
  .update({ working_state: workerMove, updated_at: new Date().toISOString() })
  .eq("id", sessionId).eq("owner_user_id", userId);
assert.ok(!seed.error, `seeding working_state failed: ${seed.error?.message}`);
ok("BROWSER next move seeded");

const delegated = await api(`/api/v1/pursuits/${pursuitId}/actions/delegate-worker`, "POST", { session_id: sessionId, approved: true });
assert.equal(delegated.status, 201, `delegation failed: ${JSON.stringify(delegated.json)}`);
const jobId = (delegated.json.job as Json).id as string;
const actionId = (delegated.json.action as Json).id as string;
ok("approved delegation committed a real CONTROLLED job");

const { data: browserTool } = await service.from("tool")
  .select("id, tool_key, tool_version").eq("tool_key", "worker.browser").eq("tool_version", "v1").maybeSingle();
assert.ok(browserTool, "worker.browser tool is not registered");
const { data: jobRow } = await service.from("job").select("tool_id").eq("id", jobId).maybeSingle();
assert.equal(jobRow?.tool_id, browserTool!.id, "job must run through the worker.browser tool");
ok("job is bound to the worker.browser tool");

const { spawn } = await import("node:child_process");
const workerPort = Number(new URL(process.env.STRYDE_BROWSER_URL ?? "http://127.0.0.1:8899").port || 8899);
const workerUrl = `http://127.0.0.1:${workerPort}`;
const workerToken = process.env.STRYDE_BROWSER_TOKEN?.trim() || `e2e-${randomUUID()}`;
const authedProbe = (headers: Record<string, string>) =>
  fetch(`${workerUrl}/work/__probe__`, { headers }).then((r) => r.status).catch(() => 0);
const alreadyListening = await authedProbe({ Authorization: `Bearer ${workerToken}` });
assert.ok(!alreadyListening, `port ${workerPort} is already in use; free it so this suite can manage its own worker`);

const workerChild = spawn(process.execPath, ["--experimental-strip-types", "scripts/browser-worker.ts"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    STRYDE_BROWSER_WORKER_PORT: String(workerPort),
    STRYDE_BROWSER_TIMEOUT_MS: "60000",
    STRYDE_BROWSER_TOKEN: workerToken,
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
console.log(`  ... waiting for the browser worker on ${workerUrl}`);
let workerUp = false;
for (let i = 0; i < 60 && !workerUp; i++) {
  workerUp = await authedProbe({ Authorization: `Bearer ${workerToken}` }).then((s) => s > 0);
  if (!workerUp) await new Promise((r) => setTimeout(r, 500));
}
assert.ok(workerUp, `browser worker never became ready: ${workerOutput}`);
ok(`browser worker listening on ${workerUrl} (spawned by this suite)`);

// The worker must refuse private/loopback targets before any navigation.
const ssrfRefused = await new Promise<number>((resolve) => {
  fetch(`${workerUrl}/work`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${workerToken}` },
    body: JSON.stringify({
      worker_type: "BROWSER",
      instruction: "Observe http://127.0.0.1:9999/admin",
      context: { task: "OBSERVE_PAGE" },
      idempotency_key: `ssrf-check-${randomUUID()}`,
    }),
  }).then((r) => {
    void r.json().then((body: Json) => {
      // 201 means queued; the job then FAILs on the guard. Poll its result.
      const id = body.external_work_id as string;
      const poll = async (): Promise<number> => {
        const res = await fetch(`${workerUrl}/work/${id}/result`, { headers: { Authorization: `Bearer ${workerToken}` } });
        const data = await res.json() as Json;
        if (data.status === "RUNNING") { await new Promise((r) => setTimeout(r, 300)); return poll(); }
        return data.status === "FAILED" && String(data.error ?? "").includes("forbidden") ? 1 : 0;
      };
      resolve(poll());
    });
  }).catch(() => resolve(0));
});
assert.equal(ssrfRefused, 1, "the worker must refuse a loopback observation target with an explicit forbidden error");
ok("SSRF guard refused a loopback observation target");

console.log("  ... running the real dispatcher against the real browser (this executes real work)");
// The queue is shared: older AUTHORIZED jobs (from earlier attempts or other
// suites) are leased first, so a single ONCE dispatch can complete a job that
// is not ours. The dispatcher therefore runs CONTINUOUSLY in the background and
// this suite polls until ITS OWN job reaches a terminal state, then stops it.
const dispatcherChild = spawn(process.execPath, ["--experimental-strip-types", "scripts/worker-dispatcher.ts"], {
  cwd: repoRoot,
  env: { ...process.env, STRYDE_BROWSER_URL: workerUrl, STRYDE_BROWSER_TOKEN: workerToken, STRYDE_WORKER_POLL_MS: "500", STRYDE_WORKER_MAX_RUNTIME_MS: "300000" },
  stdio: ["ignore", "pipe", "pipe"],
});
let dispatcherOutput = "";
dispatcherChild.stdout.on("data", (c) => { dispatcherOutput += String(c); });
dispatcherChild.stderr.on("data", (c) => { dispatcherOutput += String(c); });
const teardownDispatcher = () => {
  if (dispatcherChild.pid && process.platform === "win32") {
    try { spawn("taskkill", ["/pid", String(dispatcherChild.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* best effort */ }
  } else {
    dispatcherChild.kill("SIGKILL");
  }
};
process.on("exit", teardownDispatcher);
let job: Json | undefined;
try {
  for (let i = 0; i < 120 && !job; i++) {
    const { data } = await service.from("job").select("status, resolved_at, tool_id").eq("id", jobId).maybeSingle();
    job = data as Json | null ?? undefined;
    if (job && ["SUCCEEDED", "FAILED", "UNKNOWN", "CANCELLED"].includes(String(job.status))) break;
    job = undefined;
    await new Promise((r) => setTimeout(r, 2000));
  }
  assert.ok(job, `job never reached a terminal state; dispatcher output: ${dispatcherOutput.slice(-2_000)}`);
} finally {
  teardownDispatcher();
  process.off("exit", teardownDispatcher);
  teardownWorker();
  process.off("exit", teardownWorker);
}

const { data: attemptRow } = await service.from("attempt")
  .select("terminal_resolution, external_correlation_id, error_details, redacted_result").eq("job_id", jobId).maybeSingle();
const { data: observations } = await service.from("observation")
  .select("content, observation_kind, source_type")
  .eq("owner_user_id", userId).order("created_at", { ascending: false }).limit(20);
const workerObs = (observations ?? []).find((o) => o.source_type === "CONTROLLED_EXECUTION");

assert.equal(String(job!.status), "SUCCEEDED", `a live page render against ${TARGET_URL} must succeed; got ${job!.status}: ${JSON.stringify(attemptRow?.error_details)}`);
{
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
  assert.equal(result?.provider, "BROWSER", "the observation must attribute the run to the BROWSER provider");
  assert.equal(result?.external_work_id, attemptRow!.external_correlation_id, "observation must carry the same correlation id as the attempt");
  const resultPayload = (result?.result as Json | undefined) as Json | undefined;
  const artifacts = resultPayload?.artifacts as Array<{ path: string; bytes: number; preview: string }> | undefined;
  assert.ok(Array.isArray(artifacts) && artifacts.length > 0, "a SUCCEEDED browser run must carry artifacts");
  ok(`real artifacts recorded (${artifacts!.length}): ${artifacts!.map((a) => a.path).join(", ")}`);

  const pageText = artifacts!.find((a) => a.path === "page-text.txt");
  assert.ok(pageText, `expected a page-text.txt artifact, got ${artifacts!.map((a) => a.path).join(", ")}`);
  assert.ok(pageText!.preview.includes(EXPECTED_TEXT), "the extracted page text does not satisfy the completion condition");
  ok("extracted page text satisfies the completion condition (content-judged, not status-judged)");
  const meta = artifacts!.find((a) => a.path === "page-metadata.json");
  assert.ok(meta && String(meta.preview).includes("PUPPETEER_HEADLESS"), "renderer provenance must be recorded");
  ok("renderer provenance recorded (PUPPETEER_HEADLESS)");
  assert.ok(attemptRow!.redacted_result != null, "mechanical result must be stored on the attempt");

  assert.notEqual(workerObs!.source_type, "USER_REPORTED", "a browser result must never be laundered as a user report");
  ok("result attributed to CONTROLLED_EXECUTION, not the user");
}

const { data: claims } = await service.from("claim").select("id, epistemic_status").eq("pursuit_id", pursuitId);
for (const c of claims ?? []) {
  assert.notEqual(c.epistemic_status, "VERIFIED", "a browser observation must never self-verify");
}
ok("no claim was auto-verified from browser output");

if (policyChanged) {
  await service.from("user_autonomy_policy").update({
    allow_worker_delegation: (policyBefore as Json).allow_worker_delegation,
    allowed_worker_types: (policyBefore as Json).allowed_worker_types,
  }).eq("owner_user_id", userId);
  console.log("  ... restored the user autonomy policy");
}

console.log(`\nE2E BROWSER WORKER PASSED: ${passed} boundaries verified against a real headless browser render of ${TARGET_URL}.`);
console.log(`Evidence artifacts: pursuit ${pursuitId}, action ${actionId}, job ${jobId}`);
