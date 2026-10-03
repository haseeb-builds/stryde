// Deterministic end-to-end proof of the CONTROLLED (worker) action lifecycle,
// independent of model availability. Seeds a schema-valid working state (the
// deterministic seam), then drives the REAL authenticated API routes, RPCs, the
// real worker dispatcher, and persistence against a stub worker runtime that
// implements the lib/worker-gateway.ts HTTP contract:
//
//   seeded working_state (ANALYZE / WORKER)
//   POST   actions/start            (409: a WORKER move is not a human Action)
//   POST   actions/delegate-worker  (authorization commit: Decision + Action + Job + snapshot)
//   POST   actions/delegate-worker  (409: session already WAITING_EXTERNAL)
//   dispatcher lease -> attempt -> stub worker -> finish -> observation
//   (per cycle: SUCCEEDED, FAILED, UNKNOWN — honest epistemics per outcome)
//
// The stub worker stands in for the external HERMES runtime only; everything
// Stryde-side (routes, RPCs, fencing, attempts, observations, actions) is real.
//
// Usage: npm run e2e:controlled   (requires the dev server on NEXT_PUBLIC_SITE_URL)
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

const env = Object.fromEntries(
  (await import("node:fs")).readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
// Process env wins over .env.local, matching e2e:human, so a run can target a
// specific dev port without editing local configuration.
const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BASE_URL ?? env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SECRET_KEY;
const EMAIL = env.STRYDE_TEST_USER_EMAIL;
const PASSWORD = env.STRYDE_TEST_USER_PASSWORD;
for (const [name, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SECRET_KEY: SERVICE_KEY, STRYDE_TEST_USER_EMAIL: EMAIL, STRYDE_TEST_USER_PASSWORD: PASSWORD })) {
  if (!value) throw new Error(`Missing required env: ${name}`);
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = createClient(supabaseUrl, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const service = createClient(supabaseUrl, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let passed = 0;
function ok(name: string) { passed += 1; console.log(`  ✔ ${name}`); }

async function api(path: string, method: string, bearer: string, body?: unknown): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Json };
}

type StubBehavior = { finalStatus: "SUCCEEDED" | "FAILED" | "RUNNING"; result: Json | null; note: string };

// Stub HERMES worker runtime implementing the HttpWorkerProvider contract.
function startStubWorker(behavior: StubBehavior): Promise<{ url: string; close: () => Promise<void>; requests: string[] }> {
  const requests: string[] = [];
  const server = http.createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    requests.push(`${req.method} ${path}`);
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST" && path === "/work") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        // Validate inside the handler but report by responding, never by
        // throwing: an assertion thrown here escapes into the request callback,
        // the response is never written, and the dispatcher sees an opaque
        // transport error instead of the real contract mismatch.
        const parsed = JSON.parse(body || "{}") as Json;
        // HttpWorkerProvider.submit sends camelCase (`workerType`,
        // `idempotencyKey`); the frozen job arguments use snake_case. Accept the
        // transport shape the gateway actually sends, and also require the
        // structured context that makes the delegated work meaningful.
        const workerType = (parsed.workerType ?? parsed.worker_type) as string | undefined;
        if (workerType !== "HERMES" || typeof parsed.instruction !== "string" || !parsed.instruction.trim()) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: `stub received an invalid work contract: ${body.slice(0, 200)}` }));
          return;
        }
        res.end(JSON.stringify({ external_work_id: `stub-work-${Date.now()}` }));
      });
      return;
    }
    const workId = path.match(/^\/work\/([^/]+)(\/result)?$/);
    if (req.method === "GET" && workId) {
      if (workId[2]) {
        res.end(JSON.stringify({ status: behavior.finalStatus, result: behavior.result, raw_result_reference: `stub://${workId[1]}` }));
      } else {
        res.end(JSON.stringify({ status: behavior.finalStatus === "RUNNING" ? "RUNNING" : behavior.finalStatus }));
      }
      return;
    }
    if (req.method === "DELETE" && workId) { res.end(JSON.stringify({})); return; }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        requests,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

