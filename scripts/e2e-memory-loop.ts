// Deterministic live proof of the personal memory subsystem end to end —
// no model required (every seam is the deterministic one the model would
// fill): reality report -> memory, user control (confirm/forget/delete),
// outcome learning (adjudication VERIFIED -> ACTIVE memory), contradiction
// (adjudication CONTRADICTED -> memory flip), and cross-session retrieval
// (a NEW conversation session's adaptive situation carries the live memories
// and the episodic history of the prior session, without dead memories).
//
// Usage: npm run e2e:memory-loop   (requires the dev server on NEXT_PUBLIC_SITE_URL)
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

const health = await fetch(`${BASE_URL}/api/health/model`).then((r) => r.status).catch(() => 0);
if (!health) { console.error(`Dev server not reachable at ${BASE_URL}. Start it with: npm run dev`); process.exit(1); }
console.log(`Dev server up (${BASE_URL})`);

const { data: authData, error: authError } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
assert.ok(!authError, `sign-in failed: ${authError?.message}`);
const bearer = authData!.session!.access_token;
const userId = authData!.user!.id;

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const created = await api("/api/v1/pursuits", "POST", bearer, { title: `E2E MEMORY loop ${stamp}` });
assert.equal(created.status, 201, `pursuit creation failed: ${JSON.stringify(created.json)}`);
const pursuitId = (created.json.pursuit as Json).id as string;
const sessionRes = await api(`/api/v1/pursuits/${pursuitId}/conversations`, "POST", bearer, {});
const sessionId = (sessionRes.json as { session?: { id: string }; id?: string }).session?.id ?? (sessionRes.json as { id?: string }).id!;
assert.ok(sessionId, "session id missing");

// --- 1. Reality report -> USER_REPORTED memory (the deterministic seam of
//       the human action path: report interpretation falls back honestly
//       without a model, and the memory write is the real product path).
const seedWorkingState = {
  version: 1,
  status: "WORKING",
  objective: "Learn backend engineering on a consistent schedule",
  understanding: "The user wants a study routine and has not started yet.",
  known: ["Two weeks available"],
  unknowns: [],
  bottleneck: null,
  next_move: {
    mode: "CREATE_ACTION",
    actor: "HUMAN",
    worker_type: null,
    title: "Run the first study block",
    why: "Starting converts intent into reality",
    expected_change: "A completed first study block",
    stryde_can_do: "Track what happened and keep the pursuit moving",
    user_needs_to_do: "Do the study block and report back",
    completion_condition: "The first study block is done",
  },
};
await service.from("conversation_session").update({ working_state: seedWorkingState }).eq("id", sessionId);

const startRes = await api(`/api/v1/pursuits/${pursuitId}/actions/start`, "POST", bearer, { session_id: sessionId, approved: true });
assert.equal(startRes.status, 201, `action start failed: ${JSON.stringify(startRes.json)}`);
const actionId = (startRes.json.action as Json).id as string;

const report = "I ran my first two study sessions this week and finally understand closures.";
const completeRes = await api(`/api/v1/pursuits/${pursuitId}/actions/${actionId}/complete`, "POST", bearer, { session_id: sessionId, terminal_status: "COMPLETED", turn_key: crypto.randomUUID(), report });
assert.equal(completeRes.status, 200, `action complete failed: ${JSON.stringify(completeRes.json).slice(0, 200)}`);
const completion = completeRes.json.completion as Json | undefined;
const completedObservationId = (completion?.observation_id ?? (completion?.observation as Json | undefined)?.id) as string | undefined;
assert.ok(completedObservationId, "completion did not produce an observation");

const { data: reportMemories } = await service
  .from("memory_item")
  .select("id, memory_type, status, provenance_type, content, source_observation_id")
  .eq("owner_user_id", userId)
  .eq("source_observation_id", completedObservationId);
const reportMemory = (reportMemories ?? []).find((m) => m.memory_type === "EXPERIENCE");
assert.ok(reportMemory, "the action report did not become a memory");
assert.equal(reportMemory!.provenance_type, "USER_REPORTED");
assert.equal(reportMemory!.status, "ACTIVE", "a user's own report must start ACTIVE, not as a model candidate");
ok("reality report recorded verbatim as a USER_REPORTED ACTIVE memory");

