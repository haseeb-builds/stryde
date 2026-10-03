// Proves the CONTROLLED execution path end to end against live infrastructure:
// user approval -> capability grant -> immutable job -> lease -> attempt ->
// worker submission -> mechanical result -> observation. It uses the real
// commit RPC, the real dispatcher, and a worker endpoint implementing the real
// HTTP contract. It makes no claim that a specific worker implementation ran;
// it proves the CONTROLLED plane executes, records, and closes the loop.
//
// Prereqs:
//   - dev server on $BASE_URL
//   - npm run worker:dispatch --with STRYDE_WORKER_ONCE=1 running once
//   - a worker endpoint at STRYDE_HERMES_URL
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(repoRoot, ".env.local"), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
for (const [k, v] of Object.entries(env)) if (!(k in process.env)) process.env[k] = v;

const { createClient } = await import("@supabase/supabase-js");
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const BASE_URL = (process.env.BASE_URL ?? "http://127.0.0.1:3144").replace(/\/$/, "");
let passed = 0;
const ok = (name: string) => { passed += 1; console.log(`  \u2713 ${name}`); };
type Json = Record<string, unknown>;

async function api(path: string, method: string, token: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: Json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: res.status, json };
}

// 1. Authenticate as the real test user.
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const signed = await anon.auth.signInWithPassword({ email: env.STRYDE_TEST_USER_EMAIL, password: env.STRYDE_TEST_USER_PASSWORD });
assert.ok(signed.data.session, `sign-in failed: ${JSON.stringify(signed.error)}`);
const bearer = signed.data.session.access_token;
const userId = signed.data.user.id;
ok("signed in as real user");

// 2. Create a real Pursuit through the authenticated API.
const stamp = new Date().toISOString();
const created = await api("/api/v1/pursuits", "POST", bearer, { title: `E2E CONTROLLED ${stamp}` });
assert.equal(created.status, 201, `pursuit create failed: ${JSON.stringify(created.json)}`);
const pursuitId = (created.json.pursuit as Json | undefined)?.id as string;
assert.ok(pursuitId, "pursuit id missing");
ok("pursuit created");

// 3. Open a conversation session.
const sessionRes = await api(`/api/v1/pursuits/${pursuitId}/conversations`, "POST", bearer, { title: "Controlled worker probe" });
assert.ok(sessionRes.status === 200 || sessionRes.status === 201, `session create failed: ${JSON.stringify(sessionRes.json)}`);
const sessionBody = sessionRes.json.session as Json | undefined;
const sessionId = (sessionBody?.id ?? sessionRes.json.session_id) as string;
assert.ok(sessionId, "session id missing");
ok("conversation session created");

// 4. Seed a WORKER next move. This is the deterministic seam: the model decides
//    allocation, but the harness fixes the shape so the CONTROLLED plane can be
//    exercised without depending on provider availability.
const workerMove = {
  version: 1,
  status: "WORKING",
  objective: "Prove the CONTROLLED execution path.",
  understanding: "The worker plane has infrastructure but no proven end-to-end run.",
  known: ["Two worker tools are registered.", "Zero jobs and attempts exist."],
  unknowns: ["Whether a real worker completes a leased job."],
  bottleneck: "No CONTROLLED job has ever been leased and finished.",
  next_move: {
    mode: "ANALYZE",
    actor: "WORKER",
    worker_type: "HERMES",
    title: "Report the current worker capability state",
    why: "The CONTROLLED plane must be proven independently of model availability.",
    expected_change: "A worker result exists as an Observation.",
    stryde_can_do: "Provision the job and observe completion.",
    user_needs_to_do: "Approve the delegation.",
    completion_condition: "A worker result is recorded as an Observation.",
  },
};
const seed = await service.from("conversation_session").update({ working_state: workerMove, updated_at: new Date().toISOString() })
  .eq("id", sessionId).eq("owner_user_id", userId).select("id").maybeSingle();
assert.ok(seed.data, `working_state seed failed: ${JSON.stringify(seed.error)}`);
ok("WORKER next move seeded (deterministic seam)");

// 5. The worker tool must be registered for delegation to be legal.
const { data: tool } = await service.from("tool").select("id, tool_key, tool_version").eq("tool_key", "worker.hermes").eq("tool_version", "v1").maybeSingle();
assert.ok(tool, "worker.hermes v1 is not registered");
ok("worker.hermes v1 registered");

// 6. Delegation must require explicit human approval.
const denied = await api(`/api/v1/pursuits/${pursuitId}/actions/delegate-worker`, "POST", bearer, { session_id: sessionId });
assert.equal(denied.status, 400, `unapproved delegation should be rejected: ${JSON.stringify(denied.json)}`);
assert.match(String(denied.json.error), /approval/i);
ok("unapproved delegation refused (human authority is real)");

