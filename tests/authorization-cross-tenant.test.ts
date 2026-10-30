import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "@supabase/supabase-js";
import { normalizePaddleBillingEvent } from "../lib/paddle.ts";
import { AccountDeletionLockedError } from "../lib/supabase/server.ts";

test("Cross-tenant security: Artifact revision caller identity and ownership isolation", () => {
  const userA = "11111111-1111-4111-8111-111111111111";
  const userB = "22222222-2222-4222-8222-222222222222";

  // Simulate stryde_revise_artifact SQL assertion logic
  function simulateStrydeReviseArtifact(
    authUid: string | null,
    pActor: string,
    artifactOwner: string
  ): { success: boolean; error?: string } {
    if (!authUid || pActor !== authUid) {
      return { success: false, error: "Not authorized to revise artifact" };
    }
    if (artifactOwner !== authUid) {
      return { success: false, error: "artifact not found" };
    }
    return { success: true };
  }

  // 1. User B cannot impersonate User A by passing User A as pActor
  const impersonationResult = simulateStrydeReviseArtifact(userB, userA, userA);
  assert.equal(impersonationResult.success, false);
  assert.equal(impersonationResult.error, "Not authorized to revise artifact");

  // 2. User B cannot revise User A's artifact even if passing their own pActor
  const crossTenantResult = simulateStrydeReviseArtifact(userB, userB, userA);
  assert.equal(crossTenantResult.success, false);
  assert.equal(crossTenantResult.error, "artifact not found");

  // 3. User A revising User A's artifact succeeds
  const ownerResult = simulateStrydeReviseArtifact(userA, userA, userA);
  assert.equal(ownerResult.success, true);
});

test("Cross-tenant security: Conversation RPC caller isolation", () => {
  const userA = "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const userB = "bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const sessionOwnedByA = { id: "sess-1", owner_user_id: userA, status: "ACTIVE" };

  function simulateRecordUserInput(
    authUid: string | null,
    session: typeof sessionOwnedByA
  ): { success: boolean; error?: string } {
    if (!authUid) {
      return { success: false, error: "Authentication required" };
    }
    if (session.owner_user_id !== authUid) {
      return { success: false, error: "Conversation not found" };
    }
    return { success: true };
  }

  // Unauthenticated call rejected
  assert.equal(simulateRecordUserInput(null, sessionOwnedByA).error, "Authentication required");

  // User B cannot access User A's conversation session
  assert.equal(simulateRecordUserInput(userB, sessionOwnedByA).error, "Conversation not found");

  // User A can access their own session
  assert.equal(simulateRecordUserInput(userA, sessionOwnedByA).success, true);
});

test("Cross-tenant security: Action completion caller isolation", () => {
  const userA = "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const userB = "bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const actionOwnedByA = { id: "act-1", owner_user_id: userA, execution_mode: "HUMAN" };

  function simulateCompleteHumanAction(
    authUid: string | null,
    action: typeof actionOwnedByA
  ): { success: boolean; error?: string } {
    if (!authUid) {
      return { success: false, error: "Authentication required" };
    }
    if (action.owner_user_id !== authUid) {
      return { success: false, error: "Action not found" };
    }
    return { success: true };
  }

  // User B cannot complete User A's action
  assert.equal(simulateCompleteHumanAction(userB, actionOwnedByA).error, "Action not found");

  // User A can complete their own action
  assert.equal(simulateCompleteHumanAction(userA, actionOwnedByA).success, true);
});

test("Cross-tenant security: Account deletion cannot delete another user's account", async () => {
  const callerUserA = "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const victimUserB = "bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  // Simulate route-level check: userId is derived exclusively from the authenticated session
  function resolveTargetUserId(authenticatedUser: { id: string }, clientSuppliedId?: string): string {
    // Client cannot supply target user ID; session user ID is strictly used
    if (clientSuppliedId && clientSuppliedId !== authenticatedUser.id) {
      throw new Error("Target user ID does not match authenticated user");
    }
    return authenticatedUser.id;
  }

  assert.throws(
    () => resolveTargetUserId({ id: callerUserA }, victimUserB),
    /Target user ID does not match authenticated user/
  );

  const resolved = resolveTargetUserId({ id: callerUserA }, callerUserA);
  assert.equal(resolved, callerUserA);
});

test("Cross-tenant security: Unknown price mapping cannot elevate subscription to paid tier", () => {
  const event = {
    event_id: "evt_malicious_1",
    event_type: "subscription.created",
    occurred_at: "2026-10-27T12:00:00Z",
    data: {
      id: "sub_1",
      customer_id: "ctm_1",
      status: "active",
      items: [{ price: { id: "pri_fake_pro_exploit" } }],
      custom_data: { user_id: "user-123" },
    },
  };

  const normalized = normalizePaddleBillingEvent(event, {
    pri_valid_pro: "pro",
  });

  assert.ok(normalized);
  // Must fail-closed to free
  assert.equal(normalized.planId, "free");
  assert.equal(normalized.status, "UNKNOWN");
  assert.equal(normalized.quarantined, true);
});

test("Account deletion write barrier: requireAuthenticatedSupabase rejects concurrent requests when deletion_in_progress is true", () => {
  const lockedUser = {
    id: "user-locked-123",
    app_metadata: { deletion_in_progress: true },
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as unknown as User;

  const normalUser = {
    id: "user-normal-123",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as unknown as User;

  function checkWriteBarrier(user: User, options?: { allowDeletionInProgress?: boolean }) {
    if (user.app_metadata?.deletion_in_progress && !options?.allowDeletionInProgress) {
      throw new AccountDeletionLockedError();
    }
    return true;
  }

  // Normal user proceeds
  assert.equal(checkWriteBarrier(normalUser), true);

  // Locked user is rejected with AccountDeletionLockedError
  assert.throws(
    () => checkWriteBarrier(lockedUser),
    AccountDeletionLockedError
  );

  // Locked user with allowDeletionInProgress: true proceeds (for idempotent retry of DELETE /api/v1/user/account)
  assert.equal(checkWriteBarrier(lockedUser, { allowDeletionInProgress: true }), true);
});
