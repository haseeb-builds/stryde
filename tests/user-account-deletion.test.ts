import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cascadeDeleteUserData,
  ORDERED_USER_TABLES,
  shouldCancelSubscription,
  isCancellableSubscriptionStatus,
  unlockUserAccount,
} from "../lib/account-deletion.ts";

test("ORDERED_USER_TABLES includes all user-associated tables in topological leaf-first order", () => {
  // 1. Verify existence of all key child and parent tables
  assert.ok(ORDERED_USER_TABLES.includes("pursuit_source_citation"));
  assert.ok(ORDERED_USER_TABLES.includes("conversation_message"));
  assert.ok(ORDERED_USER_TABLES.includes("subscription_state"));
  assert.ok(ORDERED_USER_TABLES.includes("pursuit"));
  assert.ok(ORDERED_USER_TABLES.includes("action"));
  assert.ok(ORDERED_USER_TABLES.includes("decision"));
  assert.ok(ORDERED_USER_TABLES.includes("claim_observation_link"));
  assert.ok(ORDERED_USER_TABLES.includes("claim_relation"));
  assert.ok(ORDERED_USER_TABLES.includes("budget_reservation"));
  assert.ok(ORDERED_USER_TABLES.includes("resource_usage"));
  assert.ok(ORDERED_USER_TABLES.includes("skill"));

  // 2. Leaf tables must appear before parent tables
  const citationIdx = ORDERED_USER_TABLES.indexOf("pursuit_source_citation");
  const adaptationIdx = ORDERED_USER_TABLES.indexOf("pursuit_source_adaptation");
  const sourceIdx = ORDERED_USER_TABLES.indexOf("pursuit_source");
  const pursuitIdx = ORDERED_USER_TABLES.indexOf("pursuit");
  const threadIdx = ORDERED_USER_TABLES.indexOf("thread");

  assert.ok(citationIdx < adaptationIdx, "Citations must be purged before adaptations");
  assert.ok(adaptationIdx < sourceIdx, "Adaptations must be purged before sources");
  assert.ok(sourceIdx < pursuitIdx, "Sources must be purged before pursuits");
  assert.ok(pursuitIdx < threadIdx, "Pursuits must be purged before threads");

  const actionIdx = ORDERED_USER_TABLES.indexOf("action");
  const decisionOptionIdx = ORDERED_USER_TABLES.indexOf("decision_option");
  const decisionIdx = ORDERED_USER_TABLES.indexOf("decision");
  assert.ok(actionIdx < decisionOptionIdx, "Actions must be purged before decision options");
  assert.ok(decisionOptionIdx < decisionIdx, "Decision options must be purged before decisions");
  assert.ok(decisionIdx < pursuitIdx, "Decisions must be purged before pursuits");

  const attemptIdx = ORDERED_USER_TABLES.indexOf("attempt");
  const jobIdx = ORDERED_USER_TABLES.indexOf("job");
  assert.ok(attemptIdx < jobIdx, "Attempts must be purged before jobs");
  assert.ok(jobIdx < actionIdx, "Jobs must be purged before actions");

  const msgIdx = ORDERED_USER_TABLES.indexOf("conversation_message");
  const sessionIdx = ORDERED_USER_TABLES.indexOf("conversation_session");
  assert.ok(msgIdx < sessionIdx, "Messages must be purged before sessions");
  assert.ok(sessionIdx < pursuitIdx, "Sessions must be purged before pursuits");
});