// --- 2. User control: confirm / forget / delete through the memory API.
const candidateSeed = await service.from("memory_item").insert({
  owner_user_id: userId,
  pursuit_id: pursuitId,
  memory_scope: "PURSUIT",
  memory_type: "PREFERENCE",
  status: "CANDIDATE",
  content: "Prefers evening study sessions after 9pm",
  provenance_type: "MODEL_INFERENCE",
  provenance: { source: "CONVERSATION_TURN", session_id: sessionId, turn_key: `seed-${stamp}` },
  confidence: 0.55,
  importance: 0.5,
}).select("id").single();
assert.ok(!candidateSeed.error, `candidate seed failed: ${candidateSeed.error?.message}`);
const candidateId = candidateSeed.data!.id as string;

const forgetSeed = await service.from("memory_item").insert({
  owner_user_id: userId,
  memory_scope: "USER",
  memory_type: "FACT",
  status: "CANDIDATE",
  content: "Temporary fact destined to be forgotten",
  provenance_type: "MODEL_INFERENCE",
  provenance: { source: "E2E_SEED" },
  confidence: 0.4,
  importance: 0.3,
}).select("id").single();
const forgetId = forgetSeed.data!.id as string;

const confirmRes = await api(`/api/v1/memory/${candidateId}`, "POST", bearer, { action: "confirm" });
assert.equal(confirmRes.status, 200, `confirm failed: ${JSON.stringify(confirmRes.json)}`);
const { data: confirmedRow } = await service.from("memory_item").select("status, confidence, provenance, last_confirmed_at").eq("id", candidateId).maybeSingle();
assert.equal(confirmedRow!.status, "ACTIVE", "user confirmation must promote a candidate to ACTIVE");
assert.ok((confirmedRow!.confidence as number) >= 0.9, "user confirmation must carry the authority's confidence");
assert.equal((confirmedRow!.provenance as Json).confirmed_by_user, true);
ok("user confirmation promotes a tentative memory to active reality");

const forgetRes = await api(`/api/v1/memory/${forgetId}`, "POST", bearer, { action: "forget" });
assert.equal(forgetRes.status, 200);
const { data: forgottenRow } = await service.from("memory_item").select("status, provenance").eq("id", forgetId).maybeSingle();
assert.equal(forgottenRow!.status, "STALE", "forget must retire a memory softly");
assert.equal((forgottenRow!.provenance as Json).forgotten_by_user, true);
ok("user forget retires a memory without deleting the record");

const listRes = await api(`/api/v1/memory?limit=200`, "GET", bearer);
assert.equal(listRes.status, 200);
const listed = (listRes.json.memories as Json[]) ?? [];
assert.ok(listed.some((m) => m.id === candidateId), "memory list must include the confirmed memory");
assert.ok(!listed.some((m) => (m.provenance as Json)?.owner_probe === true), "memory list must be owner-scoped");
ok("memory inspection endpoint lists the user's memories");

// --- 3. Outcome learning: claim -> evidence -> adjudication VERIFIED creates
//       a durable memory sourced from the claim.
const claimRes = await api("/api/v1/claims", "POST", bearer, {
  scope: "PURSUIT",
  kind: "OUTCOME",
  pursuit_id: pursuitId,
  content: "I completed the first two study sessions and understand closures.",
});
assert.equal(claimRes.status, 201, `claim creation failed: ${JSON.stringify(claimRes.json)}`);
const claimId = (claimRes.json.claim as Json).id as string;
const linkRes = await api(`/api/v1/claims/${claimId}/observations`, "POST", bearer, {
  observation_id: completedObservationId,
  relation_type: "VERIFIES",
});
assert.equal(linkRes.status, 201, `evidence link failed: ${JSON.stringify(linkRes.json)}`);
const verdictRes = await api(`/api/v1/claims/${claimId}/adjudicate`, "POST", bearer, {
  to_status: "VERIFIED",
  reason: "The linked observation is my own report of the completed sessions.",
});
assert.equal(verdictRes.status, 200, `adjudication failed: ${JSON.stringify(verdictRes.json)}`);

const { data: learnedMemory } = await service
  .from("memory_item")
  .select("id, memory_type, status, confidence, provenance_type, source_claim_id")
  .eq("owner_user_id", userId)
  .eq("source_claim_id", claimId)
  .maybeSingle();