function runDispatcher(stubUrl: string, extraEnv: Record<string, string> = {}): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", "scripts/worker-dispatcher.ts"], {
      cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        STRYDE_HERMES_URL: stubUrl,
        STRYDE_WORKER_ONCE: "1",
        STRYDE_WORKER_POLL_MS: "100",
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("close", (code) => resolve({ code, output }));
  });
}

// The queue is shared and leased oldest-first, which is correct production
// behavior. A one-shot dispatcher may therefore pick up an older job instead of
// the one this cycle just created, leaving that job untouched and making the run
// look broken when it is only unordered. Keep dispatching until this specific
// job reaches a terminal state, so the proof is about this job.
async function dispatchUntilSettled(jobId: string, stubUrl: string, extraEnv: Record<string, string> = {}) {
  const { data: terminal } = await service.from("job").select("status, resolved_at").eq("id", jobId).maybeSingle();
  const isTerminal = (row: typeof terminal) =>
    !!row && ["SUCCEEDED", "FAILED", "UNKNOWN", "CANCELLED"].includes(String(row.status));
  if (isTerminal(terminal)) return { code: 0 as number | null, output: "job already terminal" };

  for (let pass = 0; pass < 25; pass++) {
    const run = await runDispatcher(stubUrl, extraEnv);
    const { data: after } = await service.from("job").select("status, resolved_at").eq("id", jobId).maybeSingle();
    if (isTerminal(after)) return run;
    if (run.code !== 0) return run;
  }
  return { code: 0 as number | null, output: "dispatcher passes exhausted before this job settled" };
}

async function fetchSessionState(sessionId: string) {
  const { data } = await service.from("conversation_session").select("working_state").eq("id", sessionId).maybeSingle();
  return (data?.working_state ?? null) as { status?: string; next_move?: { mode?: string; actor?: string } } | null;
}

async function seedWorkerMove(pursuitId: string, sessionId: string, title: string) {
  const seededWorkingState = {
    version: 1,
    status: "WORKING",
    objective: "Prepare for the system design interview",
    understanding: "The user needs grounded research compiled into a comparable draft before the next study session.",
    known: ["The interview is in two weeks", "About one hour per day is available"],
    unknowns: ["How competing designs handle rate limiting"],
    bottleneck: "No comparable draft of approaches exists yet",
    next_move: {
      mode: "ANALYZE",
      actor: "WORKER",
      worker_type: "HERMES",
      title,
      why: "A comparable draft converts scattered reading into a usable study artifact",
      expected_change: "A written comparison of rate-limiting approaches exists in the pursuit context",
      stryde_can_do: "Stryde frames the comparison and reviews the worker result",
      user_needs_to_do: "Review the drafted comparison and confirm it matches the study focus",
      completion_condition: "A comparison draft covering at least three approaches is produced",
    },
  };
  const seed = await service.from("conversation_session").update({ working_state: seededWorkingState }).eq("id", sessionId);
  assert.ok(!seed.error, `seeding working_state failed: ${seed.error?.message}`);
  void pursuitId;
}

async function createPursuitAndSession(bearer: string, label: string): Promise<{ pursuitId: string; sessionId: string }> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const created = await api("/api/v1/pursuits", "POST", bearer, { title: `E2E CONTROLLED loop ${label} ${stamp}` });
  assert.equal(created.status, 201, `pursuit creation failed: ${JSON.stringify(created.json)}`);
  const pursuitId = (created.json.pursuit as Json | undefined)?.id as string;
  const sessionRes = await api(`/api/v1/pursuits/${pursuitId}/conversations`, "POST", bearer, {});
  assert.equal(sessionRes.status, 201, `session creation failed: ${JSON.stringify(sessionRes.json)}`);
  const sessionId = ((sessionRes.json as Json).session as Json | undefined)?.id as string;
  assert.ok(pursuitId && sessionId, "pursuit/session ids missing");
  return { pursuitId, sessionId };
}

// 0. Reachability + auth
const health = await fetch(`${BASE_URL}/api/health/model`).then((r) => r.status).catch(() => 0);
if (!health) { console.error(`Dev server not reachable at ${BASE_URL}. Start it with: npm run dev`); process.exit(1); }
console.log(`Dev server up (${BASE_URL})`);

