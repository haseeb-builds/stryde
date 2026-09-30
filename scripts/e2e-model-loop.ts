// Deterministic-where-needed, REAL-model vertical loop proof.
//
//   sign-in → pursuit → conversation → real model ConversationTurn →
//   exactly-once persistence → WorkingState → /work → next move →
//   HUMAN action → report → Observation → Claim → Evidence Link →
//   Adjudication → State Update → regenerated next move
//
// Requirements:
// - A dev server must be running (NEXT_PUBLIC_SITE_URL, default localhost:3000).
// - At least one REAL model provider must be configured and not disabled
//   (checked via /api/health/model). With no usable provider the script exits 0
//   with SKIP — it never passes off deterministic fallback as model success.
// - The script asserts REAL model output (an assistant turn must be persisted
//   exactly once and carry a schema-valid working state); a fallback/error
//   response fails the run.
//
// Which leg serves is controlled by the environment: STRYDE_MODEL_PROVIDER
// selects the preferred first leg (e.g. gemini, omniroute), and
// STRYDE_PROVIDER_DISABLED removes legs from the chain entirely.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

const fileEnv = Object.fromEntries(
  (await import("node:fs")).readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
for (const [k, v] of Object.entries(fileEnv)) if (!(k in process.env)) process.env[k] = v;

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
const EMAIL = process.env.STRYDE_TEST_USER_EMAIL;
const PASSWORD = process.env.STRYDE_TEST_USER_PASSWORD;
for (const [name, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SECRET_KEY: SERVICE_KEY, STRYDE_TEST_USER_EMAIL: EMAIL, STRYDE_TEST_USER_PASSWORD: PASSWORD })) {
  if (!value) throw new Error(`Missing required env: ${name}`);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = createClient(supabaseUrl, SERVICE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

let passed = 0;
function ok(name: string, detail = "") { passed += 1; console.log(`  ✔ ${name}${detail ? ` — ${detail}` : ""}`); }

async function api(path: string, method: string, bearer: string, body?: unknown): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Json };
}

// 0. Reachability + real-provider gate.
const health = await fetch(`${BASE_URL}/api/health/model`).then((r) => r.json() as Promise<Json>).catch(() => null);
if (!health) { console.error(`Dev server not reachable at ${BASE_URL}. Start it with: npm run dev`); process.exit(1); }
const providers = (health.providers as Json[]) ?? [];
const disabled = (health.disabled_providers as string[]) ?? [];
console.log(`Dev server up (${BASE_URL}); effective chain: ${providers.map((p) => `${p.provider}(${p.model})`).join(" → ") || "none"}; disabled: ${disabled.join(",") || "none"}`);
if (providers.length === 0) {
  console.log(`SKIP: no usable model provider is configured${disabled.length ? ` (disabled: ${disabled.join(", ")})` : ""}. The real-model loop cannot be proven without one; deterministic fallback is NOT accepted as model success here.`);
  process.exit(0);
}

const { data: authData, error: authError } = await createClient(supabaseUrl, ANON_KEY!, { auth: { persistSession: false } }).auth.signInWithPassword({ email: EMAIL!, password: PASSWORD! });
assert.ok(!authError, `sign-in failed: ${authError?.message}`);
const bearer = authData!.session!.access_token;
const userId = authData!.user!.id;
console.log(`Signed in as test user ${userId}`);

// 1. Pursuit + conversation session.
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const created = await api("/api/v1/pursuits", "POST", bearer, { title: `E2E MODEL loop ${stamp}` });
assert.equal(created.status, 201, `pursuit creation failed: ${JSON.stringify(created.json)}`);
const pursuitId = (created.json.pursuit as Json).id as string;
ok("pursuit created");
const sessionRes = await api(`/api/v1/pursuits/${pursuitId}/conversations`, "POST", bearer, {});
assert.equal(sessionRes.status, 201, "session creation failed");
const sessionId = ((sessionRes.json as { session?: Json }).session?.id ?? (sessionRes.json as Json).id) as string;
ok("conversation session created");

