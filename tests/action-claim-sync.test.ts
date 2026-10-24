import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncObservedUserClaims } from "../lib/action-completion.ts";

test("BUG B RED: syncObservedUserClaims invokes trusted service-role RPC with p_actor_id and 4 arguments", async () => {
  let userRpcCalledWith: { name: string; args: unknown } | null = null;
  let serviceRpcCalledWith: { name: string; args: unknown } | null = null;

  const mockUserSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: { id: "claim-existing-123" }, error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
    rpc: async (name: string, args: unknown) => {
      userRpcCalledWith = { name, args };
      // Simulating the real database behavior: authenticated role execution was revoked in migration 20260930040000!
      return { data: null, error: new Error("permission denied for function stryde_link_claim_observation") };
    },
  } as unknown as SupabaseClient;

  const mockServiceSupabase = {
    rpc: async (name: string, args: unknown) => {
      serviceRpcCalledWith = { name, args };
      return {
        data: {
          claim_id: "claim-existing-123",
          observation_id: "obs-456",
          relation_type: "SUPPORTS",
          epistemic_status: "OBSERVED",
        },
        error: null,
      };
    },
  } as unknown as SupabaseClient;

  const result = await syncObservedUserClaims({
    userSupabase: mockUserSupabase,
    serviceSupabase: mockServiceSupabase,
    userId: "user-789",
    pursuitId: "pursuit-001",
    observationId: "obs-456",
    claims: ["User increased bench press to 225lbs"],
  });

  assert.equal(result.warnings.length, 0, `Expected 0 warnings, got: ${JSON.stringify(result.warnings)}`);
  assert.equal(result.created, 0);

  // Must NOT call stryde_link_claim_observation on user client!
  assert.equal(userRpcCalledWith, null, "stryde_link_claim_observation must not be called on userSupabase client");

  // MUST call stryde_link_claim_observation on service client with p_actor_id!
  assert.ok(serviceRpcCalledWith !== null, "stryde_link_claim_observation must be called on serviceSupabase client");
  const call = serviceRpcCalledWith as { name: string; args: Record<string, unknown> };
  assert.equal(call.name, "stryde_link_claim_observation");
  assert.deepEqual(call.args, {
    p_actor_id: "user-789",
    p_claim_id: "claim-existing-123",
    p_observation_id: "obs-456",
    p_relation_type: "SUPPORTS",
  });
});

test("BUG B RED: syncObservedUserClaims creates new claim on user client and links via service client", async () => {
  let createdClaimPayload: unknown = null;
  let serviceLinkArgs: unknown = null;

  const mockUserSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
    rpc: async (name: string, args: unknown) => {
      if (name === "stryde_create_claim") {
        createdClaimPayload = args;
        return { data: { id: "claim-new-999" }, error: null };
      }
      return { data: null, error: new Error("unknown user rpc") };
    },
  } as unknown as SupabaseClient;

  const mockServiceSupabase = {
    rpc: async (name: string, args: unknown) => {
      if (name === "stryde_link_claim_observation") {
        serviceLinkArgs = args;
        return {
          data: {
            claim_id: "claim-new-999",
            observation_id: "obs-111",
            relation_type: "SUPPORTS",
            epistemic_status: "OBSERVED",
          },
          error: null,
        };
      }
      return { data: null, error: new Error("unknown service rpc") };
    },
  } as unknown as SupabaseClient;

  const result = await syncObservedUserClaims({
    userSupabase: mockUserSupabase,
    serviceSupabase: mockServiceSupabase,
    userId: "user-123",
    pursuitId: "pursuit-abc",
    observationId: "obs-111",
    claims: ["Client signed agreement"],
  });

  assert.equal(result.created, 1);
  assert.equal(result.warnings.length, 0);
  assert.deepEqual(createdClaimPayload, {
    p_scope: "PURSUIT",
    p_kind: "OUTCOME",
    p_content: "Client signed agreement",
    p_pursuit_id: "pursuit-abc",
  });
  assert.deepEqual(serviceLinkArgs, {
    p_actor_id: "user-123",
    p_claim_id: "claim-new-999",
    p_observation_id: "obs-111",
    p_relation_type: "SUPPORTS",
  });
});

test("BUG B RED: syncObservedUserClaims records warning when trusted RPC rejects link", async () => {
  const mockUserSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: { id: "claim-1" }, error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
    rpc: async () => ({ data: null, error: null }),
  } as unknown as SupabaseClient;

  const mockServiceSupabase = {
    rpc: async () => ({
      data: null,
      error: new Error("Observation not found"),
    }),
  } as unknown as SupabaseClient;

  const result = await syncObservedUserClaims({
    userSupabase: mockUserSupabase,
    serviceSupabase: mockServiceSupabase,
    userId: "user-123",
    pursuitId: "pursuit-abc",
    observationId: "obs-nonexistent",
    claims: ["Some statement"],
  });

  assert.equal(result.created, 0);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Observation not found/);
});
