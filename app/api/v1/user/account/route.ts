import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { cascadeDeleteUserData } from "@/lib/account-deletion";

export const runtime = "nodejs";

/**
 * DELETE /api/v1/user/account
 *
 * Permanently deletes the authenticated user's account and all personal/pursuit data.
 * Satisfies Apple App Store Review Guideline 5.1.1(v) & GDPR/CCPA Right to Erasure.
 */
export async function DELETE(request: Request) {
  try {
    const { user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const serviceClient = getSupabaseServiceClient();

    const result = await cascadeDeleteUserData(serviceClient, user.id);

    return NextResponse.json({
      deleted: true,
      user_id: result.deletedUserId,
      message: "Account and associated data permanently deleted.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account deletion failed";
    const status = message.includes("token") || message.includes("Missing bearer") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
