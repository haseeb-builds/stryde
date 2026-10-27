import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cascadeDeleteUserData, ORDERED_USER_TABLES } from "../lib/account-deletion.ts";

test("ORDERED_USER_TABLES includes all user-associated tables in topological leaf-first order", () => {
  assert.ok(ORDERED_USER_TABLES.includes("pursuit_source_citation"));
  assert.ok(ORDERED_USER_TABLES.includes("conversation_message"));
  assert.ok(ORDERED_USER_TABLES.includes("subscription_state"));
  assert.ok(ORDERED_USER_TABLES.includes("pursuit"));

  // Leaf tables must appear before parent tables
  const citationIdx = ORDERED_USER_TABLES.indexOf("pursuit_source_citation");
  const sourceIdx = ORDERED_USER_TABLES.indexOf("pursuit_source");
  const pursuitIdx = ORDERED_USER_TABLES.indexOf("pursuit");

  assert.ok(citationIdx < sourceIdx, "Citations must be purged before sources");
  assert.ok(sourceIdx < pursuitIdx, "Sources must be purged before pursuits");

  const msgIdx = ORDERED_USER_TABLES.indexOf("conversation_message");
  const sessionIdx = ORDERED_USER_TABLES.indexOf("conversation_session");
  assert.ok(msgIdx < sessionIdx, "Messages must be purged before sessions");
});

test("cascadeDeleteUserData rejects empty or malformed user IDs", async () => {
  const dummyClient = {} as SupabaseClient;
  await assert.rejects(
    cascadeDeleteUserData(dummyClient, ""),
    /Invalid or missing user ID/
  );
  await assert.rejects(
    cascadeDeleteUserData(dummyClient, "   "),
    /Invalid or missing user ID/
  );
});

test("cascadeDeleteUserData cancels active Paddle subscription before purging DB", async () => {
  const userId = "user-with-paddle-sub";
  let paddleCancelled = false;
  const deletedTables: string[] = [];

  const mockClient = {
    from: (table: string) => {
      if (table === "subscription_state") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  provider: "paddle",
                  provider_subscription_ref: "sub_paddle_12345",
                  status: "active",
                },
                error: null,
              }),
            }),
          }),
          delete: () => ({
            eq: () => {
              deletedTables.push(table);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      return {
        delete: () => ({
          eq: () => {
            deletedTables.push(table);
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
    auth: {
      admin: {
        deleteUser: async () => ({ data: {}, error: null }),
      },
    },
  } as unknown as SupabaseClient;

  const mockPaddleCancel = async (ref: string) => {
    if (ref === "sub_paddle_12345") {
      paddleCancelled = true;
      return { success: true, status: "canceled" };
    }
    return { success: false, error: "not found" };
  };

  const result = await cascadeDeleteUserData(mockClient, userId, {
    paddleCancelImpl: mockPaddleCancel,
  });

  assert.equal(result.success, true);
  assert.equal(paddleCancelled, true, "Paddle subscription must be cancelled");
  assert.ok(deletedTables.includes("subscription_state"), "subscription_state must be deleted");
});

test("cascadeDeleteUserData fails closed if Paddle subscription cancellation fails, protecting billing ref", async () => {
  const userId = "user-failed-paddle-cancel";
  let authDeleted = false;

  const mockClient = {
    from: (table: string) => {
      if (table === "subscription_state") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  provider: "paddle",
                  provider_subscription_ref: "sub_failing_123",
                  status: "active",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    },
    auth: {
      admin: {
        deleteUser: async () => {
          authDeleted = true;
          return { data: {}, error: null };
        },
      },
    },
  } as unknown as SupabaseClient;

  const mockFailingPaddleCancel = async () => ({
    success: false,
    error: "Paddle API rate limit",
  });

  await assert.rejects(
    cascadeDeleteUserData(mockClient, userId, { paddleCancelImpl: mockFailingPaddleCancel }),
    /Failed to cancel active Paddle subscription/
  );

  assert.equal(authDeleted, false, "Auth user must NOT be deleted if Paddle cancellation fails");
});

test("cascadeDeleteUserData fails closed and aborts Auth deletion if a database table deletion fails", async () => {
  const userId = "user-db-failure";
  let authDeleted = false;

  const mockClient = {
    from: (table: string) => {
      if (table === "subscription_state") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === "conversation_message") {
        return {
          delete: () => ({ eq: () => Promise.resolve({ error: { message: "Foreign key violation" } }) }),
        };
      }
      return {
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    },
    auth: {
      admin: {
        deleteUser: async () => {
          authDeleted = true;
          return { data: {}, error: null };
        },
      },
    },
  } as unknown as SupabaseClient;

  await assert.rejects(
    cascadeDeleteUserData(mockClient, userId),
    /Account deletion failed for tables: conversation_message/
  );

  assert.equal(authDeleted, false, "Auth user must NOT be deleted if DB table deletion failed");
});

test("cascadeDeleteUserData fails closed if auth.admin.deleteUser returns an error", async () => {
  const userId = "user-auth-failure";

  const mockClient = {
    from: (table: string) => {
      if (table === "subscription_state") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      return {
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    },
    auth: {
      admin: {
        deleteUser: async () => ({ data: null, error: { message: "Auth service unavailable" } }),
      },
    },
  } as unknown as SupabaseClient;

  await assert.rejects(
    cascadeDeleteUserData(mockClient, userId),
    /Auth user deletion failed: Auth service unavailable/
  );
});
