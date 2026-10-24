import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { isPaddleConfigured, createPaddleCheckoutTransaction } from "@/lib/paddle";

export const runtime = "nodejs";

/**
 * Initiates subscription checkout for Stryde.
 *
 * Provider: Paddle Billing v2 (Merchant of Record).
 * Fully supports Pakistani and international SaaS founders with automated
 * sales tax/VAT compliance, subscription lifecycle, and direct SWIFT/Payoneer payouts.
 *
 * Honesty rule:
 * If billing credentials are missing, this endpoint returns 503 with exact instructions
 * and never pretends payments succeed.
 */
export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));

    if (!isPaddleConfigured()) {
      return NextResponse.json(
        {
          error: "Billing is not configured yet. Paddle credentials (PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET, PADDLE_PRICE_ID_PRO) are required.",
          configured: false,
          provider: "paddle",
          details: "Stryde uses Paddle Billing as its Merchant of Record to support Pakistan and global operations.",
        },
        { status: 503 }
      );
    }

    let planId: "pro" | "max" = "pro";
    try {
      const body = (await request.json()) as { plan_id?: unknown };
      if (body.plan_id === "max") planId = "max";
    } catch {
      // Body is optional; default to pro
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || new URL(request.url).origin;
    const returnUrl = `${origin}/?billing=success`;

    const { checkoutUrl, transactionId } = await createPaddleCheckoutTransaction({
      ownerUserId: user.id,
      userEmail: user.email,
      planId,
      returnUrl,
    });

    return NextResponse.json(
      {
        checkout_url: checkoutUrl,
        transaction_id: transactionId,
        plan_id: planId,
        configured: true,
        provider: "paddle",
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Billing request failed";
    console.error("[billing/checkout] error:", message);
    const isAuth = message.includes("token") || message.includes("Unauthorized") || message.includes("auth");
    return NextResponse.json(
      { error: message },
      { status: isAuth ? 401 : 500 }
    );
  }
}
