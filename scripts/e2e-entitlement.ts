// Deterministic live proof of the resource-control plane (Phases 1-3 of the
// capability platform): capability catalog sync, plan envelope enforcement,
// reservation → reconcile/release lifecycle, exhaustion refusal, expiry
// recovery, and post-hoc usage metering. No model required — every seam is
// the SQL the routes call through lib/resource-control.
//
// Usage: npm run e2e:entitlement   (requires live Supabase credentials only)
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CAPABILITY_CATALOG, resolveCatalogAvailability, syncCapabilityCatalog } from "../lib/capability-registry.ts";
import { reserveResources, recordResourceUsage, ResourceExhaustedError } from "../lib/resource-control.ts";
import { getEntitlement } from "../lib/entitlement.ts";
import { discoverCapabilities } from "../lib/capability-discovery.ts";

const env = Object.fromEntries(
  (await import("node:fs")).readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SECRET_KEY;
if (!SUPA_URL || !SERVICE_KEY) throw new Error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY");

const service: SupabaseClient = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let passed = 0;
function ok(name: string) { passed += 1; console.log(`  ✔ ${name}`); }

// A dedicated synthetic user isolates this harness's metering from real data.
const stamp = Date.now();
const email = `stryde.e2e.entitlement.${stamp}@example.com`;
const { data: user, error: userError } = await service.auth.admin.createUser({
  email,
  password: `Px!${stamp}aB`,
  email_confirm: true,
});
assert.ok(!userError, `synthetic user creation failed: ${userError?.message}`);
const userId = user!.user.id;

try {
  // 1. Catalog sync is idempotent and reflects the deployed catalog.
  const sync1 = await syncCapabilityCatalog(service, resolveCatalogAvailability(process.env));
  assert.equal(sync1.errors.length, 0, `catalog sync errors: ${sync1.errors.join("; ")}`);
  assert.equal(sync1.synced, CAPABILITY_CATALOG.length);
  const sync2 = await syncCapabilityCatalog(service);
  assert.equal(sync2.synced, CAPABILITY_CATALOG.length, "catalog sync must be idempotent");
  ok(`capability catalog synced (${sync1.synced} rows, idempotent re-sync)`);

  // 2. Discovery resolves for a real user: free plan, no configured research keys.
  const entitlement = await getEntitlement(service, userId);
  assert.equal(entitlement.planId, "free");
  const discovery = await discoverCapabilities(service, { ownerUserId: userId, planId: entitlement.planId });
  const byKey = new Map(discovery.eligible.concat(discovery.ineligible).map((e) => [e.capabilityKey, e]));
  assert.equal(byKey.get("worker.execution")?.eligibility, "PLAN_NOT_ELIGIBLE", "free plan must not see worker execution as eligible");
  assert.ok(byKey.get("research.page_fetch")?.eligibility === "ELIGIBLE" || byKey.get("research.page_fetch")?.eligibility === "DEGRADED");
  ok("capability discovery resolves eligibility with reasons for a real free-plan user");

  // 3. Reservation lifecycle: available drops while RESERVED, reconcile records actual usage.
  const before = (await service.rpc("stryde_resource_available", { p_owner: userId, p_resource: "research_rounds" })).data as number;
  assert.equal(before, 10, "free research_rounds envelope should seed at 10/day");
  const group = await reserveResources(service, {
    ownerUserId: userId,
    operationKey: "e2e.entitlement",
    requests: [{ resource: "research_rounds", expected: 4 }],
  });
  const during = (await service.rpc("stryde_resource_available", { p_owner: userId, p_resource: "research_rounds" })).data as number;
  assert.equal(during, 6, "reserved units must reduce availability before execution");
  await group.reconcile([{ resource: "research_rounds", expected: 3 }]);
  const after = (await service.rpc("stryde_resource_available", { p_owner: userId, p_resource: "research_rounds" })).data as number;
  assert.equal(after, 7, "reconciliation must release the unused reserved unit and record the actual");
  ok("reserve → availability drop → reconcile with actual (1 unit released)");

  // 4. Exhaustion is refused server-side, never silently overspent.
  let refused = false;
  try {
    await reserveResources(service, {
      ownerUserId: userId,
      operationKey: "e2e.entitlement.over",
      requests: [{ resource: "research_rounds", expected: 8 }],
    });
  } catch (e) {
    refused = e instanceof ResourceExhaustedError;
  }
  assert.ok(refused, "over-reserving beyond the envelope must raise ResourceExhaustedError");
  ok("over-reserve refused with RESOURCE_EXHAUSTED");

  // 5. Released reservations return to the balance.
  const group2 = await reserveResources(service, {
    ownerUserId: userId,
    operationKey: "e2e.entitlement.release",
    requests: [{ resource: "research_rounds", expected: 7 }],
  });
  await group2.release();
  const released = (await service.rpc("stryde_resource_available", { p_owner: userId, p_resource: "research_rounds" })).data as number;
  assert.equal(released, 7, "released reservation must restore availability");
  ok("release restores the reserved units");

  // 6. Post-hoc usage metering is enforced against the envelope too.
  const recorded = await recordResourceUsage(service, {
    ownerUserId: userId, resource: "research_rounds", amount: 7,
  });
  assert.equal(recorded.ok, true);
  const overRecorded = await recordResourceUsage(service, {
    ownerUserId: userId, resource: "research_rounds", amount: 5,
  });
  assert.equal(overRecorded.ok, false, "usage beyond the envelope must be refused, not recorded");
  ok("post-hoc usage recorded; over-envelope usage refused");

  // 7. Expired reservations are reclaimed by the maintenance RPC.
  const group3 = await reserveResources(service, {
    ownerUserId: userId,
    operationKey: "e2e.entitlement.expire",
    requests: [{ resource: "model_turns", expected: 60 }],
    ttlSeconds: 1,
  });
  assert.ok(group3.groupId);
  await new Promise((r) => setTimeout(r, 1200));
  const expiredCount = (await service.rpc("stryde_expire_reservations")).data as number;
  assert.ok(expiredCount >= 1, "expiry maintenance must reclaim stale reservations");
  ok(`expired reservations reclaimed (${expiredCount})`);

  // 8. Cross-user isolation: another synthetic user's envelope is untouched.
  const other = await service.auth.admin.createUser({
    email: `stryde.e2e.entitlement.other.${stamp}@example.com`,
    password: `Px!${stamp}bB`, email_confirm: true,
  });
  const otherAvailable = (await service.rpc("stryde_resource_available", { p_owner: other.data!.user!.id, p_resource: "research_rounds" })).data as number;
  assert.equal(otherAvailable, 10, "one user's consumption must never leak into another's envelope");
  ok("cross-user envelope isolation holds");

  console.log(`\nE2E ENTITLEMENT PASSED: ${passed} boundaries`);
} finally {
  // Cleanup: remove the synthetic users and their metering rows.
  for (const id of [userId]) {
    await service.from("resource_usage").delete().eq("owner_user_id", id);
    await service.from("budget_reservation").delete().eq("owner_user_id", id);
  }
  await service.auth.admin.deleteUser(userId);
  const { data: others } = await service.auth.admin.listUsers({ page: 1, perPage: 50 });
  for (const u of others?.users ?? []) {
    if (u.email?.startsWith(`stryde.e2e.entitlement.other.${stamp}@`)) {
      await service.from("resource_usage").delete().eq("owner_user_id", u.id);
      await service.from("budget_reservation").delete().eq("owner_user_id", u.id);
      await service.auth.admin.deleteUser(u.id);
    }
  }
}
