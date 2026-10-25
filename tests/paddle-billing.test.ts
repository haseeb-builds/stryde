import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  isPaddleConfigured,
  getPaddleConfig,
  verifyPaddleWebhookSignature,
  createPaddleCheckoutTransaction,
  normalizePaddleSubscriptionEvent,
  type PaddleWebhookEvent,
} from "../lib/paddle.ts";

test("Paddle config: detects missing vs complete configuration", () => {
  assert.equal(isPaddleConfigured({} as unknown as NodeJS.ProcessEnv), false);

  const partialEnv = {
    PADDLE_API_KEY: "pdl_live_123",
  } as unknown as NodeJS.ProcessEnv;
  assert.equal(isPaddleConfigured(partialEnv), false);

  const fullEnv = {
    PADDLE_API_KEY: "pdl_live_123",
    PADDLE_WEBHOOK_SECRET: "pndto_secret_456",
    PADDLE_PRICE_ID_PRO: "pri_pro_789",
  } as unknown as NodeJS.ProcessEnv;
  assert.equal(isPaddleConfigured(fullEnv), true);

  const config = getPaddleConfig(fullEnv);
  assert.equal(config.baseUrl, "https://api.paddle.com");
  assert.equal(config.environment, "production");
  assert.equal(config.priceIdPro, "pri_pro_789");

  const sandboxEnv = {
    ...fullEnv,
    PADDLE_ENVIRONMENT: "sandbox",
  } as unknown as NodeJS.ProcessEnv;
  const sandboxConfig = getPaddleConfig(sandboxEnv);
  assert.equal(sandboxConfig.baseUrl, "https://sandbox-api.paddle.com");
  assert.equal(sandboxConfig.environment, "sandbox");
});

test("Paddle webhook signature verification: passes for valid HMAC-SHA256 signature", () => {
  const secret = "pndto_test_secret_key_12345";
  const rawBody = JSON.stringify({ event_id: "evt_123", event_type: "subscription.created" });
  const ts = Math.floor(Date.now() / 1000);

  const payload = `${ts}:${rawBody}`;
  const h1 = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const signatureHeader = `ts=${ts};h1=${h1}`;

  const valid = verifyPaddleWebhookSignature(rawBody, signatureHeader, secret);
  assert.equal(valid, true);
});

test("Paddle webhook signature verification: rejects tampered body or wrong secret", () => {
  const secret = "pndto_test_secret_key_12345";
  const rawBody = JSON.stringify({ event_id: "evt_123", event_type: "subscription.created" });
  const ts = Math.floor(Date.now() / 1000);

  const payload = `${ts}:${rawBody}`;
  const h1 = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const signatureHeader = `ts=${ts};h1=${h1}`;

  // 1. Wrong secret
  assert.equal(verifyPaddleWebhookSignature(rawBody, signatureHeader, "wrong_secret"), false);

  // 2. Tampered body
  const tamperedBody = JSON.stringify({ event_id: "evt_123", event_type: "subscription.created", hack: true });
  assert.equal(verifyPaddleWebhookSignature(tamperedBody, signatureHeader, secret), false);

  // 3. Malformed header
  assert.equal(verifyPaddleWebhookSignature(rawBody, "invalid-header", secret), false);
  assert.equal(verifyPaddleWebhookSignature(rawBody, null, secret), false);
});

test("Paddle webhook signature verification: rejects expired timestamp (replay protection)", () => {
  const secret = "pndto_test_secret_key_12345";
  const rawBody = JSON.stringify({ event_id: "evt_123" });
  // 10 minutes in the past
  const expiredTs = Math.floor(Date.now() / 1000) - 600;

  const payload = `${expiredTs}:${rawBody}`;
  const h1 = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const signatureHeader = `ts=${expiredTs};h1=${h1}`;

  // Default tolerance is 300s (5 minutes)
  const valid = verifyPaddleWebhookSignature(rawBody, signatureHeader, secret, 300);
  assert.equal(valid, false);
});