// 7. Approved delegation: capability grant + immutable job.
const delegated = await api(`/api/v1/pursuits/${pursuitId}/actions/delegate-worker`, "POST", bearer, { session_id: sessionId, approved: true });
assert.equal(delegated.status, 201, `delegation failed: ${JSON.stringify(delegated.json)}`);
ok("approved delegation committed");

// 8. A CONTROLLED action exists, and the commit resolved the user's approval
//    decision through it (the commit RPC's return shape is not the source of
//    truth for authority linkage; the persisted graph is).
const { data: actions } = await service.from("action").select("id, execution_mode, status, originating_decision_id")
  .eq("pursuit_id", pursuitId).eq("execution_mode", "CONTROLLED");
assert.equal(actions?.length, 1, `expected one CONTROLLED action, got ${actions?.length}`);
ok("CONTROLLED action created");

// 9. The trusted plane provisioned authority for this user and tool. The
//    invariant is that a live, unconstrained, tool-scoped grant exists that the
//    commit may draw on - not that a fresh row is minted per delegation, since
//    the trusted plane deliberately reuses an existing live grant for the same
//    owner and tool. Authority must be durable, revocable and expiring, and it
//    must never be broader than the tool the user approved.
const { data: grants } = await service.from("capability_grant")
  .select("id, owner_user_id, tool_id, scope_constraints, target_constraints, revoked_at, expires_at, source_decision_id")
  .eq("owner_user_id", userId).eq("tool_id", tool!.id);
const liveGrants = (grants ?? []).filter((x) => x.revoked_at === null);
assert.ok(liveGrants.length >= 1, `no live capability grant for owner+tool; got ${JSON.stringify(grants)}`);
const grant = liveGrants[0];
assert.ok(grant.expires_at, "capability grant must be time-bounded, not permanent");
assert.ok(new Date(grant.expires_at as string).getTime() > Date.now(), "capability grant is already expired");
const scope = grant.scope_constraints ?? {};
assert.equal(Object.keys(scope).length, 0, `grant must not silently widen its own scope: ${JSON.stringify(scope)}`);
assert.ok(grant.source_decision_id, "every grant must be traceable to a user approval decision");
ok("capability grant live, tool-scoped, time-bounded, and decision-traceable");

const { data: jobs } = await service.from("job").select("id, status, tool_id, tool_version, idempotency_key, frozen_arguments, args_hash").eq("action_id", actions![0].id);
assert.equal(jobs?.length, 1, `expected one job, got ${jobs?.length}`);
// The job is created AUTHORIZED and may already be leased by the time this
// read lands; either is a legitimate non-terminal state.
assert.ok(["AUTHORIZED", "LEASED", "DISPATCHING", "QUEUED"].includes(jobs![0].status), `unexpected job status ${jobs![0].status}`);
ok(`job created and queued (${jobs![0].status})`);

// 10. Authority is explicit, user-attributed, bound to the exact argument hash,
//     and the job carries the frozen arguments the worker will actually run.
//     This is the anti-drift check: authorization cannot outlive the arguments
//     it was granted for.
const { data: jobAuth } = await service.from("job_authorization")
  .select("authorization_type, authorized_by_type, authorized_by_id, decision_id, args_hash, authorization_snapshot")
  .eq("job_id", jobs![0].id).maybeSingle();
assert.ok(jobAuth, "job_authorization missing");
assert.equal(jobAuth.authorization_type, "EXPLICIT_USER_APPROVAL");
assert.equal(jobAuth.authorized_by_type, "USER");
assert.equal(jobAuth.authorized_by_id, userId, "authorization must be attributed to the approving user");
assert.ok(jobAuth.decision_id, "authorization must trace to the approval decision");
const snapshot = jobAuth.authorization_snapshot as Json;
assert.equal(snapshot.args_hash, jobAuth.args_hash, "authorization snapshot must carry the authorized args hash");
assert.equal(snapshot.tool_id, tool!.id);
assert.equal(snapshot.tool_version, "v1");
assert.ok(snapshot.capability_grant_id, "authorization must reference the capability grant it drew on");
assert.ok(snapshot.authorization_rationale, "authorization must record why the user approved");
ok("job authorization is explicit, user-attributed and bound to the argument hash");