const { data: authData, error: authError } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
assert.ok(!authError, `sign-in failed: ${authError?.message}`);
const bearer = authData!.session!.access_token;
const userId = authData!.user!.id;
console.log(`Signed in as test user ${userId}`);

const { data: grantsBefore } = await service.from("capability_grant").select("id").eq("owner_user_id", userId);
const grantsBeforeCount = grantsBefore?.length ?? 0;

// ===== Cycle 1: full authority chain + successful worker execution =====
console.log("\nCycle 1: grant authority, delegate, worker SUCCEEDS");
{
  const { pursuitId, sessionId } = await createPursuitAndSession(bearer, "success");

  // 1. Explicit user grant of worker authority (no model involved).
  // 201 provisions a new grant; 200 renews an existing live one for the same
  // tool. Both are correct: authority is durable and must not be duplicated on
  // every approval. Either way the user must have explicitly approved.
  const grantRes = await api("/api/v1/capabilities/worker", "POST", bearer, { approved: true, worker_type: "HERMES" });
  assert.ok(grantRes.status === 200 || grantRes.status === 201, `capability grant failed: ${JSON.stringify(grantRes.json)}`);
  assert.equal(grantRes.json.active, true);
  ok(`POST capabilities/worker provisions authority (${grantRes.status}, active${grantRes.json.renewed ? ", renewed" : ""})`);
  // Resolve the grant and its originating decision from the database rather than
  // the response, since a renewal does not mint new ids.
  const { data: grantForDecision } = await service.from("capability_grant")
    .select("id, source_decision_id").eq("owner_user_id", userId).is("revoked_at", null)
    .order("granted_at", { ascending: false }).limit(1).maybeSingle();
  const grantId = (grantRes.json.grant_id ?? grantForDecision?.id) as string;
  const decisionId = (grantRes.json.decision_id ?? grantForDecision?.source_decision_id) as string;
  assert.ok(grantId, "capability grant id could not be resolved");

  const { data: grantRow } = await service.from("capability_grant").select("id, owner_user_id, tool_id, scope_constraints, target_constraints, expires_at, revoked_at, source_decision_id").eq("id", grantId).maybeSingle();
  assert.ok(grantRow, "capability_grant row missing");
  assert.equal(grantRow!.owner_user_id, userId);
  assert.equal(grantRow!.source_decision_id, decisionId);
  assert.ok(grantRow!.expires_at && new Date(grantRow!.expires_at).getTime() > Date.now(), "grant not expiring in the future");
  assert.ok(!grantRow!.revoked_at);
  // Authority provenance. On a freshly minted grant the originating decision is
  // the user's STRATEGIC capability decision; on a renewal the grant still
  // traces to whichever user decision first authorized it. Either way it must be
  // a real, user-resolved decision - never a system- or model-authored grant.
  const { data: grantDecision } = await service.from("decision")
    .select("id, kind, status, resolution_actor_type").eq("id", decisionId).maybeSingle();
  assert.ok(grantDecision, "capability grant does not trace to a decision");
  assert.ok(["STRATEGIC", "ACTION_APPROVAL"].includes(grantDecision!.kind), `unexpected decision kind ${grantDecision!.kind}`);
  assert.equal(grantDecision!.status, "RESOLVED");
  assert.equal(grantDecision!.resolution_actor_type, "USER");
  const { data: grantEvents } = await service.from("event")
    .select("id, event_type").eq("entity_type", "CAPABILITY_GRANT").eq("entity_id", grantId);
  assert.ok((grantEvents ?? []).some((e) => e.event_type === "CAPABILITY_GRANTED" || e.event_type === "CAPABILITY_RENEWED"),
    "capability grant is not event-recorded");
  ok("grant is decision-sourced by the USER, unexpired, and event-recorded");

  const capRes = await api("/api/v1/capabilities/worker", "GET", bearer);
  assert.equal(capRes.status, 200);
  assert.equal(capRes.json.active, true);
  assert.ok((capRes.json.worker_types as string[]).includes("HERMES"));
  ok("GET capabilities/worker reports active HERMES capability");

  // 2. Deterministic seam: WORKER move.
  await seedWorkerMove(pursuitId, sessionId, "Draft a comparison of rate-limiting approaches");
  ok("working_state seeded (deterministic seam: ANALYZE / WORKER)");

  // 3. A WORKER move must not be committable as a HUMAN action.
  const wrongStart = await api(`/api/v1/pursuits/${pursuitId}/actions/start`, "POST", bearer, { session_id: sessionId, approved: true });
  assert.equal(wrongStart.status, 409, `actions/start on WORKER move should 409: ${JSON.stringify(wrongStart.json)}`);
  ok("actions/start rejects a WORKER move (409, actor boundary)");

  // 4. Delegate with explicit approval.
  const delegateRes = await api(`/api/v1/pursuits/${pursuitId}/actions/delegate-worker`, "POST", bearer, { session_id: sessionId, approved: true });
  assert.equal(delegateRes.status, 201, `delegate-worker failed (${delegateRes.status}): ${JSON.stringify(delegateRes.json)}`);
  const action = delegateRes.json.action as Json | undefined;
  const actionId = action?.id as string;
  const job = delegateRes.json.job as Json | undefined;
  assert.ok(actionId, "no action id in delegation response");
  assert.equal(action?.execution_mode, "CONTROLLED");
  assert.equal(action?.status, "IN_PROGRESS");
  assert.ok(job && job.id, "no job in delegation response");
  assert.equal(job?.status, "AUTHORIZED");
  ok(`delegation committed: action ${actionId} + job AUTHORIZED`);

  const workingState = delegateRes.json.working_state as { status?: string } | undefined;
  assert.equal(workingState?.status, "WAITING_EXTERNAL", "working_state not WAITING_EXTERNAL after delegation");
  const persisted = await fetchSessionState(sessionId);
  assert.equal(persisted?.status, "WAITING_EXTERNAL");
  ok("working_state persisted as WAITING_EXTERNAL");

  // DB evidence: decision, job authorization snapshot, grant reuse, events.
  const { data: actionDecision } = await service.from("decision").select("id, kind, status").eq("pursuit_id", pursuitId).eq("kind", "ACTION_APPROVAL").maybeSingle();
  assert.ok(actionDecision && actionDecision.status === "RESOLVED", "ACTION_APPROVAL decision missing for delegation");
  const { data: jobRow } = await service.from("job").select("id, status, authorization_basis, args_hash, idempotency_key, fencing_token, lease_owner").eq("id", (job!.id as string)).maybeSingle();
  assert.ok(jobRow && jobRow.status === "AUTHORIZED", "job not AUTHORIZED in DB");
  const basis = jobRow!.authorization_basis as Json;
  assert.equal(basis.authorization_type, "EXPLICIT_USER_APPROVAL");
  assert.equal(basis.capability_grant_id, grantId, "job authorization not bound to the granted capability");
  ok("job authorization basis bound to explicit approval + grant");
  const { data: jobAuth } = await service.from("job_authorization").select("id, decision_id, authorization_type, args_hash, authorization_snapshot").eq("job_id", jobRow!.id).maybeSingle();
  assert.ok(jobAuth, "job_authorization snapshot missing");
  assert.equal(jobAuth!.decision_id, actionDecision!.id);
  assert.equal(jobAuth!.args_hash, jobRow!.args_hash);
  ok("immutable job_authorization snapshot recorded");
  // Authority must not accumulate: delegating again for a tool the user already
  // holds a live grant for must reuse that grant, not mint another. The grant
  // count is therefore unchanged by the delegation commit.
  const { data: grantsAfterDelegate } = await service.from("capability_grant").select("id").eq("owner_user_id", userId);
  assert.equal(grantsAfterDelegate?.length, grantsBeforeCount, `delegation must reuse the existing grant, not duplicate it (before ${grantsBeforeCount}, after ${grantsAfterDelegate?.length})`);
  ok("commit reused the active grant (no duplicate provisioning)");
  const { data: authorizedEvent } = await service.from("event").select("id").eq("event_type", "JOB_AUTHORIZED").eq("entity_id", jobRow!.id).maybeSingle();
  assert.ok(authorizedEvent, "JOB_AUTHORIZED event missing");
  ok("JOB_AUTHORIZED event recorded");

  // 5. Double delegation is refused while waiting on the external result.
  const doubleDelegate = await api(`/api/v1/pursuits/${pursuitId}/actions/delegate-worker`, "POST", bearer, { session_id: sessionId, approved: true });
  assert.equal(doubleDelegate.status, 409, `second delegation should 409: ${JSON.stringify(doubleDelegate.json)}`);
  ok("second delegation rejected while WAITING_EXTERNAL (409)");

  // 6. Real dispatcher against the stub worker.
  const stub = await startStubWorker({ finalStatus: "SUCCEEDED", result: { draft: "Comparison of token bucket, leaky bucket, and sliding window approaches.", approaches: 3 }, note: "cycle1" });
  try {
    const run = await dispatchUntilSettled(jobRow!.id, stub.url);
    assert.equal(run.code, 0, `dispatcher failed: ${run.output}`);
    assert.ok(stub.requests.some((r) => r === "POST /work"), "stub never received a submission");
  } finally { await stub.close(); }
  ok("worker dispatcher leased, submitted to the worker runtime, and finished the attempt");

  const { data: attemptRow } = await service.from("attempt").select("id, terminal_resolution, mechanical_result_state, dispatch_state, external_correlation_id, redacted_result").eq("job_id", jobRow!.id).maybeSingle();
  assert.ok(attemptRow, "attempt row missing");
  assert.equal(attemptRow!.terminal_resolution, "SUCCEEDED");
  assert.equal(attemptRow!.mechanical_result_state, "SUCCEEDED");
  assert.ok(attemptRow!.external_correlation_id, "external correlation id missing");
  ok("attempt terminal: SUCCEEDED with external correlation id");

  const { data: jobDone } = await service.from("job").select("status, resolved_at, lease_owner").eq("id", jobRow!.id).maybeSingle();
  assert.equal(jobDone?.status, "SUCCEEDED");
  assert.ok(jobDone?.resolved_at);
  const { data: actionDone } = await service.from("action").select("status, terminal_at").eq("id", actionId).maybeSingle();
  assert.equal(actionDone?.status, "COMPLETED");
  assert.ok(actionDone?.terminal_at);
  ok("job SUCCEEDED -> action COMPLETED (control plane reconciliation)");

  const { data: completedEvent } = await service.from("event").select("id").eq("event_type", "ACTION_COMPLETED_BY_WORKER").eq("entity_id", actionId).maybeSingle();
  assert.ok(completedEvent, "ACTION_COMPLETED_BY_WORKER event missing");

  const { data: observation } = await service.from("observation").select("id, observation_kind, source_type, content").eq("owner_user_id", userId).contains("content", { job_id: jobRow!.id }).maybeSingle();
  assert.ok(observation, "MECHANICAL_ATTEMPT_RESULT observation missing");
  assert.equal(observation!.observation_kind, "MECHANICAL_ATTEMPT_RESULT");
  assert.equal(observation!.source_type, "CONTROLLED_EXECUTION");
  ok("worker result recorded as MECHANICAL_ATTEMPT_RESULT observation (CONTROLLED_EXECUTION source)");

  const { data: verifiedClaims } = await service.from("claim").select("id").eq("owner_user_id", userId).eq("pursuit_id", pursuitId).eq("status", "VERIFIED");
  assert.equal(verifiedClaims?.length ?? 0, 0, "worker execution must not verify any claim by itself");
  ok("no claim auto-VERIFIED by mechanical execution (provenance boundary)");
}