test("shouldCancelSubscription correctly identifies all billable, retryable, and terminal states", () => {
  // Active/billable states (both uppercase and lowercase) MUST cancel
  assert.equal(shouldCancelSubscription("paddle", "sub_1", "ACTIVE"), true);
  assert.equal(shouldCancelSubscription("paddle", "sub_1", "active"), true);
  assert.equal(shouldCancelSubscription("paddle", "sub_1", "TRIALING"), true);
  assert.equal(shouldCancelSubscription("paddle", "sub_1", "trialing"), true);
  assert.equal(shouldCancelSubscription("paddle", "sub_1", "PAST_DUE"), true);
  assert.equal(shouldCancelSubscription("paddle", "sub_1", "past_due"), true);
  assert.equal(shouldCancelSubscription("paddle", "sub_1", "PAUSED"), true);
  assert.equal(shouldCancelSubscription("paddle", "sub_1", "paused"), true);

  // Quarantined/unmapped price state with active subscription reference MUST cancel
  assert.equal(shouldCancelSubscription("paddle", "sub_1", "UNKNOWN"), true);

  // Terminal states MUST NOT cancel
  assert.equal(shouldCancelSubscription("paddle", "sub_1", "CANCELLED"), false);
  assert.equal(shouldCancelSubscription("paddle", "sub_1", "cancelled"), false);
  assert.equal(shouldCancelSubscription("paddle", "sub_1", "canceled"), false);
  assert.equal(shouldCancelSubscription("paddle", "sub_1", "EXPIRED"), false);
  assert.equal(shouldCancelSubscription("paddle", "sub_1", "expired"), false);

  // Missing subscription ref or wrong provider MUST NOT cancel
  assert.equal(shouldCancelSubscription("paddle", "", "ACTIVE"), false);
  assert.equal(shouldCancelSubscription("paddle", null, "ACTIVE"), false);
  assert.equal(shouldCancelSubscription("stripe", "sub_1", "ACTIVE"), false);
  assert.equal(shouldCancelSubscription(null, "sub_1", "ACTIVE"), false);

  // isCancellableSubscriptionStatus unit checks
  assert.equal(isCancellableSubscriptionStatus("ACTIVE"), true);
  assert.equal(isCancellableSubscriptionStatus("active"), true);
  assert.equal(isCancellableSubscriptionStatus("TRIALING"), true);
  assert.equal(isCancellableSubscriptionStatus("PAST_DUE"), true);
  assert.equal(isCancellableSubscriptionStatus("PAUSED"), true);
  assert.equal(isCancellableSubscriptionStatus("CANCELLED"), false);
  assert.equal(isCancellableSubscriptionStatus("EXPIRED"), false);
  assert.equal(isCancellableSubscriptionStatus(""), false);
  assert.equal(isCancellableSubscriptionStatus(null), false);
});

test("cascadeDeleteUserData cancels Paddle subscription across all active status variants (ACTIVE, TRIALING, PAST_DUE, PAUSED, UNKNOWN)", async () => {
  const testStatuses = ["ACTIVE", "active", "TRIALING", "PAST_DUE", "PAUSED", "UNKNOWN"];

  for (const status of testStatuses) {
    let cancelledRef: string | null = null;
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
                    provider_subscription_ref: `sub_${status}_123`,
                    status,
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

    const mockCancel = async (ref: string) => {
      cancelledRef = ref;
      return { success: true, status: "canceled" };
    };

    const result = await cascadeDeleteUserData(mockClient, "test-user-id", {
      paddleCancelImpl: mockCancel,
    });

    assert.equal(result.success, true);
    assert.equal(
      cancelledRef,
      `sub_${status}_123`,
      `Status ${status} must trigger Paddle cancellation`
    );
    assert.ok(deletedTables.includes("subscription_state"));
  }
});

test("cascadeDeleteUserData skips cancellation for already terminal CANCELLED or EXPIRED subscriptions", async () => {
  let cancelCalled = false;
  const mockClient = {
    from: (table: string) => {
      if (table === "subscription_state") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  provider: "paddle",
                  provider_subscription_ref: "sub_cancelled_already",
                  status: "CANCELLED",
                },
                error: null,
              }),
            }),
          }),
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      return {
        delete: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      };
    },
    auth: {
      admin: {
        deleteUser: async () => ({ data: {}, error: null }),
      },
    },
  } as unknown as SupabaseClient;

  const mockCancel = async () => {
    cancelCalled = true;
    return { success: true };
  };

  const result = await cascadeDeleteUserData(mockClient, "user-already-cancelled", {
    paddleCancelImpl: mockCancel,
  });

  assert.equal(result.success, true);
  assert.equal(cancelCalled, false, "Must not call cancel on already CANCELLED subscription");
});

test("cascadeDeleteUserData handles idempotent already-cancelled Paddle response gracefully", async () => {
  let cancelCalls = 0;
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
                  provider_subscription_ref: "sub_idempotent_test",
                  status: "ACTIVE", // DB thought it was active
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

  // Paddle returns success with "canceled" (e.g. idempotent acknowledge)
  const mockCancel = async () => {
    cancelCalls++;
    return { success: true, status: "canceled" };
  };

  const result = await cascadeDeleteUserData(mockClient, "user-idempotent-cancel", {
    paddleCancelImpl: mockCancel,
  });

  assert.equal(result.success, true);
  assert.equal(cancelCalls, 1);
  assert.ok(deletedTables.includes("subscription_state"));
});

