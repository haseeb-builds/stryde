import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchPursuitObservations,
  isSelectableObservationForClaim,
  formatObservationOptionLabel,
  type PursuitObservationRecord,
} from "../lib/pursuit-observations.ts";

function createMockSupabase(options: {
  pursuitOwnerId?: string;
  pursuitFound?: boolean;
  pursuitError?: Error | null;
  actionsError?: Error | null;
  observationsError?: Error | null;
  actions?: Array<{ id: string; pursuit_id: string }>;
  observations?: Array<PursuitObservationRecord & { owner_user_id: string }>;
  currentUserId?: string;
}) {
  const currentUserId = options.currentUserId ?? "user-1";
  const pursuitFound = options.pursuitFound ?? true;
  const pursuitError = options.pursuitError ?? null;
  const actionsError = options.actionsError ?? null;
  const observationsError = options.observationsError ?? null;
  const actions = options.actions ?? [];
  const allObservations = options.observations ?? [];

  return {
    from: (table: string) => {
      if (table === "pursuit") {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => {
                if (pursuitError) return { data: null, error: pursuitError };
                if (!pursuitFound) return { data: null, error: null };
                // Enforce RLS: if pursuit owner doesn't match current user, not found
                if (options.pursuitOwnerId && options.pursuitOwnerId !== currentUserId) {
                  return { data: null, error: null };
                }
                return { data: { id }, error: null };
              },
            }),
          }),
        };
      }

      if (table === "action") {
        return {
          select: () => ({
            eq: (_col: string, pursuitId: string) => {
              if (actionsError) return Promise.resolve({ data: null, error: actionsError });
              const matched = actions.filter((a) => a.pursuit_id === pursuitId);
              return Promise.resolve({ data: matched, error: null });
            },
          }),
        };
      }

      if (table === "observation") {
        return {
          select: () => {
            const chain = {
              _inIds: null as string[] | null,
              _containsContent: null as Record<string, unknown> | null,
              _containsMeta: null as Record<string, unknown> | null,
              in: (_col: string, ids: string[]) => {
                chain._inIds = ids;
                return chain;
              },
              contains: (col: string, payload: Record<string, unknown>) => {
                if (col === "content") chain._containsContent = payload;
                if (col === "source_metadata") chain._containsMeta = payload;
                return chain;
              },
              order: () => chain,
              limit: () => chain,
              then: (resolve: (val: unknown) => unknown) => {
                if (observationsError) {
                  return Promise.resolve({ data: null, error: observationsError }).then(resolve);
                }
                // Filter observations owned by current user (RLS)
                let matched = allObservations.filter((o) => o.owner_user_id === currentUserId);
                if (chain._inIds) {
                  matched = matched.filter((o) => o.source_reference && chain._inIds!.includes(o.source_reference));
                }
                if (chain._containsContent) {
                  const targetPursuitId = chain._containsContent.pursuit_id;
                  matched = matched.filter((o) => {
                    const c = o.content as Record<string, unknown> | null;
                    return c && typeof c === "object" && c.pursuit_id === targetPursuitId;
                  });
                }
                if (chain._containsMeta) {
                  const targetPursuitId = chain._containsMeta.pursuit_id;
                  matched = matched.filter((o) => {
                    const m = o.source_metadata as Record<string, unknown> | null;
                    return m && typeof m === "object" && m.pursuit_id === targetPursuitId;
                  });
                }
                return Promise.resolve({ data: matched, error: null }).then(resolve);
              },
            };
            return chain;
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

test("1. Research observations returned when the pursuit has zero actions", async () => {
  const pursuitId = "p-zero-actions";
  const userId = "user-1";
  const searchObs: PursuitObservationRecord & { owner_user_id: string } = {
    id: "obs-search-1",
    owner_user_id: userId,
    observation_kind: "WEB_SEARCH_RESULT",
    content: {
      pursuit_id: pursuitId,
      query: "quantum computing qubits",
      results: [{ url: "https://example.com/quantum" }],
    },
    observed_at: "2026-10-22T01:00:00Z",
    source_type: "WEB_SEARCH",
    source_reference: "req-12345",
    source_metadata: { pursuit_id: pursuitId },
  };

  const client = createMockSupabase({
    currentUserId: userId,
    actions: [], // 0 actions!
    observations: [searchObs],
  });

  const result = await fetchPursuitObservations(client, pursuitId);
  assert.equal(result.error, null);
  assert.ok(result.observations, "observations must be returned");
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].id, "obs-search-1");
  assert.equal(result.observations[0].observation_kind, "WEB_SEARCH_RESULT");
});

test("2. Search observations returned alongside action-linked observations", async () => {
  const pursuitId = "p-mixed";
  const userId = "user-1";
  const actionObs: PursuitObservationRecord & { owner_user_id: string } = {
    id: "obs-action-1",
    owner_user_id: userId,
    observation_kind: "HUMAN_ACTION_RESULT",
    content: { action_id: "act-1", note: "Completed interview" },
    observed_at: "2026-10-22T02:00:00Z",
    source_type: "HUMAN",
    source_reference: "act-1",
  };
  const searchObs: PursuitObservationRecord & { owner_user_id: string } = {
    id: "obs-search-2",
    owner_user_id: userId,
    observation_kind: "WEB_SEARCH_RESULT",
    content: { pursuit_id: pursuitId, query: "interview techniques" },
    observed_at: "2026-10-22T03:00:00Z", // Newer
    source_type: "WEB_SEARCH",
    source_reference: "req-999",
    source_metadata: { pursuit_id: pursuitId },
  };

  const client = createMockSupabase({
    currentUserId: userId,
    actions: [{ id: "act-1", pursuit_id: pursuitId }],
    observations: [actionObs, searchObs],
  });

  const result = await fetchPursuitObservations(client, pursuitId);
  assert.equal(result.error, null);
  assert.ok(result.observations);
  assert.equal(result.observations.length, 2);
  // Sorted descending by observed_at
  assert.equal(result.observations[0].id, "obs-search-2");
  assert.equal(result.observations[1].id, "obs-action-1");
});

test("3. Observations belonging to another pursuit are excluded", async () => {
  const pursuitId = "p-target";
  const foreignPursuitId = "p-foreign";
  const userId = "user-1";

  const targetSearchObs: PursuitObservationRecord & { owner_user_id: string } = {
    id: "obs-target",
    owner_user_id: userId,
    observation_kind: "WEB_SEARCH_RESULT",
    content: { pursuit_id: pursuitId, query: "target query" },
    observed_at: "2026-10-22T01:00:00Z",
    source_type: "WEB_SEARCH",
    source_reference: "req-1",
    source_metadata: { pursuit_id: pursuitId },
  };
  const foreignSearchObs: PursuitObservationRecord & { owner_user_id: string } = {
    id: "obs-foreign",
    owner_user_id: userId,
    observation_kind: "WEB_SEARCH_RESULT",
    content: { pursuit_id: foreignPursuitId, query: "foreign query" },
    observed_at: "2026-10-22T02:00:00Z",
    source_type: "WEB_SEARCH",
    source_reference: "req-2",
    source_metadata: { pursuit_id: foreignPursuitId },
  };
  const foreignActionObs: PursuitObservationRecord & { owner_user_id: string } = {
    id: "obs-foreign-act",
    owner_user_id: userId,
    observation_kind: "HUMAN_ACTION_RESULT",
    content: { action_id: "act-foreign" },
    observed_at: "2026-10-22T03:00:00Z",
    source_type: "HUMAN",
    source_reference: "act-foreign",
  };

  const client = createMockSupabase({
    currentUserId: userId,
    actions: [{ id: "act-foreign", pursuit_id: foreignPursuitId }],
    observations: [targetSearchObs, foreignSearchObs, foreignActionObs],
  });

  const result = await fetchPursuitObservations(client, pursuitId);
  assert.equal(result.error, null);
  assert.ok(result.observations);
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].id, "obs-target");
});

