import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import {
  verifyPaddleWebhookSignature,
  normalizePaddleSubscriptionEvent,
  createPaddleCheckoutTransaction,
} from "../lib/paddle.ts";
import { normalizePlanId } from "../lib/entitlement.ts";

function generateTestSignature(secret: string, rawBody: string, ts: number): string {
  const payloadToSign = `${ts}:${rawBody}`;
  const h = crypto.createHmac("sha256", secret).update(payloadToSign).digest("hex");
  return `ts=${ts};h1=${h}`;
}

test("paddle sandbox e2e: cryptographic signature and replay protection", () => {
  const secret = "pdl_ntf_set_sandbox_secret_1234567890";
  const body = JSON.stringify({
    event_id: "evt_01sandbox12345",
    event_type: "subscription.created",
    data: {
      id: "sub_01sandbox_sub_1",
      customer_id: "ctm_01sandbox_cust_1",
      status: "active",
      items: [{ price: { id: "pri_pro_monthly" } }],
    },
  });

  const nowSec = Math.floor(Date.now() / 1000);
  const validSig = generateTestSignature(secret, body, nowSec);

  // 1. Valid signature passes
  assert.equal(verifyPaddleWebhookSignature(body, validSig, secret), true);

  // 2. Tampered body fails
  const tamperedBody = body.replace("sub_01sandbox_sub_1", "sub_01sandbox_sub_HACKED");
  assert.equal(verifyPaddleWebhookSignature(tamperedBody, validSig, secret), false);

  // 3. Replay attack (> 300 seconds in past) fails
  const staleSig = generateTestSignature(secret, body, nowSec - 301);
  assert.equal(verifyPaddleWebhookSignature(body, staleSig, secret), false);

  // 4. Future drift (> 300 seconds in future) fails
  const futureSig = generateTestSignature(secret, body, nowSec + 301);
  assert.equal(verifyPaddleWebhookSignature(body, futureSig, secret), false);
});

test("paddle sandbox e2e: full subscription lifecycle normalization", () => {
  // A. subscription.created -> ACTIVE, PRO
  const created = normalizePaddleSubscriptionEvent({
    event_id: "evt_1",
    event_type: "subscription.created",
    occurred_at: "2026-10-24T00:00:00Z",
    data: {
      id: "sub_1",
      customer_id: "ctm_1",
      status: "active",
      started_at: "2026-10-24T00:00:00Z",
      items: [{ price: { id: "pri_pro_monthly" } }],
      custom_data: { user_id: "user-123" },
    },
  });

  assert.ok(created);
  assert.equal(created!.ownerUserId, "user-123");
  assert.equal(created!.providerSubscriptionRef, "sub_1");
  assert.equal(created!.providerCustomerRef, "ctm_1");
  assert.equal(created!.status, "ACTIVE");
  assert.equal(created!.planId, "pro");
  assert.equal(created!.effectiveAt, "2026-10-24T00:00:00Z");

  // B. subscription.paused -> PAUSED
  const paused = normalizePaddleSubscriptionEvent({
    event_id: "evt_2",
    event_type: "subscription.paused",
    occurred_at: "2026-10-24T00:00:00Z",
    data: {
      id: "sub_1",
      customer_id: "ctm_1",
      status: "paused",
      items: [{ price: { id: "pri_pro_monthly" } }],
      custom_data: { user_id: "user-123" },
    },
  });
  assert.ok(paused);
  assert.equal(paused!.status, "PAUSED");

  // C. subscription.canceled -> CANCELLED
  const canceled = normalizePaddleSubscriptionEvent({
    event_id: "evt_3",
    event_type: "subscription.canceled",
    occurred_at: "2026-10-24T00:00:00Z",
    data: {
      id: "sub_1",
      customer_id: "ctm_1",
      status: "canceled",
      items: [{ price: { id: "pri_pro_monthly" } }],
      custom_data: { user_id: "user-123" },
    },
  });
  assert.ok(canceled);
  assert.equal(canceled!.status, "CANCELLED");
});

test("paddle sandbox e2e: entitlement resolver behavior across lifecycle", () => {
  // Plan resolution
  assert.equal(normalizePlanId("pro"), "pro");
  assert.equal(normalizePlanId("max"), "max");
  assert.equal(normalizePlanId("free"), "free");
  assert.equal(normalizePlanId("unknown_plan"), "free");
  assert.equal(normalizePlanId(null), "free");
});

test("paddle sandbox e2e: transaction checkout creation contract", async () => {
  let capturedUrl = "";
  let capturedBody = "";
  let capturedAuth = "";

  const mockFetch = async (url: string, opts: { method: string; body: string; headers: Record<string, string> }) => {
    capturedUrl = url;
    capturedBody = opts.body;
    capturedAuth = opts.headers.Authorization;

    return new Response(
      JSON.stringify({
        data: {
          id: "txn_01sandbox_transaction_123",
          checkout_url: "https://sandbox-checkout.paddle.com/checkout/tx_12345",
          status: "ready",
        },
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  };

  const mockEnv = {
    PADDLE_API_KEY: "pdl_sbox_key_999",
    PADDLE_WEBHOOK_SECRET_KEY: "pdl_ntf_secret_888",
    PADDLE_PRO_PRICE_ID: "pri_sbox_pro_price_777",
    PADDLE_ENVIRONMENT: "sandbox",
  } as unknown as NodeJS.ProcessEnv;

  const result = await createPaddleCheckoutTransaction({
    ownerUserId: "user-abc-123",
    userEmail: "test-founder@example.com",
    planId: "pro",
    returnUrl: "http://localhost:3000/pursuits",
    env: mockEnv,
    fetchImpl: mockFetch as unknown as typeof fetch,
  });

  assert.equal(capturedUrl, "https://sandbox-api.paddle.com/transactions");
  assert.equal(capturedAuth, "Bearer pdl_sbox_key_999");
  assert.equal(result.transactionId, "txn_01sandbox_transaction_123");
  assert.equal(result.checkoutUrl, "https://sandbox-checkout.paddle.com/checkout/tx_12345");

  const parsedBody = JSON.parse(capturedBody) as {
    items: Array<{ price_id: string; quantity: number }>;
    custom_data: { owner_user_id: string; plan_id: string };
  };
  assert.equal(parsedBody.items[0].price_id, "pri_sbox_pro_price_777");
  assert.equal(parsedBody.items[0].quantity, 1);
  assert.equal(parsedBody.custom_data.owner_user_id, "user-abc-123");
  assert.equal(parsedBody.custom_data.plan_id, "pro");
});
