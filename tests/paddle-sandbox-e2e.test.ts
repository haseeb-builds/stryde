import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import {
  verifyPaddleWebhookSignature,
  normalizePaddleBillingEvent,
  normalizePaddleSubscriptionEvent,
  createPaddleCheckoutTransaction,
  resolvePaddleWebhookSecret,
  resolvePaddlePricePlanMap,
  getPaddleConfig,
  isPaddleConfigured,
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

  // 5. Alternate h= signature format is also accepted
  const hSig = `ts=${nowSec};h=${crypto.createHmac("sha256", secret).update(`${nowSec}:${body}`).digest("hex")}`;
  assert.equal(verifyPaddleWebhookSignature(body, hSig, secret), true);
});

test("paddle sandbox e2e: canonical configuration resolver and aliases", () => {
  // Test webhook secret aliases
  assert.equal(resolvePaddleWebhookSecret({ PADDLE_WEBHOOK_SECRET_KEY: "secret_a" }), "secret_a");
  assert.equal(resolvePaddleWebhookSecret({ PADDLE_WEBHOOK_SECRET: "secret_b" }), "secret_b");
  assert.equal(
    resolvePaddleWebhookSecret({ PADDLE_WEBHOOK_SECRET_KEY: "secret_a", PADDLE_WEBHOOK_SECRET: "secret_b" }),
    "secret_a"
  );
  assert.equal(resolvePaddleWebhookSecret({}), "");

  // Test price plan map aliases
  const planMap = resolvePaddlePricePlanMap({
    PADDLE_PRO_PRICE_ID: "pri_pro_1",
    PADDLE_PRICE_ID_PRO: "pri_pro_2",
    PADDLE_PRICE_ID: "pri_pro_3",
    PADDLE_MAX_PRICE_ID: "pri_max_1",
    PADDLE_PRICE_ID_MAX: "pri_max_2",
  });
  assert.equal(planMap["pri_pro_1"], "pro");
  assert.equal(planMap["pri_pro_2"], "pro");
  assert.equal(planMap["pri_pro_3"], "pro");
  assert.equal(planMap["pri_max_1"], "max");
  assert.equal(planMap["pri_max_2"], "max");

  // Test isPaddleConfigured & getPaddleConfig
  const validEnv = {
    PADDLE_API_KEY: "pdl_api_123",
    PADDLE_WEBHOOK_SECRET_KEY: "secret_123",
    PADDLE_PRO_PRICE_ID: "pri_pro_123",
    PADDLE_ENVIRONMENT: "sandbox",
  };
  assert.equal(isPaddleConfigured(validEnv), true);
  const cfg = getPaddleConfig(validEnv);
  assert.equal(cfg.apiKey, "pdl_api_123");
  assert.equal(cfg.webhookSecret, "secret_123");
  assert.equal(cfg.priceIdPro, "pri_pro_123");
  assert.equal(cfg.environment, "sandbox");
  assert.equal(cfg.baseUrl, "https://sandbox-api.paddle.com");
  assert.equal(cfg.pricePlanMap["pri_pro_123"], "pro");

  // Test missing env fails closed
  assert.equal(isPaddleConfigured({}), false);
  assert.throws(() => getPaddleConfig({}), /Paddle billing is not fully configured/);
});