test("3b. Observations with conflicting pursuit IDs between content and metadata are strictly rejected", async () => {
  const pursuitId = "p-active";
  const foreignPursuitId = "p-conflicting";
  const userId = "user-1";

  // Case A: content says p-active, but source_metadata says p-conflicting
  const conflictingObsA: PursuitObservationRecord & { owner_user_id: string } = {
    id: "obs-conflict-a",
    owner_user_id: userId,
    observation_kind: "WEB_SEARCH_RESULT",
    content: { pursuit_id: pursuitId, query: "conflicting search A" },
    observed_at: "2026-10-22T01:00:00Z",
    source_type: "WEB_SEARCH",
    source_reference: "req-conflict-a",
    source_metadata: { pursuit_id: foreignPursuitId },
  };

  // Case B: content says p-conflicting, but source_metadata says p-active
  const conflictingObsB: PursuitObservationRecord & { owner_user_id: string } = {
    id: "obs-conflict-b",
    owner_user_id: userId,
    observation_kind: "WEB_SEARCH_RESULT",
    content: { pursuit_id: foreignPursuitId, query: "conflicting search B" },
    observed_at: "2026-10-22T02:00:00Z",
    source_type: "WEB_SEARCH",
    source_reference: "req-conflict-b",
    source_metadata: { pursuit_id: pursuitId },
  };

  // Valid observation: both match p-active
  const validObs: PursuitObservationRecord & { owner_user_id: string } = {
    id: "obs-valid",
    owner_user_id: userId,
    observation_kind: "WEB_SEARCH_RESULT",
    content: { pursuit_id: pursuitId, query: "valid search" },
    observed_at: "2026-10-22T03:00:00Z",
    source_type: "WEB_SEARCH",
    source_reference: "req-valid",
    source_metadata: { pursuit_id: pursuitId },
  };

  const client = createMockSupabase({
    currentUserId: userId,
    actions: [],
    observations: [conflictingObsA, conflictingObsB, validObs],
  });

  const result = await fetchPursuitObservations(client, pursuitId);
  assert.equal(result.error, null);
  assert.ok(result.observations);
  // Both conflicting observations must be rejected; a match in one field must never override a conflict in the other
  assert.equal(result.observations.length, 1, "Only the unconflicted observation matching active pursuit must be retained");
  assert.equal(result.observations[0].id, "obs-valid");
});