// ===== Cycle 2: worker reports failure =====
console.log("\nCycle 2: delegate, worker FAILS");
{
  const { pursuitId, sessionId } = await createPursuitAndSession(bearer, "failure");
  await seedWorkerMove(pursuitId, sessionId, "Draft a comparison of consensus protocols");
  const delegateRes = await api(`/api/v1/pursuits/${pursuitId}/actions/delegate-worker`, "POST", bearer, { session_id: sessionId, approved: true });
  assert.equal(delegateRes.status, 201, `delegate-worker failed: ${JSON.stringify(delegateRes.json)}`);
  const actionId = (delegateRes.json.action as Json).id as string;
  const jobId = (delegateRes.json.job as Json).id as string;

  const stub = await startStubWorker({ finalStatus: "FAILED", result: null, note: "cycle2" });
  try {
    const run = await dispatchUntilSettled(jobId, stub.url);
    assert.equal(run.code, 0, `dispatcher failed: ${run.output}`);
  } finally { await stub.close(); }

  const { data: jobRow } = await service.from("job").select("status, resolved_at").eq("id", jobId).maybeSingle();
  assert.equal(jobRow?.status, "FAILED");
  const { data: actionRow } = await service.from("action").select("status, terminal_at").eq("id", actionId).maybeSingle();
  assert.equal(actionRow?.status, "FAILED");
  assert.ok(actionRow?.terminal_at);
  const { data: failedEvent } = await service.from("event").select("id").eq("event_type", "ACTION_FAILED_BY_WORKER").eq("entity_id", actionId).maybeSingle();
  assert.ok(failedEvent, "ACTION_FAILED_BY_WORKER event missing");
  const { data: observation } = await service.from("observation").select("id").eq("owner_user_id", userId).contains("content", { job_id: jobId }).maybeSingle();
  assert.ok(observation, "failed attempt observation missing");
  ok("worker failure -> job FAILED, action FAILED, failure observed (reality preserved)");
  void pursuitId;
}

