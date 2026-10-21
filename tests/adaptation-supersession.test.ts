import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supersedeAdaptation, updateAdaptationAuditStatus } from "../lib/research-orchestration.ts";

function createMockSupabase(handler: {
  update?: (data: unknown, filters: Record<string, unknown>) => { data: unknown; error: unknown };
}) {
  return {
    from: () => {
      let updatedData: unknown = null;
      const filters: Record<string, unknown> = {};
      const builder: Record<string, unknown> = {
        update: (data: unknown) => {
          updatedData = data;
          return builder;
        },
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return builder;
        },
        select: () => {
          if (handler.update) {
            return Promise.resolve(handler.update(updatedData, filters));
          }
          return Promise.resolve({ data: [{ id: "mock-id" }], error: null });
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

type CapturedData = {
  status?: string;
  summary?: string;
  methods?: Array<{ title: string; audit_status: string }>;
  provenance?: { audit_status: string; error?: string };
};

test("R-2 supersession: successfully marks target adaptation as SUPERSEDED scoped to owner and pursuit", async () => {
  const captured: { data: CapturedData | null; filters: Record<string, unknown> } = {
    data: null,
    filters: {},
  };

  const client = createMockSupabase({
    update: (data, filters) => {
      captured.data = data as CapturedData;
      captured.filters = filters;
      return { data: [{ id: "adapt-123" }], error: null };
    },
  });

  const res = await supersedeAdaptation(client, {
    adaptationId: "adapt-123",
    ownerUserId: "user-456",
    pursuitId: "pursuit-789",
  });

  assert.equal(res.success, true);
  assert.equal(res.affectedCount, 1);
  assert.equal(res.error, null);
  assert.deepEqual(captured.data, { status: "SUPERSEDED" });
  assert.equal(captured.filters.id, "adapt-123");
  assert.equal(captured.filters.owner_user_id, "user-456");
  assert.equal(captured.filters.pursuit_id, "pursuit-789");
});

test("R-2 supersession failure: zero matching rows (e.g. wrong owner or wrong pursuit) returns error and affectedCount 0", async () => {
  const client = createMockSupabase({
    update: () => ({ data: [], error: null }),
  });

  const res = await supersedeAdaptation(client, {
    adaptationId: "adapt-nonexistent",
    ownerUserId: "user-456",
    pursuitId: "pursuit-789",
  });

  assert.equal(res.success, false);
  assert.equal(res.affectedCount, 0);
  assert.match(res.error ?? "", /No matching adaptation found to supersede/);
});

test("R-2 supersession failure: database error is caught and not represented as success", async () => {
  const client = createMockSupabase({
    update: () => ({ data: null, error: { message: "database connection lost" } }),
  });

  const res = await supersedeAdaptation(client, {
    adaptationId: "adapt-123",
    ownerUserId: "user-456",
    pursuitId: "pursuit-789",
  });

  assert.equal(res.success, false);
  assert.equal(res.affectedCount, 0);
  assert.equal(res.error, "database connection lost");
});

test("R-2 audit status update: updates summary, methods, and provenance scoped to owner and pursuit", async () => {
  const captured: { data: CapturedData | null; filters: Record<string, unknown> } = {
    data: null,
    filters: {},
  };

  const client = createMockSupabase({
    update: (data, filters) => {
      captured.data = data as CapturedData;
      captured.filters = filters;
      return { data: [{ id: "adapt-audit-1" }], error: null };
    },
  });

  const res = await updateAdaptationAuditStatus(client, {
    adaptationId: "adapt-audit-1",
    ownerUserId: "user-456",
    pursuitId: "pursuit-789",
    summary: "Audit incomplete due to source error",
    methods: [{ title: "Step 1", audit_status: "UNVERIFIED" }],
    provenance: { audit_status: "INCOMPLETE", error: "Source timeout" },
  });

  assert.equal(res.success, true);
  assert.equal(res.affectedCount, 1);
  assert.equal(res.error, null);
  assert.equal(captured.data?.summary, "Audit incomplete due to source error");
  assert.equal(captured.data?.methods?.[0]?.audit_status, "UNVERIFIED");
  assert.equal(captured.data?.provenance?.audit_status, "INCOMPLETE");
  assert.equal(captured.filters.id, "adapt-audit-1");
  assert.equal(captured.filters.owner_user_id, "user-456");
  assert.equal(captured.filters.pursuit_id, "pursuit-789");
});

test("R-2 audit status update failure: zero rows updated returns error", async () => {
  const client = createMockSupabase({
    update: () => ({ data: [], error: null }),
  });

  const res = await updateAdaptationAuditStatus(client, {
    adaptationId: "adapt-missing",
    ownerUserId: "user-456",
    pursuitId: "pursuit-789",
    summary: "Audit update",
    methods: [],
    provenance: {},
  });

  assert.equal(res.success, false);
  assert.equal(res.affectedCount, 0);
  assert.match(res.error ?? "", /No matching adaptation found to update/);
});