test("paddle sandbox e2e: hardened fail-closed entitlement normalization", () => {
  const priceMap = {
    pri_pro_plan: "pro" as const,
    pri_max_plan: "max" as const,
  };

  // 1. KNOWN PRO PRICE -> PRO
  const proEvent = normalizePaddleBillingEvent(
    {
      event_id: "evt_1",
      event_type: "subscription.created",
      occurred_at: "2026-10-24T00:00:00Z",
      data: {
        id: "sub_1",
        customer_id: "ctm_1",
        status: "active",
        items: [{ price: { id: "pri_pro_plan" } }],
        custom_data: { user_id: "user-123" },
      },
    },
    priceMap
  );
  assert.ok(proEvent);
  assert.equal(proEvent!.planId, "pro");
  assert.equal(proEvent!.status, "ACTIVE");
  assert.equal(proEvent!.quarantined, false);

  // 2. KNOWN MAX PRICE -> MAX
  const maxEvent = normalizePaddleBillingEvent(
    {
      event_id: "evt_2",
      event_type: "subscription.created",
      occurred_at: "2026-10-24T00:00:00Z",
      data: {
        id: "sub_2",
        customer_id: "ctm_2",
        status: "active",
        items: [{ price: { id: "pri_max_plan" } }],
        custom_data: { user_id: "user-456" },
      },
    },
    priceMap
  );
  assert.ok(maxEvent);
  assert.equal(maxEvent!.planId, "max");
  assert.equal(maxEvent!.status, "ACTIVE");

  // 3. UNKNOWN PRICE MAPPING -> MUST QUARANTINE TO FREE / UNKNOWN (NEVER DEFAULT TO PRO!)
  const unknownPriceEvent = normalizePaddleBillingEvent(
    {
      event_id: "evt_3",
      event_type: "subscription.created",
      occurred_at: "2026-10-24T00:00:00Z",
      data: {
        id: "sub_3",
        customer_id: "ctm_3",
        status: "active",
        items: [{ price: { id: "pri_unknown_rogue_price" } }],
        custom_data: { user_id: "user-789" },
      },
    },
    priceMap
  );
  assert.ok(unknownPriceEvent);
  assert.equal(unknownPriceEvent!.planId, "free", "Unknown price MUST fail closed to free!");
  assert.equal(unknownPriceEvent!.status, "UNKNOWN", "Unknown price MUST map status to UNKNOWN!");
  assert.equal(unknownPriceEvent!.quarantined, true, "Unknown price MUST be quarantined!");

  // 4. CANCELLATION -> STATUS IS CANCELLED
  const canceled = normalizePaddleBillingEvent(
    {
      event_id: "evt_4",
      event_type: "subscription.canceled",
      occurred_at: "2026-10-24T00:00:00Z",
      data: {
        id: "sub_1",
        customer_id: "ctm_1",
        status: "canceled",
        items: [{ price: { id: "pri_pro_plan" } }],
        custom_data: { user_id: "user-123" },
      },
    },
    priceMap
  );
  assert.ok(canceled);
  assert.equal(canceled!.status, "CANCELLED");

  // 5. TRANSACTION.COMPLETED FOR SUBSCRIPTION -> CONFIRMS ACTIVE
  const txnCompleted = normalizePaddleBillingEvent(
    {
      event_id: "evt_5",
      event_type: "transaction.completed",
      occurred_at: "2026-10-24T00:00:00Z",
      data: {
        id: "txn_999",
        subscription_id: "sub_1",
        customer_id: "ctm_1",
        status: "completed",
        items: [{ price: { id: "pri_pro_plan" } }],
        custom_data: { user_id: "user-123" },
      },
    },
    priceMap
  );
  assert.ok(txnCompleted);
  assert.equal(txnCompleted!.providerSubscriptionRef, "sub_1");
  assert.equal(txnCompleted!.status, "ACTIVE");
  assert.equal(txnCompleted!.planId, "pro");

  // Backward compatibility alias check
  const legacyCall = normalizePaddleSubscriptionEvent({
    event_id: "evt_legacy",
    event_type: "subscription.updated",
    occurred_at: "2026-10-24T00:00:00Z",
    data: {
      id: "sub_leg",
      customer_id: "ctm_leg",
      status: "active",
      items: [{ price: { id: "pri_pro_plan" } }],
      custom_data: { user_id: "user-leg" },
    },
  }, priceMap);
  assert.ok(legacyCall);
  assert.equal(legacyCall!.planId, "pro");
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