// ===== Cycle 3: worker hangs -> honest UNKNOWN =====
console.log("\nCycle 3: delegate, worker hangs -> UNKNOWN");
{
  const { pursuitId, sessionId } = await createPursuitAndSession(bearer, "unknown");
  await seedWorkerMove(pursuitId, sessionId, "Draft a comparison of caching strategies");
  const delegateRes = await api(`/api/v1/pursuits/${pursuitId}/actions/delegate-worker`, "POST", bearer, { session_id: sessionId, approved: true });
  assert.equal(delegateRes.status, 201, `delegate-worker failed: ${JSON.stringify(delegateRes.json)}`);
  const actionId = (delegateRes.json.action as Json).id as string;
  const jobId = (delegateRes.json.job as Json).id as string;

  const stub = await startStubWorker({ finalStatus: "RUNNING", result: null, note: "cycle3" });
  try {
    const run = await dispatchUntilSettled(jobId, stub.url, { STRYDE_WORKER_MAX_RUNTIME_MS: "3000" });
    assert.equal(run.code, 0, `dispatcher failed: ${run.output}`);
  } finally { await stub.close(); }

  const { data: attemptRow } = await service.from("attempt").select("terminal_resolution, mechanical_result_state").eq("job_id", jobId).maybeSingle();
  assert.equal(attemptRow?.terminal_resolution, "UNKNOWN");
  assert.equal(attemptRow?.mechanical_result_state, "UNKNOWN");
  const { data: jobRow } = await service.from("job").select("status, resolved_at").eq("id", jobId).maybeSingle();
  assert.equal(jobRow?.status, "UNKNOWN");
  assert.ok(!jobRow?.resolved_at, "UNKNOWN job must not be resolved");
  const { data: actionRow } = await service.from("action").select("status").eq("id", actionId).maybeSingle();
  assert.equal(actionRow?.status, "IN_PROGRESS", "UNKNOWN worker result must not finalize the action");
  const { data: observation } = await service.from("observation").select("id").eq("owner_user_id", userId).contains("content", { job_id: jobId }).maybeSingle();
  assert.ok(observation, "UNKNOWN attempt observation missing");
  ok("unknown worker state -> attempt/job UNKNOWN, action stays IN_PROGRESS (unknown stays unknown)");
  void pursuitId;
  void sessionId;
}

console.log(`\nE2E CONTROLLED loop: ${passed} boundaries verified.`);
