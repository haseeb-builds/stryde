// Deterministic end-to-end proof of the HUMAN action lifecycle, independent of
// model availability. Seeds a schema-valid working state (the deterministic seam),
// then drives the REAL authenticated API routes, RPCs, and persistence:
//
//   seeded working_state (CREATE_ACTION / HUMAN)
//   -> POST actions/start          (authorization commit: Decision + Action + events)
//   -> POST actions/start (dedupe) (already_active)
//   -> POST actions/:id/complete   (report -> observation -> state update -> assistant turn)
//   -> POST actions/:id/complete (replay) (turn-key idempotency, no duplicate rows)
//
// Model-dependent steps (report interpretation, next-move regeneration) run in
// their designed deterministic fallback mode when the model is unavailable; the
// script asserts those fallbacks explicitly instead of treating them as success
// of the model path.
//
// Usage: npm run e2e:human   (requires the dev server on NEXT_PUBLIC_SITE_URL)
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

const env = Object.fromEntries(
  (await import("node:fs")).readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
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

// 0. Reachability + auth
const health = await fetch(`${BASE_URL}/api/health/model`).then((r) => r.status).catch(() => 0);
if (!health) { console.error(`Dev server not reachable at ${BASE_URL}. Start it with: npm run dev`); process.exit(1); }
console.log(`Dev server up (${BASE_URL}); model health ${health}`);

const { data: authData, error: authError } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
assert.ok(!authError, `sign-in failed: ${authError?.message}`);
const bearer = authData!.session!.access_token;
const userId = authData!.user!.id;
console.log(`Signed in as test user ${userId}`);

// 1. Fresh pursuit + conversation session
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const pursuitTitle = `E2E HUMAN loop ${stamp}`;
const created = await api("/api/v1/pursuits", "POST", bearer, { title: pursuitTitle });
assert.equal(created.status, 201, `pursuit creation failed: ${JSON.stringify(created.json)}`);
const pursuitId = (created.json.pursuit as Json | undefined)?.id as string | undefined;
assert.ok(pursuitId, "pursuit id missing from creation response");
ok("pursuit created via authenticated API");

const sessionRes = await api(`/api/v1/pursuits/${pursuitId}/conversations`, "POST", bearer, {});
assert.equal(sessionRes.status, 201, `session creation failed: ${JSON.stringify(sessionRes.json)}`);
const sessionIdResolved = (sessionRes.json as { session?: { id: string }; id?: string }).session?.id ?? (sessionRes.json as { id?: string }).id!;
assert.ok(sessionIdResolved, "session id missing from response");

// 2. Deterministic seam: a schema-valid working state as the adaptive controller
//    would have persisted it (mode CREATE_ACTION, actor HUMAN).
const seededWorkingState = {
  version: 1,
  status: "WORKING",
  objective: "Prepare for the system design interview",
  understanding: "The user has a fintech system design interview in two weeks, roughly one hour per day, and has not started because the scope feels undefined.",
  known: ["The interview is in two weeks", "About one hour per day is available"],
  unknowns: ["The interview format and focus areas"],
  bottleneck: "No concrete week-one plan exists yet",
  next_move: {
    mode: "CREATE_ACTION",
    actor: "HUMAN",
    worker_type: null,
    title: "Draft a two-week study plan",
    why: "A concrete plan converts vague intent into scheduled work",
    expected_change: "The user has a day-by-day plan for week one",
    stryde_can_do: "Outline the plan structure from standard system design curricula",
    user_needs_to_do: "Review and commit to the plan slots",
    completion_condition: "A written two-week plan exists and the first session is scheduled",
  },
};
const seedRes = await service.from("conversation_session").update({ working_state: seededWorkingState }).eq("id", sessionIdResolved);
assert.ok(!seedRes.error, `seeding working_state failed: ${seedRes.error?.message}`);
ok("working_state seeded (deterministic seam: CREATE_ACTION / HUMAN)");

// 3. Start the HUMAN action
const startRes = await api(`/api/v1/pursuits/${pursuitId}/actions/start`, "POST", bearer, { session_id: sessionIdResolved, approved: true });
assert.equal(startRes.status, 201, `actions/start failed (${startRes.status}): ${JSON.stringify(startRes.json)}`);
const action = startRes.json.action as Json | undefined;
const actionId = (action?.id ?? (startRes.json as Json).id) as string | undefined;
assert.ok(actionId, "no action id in start response");
assert.equal(action?.execution_mode, "HUMAN");
assert.equal(action?.status, "IN_PROGRESS");
ok(`action started: ${actionId}`);

// DB evidence: action + decision + session state
const { data: actionRow } = await service.from("action").select("id, execution_mode, status, pursuit_id, owner_user_id").eq("id", actionId!).maybeSingle();
assert.ok(actionRow, "action row missing in DB");
assert.equal(actionRow!.pursuit_id, pursuitId);
assert.equal(actionRow!.owner_user_id, userId);
assert.equal(actionRow!.status, "IN_PROGRESS");
const { data: decisionRow } = await service.from("decision").select("id, kind, status").eq("pursuit_id", pursuitId).eq("kind", "ACTION_APPROVAL").maybeSingle();
assert.ok(decisionRow, "ACTION_APPROVAL decision missing");
assert.equal(decisionRow!.status, "RESOLVED");
const { data: sessionAfterStart } = await service.from("conversation_session").select("working_state").eq("id", sessionIdResolved).maybeSingle();
assert.equal((sessionAfterStart!.working_state as Json).status, "WAITING_EXTERNAL");
ok("DB: action IN_PROGRESS, ACTION_APPROVAL decision RESOLVED, working_state WAITING_EXTERNAL");

// 4. Start dedupe
const startAgain = await api(`/api/v1/pursuits/${pursuitId}/actions/start`, "POST", bearer, { session_id: sessionIdResolved, approved: true });
assert.equal(startAgain.status, 200, `dedupe start expected 200: ${JSON.stringify(startAgain.json)}`);
assert.equal(startAgain.json.already_active, true);
ok("second start is a no-op (already_active)");

// 5. Report the result — model steps run in deterministic fallback mode when unavailable
const turnKey = crypto.randomUUID();
const report = "I drafted the two-week plan on Saturday. Week one covers fundamentals and one practice design each evening; I already finished the first session.";
const completeRes = await api(`/api/v1/pursuits/${pursuitId}/actions/${actionId}/complete`, "POST", bearer, { session_id: sessionIdResolved, terminal_status: "COMPLETED", report, turn_key: turnKey });
assert.equal(completeRes.status, 200, `complete failed (${completeRes.status}): ${JSON.stringify(completeRes.json)}`);
const workingStateAfter = completeRes.json.working_state as Json;
const assistantMessage = completeRes.json.assistant_message as string;
assert.ok(assistantMessage?.length > 0, "assistant message missing");
const metadata = completeRes.json.metadata as Json;
assert.equal(metadata.focus, "ACTION_REPORT");
assert.ok(completeRes.json.observation_interpretation, "observation interpretation missing");
if (workingStateAfter.status === "STALLED") {
  console.log("  ℹ model unavailable (expected without credits): next-move regeneration fell back to STALLED");
} else {
  assert.ok(workingStateAfter.next_move, "regenerated working state has no next move");
}
ok(`action completed: state=${String(workingStateAfter.status)}, assistant turn committed`);

// DB evidence: terminal action + observation + conversation rows
const { data: actionAfter } = await service.from("action").select("status, terminal_at").eq("id", actionId!).maybeSingle();
assert.equal(actionAfter!.status, "COMPLETED");
assert.ok(actionAfter!.terminal_at, "terminal_at missing");
const completion = completeRes.json.completion as Json;
const observationId = (completion?.observation_id ?? (completion?.observation as Json | undefined)?.id) as string | undefined;
assert.ok(observationId, "observation id missing from completion result");
const { data: observationRow } = await service.from("observation").select("observation_kind, content, owner_user_id").eq("id", observationId!).maybeSingle();
assert.ok(observationRow, "observation row missing in DB");
assert.equal(observationRow!.observation_kind, "HUMAN_ACTION_RESULT");
assert.equal(observationRow!.owner_user_id, userId);
const { data: turnRows } = await service.from("conversation_message").select("role, turn_key").eq("session_id", sessionIdResolved).eq("turn_key", turnKey);
assert.equal(turnRows!.length, 2, `expected exactly USER+STRYDE rows for the turn, got ${turnRows!.length}`);
assert.deepEqual(turnRows!.map((r) => r.role).sort(), ["STRYDE", "USER"]);
const { data: sessionAfterComplete } = await service.from("conversation_session").select("working_state").eq("id", sessionIdResolved).maybeSingle();
assert.equal((sessionAfterComplete!.working_state as Json).status, workingStateAfter.status);
ok("DB: action COMPLETED + HUMAN_ACTION_RESULT observation + exactly-once turn persistence");

// 6. Replay with the same turn key — idempotent, no duplicate rows
const replayRes = await api(`/api/v1/pursuits/${pursuitId}/actions/${actionId}/complete`, "POST", bearer, { session_id: sessionIdResolved, terminal_status: "COMPLETED", report, turn_key: turnKey });
assert.equal(replayRes.status, 200, `replay failed: ${JSON.stringify(replayRes.json)}`);
assert.equal(replayRes.json.already_recorded, true);
const { data: turnRowsAfterReplay } = await service.from("conversation_message").select("role, turn_key").eq("session_id", sessionIdResolved).eq("turn_key", turnKey);
assert.equal(turnRowsAfterReplay!.length, 2, "replay duplicated conversation rows");
const { data: observationAfterReplay } = await service.from("observation").select("id").eq("id", observationId!).maybeSingle();
assert.ok(observationAfterReplay, "observation missing after replay");
ok("replay is idempotent (no duplicate rows, already_recorded)");

// 7. Active-action query is now empty (panel would hide the execution section)
const activeRes = await api(`/api/v1/pursuits/${pursuitId}/actions?status=IN_PROGRESS`, "GET", bearer);
assert.equal(activeRes.status, 200);
assert.equal(((activeRes.json.actions as Json[]) ?? []).length, 0, "IN_PROGRESS action still listed after completion");
ok("active-action query returns empty after completion");

// 8. FAILED terminal cycle — blockers must capture the report, action must go FAILED.
//    The model is unavailable, so the previous completion left a STALLED state with
//    no next move; re-seed the working state (same seam) to represent a generated
//    next move before starting the second action.
const reseedRes = await service.from("conversation_session").update({ working_state: seededWorkingState }).eq("id", sessionIdResolved);
assert.ok(!reseedRes.error, `re-seeding working_state failed: ${reseedRes.error?.message}`);
const failStart = await api(`/api/v1/pursuits/${pursuitId}/actions/start`, "POST", bearer, { session_id: sessionIdResolved, approved: true });
assert.equal(failStart.status, 201, `second action start failed: ${JSON.stringify(failStart.json)}`);
const failActionId = ((failStart.json.action as Json | undefined)?.id ?? failStart.json.id) as string;
assert.notEqual(failActionId, actionId, "dedupe returned the already-completed action");
ok("second action started after first completed");
const failTurnKey = crypto.randomUUID();
const failReport = "I could not stick to the schedule. I missed every session this week and feel behind.";
const failComplete = await api(`/api/v1/pursuits/${pursuitId}/actions/${failActionId}/complete`, "POST", bearer, { session_id: sessionIdResolved, terminal_status: "FAILED", report: failReport, turn_key: failTurnKey });
assert.equal(failComplete.status, 200, `FAILED complete failed: ${JSON.stringify(failComplete.json)}`);
const { data: failActionRow } = await service.from("action").select("status").eq("id", failActionId).maybeSingle();
assert.equal(failActionRow!.status, "FAILED");
const failCompletion = failComplete.json.completion as Json;
const failObservationId = (failCompletion?.observation_id ?? (failCompletion?.observation as Json | undefined)?.id) as string;
const { data: failObservation } = await service.from("observation").select("observation_kind, content").eq("id", failObservationId).maybeSingle();
assert.equal(failObservation!.observation_kind, "HUMAN_ACTION_RESULT");
const failInterpretation = failComplete.json.observation_interpretation as Json;
assert.ok(Array.isArray(failInterpretation.blockers) && (failInterpretation.blockers as string[]).some((b) => b.includes("missed every session")), "FAILED report not routed into blockers");
ok("FAILED cycle: action FAILED, report preserved as blockers evidence");

// 9. Verification segment: evidence -> claim linkage -> human adjudication.
//    The report produced a HUMAN_ACTION_RESULT observation; the user files a
//    claim about the outcome, links the observation as evidence, and
//    adjudicates. Epistemic transitions are DB-controlled, not model-decided.
const claimRes = await api("/api/v1/claims", "POST", bearer, {
  scope: "PURSUIT",
  kind: "OUTCOME",
  pursuit_id: pursuitId,
  content: "I completed the first study session of the week-one plan.",
});
assert.equal(claimRes.status, 201, `claim creation failed: ${JSON.stringify(claimRes.json)}`);
const claimId = (claimRes.json.claim as Json | undefined)?.id as string;
assert.equal((claimRes.json.claim as Json).epistemic_status, "REPORTED");
ok("claim created (REPORTED)");

const linkRes = await api(`/api/v1/claims/${claimId}/observations`, "POST", bearer, {
  observation_id: observationId,
  relation_type: "SUPPORTS",
});
assert.equal(linkRes.status, 201, `claim/observation link failed: ${JSON.stringify(linkRes.json)}`);
assert.equal((linkRes.json.link as Json).epistemic_status, "OBSERVED");
const { data: linkedClaim } = await service.from("claim").select("epistemic_status").eq("id", claimId).maybeSingle();
assert.equal(linkedClaim!.epistemic_status, "OBSERVED", "claim status did not transition to OBSERVED");
const { data: statusEvents } = await service.from("claim_status_event").select("from_status, to_status, actor_type, evidence_observation_id").eq("claim_id", claimId).order("occurred_at");
assert.ok(statusEvents!.some((e) => e.from_status === "REPORTED" && e.to_status === "OBSERVED" && e.evidence_observation_id === observationId), "REPORTED->OBSERVED status event missing");
ok("observation linked as evidence; claim auto-advanced REPORTED -> OBSERVED");

const adjudicateRes = await api(`/api/v1/claims/${claimId}/adjudicate`, "POST", bearer, {
  to_status: "VERIFIED",
  reason: "The linked HUMAN_ACTION_RESULT observation records the completed session in the user's own report.",
  observation_id: observationId,
});
assert.equal(adjudicateRes.status, 200, `adjudication failed: ${JSON.stringify(adjudicateRes.json)}`);
assert.equal((adjudicateRes.json.claim as Json).epistemic_status, "VERIFIED");
const { data: adjudicationEvents } = await service.from("claim_status_event").select("from_status, to_status, actor_type").eq("claim_id", claimId).order("occurred_at");
assert.ok(adjudicationEvents!.some((e) => e.from_status === "OBSERVED" && e.to_status === "VERIFIED" && e.actor_type === "USER"), "OBSERVED->VERIFIED adjudication event missing");

// Invalid relation vocabulary must be rejected at the boundary.
const badLink = await api(`/api/v1/claims/${claimId}/observations`, "POST", bearer, {
  observation_id: observationId,
  relation_type: "PROVES",
});
assert.equal(badLink.status, 400, "invalid relation_type was not rejected");
ok("human adjudication VERIFIED with evidence link; invalid relation rejected");

console.log(`\nE2E HUMAN loop PASSED: ${passed} boundaries verified.`);
console.log(`Evidence artifacts: pursuit "${pursuitTitle}" (${pursuitId}), action ${actionId}, session ${sessionIdResolved}`);