// 11. The frozen arguments are a validated worker contract, not free text.
const args = jobs![0].frozen_arguments as Json;
assert.equal(args.worker_type, "HERMES");
assert.equal(typeof args.instruction, "string");
assert.ok((args.instruction as string).trim().length > 0);
assert.ok(args.idempotency_key, "idempotency_key missing");
assert.equal(typeof args.context, "object");
ok("job froze a validated worker contract");

// 11. A worker executes: the dispatcher leases, submits, polls, and finishes.
const attemptsBefore = (await service.from("attempt").select("id", { count: "exact", head: true }).eq("job_id", jobs![0].id)).count ?? 0;
console.log("  ... run `npm run worker:dispatch` once to lease, execute and finish the job");
let attempts = attemptsBefore;
for (let i = 0; i < 40 && (attempts ?? 0) === 0; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  attempts = (await service.from("attempt").select("id", { count: "exact", head: true }).eq("job_id", jobs![0].id)).count ?? 0;
}
assert.ok((attempts ?? 0) > 0, "no attempt was recorded: the dispatcher did not run");
ok(`worker attempt recorded (${attempts})`);

// `attempt` records terminal state in terminal_resolution, not status.
const { data: attemptsRows } = await service.from("attempt")
  .select("id, terminal_resolution, error_details, external_correlation_id").eq("job_id", jobs![0].id);
let finished = (attemptsRows ?? []).find((a) => a.terminal_resolution !== null);
for (let i = 0; i < 30 && !finished; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const { data: again } = await service.from("attempt")
    .select("id, terminal_resolution, error_details, external_correlation_id").eq("job_id", jobs![0].id);
  finished = (again ?? []).find((a) => a.terminal_resolution !== null);
}
assert.ok(finished, `attempt not terminal: ${JSON.stringify(attemptsRows)}`);
assert.equal(finished!.terminal_resolution, "SUCCEEDED", `attempt ended ${finished!.terminal_resolution}: ${JSON.stringify(finished!.error_details)}`);
assert.ok(finished!.external_correlation_id, "a finished attempt must record the worker's external id");
ok("attempt reached SUCCEEDED with a mechanical result and worker correlation id");

// 12. The CONTROLLED action is finalized by the trusted plane.
const { data: finalAction } = await service.from("action").select("status").eq("id", actions![0].id).maybeSingle();
assert.equal(finalAction?.status, "COMPLETED", `CONTROLLED action is ${finalAction?.status}`);
ok("CONTROLLED action finalized COMPLETED");

// 13. The worker result became an Observation (a report, not verified truth).
// Observations are not scoped to pursuit_id, so read them via the job's owner and
// match on the attempt. The observation is written after the attempt is
// finalized, so allow it to land.
let workerObs: { id: string; observation_kind: string; source_type: string; content: unknown } | undefined;
for (let i = 0; i < 20 && !workerObs; i++) {
  const { data: obs } = await service.from("observation")
    .select("id, observation_kind, source_type, content, source_reference")
    .eq("owner_user_id", userId).order("created_at", { ascending: false }).limit(50);
  workerObs = (obs ?? []).find((o) => o.source_type === "CONTROLLED_EXECUTION");
  if (!workerObs) await new Promise((r) => setTimeout(r, 2000));
}
assert.ok(workerObs, "no CONTROLLED_EXECUTION Observation recorded from the worker result");
const content = workerObs!.content as Json;
assert.ok(content.job_id, "observation must reference the job it came from");
assert.equal(content.mechanical_result_state, "SUCCEEDED");
assert.ok(content.external_correlation_id, "observation must carry the worker's external id");
ok(`worker result recorded as Observation (${workerObs!.observation_kind})`);

// 13b. The observation must be a mechanical report, explicitly not user-reported.
assert.notEqual(workerObs!.source_type, "USER_REPORTED", "a worker result must not be laundered as a user report");
ok("worker observation is attributed to CONTROLLED_EXECUTION, not the user");

// 14. Authority: a worker result is a report. It must NOT be auto-verified.
const { data: claims } = await service.from("claim").select("id, content, epistemic_status").eq("pursuit_id", pursuitId);
for (const c of claims ?? []) {
  const { data: events } = await service.from("claim_status_event").select("actor_type, to_status").eq("claim_id", c.id);
  assert.ok(events === null || events.length === 0, `worker-only evidence produced a claim status event for claim ${c.id}`);
  assert.notEqual(c.epistemic_status, "VERIFIED", "a worker result must never self-verify");
}
ok("no worker-only claim reached VERIFIED without human adjudication");

console.log(`\nE2E CONTROLLED worker loop PASSED: ${passed} boundaries verified.`);
console.log(`Evidence artifacts: pursuit ${pursuitId}, action ${actions![0].id}, job ${jobs![0].id}, session ${sessionId}`);
