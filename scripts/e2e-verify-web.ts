// Live proof of the MECHANICAL verification path (docs/DECISIONS.md D8):
// a claim can be settled by a reliable observation without asking the user,
// while VERIFIED stays human-only. Independent of model availability — the
// working state is seeded at the deterministic seam, exactly like e2e:human.
//
//   seeded working_state (VERIFY_WEB / STRYDE + verify fields)
//   -> POST /work   (mechanical fetch -> URL_VERIFICATION observation
//                    -> claim_observation_link -> REPORTED -> OBSERVED)
//   cycles:
//     MATCHED      -> link relation VERIFIES,    claim OBSERVED
//     MISMATCHED   -> link relation CONTRADICTS, claim OBSERVED
//     UNREACHABLE  -> observation recorded honestly, NO link, claim REPORTED
//   and nothing anywhere reaches VERIFIED without human adjudication.
//
// Usage: npm run e2e:verify-web   (requires the dev server on NEXT_PUBLIC_SITE_URL)
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
const created = await api("/api/v1/pursuits", "POST", bearer, { title: `E2E VERIFY-WEB loop ${stamp}` });
assert.equal(created.status, 201, `pursuit creation failed: ${JSON.stringify(created.json)}`);
const pursuitId = (created.json.pursuit as Json | undefined)?.id as string;
const sessionRes = await api(`/api/v1/pursuits/${pursuitId}/conversations`, "POST", bearer, {});
const sessionId = (sessionRes.json as { session?: { id: string }; id?: string }).session?.id ?? (sessionRes.json as { id?: string }).id!;
assert.ok(sessionId, "session id missing");

// The work route refuses to run against an empty conversation. Seed one USER
// message at the deterministic seam (same philosophy as the working_state
// seeding below): no model is needed to prove the mechanical path.
const seedMessage = await service.from("conversation_message").insert({
  session_id: sessionId,
  owner_user_id: userId,
  role: "USER",
  content: "Please check the public reference page for this claim.",
  sequence_no: 1,
  turn_key: crypto.randomUUID(),
});
assert.ok(!seedMessage.error, `seeding conversation message failed: ${seedMessage.error?.message}`);

async function seedVerifyMove(claimId: string, url: string, expectText: string) {
  const workingState = {
    version: 1,
    status: "WORKING",
    objective: "Track the public evidence for the pursuit's claims",
    understanding: "One claim is pending and a public page can settle it mechanically.",
    known: ["A public reference page exists"],
    unknowns: [],
    bottleneck: null,
    next_move: {
      mode: "VERIFY_WEB",
      actor: "STRYDE",
      worker_type: null,
      title: "Check the public reference page",
      why: "The claim can be settled by direct observation instead of asking the user",
      expected_change: "The claim gains an observation and moves to OBSERVED",
      stryde_can_do: "Fetch the page and compare the expected text",
      user_needs_to_do: "Nothing — the check is mechanical",
      completion_condition: "The page has been fetched and the claim linked",
      verify: { claim_id: claimId, url, expect_text: expectText },
    },
  };
  const seedRes = await service.from("conversation_session").update({ working_state: workingState }).eq("id", sessionId);
  assert.ok(!seedRes.error, `seeding working_state failed: ${seedRes.error?.message}`);
}

async function runWork(): Promise<Json> {
  const res = await api(`/api/v1/pursuits/${pursuitId}/work`, "POST", bearer, { session_id: sessionId });
  assert.ok(res.status === 200 || res.status === 503, `work route failed: ${res.status} ${JSON.stringify(res.json)}`);
  return res.json;
}

async function claimStatus(claimId: string): Promise<string> {
  const { data } = await service.from("claim").select("epistemic_status").eq("id", claimId).maybeSingle();
  return data!.epistemic_status as string;
}

async function observationFor(claimId: string): Promise<Json | null> {
  const { data } = await service
    .from("observation")
    .select("id, observation_kind, source_type, source_uri, content")
    .eq("owner_user_id", userId)
    .eq("observation_kind", "URL_VERIFICATION")
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []).find((row) => (row.content as Json)?.claim_id === claimId) ?? null;
}

async function linkFor(claimId: string): Promise<{ relation_type: string } | null> {
  const { data } = await service.from("claim_observation_link").select("relation_type").eq("claim_id", claimId);
  return (data ?? [])[0] ?? null;
}