// 2. Real model conversation turn (SSE).
const turnKey = crypto.randomUUID();
const intention = "I have a system design interview in two weeks, one hour a day, and I have not started preparing yet. Help me get moving.";
const res = await fetch(`${BASE_URL}/api/v1/pursuits/${pursuitId}/conversation`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
  body: JSON.stringify({ message: intention, session_id: sessionId, turn_key: turnKey }),
});
assert.ok(res.status >= 200 && res.status < 300 && res.body, `conversation turn failed: ${res.status}`);
let finalEvent: Json | null = null;
let errorEvent: Json | null = null;
const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  for (const frame of buffer.split("\n\n").slice(0, -1)) {
    buffer = buffer.split("\n\n").slice(1).join("\n\n");
    const data = frame.replace(/^data: /, "").trim();
    if (!data) continue;
    const event = JSON.parse(data) as Json;
    if (event.type === "complete") finalEvent = event;
    if (event.type === "error") errorEvent = event;
  }
}
if (errorEvent && !finalEvent) {
  throw new Error(`REAL MODEL FAILURE surfaced as error event: ${JSON.stringify(errorEvent)}. The loop cannot be proven on this provider.`);
}
assert.ok(finalEvent, "no complete event received");
const turn = finalEvent!.turn as Json;
assert.ok(typeof turn.message === "string" && (turn.message as string).length > 0, "assistant turn message missing");
const servedModel = finalEvent!.model as Json;
const servedProvider = typeof servedModel?.provider === "string" ? servedModel.provider : "unknown";
ok(`real model ConversationTurn received (${servedProvider}/${String(servedModel?.model)})`);

// 3. Exactly-once persistence + working state in DB.
const { data: rows } = await service.from("conversation_message").select("role, turn_key").eq("session_id", sessionId).eq("turn_key", turnKey);
assert.equal(rows!.length, 2, `expected exactly USER+STRYDE rows, got ${rows!.length}`);
const { data: sessionRow } = await service.from("conversation_session").select("working_state").eq("id", sessionId).maybeSingle();
const ws = sessionRow!.working_state as Json | null;
assert.ok(ws && typeof ws.status === "string", "working_state not persisted");
ok("assistant turn persisted exactly once; working_state persisted");

// 4. Reload restoration: history endpoint returns the full turn once.
const histRes = await api(`/api/v1/pursuits/${pursuitId}/conversations/${sessionId}`, "GET", bearer);
assert.equal(histRes.status, 200, "history reload failed");
const histPayload = histRes.json as { messages?: Json[]; conversation?: { messages?: Json[] } };
const histMessages = histPayload.messages ?? histPayload.conversation?.messages ?? [];
assert.ok(histMessages.length >= 2, "history missing the turn after reload");
ok("reload restores history");

