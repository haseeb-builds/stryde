import type { SupabaseClient } from "@supabase/supabase-js";
import { cancelPaddleSubscription } from "./paddle.ts";

/**
 * Ordered list of all user-owned and user-associated database tables in strict
 * topological leaf-to-root order to prevent foreign key constraint violations
 * during permanent account deletion.
 */
export const ORDERED_USER_TABLES: readonly string[] = [
  "trigger_firing",
  "trigger",
  "notification",
  "artifact",
  "pursuit_source_citation",
  "pursuit_source_adaptation",
  "pursuit_source",
  "claim_evidence",
  "claim_observation",
  "claim_edge",
  "pursuit_claim",
  "claim",
  "decision_option",
  "decision",
  "observation",
  "action",
  "run",
  "conversation_message",
  "conversation_session",
  "memory_item",
  "user_skill",
  "user_autonomy_policy",
  "user_agent_preference",
  "resource_reservation",
  "resource_ledger",
  "funnel_event",
  "event_log",
  "pursuit",
  "thread",
  "subscription_state",
];

export type AccountDeletionOptions = {
  paddleCancelImpl?: (ref: string) => Promise<{ success: boolean; status?: string; error?: string }>;
};

export type AccountDeletionResult = {
  success: boolean;
  deletedUserId: string;
  purgedTables: string[];
};

/**
 * Permanently deletes all personal, billing, and pursuit data associated with a user ID.
 * Semantics:
 * 1. Cancels any active Paddle subscription first, ensuring the user is never billed again
 *    and that billing identifiers are not deleted before cancellation is confirmed.
 * 2. Purges all 30 user-associated database tables in leaf-first topological order.
 * 3. Fails closed: if any table fails to purge, aborts before deleting the Supabase Auth
 *    identity so that the user or an admin can re-authenticate to retry or reconcile.
 * 4. Only once all database tables are cleanly purged does it delete the Auth user identity.
 */
export async function cascadeDeleteUserData(
  serviceClient: SupabaseClient,
  userId: string,
  options?: AccountDeletionOptions
): Promise<AccountDeletionResult> {
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    throw new Error("Invalid or missing user ID for deletion");
  }

  const cleanUserId = userId.trim();

  // 1. Check for active external billing subscriptions before deleting database records
  const { data: subState, error: subError } = await serviceClient
    .from("subscription_state")
    .select("provider, provider_subscription_ref, status")
    .eq("owner_user_id", cleanUserId)
    .maybeSingle();

  if (subError) {
    throw new Error(`Failed to query subscription state before deletion: ${subError.message}`);
  }

  const activePaddleSub =
    subState &&
    subState.provider === "paddle" &&
    subState.provider_subscription_ref &&
    subState.status === "active";

  if (activePaddleSub) {
    const cancelFn = options?.paddleCancelImpl ?? cancelPaddleSubscription;
    const cancelResult = await cancelFn(subState.provider_subscription_ref as string);
    if (!cancelResult.success) {
      throw new Error(
        `Failed to cancel active Paddle subscription (${subState.provider_subscription_ref}): ${cancelResult.error || "unknown error"}. Deletion aborted to prevent orphaned recurring charges.`
      );
    }
  }

  // 2. Cascade delete database records in leaf-to-root order
  const failedTables: string[] = [];
  const purgedTables: string[] = [];

  for (const table of ORDERED_USER_TABLES) {
    try {
      const { error } = await serviceClient
        .from(table)
        .delete()
        .eq("owner_user_id", cleanUserId);

      if (error) {
        failedTables.push(table);
      } else {
        purgedTables.push(table);
      }
    } catch {
      failedTables.push(table);
    }
  }

  if (failedTables.length > 0) {
    throw new Error(
      `Account deletion failed for tables: ${failedTables.join(", ")}. Auth user preserved for recovery.`
    );
  }

  // 3. Purge user from Supabase Auth identity plane
  if (serviceClient.auth?.admin?.deleteUser) {
    const { error: authError } = await serviceClient.auth.admin.deleteUser(cleanUserId);
    if (authError) {
      throw new Error(`Auth user deletion failed: ${authError.message}. Database records were purged.`);
    }
  }

  return {
    success: true,
    deletedUserId: cleanUserId,
    purgedTables,
  };
}