// --- Cycle 1: MATCHED -------------------------------------------------------
// https://example.com has served "Example Domain" for decades; it is the most
// stable public page available for a mechanical assertion.
const claim1 = await api("/api/v1/claims", "POST", bearer, {
  scope: "PURSUIT",
  kind: "OUTCOME",
  pursuit_id: pursuitId,
  content: "The reference page is live and titled Example Domain.",
});
assert.equal(claim1.status, 201, `claim 1 creation failed: ${JSON.stringify(claim1.json)}`);
const claim1Id = (claim1.json.claim as Json).id as string;
await seedVerifyMove(claim1Id, "https://example.com/", "Example Domain");
await runWork();
ok("work route accepted a VERIFY_WEB move (MATCHED cycle)");

const obs1 = await observationFor(claim1Id);
assert.ok(obs1, "no URL_VERIFICATION observation recorded for the matched check");
assert.equal((obs1!.content as Json).outcome, "MATCHED");
assert.equal(obs1!.source_type, "URL_CHECK");
ok("mechanical fetch produced a MATCHED observation attributed to URL_CHECK");

assert.equal(await claimStatus(claim1Id), "OBSERVED", "claim did not transition REPORTED -> OBSERVED");
const link1 = await linkFor(claim1Id);
assert.equal(link1?.relation_type, "VERIFIES");
ok("claim transitioned to OBSERVED with a VERIFIES evidence link");

// --- Cycle 2: MISMATCHED ----------------------------------------------------
const claim2 = await api("/api/v1/claims", "POST", bearer, {
  scope: "PURSUIT",
  kind: "OUTCOME",
  pursuit_id: pursuitId,
  content: "The reference page contains text it does not actually contain.",
});
assert.equal(claim2.status, 201, "claim 2 creation failed");
const claim2Id = (claim2.json.claim as Json).id as string;
await seedVerifyMove(claim2Id, "https://example.com/", "this text will never appear xyzzynope");
await runWork();

const obs2 = await observationFor(claim2Id);
assert.ok(obs2, "no URL_VERIFICATION observation recorded for the mismatched check");
assert.equal((obs2!.content as Json).outcome, "MISMATCHED");
const link2 = await linkFor(claim2Id);
assert.equal(link2?.relation_type, "CONTRADICTS");
assert.equal(await claimStatus(claim2Id), "OBSERVED");
ok("mismatch produced a CONTRADICTS link and the claim is OBSERVED, not CONTRADICTED");

// --- Cycle 3: UNREACHABLE (SSRF-guarded loopback) ---------------------------
const claim3 = await api("/api/v1/claims", "POST", bearer, {
  scope: "PURSUIT",
  kind: "OUTCOME",
  pursuit_id: pursuitId,
  content: "A loopback service exposes the internal report.",
});
assert.equal(claim3.status, 201, "claim 3 creation failed");
const claim3Id = (claim3.json.claim as Json).id as string;
await seedVerifyMove(claim3Id, "http://127.0.0.1:9/report", "internal report");
await runWork();

const obs3 = await observationFor(claim3Id);
assert.ok(obs3, "no observation recorded for the refused URL — the attempt must be evidenced");
assert.equal((obs3!.content as Json).outcome, "UNREACHABLE");
const link3 = await linkFor(claim3Id);
assert.equal(link3, null, "an unreachable check must not be linked as evidence");
assert.equal(await claimStatus(claim3Id), "REPORTED", "an unresolved check must leave the claim REPORTED");
ok("SSRF-guarded loopback URL recorded honestly as UNREACHABLE; claim stays REPORTED (UNKNOWN stays UNKNOWN)");

// --- Nothing auto-verified --------------------------------------------------
const { data: runClaims } = await service
  .from("claim")
  .select("epistemic_status")
  .eq("owner_user_id", userId)
  .eq("pursuit_id", pursuitId);
const verified = (runClaims ?? []).filter((row) => row.epistemic_status === "VERIFIED");
assert.equal(verified.length, 0, "mechanical verification must never assign VERIFIED");
ok("no claim reached VERIFIED without human adjudication");

console.log(`\ne2e:verify-web PASSED ${passed}/${passed} boundaries`);
