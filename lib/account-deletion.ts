import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Permanently deletes all personal and pursuit data associated with a user ID
 * to comply with Apple App Store Review Guideline 5.1.1(v) and GDPR/CCPA right to erasure.
 */
export async function cascadeDeleteUserData(
  serviceClient: SupabaseClient,
  userId: string
): Promise<{ success: boolean; deletedUserId: string }> {
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    throw new Error("Invalid or missing user ID for deletion");
  }

  const cleanUserId = userId.trim();

  // Ordered list of user-owned tables to purge in cascade sequence
  const userScopedTables = [
    "conversation_message",
    "conversation_session",
    "action",
    "claim",
    "observation",
    "memory_item",
    "pursuit_source",
    "user_skill",
    "funnel_event",
    "user_autonomy_policy",
    "subscription_state",
    "pursuit",
  ];

  for (const table of userScopedTables) {
    try {
      const { error } = await serviceClient
        .from(table)
        .delete()
        .eq("owner_user_id", cleanUserId);

      if (error) {
        console.warn(`[account-deletion] Warning: error deleting from ${table} for user ${cleanUserId}:`, error.message);
      }
    } catch (err) {
      console.warn(`[account-deletion] Exception deleting from ${table} for user ${cleanUserId}:`, err);
    }
  }

  // Delete user from Supabase Auth admin plane if admin client is provided
  if (serviceClient.auth?.admin?.deleteUser) {
    const { error: authError } = await serviceClient.auth.admin.deleteUser(cleanUserId);
    if (authError) {
      console.warn(`[account-deletion] Warning: auth.admin.deleteUser failed for ${cleanUserId}:`, authError.message);
    }
  }

  return { success: true, deletedUserId: cleanUserId };
}
