import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getPaddleConfig, isPaddleConfigured } from "@/lib/paddle";

export const runtime = "nodejs";

/**
 * Returns the authenticated user's current subscription details and
 * self-serve management URLs (update payment method, cancellation).
 */
export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const supabase = getSupabaseServiceClient();

    const { data: sub } = await supabase
      .from("subscription_state")
      .select("plan_id, status, provider, provider_subscription_ref, provider_customer_ref, effective_at, expires_at, updated_at")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    const planId = sub?.plan_id || "free";
    const status = sub?.status || "ACTIVE";
    const provider = sub?.provider || "none";

    let managementUrls: { updatePaymentMethod?: string | null; cancel?: string | null } | null = null;

    if (provider === "paddle" && sub?.provider_subscription_ref && isPaddleConfigured()) {
      try {
        const config = getPaddleConfig();
        const res = await fetch(`${config.baseUrl}/subscriptions/${sub.provider_subscription_ref}`, {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
          },
          cache: "no-store",
        });
        if (res.ok) {
          const body = (await res.json()) as {
            data?: {
              management_urls?: {
                update_payment_method?: string | null;
                cancel?: string | null;
              };
            };
          };
          if (body.data?.management_urls) {
            managementUrls = {
              updatePaymentMethod: body.data.management_urls.update_payment_method ?? null,
              cancel: body.data.management_urls.cancel ?? null,
            };
          }
        }
      } catch (err) {
        console.warn("[billing/portal] could not fetch live management URLs from Paddle:", err);
      }
    }

    return NextResponse.json({
      plan_id: planId,
      status,
      provider,
      effective_at: sub?.effective_at || null,
      expires_at: sub?.expires_at || null,
      management_urls: managementUrls,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message.includes("token") ? 401 : 500 }
    );
  }
}