test("cascadeDeleteUserData fails closed if Paddle cancellation fails, aborting before DB or Auth delete", async () => {
  const deletedTables: string[] = [];
  let authDeleted = false;

  const mockClient = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              provider: "paddle",
              provider_subscription_ref: "sub_err",
              status: "ACTIVE",
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
    }),
    auth: {
      admin: {
        deleteUser: async () => {
          authDeleted = true;
          return { data: {}, error: null };
        },
      },
    },
  } as unknown as SupabaseClient;

  const mockFailCancel = async () => {
    return { success: false, error: "Paddle API rate limited" };
  };

  await assert.rejects(
    cascadeDeleteUserData(mockClient, "user-failed-cancel", {
      paddleCancelImpl: mockFailCancel,
    }),
    /Failed to cancel active Paddle subscription.*Paddle API rate limited/
  );

  assert.equal(deletedTables.length, 0, "No tables must be deleted if Paddle cancellation fails");
  assert.equal(authDeleted, false, "Auth user must not be deleted if Paddle cancellation fails");
});

test("cascadeDeleteUserData fails closed if any database table deletion fails, preserving Auth user", async () => {
  let authDeleted = false;

  const mockClient = {
    from: (table: string) => {
      if (table === "subscription_state") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: null,
                error: null,
              }),
            }),
          }),
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      if (table === "action") {
        return {
          delete: () => ({
            eq: () => Promise.resolve({ error: { message: "Foreign key lock timeout" } }),
          }),
        };
      }
      return {
        delete: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
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
    cascadeDeleteUserData(mockClient, "user-table-fail"),
    /Account deletion failed for tables: action\. Auth user preserved for recovery\./
  );

  assert.equal(authDeleted, false, "Auth user must NOT be deleted if database table deletion fails");
});

test("cascadeDeleteUserData establishes write barrier by setting app_metadata.deletion_in_progress before purging", async () => {
  let barrierSet = false;
  let barrierSetBeforePurge = false;
  let purgedCount = 0;

  const mockClient = {
    from: (table: string) => {
      if (table === "job") {
        return {
          update: () => ({
            eq: () => ({
              in: () => Promise.resolve({ error: null }),
            }),
          }),
          delete: () => ({
            eq: () => {
              purgedCount++;
              if (barrierSet) barrierSetBeforePurge = true;
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === "subscription_state") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          delete: () => ({
            eq: () => {
              purgedCount++;
              if (barrierSet) barrierSetBeforePurge = true;
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      return {
        delete: () => ({
          eq: () => {
            purgedCount++;
            if (barrierSet) barrierSetBeforePurge = true;
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
    auth: {
      admin: {
        updateUserById: async (
          uid: string,
          attrs: { app_metadata?: { deletion_in_progress?: boolean; [key: string]: unknown } }
        ) => {
          if (attrs.app_metadata?.deletion_in_progress === true) {
            barrierSet = true;
          }
          return { data: { user: { id: uid } }, error: null };
        },
        deleteUser: async () => ({ data: {}, error: null }),
      },
    },
  } as unknown as SupabaseClient;

  const result = await cascadeDeleteUserData(mockClient, "user-barrier-test");
  assert.equal(result.success, true);
  assert.equal(barrierSet, true, "Write barrier must be set on Auth user metadata");
  assert.equal(barrierSetBeforePurge, true, "Write barrier must be active before any database table is deleted");
  assert.equal(purgedCount, 40, "All 40 tables must be purged");
});

test("unlockUserAccount administrative recovery helper clears deletion_in_progress barrier", async () => {
  let clearedBarrier = false;

  const mockClient = {
    auth: {
      admin: {
        updateUserById: async (
          _uid: string,
          attrs: { app_metadata?: { deletion_in_progress?: boolean; [key: string]: unknown } }
        ) => {
          if (attrs.app_metadata?.deletion_in_progress === false) {
            clearedBarrier = true;
          }
          return { data: {}, error: null };
        },
      },
    },
  } as unknown as SupabaseClient;

  await unlockUserAccount(mockClient, "user-unlock-test");
  assert.equal(clearedBarrier, true);
});

test("cascadeDeleteUserData fails closed if write barrier updateUserById returns an error", async () => {
  let deletedAnyTable = false;

  const mockClient = {
    from: () => ({
      delete: () => ({
        eq: async () => {
          deletedAnyTable = true;
          return { error: null };
        },
      }),
    }),
    auth: {
      admin: {
        updateUserById: async () => ({
          data: null,
          error: { message: "Auth admin service unavailable" },
        }),
      },
    },
  } as unknown as SupabaseClient;

  await assert.rejects(
    () => cascadeDeleteUserData(mockClient, "user-barrier-fail"),
    /Failed to establish account deletion write barrier: Auth admin service unavailable/
  );
  assert.equal(
    deletedAnyTable,
    false,
    "Zero user tables may be deleted when write barrier fails"
  );
});