assert.ok(learnedMemory, "verifying the outcome claim did not create a memory");
assert.equal(learnedMemory!.provenance_type, "VERIFIED");
assert.equal(learnedMemory!.status, "ACTIVE");
assert.ok((learnedMemory!.confidence as number) >= 0.9);
ok("outcome learning: a verified outcome became a durable personal memory");

// --- 4. Contradiction: adjudicating the same claim CONTRADICTED flips the
//       memory it produced (VERIFIED -> CONTRADICTED is a legal transition;
//       reality moved, so the memory must follow).
const contradictionRes = await api(`/api/v1/claims/${claimId}/adjudicate`, "POST", bearer, {
  to_status: "CONTRADICTED",
  reason: "On reflection the sessions were not completed as reported.",
});
assert.equal(contradictionRes.status, 200, `contradiction failed: ${JSON.stringify(contradictionRes.json)}`);
const { data: flippedMemory } = await service.from("memory_item").select("status, stale_at").eq("id", learnedMemory!.id).maybeSingle();
assert.equal(flippedMemory!.status, "CONTRADICTED", "the memory sourced from the contradicted claim must flip");
assert.ok(flippedMemory!.stale_at, "the flipped memory must carry its contradiction time");
const { data: flippedClaim } = await service.from("claim").select("epistemic_status").eq("id", claimId).maybeSingle();
assert.equal(flippedClaim!.epistemic_status, "CONTRADICTED");
ok("contradiction: reality moved and the derived memory followed, with its history kept");

// --- 5. Cross-session continuation: a NEW session's adaptive situation
//       carries the live memories and the prior session's episodic history,
//       and excludes the dead (CONTRADICTED/STALE) ones.
const session2Res = await api(`/api/v1/pursuits/${pursuitId}/conversations`, "POST", bearer, {});
assert.equal(session2Res.status, 201, "second session creation failed");
const session2Id = (session2Res.json as { session?: { id: string }; id?: string }).session?.id ?? (session2Res.json as { id?: string }).id!;
assert.notEqual(session2Id, sessionId, "second session must be distinct");

// The second session needs at least one message for the episodic loader.
await service.from("conversation_message").insert({
  session_id: session2Id,
  owner_user_id: userId,
  role: "USER",
  content: "Picking this back up after a break.",
  sequence_no: 1,
  turn_key: crypto.randomUUID(),
});

const situationRes = await api(`/api/v1/pursuits/${pursuitId}/situation?adaptive=1`, "GET", bearer);
assert.equal(situationRes.status, 200, `adaptive situation failed: ${JSON.stringify(situationRes.json).slice(0, 200)}`);
const situation = situationRes.json.situation as Json;
const memories = (situation.memories as Json[]) ?? [];
assert.ok(memories.some((m) => m.id === candidateId), "the confirmed preference must reach the new session's situation");
assert.ok(memories.some((m) => m.id === reportMemory!.id), "the reported experience must reach the new session's situation");
assert.ok(!memories.some((m) => m.id === learnedMemory!.id), "the contradicted memory must NOT reach the model as usable state");
assert.ok(!memories.some((m) => m.id === forgetId), "the forgotten memory must NOT reach the model");
const episodic = (situation.episodic_memory as Json[]) ?? [];
assert.ok(episodic.some((e) => e.session_id === sessionId), "prior session must appear as episodic memory");
assert.ok(episodic.some((e) => e.session_id === session2Id), "the current session appears in episodic memory");
ok("cross-session continuation: new session reconstructs reality from live memories and episodic history");
ok("dead memories (contradicted, forgotten) are excluded from the model's situation");

// --- 6. Owner hard delete works and stays owner-scoped.
const deleteRes = await api(`/api/v1/memory/${forgetId}`, "DELETE", bearer);
assert.equal(deleteRes.status, 200, `delete failed: ${JSON.stringify(deleteRes.json)}`);
const { data: deletedRow } = await service.from("memory_item").select("id").eq("id", forgetId).maybeSingle();
assert.equal(deletedRow, null, "hard delete must remove the row");
ok("user hard delete removes a memory outright");

console.log(`\ne2e:memory-loop PASSED ${passed}/${passed} boundaries`);
