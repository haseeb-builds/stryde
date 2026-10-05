import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Founding-access checkout. HONESTY RULE (Issue #6 decision on paid access):
// if billing credentials are missing, this endpoint says so plainly and no
// part of the product pretends payment works. When STRIPE_SECRET_KEY and
// STRIPE_PRICE_ID are configured, a real Stripe Checkout session is created
// through the platform-native fetch — no SDK.
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));

    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    const priceId = process.env.STRIPE_PRICE_ID?.trim();
    if (!secretKey || !priceId) {
      return NextResponse.json(
        {
          error: "Billing is not configured yet. Founding access is not open for payment at this moment.",
          configured: false,
        },
        { status: 503 },
      );
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || new URL(request.url).origin;
    const form = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${origin}/?founding=success`,
      cancel_url: `${origin}/?founding=cancelled`,
      client_reference_id: user.id,
      "subscription_data[metadata][owner_user_id]": user.id,
    });

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      cache: "no-store",
    });
    const body = (await response.json()) as { url?: unknown; error?: { message?: unknown } };
    if (!response.ok || typeof body.url !== "string") {
      console.error("[billing] stripe checkout failed:", body.error?.message ?? response.status);
      return NextResponse.json({ error: "The payment provider refused the request." }, { status: 502 });
    }

    return NextResponse.json({ checkout_url: body.url, configured: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.includes("token") ? 401 : 500 });
  }
}
