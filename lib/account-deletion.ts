import type { SupabaseClient } from "@supabase/supabase-js";
import { cancelPaddleSubscription } from "./paddle.ts";

/**
 * Ordered list of all user-owned and user-associated database tables in strict
 * topological leaf-to-root order to prevent foreign key constraint violations
 * during permanent account deletion.
 *
 * Derived directly from PostgreSQL foreign key dependency analysis across all migrations:
 * Every dependent child table is purged before the parent table it references.
 */
export const ORDERED_USER_TABLES: readonly string[] = [
  "trigger_firing",
  "trigger",
  "notification",
  "artifact",
  "pursuit_source_citation",
  "pursuit_source_adaptation",
  "claim_observation_link",
  "claim_relation",
  "claim_status_event",
  "decision_premise",
  "pursuit_claim_link",
  "run_context_reference",
  "run",
  "reconciliation_task",
  "attempt",
  "job_authorization",
  "job",
  "action",
  "decision_option",
  "capability_grant",
  "decision",
  "resource_usage",
  "budget_reservation",
  "budget",
  "conversation_message",
  "conversation_session",
  "memory_item",
  "pursuit_source",
  "claim",
  "observation",
  "skill",
  "user_autonomy_policy",
  "user_agent_preference",
  "credential_reference",
  "funnel_event",
  "event",
  "billing_webhook_event_ledger",
  "pursuit",
  "thread",
  "subscription_state",
];

export const CANCELLABLE_SUBSCRIPTION_STATUSES = new Set([
  "ACTIVE",
  "TRIALING",
  "PAST_DUE",
  "PAUSED",
]);

/**
 * Returns true if a status indicates a billable or potentially billable subscription.
 */
export function isCancellableSubscriptionStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return CANCELLABLE_SUBSCRIPTION_STATUSES.has(status.trim().toUpperCase());
}

/**
 * Evaluates whether a subscription row requires external Paddle cancellation before deletion.
 * Guarantees:
 * 1. Handles uppercase ("ACTIVE", "TRIALING", "PAST_DUE", "PAUSED") and lowercase ("active", etc.) statuses.
 * 2. Non-terminal states with a valid subscription reference (including UNKNOWN quarantined states)
 *    are cancelled to prevent orphaned recurring charges or dunning retries.
 * 3. Terminal states ("CANCELLED", "EXPIRED") do not incur unnecessary cancel requests.
 */
export function shouldCancelSubscription(
  provider: string | null | undefined,
  ref: string | null | undefined,
  status: string | null | undefined,
  providerStatus?: string | null | undefined
): boolean {
  if (provider !== "paddle" || !ref || !ref.trim()) {
    return false;
  }

  const normStatus = (status || "").trim().toUpperCase();
  const normProvStatus = (providerStatus || "").trim().toUpperCase();

  // Terminal states do not require cancellation
  const isTerminal =
    normStatus === "CANCELLED" ||
    normStatus === "CANCELED" ||
    normStatus === "EXPIRED" ||
    normProvStatus === "CANCELED" ||
    normProvStatus === "CANCELLED";

  if (isTerminal) {
    return false;
  }

  return true;
}

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
 * 1. Cancels any active or recurring Paddle subscription first, ensuring the user is never
 *    billed again and that billing identifiers are not deleted before cancellation is confirmed.
 * 2. Purges all 40 user-associated database tables in strict leaf-first topological order.
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
    .select("provider, provider_subscription_ref, status, provider_status")
    .eq("owner_user_id", cleanUserId)
    .maybeSingle();

  if (subError) {
    throw new Error(`Failed to query subscription state before deletion: ${subError.message}`);
  }

  const requiresCancellation = shouldCancelSubscription(
    subState?.provider,
    subState?.provider_subscription_ref,
    subState?.status,
    subState?.provider_status
  );

  if (requiresCancellation && subState?.provider_subscription_ref) {
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
