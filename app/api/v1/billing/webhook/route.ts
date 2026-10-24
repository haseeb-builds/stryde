import { NextResponse } from "next/server";
import {
  verifyPaddleWebhookSignature,
  normalizePaddleSubscriptionEvent,
  type PaddleWebhookEvent,
} from "@/lib/paddle";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * Paddle Billing v2 Webhook Endpoint.
 *
 * Receives lifecycle events for subscriptions and transactions:
 * - subscription.created
 * - subscription.updated
 * - subscription.canceled
 * - subscription.paused
 * - subscription.resumed
 * - subscription.past_due
 *
 * Verifies HMAC-SHA256 signature using PADDLE_WEBHOOK_SECRET and enforces
 * replay protection (timestamp drift validation).
 *
 * Updates public.subscription_state via trusted service-role client.
 */
export async function POST(request: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[billing/webhook] PADDLE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook endpoint not configured" },
      { status: 503 }
    );
  }

  const signatureHeader = request.headers.get("paddle-signature");
  if (!signatureHeader) {
    return NextResponse.json(
      { error: "Missing Paddle-Signature header" },
      { status: 400 }
    );
  }

  const rawBody = await request.text();
  const isValid = verifyPaddleWebhookSignature(rawBody, signatureHeader, secret);

  if (!isValid) {
    console.warn("[billing/webhook] rejected webhook: invalid signature or expired timestamp");
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  let event: PaddleWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaddleWebhookEvent;
  } catch (error) {
    console.error("[billing/webhook] malformed JSON payload:", error);
    return NextResponse.json(
      { error: "Malformed JSON payload" },
      { status: 400 }
    );
  }

  const pricePlanMap: Record<string, "pro" | "max"> = {};
  if (process.env.PADDLE_PRICE_ID_PRO) {
    pricePlanMap[process.env.PADDLE_PRICE_ID_PRO.trim()] = "pro";
  }
  if (process.env.PADDLE_PRICE_ID) {
    pricePlanMap[process.env.PADDLE_PRICE_ID.trim()] = "pro";
  }
  if (process.env.PADDLE_PRICE_ID_MAX) {
    pricePlanMap[process.env.PADDLE_PRICE_ID_MAX.trim()] = "max";
  }

  const update = normalizePaddleSubscriptionEvent(event, pricePlanMap);

  if (!update) {
    // Non-subscription event (e.g. transaction.created, address.created)
    return NextResponse.json({ received: true, ignored: true, event_type: event.event_type });
  }

  try {
    const supabase = getSupabaseServiceClient();

    const { error: dbError } = await supabase
      .from("subscription_state")
      .upsert(
        {
          owner_user_id: update.ownerUserId,
          plan_id: update.planId,
          provider: update.provider,
          provider_customer_ref: update.providerCustomerRef || null,
          provider_subscription_ref: update.providerSubscriptionRef || null,
          provider_status: update.providerStatus,
          status: update.status,
          source: "BILLING_WEBHOOK",
          effective_at: update.effectiveAt,
          expires_at: update.expiresAt,
          last_event_at: update.lastEventAt,
          reconciled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_user_id" }
      );

    if (dbError) {
      console.error("[billing/webhook] failed to upsert subscription_state:", dbError);
      return NextResponse.json(
        { error: "Failed to persist subscription update" },
        { status: 500 }
      );
    }

    console.log(
      `[billing/webhook] updated subscription for user ${update.ownerUserId}: plan=${update.planId}, status=${update.status}, providerRef=${update.providerSubscriptionRef}`
    );

    return NextResponse.json({
      received: true,
      updated: true,
      event_id: event.event_id,
      event_type: event.event_type,
      plan_id: update.planId,
      status: update.status,
    });
  } catch (error) {
    console.error("[billing/webhook] unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error processing webhook" },
      { status: 500 }
    );
  }
}
