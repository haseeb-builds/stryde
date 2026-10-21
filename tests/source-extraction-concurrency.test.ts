import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  reserveResources,
  ResourceExhaustedError,
} from "../lib/resource-control.ts";

function createMockService(overrides?: {
  availableAmount?: number | null;
  reserveHandler?: (args: Record<string, unknown>) => { data: string | null; error: unknown };
  reconcileHandler?: (args: Record<string, unknown>) => { data: null; error: unknown };
  releaseHandler?: (args: Record<string, unknown>) => { data: null; error: unknown };
}) {
  const calls: Array<{ method: string; args: unknown }> = [];

  const client = {
    rpc: async (method: string, args: unknown) => {
      calls.push({ method, args });
      if (method === "stryde_reserve_resources") {
        if (overrides?.reserveHandler) {
          return overrides.reserveHandler(args as Record<string, unknown>);
        }
        return { data: "grp-extraction-123", error: null };
      }
      if (method === "stryde_reconcile_reservation") {
        if (overrides?.reconcileHandler) {
          return overrides.reconcileHandler(args as Record<string, unknown>);
        }
        return { data: null, error: null };
      }
      if (method === "stryde_release_reservations") {
        if (overrides?.releaseHandler) {
          return overrides.releaseHandler(args as Record<string, unknown>);
        }
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

test("R-6 source extraction quota: atomic reservation succeeds under quota and reconciles on success", async () => {
  const { client, calls } = createMockService();

  const reservation = await reserveResources(client, {
    ownerUserId: "user-1",
    pursuitId: "pursuit-1",
    operationKey: "op-extract-1",
    capabilityKey: "sources.url_ingest",
    requests: [{ resource: "source_extraction", expected: 1 }],
  });

  assert.equal(reservation.groupId, "grp-extraction-123");

  const reserveCall = calls.find((c) => c.method === "stryde_reserve_resources");
  assert.ok(reserveCall, "stryde_reserve_resources RPC must be called");
  assert.equal(
    ((reserveCall.args as Record<string, unknown>).p_resources as Array<Record<string, unknown>>)[0].resource,
    "source_extraction"
  );

  // Ingestion succeeds: reconcile
  await reservation.reconcile([{ resource: "source_extraction", expected: 1 }]);

  const reconcileCall = calls.find((c) => c.method === "stryde_reconcile_reservation");
  assert.ok(reconcileCall, "stryde_reconcile_reservation RPC must be called");
  assert.equal((reconcileCall.args as Record<string, unknown>).p_resource, "source_extraction");
  assert.equal((reconcileCall.args as Record<string, unknown>).p_actual, 1);
});

test("R-6 source extraction quota: reservation is denied with ResourceExhaustedError when quota exhausted", async () => {
  const { client, calls } = createMockService({
    reserveHandler: () => ({
      data: null,
      error: { message: "RESOURCE_EXHAUSTED: source_extraction (requested 1, available 0)" },
    }),
  });

  await assert.rejects(
    () =>
      reserveResources(client, {
        ownerUserId: "user-exhausted",
        pursuitId: "pursuit-1",
        operationKey: "op-extract-exhausted",
        capabilityKey: "sources.url_ingest",
        requests: [{ resource: "source_extraction", expected: 1 }],
      }),
    (err: unknown) => {
      assert.ok(err instanceof ResourceExhaustedError);
      assert.equal(err.resource, "source_extraction");
      assert.match(err.message, /source_extraction/);
      return true;
    }
  );

  assert.equal(
    calls.filter((c) => c.method === "stryde_reconcile_reservation").length,
    0,
    "No reconciliation when reservation is denied"
  );
});

test("R-6 source extraction failure: reservation is released on ingestion error preventing quota leakage", async () => {
  const { client, calls } = createMockService();

  const reservation = await reserveResources(client, {
    ownerUserId: "user-1",
    pursuitId: "pursuit-1",
    operationKey: "op-extract-fail",
    capabilityKey: "sources.url_ingest",
    requests: [{ resource: "source_extraction", expected: 1 }],
  });

  // Simulate ingestion error during extraction
  try {
    throw new Error("HTTP 403 Forbidden from target site");
  } catch {
    await reservation.release();
  }

  const releaseCall = calls.find((c) => c.method === "stryde_release_reservations");
  assert.ok(releaseCall, "stryde_release_reservations must be called when extraction fails");
  assert.equal((releaseCall.args as Record<string, unknown>).p_group, "grp-extraction-123");
});

test("R-6 source extraction reconciliation failure: releases reservation and fails closed", async () => {
  const { client, calls } = createMockService({
    reconcileHandler: () => ({
      data: null,
      error: { message: "reconciliation transaction conflict" },
    }),
  });

  const reservation = await reserveResources(client, {
    ownerUserId: "user-1",
    pursuitId: "pursuit-1",
    operationKey: "op-extract-reconcile-fail",
    capabilityKey: "sources.url_ingest",
    requests: [{ resource: "source_extraction", expected: 1 }],
  });

  // Reconcile fails -> catch block releases reservation
  let failedClosed = false;
  try {
    await reservation.reconcile([{ resource: "source_extraction", expected: 1 }]);
  } catch {
    await reservation.release().catch(() => {});
    failedClosed = true;
  }

  assert.equal(failedClosed, true, "Must fail closed when reconciliation fails");
  const releaseCall = calls.find((c) => c.method === "stryde_release_reservations");
  assert.ok(releaseCall, "stryde_release_reservations must be called when reconciliation fails");
});

test("R-6 source extraction concurrency: concurrent requests atomically decrement quota without race conditions", async () => {
  let availableQuota = 2; // Only 2 extractions available
  let activeReservations = 0;

  const mockDbClient = {
    rpc: async (method: string) => {
      if (method === "stryde_reserve_resources") {
        // Atomic quota check & decrement
        if (availableQuota >= 1) {
          availableQuota -= 1;
          activeReservations += 1;
          return { data: `grp-${activeReservations}`, error: null };
        }
        return {
          data: null,
          error: { message: "RESOURCE_EXHAUSTED: source_extraction (requested 1, available 0)" },
        };
      }
      if (method === "stryde_reconcile_reservation") {
        return { data: null, error: null };
      }
      if (method === "stryde_release_reservations") {
        availableQuota += 1;
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;

  // 3 concurrent extraction attempts
  const results = await Promise.allSettled([
    reserveResources(mockDbClient, {
      ownerUserId: "user-concurrent",
      pursuitId: "p1",
      operationKey: "op-1",
      requests: [{ resource: "source_extraction", expected: 1 }],
    }),
    reserveResources(mockDbClient, {
      ownerUserId: "user-concurrent",
      pursuitId: "p1",
      operationKey: "op-2",
      requests: [{ resource: "source_extraction", expected: 1 }],
    }),
    reserveResources(mockDbClient, {
      ownerUserId: "user-concurrent",
      pursuitId: "p1",
      operationKey: "op-3",
      requests: [{ resource: "source_extraction", expected: 1 }],
    }),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  assert.equal(fulfilled.length, 2, "Exactly 2 reservations should succeed under quota limit of 2");
  assert.equal(rejected.length, 1, "The 3rd concurrent request must be rejected");
  assert.ok(
    (rejected[0] as PromiseRejectedResult).reason instanceof ResourceExhaustedError,
    "Rejection reason must be ResourceExhaustedError"
  );
  assert.equal(availableQuota, 0, "Available quota must be exactly 0 (no negative or leaked quota)");
});

test("R-6 research MATERIALIZE_RESULT: reserves source_extraction and releases on unextractable content", async () => {
  const { client, calls } = createMockService();

  const reservation = await reserveResources(client, {
    ownerUserId: "user-mat-1",
    pursuitId: "pursuit-mat-1",
    operationKey: "source_extraction:user-mat-1:test:12345",
    capabilityKey: "sources.url_ingest",
    requests: [{ resource: "source_extraction", expected: 1 }],
  });

  // Simulate unextractable content (fetchStatus != FETCHED and != PARTIAL)
  const ingested = { fetchStatus: "FAILED", contentText: null };
  if (!ingested.contentText || (ingested.fetchStatus !== "FETCHED" && ingested.fetchStatus !== "PARTIAL")) {
    await reservation.release().catch(() => {});
  }

  const releaseCall = calls.find((c) => c.method === "stryde_release_reservations");
  assert.ok(releaseCall, "stryde_release_reservations must be called when materialized content is unextractable");
  assert.equal(
    calls.filter((c) => c.method === "stryde_reconcile_reservation").length,
    0,
    "No reconciliation when extraction yields no usable content"
  );
});
