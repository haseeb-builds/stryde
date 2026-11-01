import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { cascadeDeleteUserData } from "@/lib/account-deletion";

export const runtime = "nodejs";

/**
 * DELETE /api/v1/user/account
 *
 * Permanently deletes the authenticated user's account and all personal,
 * pursuit, and billing data in compliance with Apple Guideline 5.1.1(v)
 * and GDPR/CCPA Right to Erasure.
 *
 * Caller identity is derived exclusively from the verified Bearer token;
 * no caller-supplied user ID is accepted as authority.
 *
 * Allows deletion when deletion_in_progress is set to ensure the endpoint
 * is fully idempotent and retryable following an intermediate failure.
 */
export async function DELETE(request: Request) {
  try {
    const { user } = await requireAuthenticatedSupabase(
      request.headers.get("authorization"),
      { allowDeletionInProgress: true }
    );
    const serviceClient = getSupabaseServiceClient();

    const result = await cascadeDeleteUserData(serviceClient, user.id);

    return NextResponse.json({
      deleted: true,
      user_id: result.deletedUserId,
      purged_tables_count: result.purgedTables.length,
      message: "Account and associated data permanently deleted.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Account deletion failed";
    const status =
      message.includes("token") ||
      message.includes("Missing bearer") ||
      message.includes("Authentication required")
        ? 401
        : message.includes("Account deletion in progress")
        ? 423
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