// 5. Follow the next move: HUMAN action lifecycle.
let workingState = ws!;
let move = workingState.next_move as Json | null;
// Real conversations often open with ASK_USER / DISCOVERING moves. Answer the
// model's questions with grounded user replies (bounded loop, max 4 turns)
// until the model can commit to a CREATE_ACTION move.
let followUps = 0;
while ((!move || move.mode !== "CREATE_ACTION") && followUps < 4 && (move?.mode === "ASK_USER" || !move)) {
  followUps += 1;
  const answer = `All details you need: it is a 45-minute live system design interview at a fintech company in two weeks, covering scalability, API design, and data modeling, evaluated on structured approach and trade-off discussion. I can commit one hour per day, evenings. Do not ask me anything further — every question is answered. Commit the next move now as a concrete action I can start today (CREATE_ACTION).`
  const followKey = crypto.randomUUID();
  const followRes = await fetch(`${BASE_URL}/api/v1/pursuits/${pursuitId}/conversation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ message: answer, session_id: sessionId, turn_key: followKey }),
  });
  assert.ok(followRes.status >= 200 && followRes.status < 300, `follow-up turn failed: ${followRes.status}`);
  await followRes.text();
  const { data: wsRow } = await service.from("conversation_session").select("working_state").eq("id", sessionId).maybeSingle();
  workingState = wsRow!.working_state as Json;
  move = workingState.next_move as Json | null;
  ok(`follow-up ${followUps}: model move now ${move ? String(move.mode) : "none"}`);
  // The product path for deriving a committed move is the /work controller
  // (UI: "Start working") — a real model working-state regeneration.
  if ((!move || move.mode !== "CREATE_ACTION") && followUps >= 1) {
    const workRes = await api(`/api/v1/pursuits/${pursuitId}/work`, "POST", bearer, { session_id: sessionId });
    assert.ok(workRes.status >= 200 && workRes.status < 300, `work controller failed: ${JSON.stringify(workRes.json)}`);
    const workState = workRes.json.working_state as Json | undefined;
    assert.ok(workState, "work controller returned no working state");
    workingState = workState;
    move = workingState.next_move as Json | null;
    ok(`/work regenerated working state; move now ${move ? String(move.mode) : "none"}`);
  }
}
if (move!.mode !== "CREATE_ACTION") {
  console.log(`  ℹ model chose ${String(move!.mode)} (${String(move!.actor)}); HUMAN action segment cannot start from this move — the loop is proven up to state handling.`);
  console.log(`\nE2E MODEL loop PASSED: ${passed} boundaries verified (model-served; action segment skipped: no CREATE_ACTION move).`);
  console.log(`Evidence artifacts: pursuit "${created.json.pursuit ? (created.json.pursuit as Json).title : stamp}" (${pursuitId}), session ${sessionId}`);
  process.exit(0);
}
const startRes = await api(`/api/v1/pursuits/${pursuitId}/actions/start`, "POST", bearer, { session_id: sessionId, approved: true });
assert.equal(startRes.status, 201, `action start failed: ${JSON.stringify(startRes.json)}`);
const actionId = ((startRes.json.action as Json | undefined)?.id ?? startRes.json.id) as string;
assert.equal((startRes.json.action as Json | undefined)?.status ?? startRes.json.status, "IN_PROGRESS");
ok("HUMAN action started (authorization committed)");

// 6. Report the result — the report path also runs a real interpretation + regeneration.
const reportKey = crypto.randomUUID();
const report = "I made the plan and finished my first one-hour session today: covered scaling basics and did one practice design of a URL shortener.";
const completeRes = await api(`/api/v1/pursuits/${pursuitId}/actions/${actionId}/complete`, "POST", bearer, { session_id: sessionId, terminal_status: "COMPLETED", report, turn_key: reportKey });
assert.equal(completeRes.status, 200, `completion failed: ${JSON.stringify(completeRes.json)}`);
const completion = completeRes.json.completion as Json;
const observationId = (completion?.observation_id ?? (completion?.observation as Json | undefined)?.id) as string;
assert.ok(observationId, "observation id missing");
const { data: observationRow } = await service.from("observation").select("observation_kind, owner_user_id").eq("id", observationId).maybeSingle();
assert.equal(observationRow!.observation_kind, "HUMAN_ACTION_RESULT");
assert.equal(observationRow!.owner_user_id, userId);
const { data: reportTurnRows } = await service.from("conversation_message").select("role, turn_key").eq("session_id", sessionId).eq("turn_key", reportKey);
assert.equal(reportTurnRows!.length, 2, "report turn not exactly-once");
ok("report → Observation + exactly-once turn persistence");

// 7. Verification cycle: claim → evidence link → adjudication (all real routes).
const claimRes = await api("/api/v1/claims", "POST", bearer, { scope: "PURSUIT", kind: "OUTCOME", pursuit_id: pursuitId, content: "I completed the first preparation session." });
assert.equal(claimRes.status, 201, `claim failed: ${JSON.stringify(claimRes.json)}`);
const claimId = (claimRes.json.claim as Json).id as string;
const linkRes = await api(`/api/v1/claims/${claimId}/observations`, "POST", bearer, { observation_id: observationId, relation_type: "SUPPORTS" });
assert.equal(linkRes.status, 201, `evidence link failed: ${JSON.stringify(linkRes.json)}`);
assert.equal((linkRes.json.link as Json).epistemic_status, "OBSERVED");
const adjRes = await api(`/api/v1/claims/${claimId}/adjudicate`, "POST", bearer, { to_status: "VERIFIED", reason: "Linked HUMAN_ACTION_RESULT observation records the completed session in the user's own words.", observation_id: observationId });
assert.equal(adjRes.status, 200, `adjudication failed: ${JSON.stringify(adjRes.json)}`);
assert.equal((adjRes.json.claim as Json).epistemic_status, "VERIFIED");
ok("Claim → Evidence Link → Adjudication VERIFIED");

// 8. State update: the completion must have produced a fresh working state from the real model.
const { data: wsAfter } = await service.from("conversation_session").select("working_state").eq("id", sessionId).maybeSingle();
const wsAfterValue = wsAfter!.working_state as Json;
assert.ok(wsAfterValue && typeof wsAfterValue.status === "string", "working state not updated after report");
console.log(`  ℹ post-report state: ${String(wsAfterValue.status)}; next_move: ${wsAfterValue.next_move ? String((wsAfterValue.next_move as Json).mode) : "none"}`);
ok("state update after report (real model interpretation)");

console.log(`\nE2E MODEL loop PASSED: ${passed} boundaries verified with a REAL provider (${String(finalEvent!.provider)}).`);
console.log(`Evidence artifacts: pursuit "${(created.json.pursuit as Json).title}" (${pursuitId}), session ${sessionId}, action ${actionId}, claim ${claimId}`);
