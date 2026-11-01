import { processPaddleWebhookRequest } from "@/lib/paddle-webhook";

export const runtime = "nodejs";

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
 * 6. Atomic event ledger and subscription state update via stryde_process_paddle_billing_event.
 */
export async function POST(request: Request) {
  return processPaddleWebhookRequest(request);
}