test("Paddle checkout transaction: formats payload and returns checkout_url", async () => {
  let capturedUrl = "";
  let capturedHeaders: HeadersInit | undefined;
  let capturedBody: Record<string, unknown> | undefined;

  const mockFetch: typeof fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedHeaders = init?.headers;
    capturedBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        data: {
          id: "txn_01h8test123",
          checkout_url: "https://checkout.paddle.com/checkout?_ptxn=txn_01h8test123",
          status: "ready",
        },
      }),
      { status: 201 }
    );
  };

  const env = {
    PADDLE_API_KEY: "pdl_test_key",
    PADDLE_WEBHOOK_SECRET: "pndto_secret",
    PADDLE_PRICE_ID_PRO: "pri_pro_plan",
    PADDLE_ENVIRONMENT: "sandbox",
  } as unknown as NodeJS.ProcessEnv;

  const result = await createPaddleCheckoutTransaction({
    ownerUserId: "usr_uuid_123",
    userEmail: "founder@example.com",
    planId: "pro",
    returnUrl: "https://example.com/return",
    env,
    fetchImpl: mockFetch,
  });

  assert.equal(capturedUrl, "https://sandbox-api.paddle.com/transactions");
  assert.equal((capturedHeaders as Record<string, string>)?.Authorization, "Bearer pdl_test_key");
  assert.deepEqual(capturedBody?.items, [{ price_id: "pri_pro_plan", quantity: 1 }]);
  assert.deepEqual(capturedBody?.custom_data, { owner_user_id: "usr_uuid_123", plan_id: "pro" });
  assert.equal(capturedBody?.customer_email, "founder@example.com");
  assert.equal(result.checkoutUrl, "https://checkout.paddle.com/checkout?_ptxn=txn_01h8test123");
  assert.equal(result.transactionId, "txn_01h8test123");
});

test("Paddle subscription normalization: maps lifecycle statuses accurately", () => {
  const baseEvent: PaddleWebhookEvent = {
    event_id: "evt_sub_created",
    event_type: "subscription.created",
    occurred_at: "2026-10-24T18:00:00Z",
    data: {
      id: "sub_01h8testsub",
      status: "active",
      customer_id: "ctm_01h8testcustomer",
      started_at: "2026-10-24T18:00:00Z",
      next_billed_at: "2026-11-24T18:00:00Z",
      custom_data: {
        owner_user_id: "user-1234-5678",
        plan_id: "pro",
      },
      items: [{ price_id: "pri_pro_001" }],
      management_urls: {
        update_payment_method: "https://buy.paddle.com/manage/update",
        cancel: "https://buy.paddle.com/manage/cancel",
      },
    },
  };

  // 1. Created active subscription
  const update1 = normalizePaddleSubscriptionEvent(baseEvent);
  assert.ok(update1);
  assert.equal(update1.ownerUserId, "user-1234-5678");
  assert.equal(update1.planId, "pro");
  assert.equal(update1.provider, "paddle");
  assert.equal(update1.status, "ACTIVE");
  assert.equal(update1.providerSubscriptionRef, "sub_01h8testsub");
  assert.equal(update1.managementUrls?.cancel, "https://buy.paddle.com/manage/cancel");

  // 2. Canceled subscription
  const canceledEvent: PaddleWebhookEvent = {
    ...baseEvent,
    event_type: "subscription.canceled",
    data: {
      ...baseEvent.data,
      status: "canceled",
      canceled_at: "2026-10-25T12:00:00Z",
    },
  };
  const update2 = normalizePaddleSubscriptionEvent(canceledEvent);
  assert.ok(update2);
  assert.equal(update2.status, "CANCELLED");

  // 3. Past due subscription
  const pastDueEvent: PaddleWebhookEvent = {
    ...baseEvent,
    event_type: "subscription.past_due",
    data: {
      ...baseEvent.data,
      status: "past_due",
    },
  };
  const update3 = normalizePaddleSubscriptionEvent(pastDueEvent);
  assert.ok(update3);
  assert.equal(update3.status, "PAST_DUE");

  // 4. Non-subscription event is ignored
  const transactionEvent = {
    ...baseEvent,
    event_type: "transaction.completed",
  };
  assert.equal(normalizePaddleSubscriptionEvent(transactionEvent), null);
});