test("4. Another user's observations are excluded", async () => {
  const pursuitId = "p-user1";
  const user1 = "user-1";
  const user2 = "user-2";

  // Pursuit belongs to user-2
  const clientForeignPursuit = createMockSupabase({
    currentUserId: user1,
    pursuitOwnerId: user2,
    actions: [],
    observations: [],
  });

  const foreignPursuitResult = await fetchPursuitObservations(clientForeignPursuit, pursuitId);
  assert.equal(foreignPursuitResult.observations, null);
  assert.equal(foreignPursuitResult.error, "Pursuit not found");

  // User 2's observations in own pursuit must never appear to User 1
  const user2SearchObs: PursuitObservationRecord & { owner_user_id: string } = {
    id: "obs-user2",
    owner_user_id: user2,
    observation_kind: "WEB_SEARCH_RESULT",
    content: { pursuit_id: pursuitId, query: "secret user 2 search" },
    observed_at: "2026-10-22T01:00:00Z",
    source_type: "WEB_SEARCH",
    source_reference: "req-secret",
    source_metadata: { pursuit_id: pursuitId },
  };

  const clientUser1 = createMockSupabase({
    currentUserId: user1,
    pursuitOwnerId: user1,
    actions: [],
    observations: [user2SearchObs],
  });

  const result = await fetchPursuitObservations(clientUser1, pursuitId);
  assert.equal(result.error, null);
  assert.deepEqual(result.observations, []);
});

test("5. Empty results and database failures handled honestly", async () => {
  const pursuitId = "p-empty";
  const userId = "user-1";

  // Empty results
  const emptyClient = createMockSupabase({
    currentUserId: userId,
    actions: [],
    observations: [],
  });
  const emptyResult = await fetchPursuitObservations(emptyClient, pursuitId);
  assert.equal(emptyResult.error, null);
  assert.deepEqual(emptyResult.observations, []);

  // Database error loading pursuit
  const dbErrorPursuitClient = createMockSupabase({
    currentUserId: userId,
    pursuitError: new Error("connection failure"),
  });
  const dbErrorPursuit = await fetchPursuitObservations(dbErrorPursuitClient, pursuitId);
  assert.equal(dbErrorPursuit.observations, null);
  assert.equal(dbErrorPursuit.error, "Unable to load pursuit");

  // Database error loading actions
  const dbErrorActionsClient = createMockSupabase({
    currentUserId: userId,
    actionsError: new Error("actions table timeout"),
  });
  const dbErrorActions = await fetchPursuitObservations(dbErrorActionsClient, pursuitId);
  assert.equal(dbErrorActions.observations, null);
  assert.equal(dbErrorActions.error, "Unable to load actions");

  // Database error loading observations
  const dbErrorObsClient = createMockSupabase({
    currentUserId: userId,
    observationsError: new Error("observation query failed"),
  });
  const dbErrorObs = await fetchPursuitObservations(dbErrorObsClient, pursuitId);
  assert.equal(dbErrorObs.observations, null);
  assert.equal(dbErrorObs.error, "Unable to load observations");
});

test("6. Claims UI can actually select a returned search observation", () => {
  const searchObs = {
    id: "obs-search-1",
    observation_kind: "WEB_SEARCH_RESULT",
    observed_at: "2026-10-22T01:00:00.000Z",
    source_reference: "req-123",
  };
  const actionObs = {
    id: "obs-action-1",
    observation_kind: "HUMAN_ACTION_RESULT",
    observed_at: "2026-10-22T02:00:00.000Z",
    source_reference: "act-1",
  };
  const urlVerifyObs = {
    id: "obs-url-1",
    observation_kind: "URL_VERIFICATION",
    observed_at: "2026-10-22T03:00:00.000Z",
    source_reference: null,
  };

  // Must not discard search or verification observations
  assert.equal(isSelectableObservationForClaim(searchObs), true);
  assert.equal(isSelectableObservationForClaim(actionObs), true);
  assert.equal(isSelectableObservationForClaim(urlVerifyObs), true);

  // Formats meaningful human-readable labels
  assert.match(formatObservationOptionLabel(searchObs), /Research evidence/);
  assert.match(formatObservationOptionLabel(actionObs), /Action result/);
  assert.match(formatObservationOptionLabel(urlVerifyObs), /URL verification/);
});
