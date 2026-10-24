import { NextResponse } from "next/server";
import {
  verifyPaddleWebhookSignature,
  normalizePaddleBillingEvent,
  resolvePaddleWebhookSecret,
  resolvePaddlePricePlanMap,
  type PaddleWebhookEvent,
} from "@/lib/paddle";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Paddle Billing v2 Webhook Endpoint.
 *
 * Receives lifecycle events for subscriptions and transactions:
 * - subscription.created
 * - subscription.updated
 * - subscription.activated
 * - subscription.canceled
 * - subscription.paused
 * - subscription.resumed
 * - subscription.past_due
 * - transaction.completed
 * - transaction.paid
 *
 * Security & Integrity Guarantees:
 * 1. Verifies HMAC-SHA256 signature using canonical webhook secret (PADDLE_WEBHOOK_SECRET_KEY / PADDLE_WEBHOOK_SECRET).
 * 2. Enforces replay protection (timestamp drift validation within 300 seconds).
 * 3. Enforces idempotency: exact duplicate deliveries are safely acknowledged.
 * 4. Protects against out-of-order events: older events do not overwrite newer state.
 * 5. Fail-closed: unrecognized price mappings are quarantined and never assigned Pro/Max.
 * 6. Updates public.subscription_state via trusted service-role client.
 */
export async function POST(request: Request) {
  const secret = resolvePaddleWebhookSecret(process.env);
  if (!secret) {
    console.error("[billing/webhook] Paddle webhook secret is not configured");
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

  const pricePlanMap = resolvePaddlePricePlanMap(process.env);
  const update = normalizePaddleBillingEvent(event, pricePlanMap);

  if (!update) {
    // Non-subscription/non-transaction event (e.g. address.created)
    return NextResponse.json({ received: true, ignored: true, event_type: event.event_type });
  }

  // Verify owner user id is valid UUID
  if (!UUID_REGEX.test(update.ownerUserId)) {
    console.warn(`[billing/webhook] rejected webhook with invalid owner_user_id format: ${update.ownerUserId}`);
    return NextResponse.json(
      { error: "Invalid owner_user_id format in custom_data" },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServiceClient();

    // Query existing subscription state for idempotency & out-of-order protection
    const { data: existing, error: queryError } = await supabase
      .from("subscription_state")
      .select("owner_user_id, last_event_at, provider_subscription_ref, status, plan_id")
      .eq("owner_user_id", update.ownerUserId)
      .maybeSingle();

    if (queryError) {
      console.error("[billing/webhook] failed to query existing subscription_state:", queryError);
      return NextResponse.json(
        { error: "Failed to read subscription state" },
        { status: 500 }
      );
    }

    if (existing?.last_event_at) {
      const existingTime = new Date(existing.last_event_at).getTime();
      const incomingTime = new Date(update.lastEventAt).getTime();

      // Duplicate delivery check
      if (
        existingTime === incomingTime &&
        existing.provider_subscription_ref === update.providerSubscriptionRef &&
        existing.status === update.status &&
        existing.plan_id === update.planId
      ) {
        return NextResponse.json({
          received: true,
          duplicate: true,
          event_id: event.event_id,
        });
      }

      // Out-of-order stale event protection: older events must not overwrite newer state
      if (incomingTime < existingTime) {
        console.warn(
          `[billing/webhook] ignored out-of-order event for user ${update.ownerUserId}: incoming=${update.lastEventAt}, existing=${existing.last_event_at}`
        );
        return NextResponse.json({
          received: true,
          ignored: true,
          reason: "stale_event",
          occurred_at: update.lastEventAt,
          current_last_event_at: existing.last_event_at,
        });
      }
    }

    if (update.quarantined) {
      console.warn(
        `[billing/webhook] quarantined subscription event for user ${update.ownerUserId}: ${update.quarantineReason}`
      );
    }

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
      `[billing/webhook] updated subscription for user ${update.ownerUserId}: plan=${update.planId}, status=${update.status}, quarantined=${Boolean(update.quarantined)}`
    );

    return NextResponse.json({
      received: true,
      updated: true,
      event_id: event.event_id,
      event_type: event.event_type,
      plan_id: update.planId,
      status: update.status,
      quarantined: update.quarantined ?? false,
    });
  } catch (error) {
    console.error("[billing/webhook] unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error processing webhook" },
      { status: 500 }
    );
  }
}
