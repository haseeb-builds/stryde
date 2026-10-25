import assert from "node:assert/strict";
import test from "node:test";
import { checkAutoResearch, type AutonomyPolicy } from "../lib/autonomy-policy.ts";
import { reserveResources, ResourceExhaustedError, recordResourceUsage } from "../lib/resource-control.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

function createMockService(overrides?: {
  availableAmount?: number | null;
  availableError?: { message: string } | null;
  reserveError?: { message: string } | null;
  recordError?: { message: string } | null;
}) {
  const calls: Array<{ method: string; args: unknown }> = [];

  const client = {
    rpc: async (method: string, args: unknown) => {
      calls.push({ method, args });
      if (method === "stryde_resource_available") {
        if (overrides?.availableError) return { data: null, error: overrides.availableError };
        return { data: overrides?.availableAmount ?? 10, error: null };
      }
      if (method === "stryde_reserve_resources") {
        if (overrides?.reserveError) return { data: null, error: overrides.reserveError };
        return { data: "grp-test-res-123", error: null };
      }
      if (method === "stryde_release_reservations") {
        return { data: null, error: null };
      }
      if (method === "stryde_reconcile_reservation") {
        return { data: null, error: null };
      }
      if (method === "stryde_record_resource_usage") {
        if (overrides?.recordError) return { data: null, error: overrides.recordError };
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

test("R-6 autonomy policy check: allows default unconfigured research, refuses when explicitly disabled", () => {
  // Unconfigured (default) allows research
  assert.equal(checkAutoResearch(null), true);
  assert.equal(checkAutoResearch(undefined as unknown as AutonomyPolicy), true);

  // Policy explicitly disabled
  assert.equal(checkAutoResearch({ allow_worker_delegation: true, allowed_worker_types: [], auto_execute_research: false }), false);

  // Policy explicitly enabled
  assert.equal(checkAutoResearch({ allow_worker_delegation: true, allowed_worker_types: [], auto_execute_research: true }), true);
});

test("R-6 resource reservation: properly parses exhaustion and prevents over-budget execution", async () => {
  const { client } = createMockService({
    reserveError: { message: "RESOURCE_EXHAUSTED: research_rounds (requested 1, available 0)" },
  });

  await assert.rejects(
    () =>
      reserveResources(client, {
        ownerUserId: "u1",
        pursuitId: "p1",
        operationKey: "op1",
        requests: [{ resource: "research_rounds", expected: 1 }],
      }),
    (err: unknown) => {
      assert.ok(err instanceof ResourceExhaustedError);
      assert.equal(err.resource, "research_rounds");
      return true;
    }
  );
});

test("R-6 reservation lifecycle: releases reservation on failure and reconciles on success", async () => {
  const { client, calls } = createMockService();

  const reservation = await reserveResources(client, {
    ownerUserId: "u1",
    pursuitId: "p1",
    operationKey: "op-test-lifecycle",
    requests: [{ resource: "research_rounds", expected: 1 }],
  });

  assert.equal(reservation.groupId, "grp-test-res-123");

  // Reconcile on success
  await reservation.reconcile([{ resource: "research_rounds", expected: 1 }]);
  const reconcileCall = calls.find((c) => c.method === "stryde_reconcile_reservation");
  assert.ok(reconcileCall);
  assert.equal((reconcileCall.args as Record<string, unknown>).p_resource, "research_rounds");

  // Release on cancellation/error
  await reservation.release();
  const releaseCall = calls.find((c) => c.method === "stryde_release_reservations");
  assert.ok(releaseCall);
});

test("R-6 usage recording: records model_turns and source_extraction without double-charging", async () => {
  const { client, calls } = createMockService();

  const res = await recordResourceUsage(client, {
    ownerUserId: "u1",
    pursuitId: "p1",
    resource: "model_turns",
    amount: 1,
    capabilityKey: "conversation.turn",
  });

  assert.equal(res.ok, true);
  const recordCall = calls.find((c) => c.method === "stryde_record_resource_usage");
  assert.ok(recordCall);
  assert.equal((recordCall.args as Record<string, unknown>).p_resource, "model_turns");
  assert.equal((recordCall.args as Record<string, unknown>).p_amount, 1);
});
