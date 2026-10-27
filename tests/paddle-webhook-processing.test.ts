import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  processPaddleWebhookRequest,
  type WebhookDbClient,
} from "../lib/paddle-webhook.ts";

function signPayload(body: string, secret: string, ts: number): string {
  const payload = `${ts}:${body}`;
  const h1 = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `ts=${ts};h1=${h1}`;
}

const TEST_SECRET = "pndto_test_webhook_secret_12345";
const VALID_USER_ID = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";
const PRO_PRICE_ID = "pri_test_pro_123";

const TEST_ENV = {
  PADDLE_WEBHOOK_SECRET_KEY: TEST_SECRET,
  PADDLE_PRICE_ID_PRO: PRO_PRICE_ID,
} as unknown as NodeJS.ProcessEnv;

test("Paddle webhook: rejects missing or invalid signature header", async () => {
  const reqNoSig = new Request("https://example.com/api/v1/billing/webhook", {
    method: "POST",
    body: JSON.stringify({ event_id: "evt_1" }),
  });

  const res1 = await processPaddleWebhookRequest(reqNoSig, { env: TEST_ENV });
  assert.equal(res1.status, 400);
  const data1 = await res1.json();
  assert.equal(data1.error, "Missing Paddle-Signature header");

  const reqBadSig = new Request("https://example.com/api/v1/billing/webhook", {
    method: "POST",
    headers: { "paddle-signature": "invalid-signature-format" },
    body: JSON.stringify({ event_id: "evt_1" }),
  });

  const res2 = await processPaddleWebhookRequest(reqBadSig, { env: TEST_ENV });
  assert.equal(res2.status, 401);
});

test("Paddle webhook: rejects expired timestamp (replay protection)", async () => {
  const rawBody = JSON.stringify({ event_id: "evt_1" });
  const expiredTs = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
  const sig = signPayload(rawBody, TEST_SECRET, expiredTs);

  const req = new Request("https://example.com/api/v1/billing/webhook", {
    method: "POST",
    headers: { "paddle-signature": sig },
    body: rawBody,
  });

  const res = await processPaddleWebhookRequest(req, { env: TEST_ENV });
  assert.equal(res.status, 401);
});

test("Paddle webhook: rejects malformed JSON body or invalid user UUID", async () => {
  const ts = Math.floor(Date.now() / 1000);
  const malformedBody = "{ invalid_json: ";
  const sig1 = signPayload(malformedBody, TEST_SECRET, ts);

  const req1 = new Request("https://example.com/api/v1/billing/webhook", {
    method: "POST",
    headers: { "paddle-signature": sig1 },
    body: malformedBody,
  });

  const res1 = await processPaddleWebhookRequest(req1, { env: TEST_ENV });
  assert.equal(res1.status, 400);

  // Invalid user UUID
  const invalidUserBody = JSON.stringify({
    event_id: "evt_invalid_user",
    event_type: "subscription.created",
    occurred_at: new Date().toISOString(),
    data: {
      id: "sub_123",
      customer_id: "ctm_123",
      status: "active",
      items: [{ price: { id: PRO_PRICE_ID } }],
      custom_data: { owner_user_id: "not-a-uuid" },
    },
  });
  const sig2 = signPayload(invalidUserBody, TEST_SECRET, ts);

  const req2 = new Request("https://example.com/api/v1/billing/webhook", {
    method: "POST",
    headers: { "paddle-signature": sig2 },
    body: invalidUserBody,
  });

  const res2 = await processPaddleWebhookRequest(req2, { env: TEST_ENV });
  assert.equal(res2.status, 400);
  const data2 = await res2.json();
  assert.match(data2.error, /invalid owner_user_id format/i);
});

test("Paddle webhook: atomic duplicate event deduplication (sequential)", async () => {
  const ledger = new Map<string, { status: string; occurred_at: string }>();
  const subscriptions = new Map<string, { plan_id: string; status: string; last_event_at: string }>();

  const mockDb: WebhookDbClient = {
    async processPaddleEventRpc(params) {
      if (ledger.has(params.p_event_id)) {
        const existing = ledger.get(params.p_event_id);
        if (existing?.status === "COMPLETED") {
          return { success: true, duplicate: true, event_id: params.p_event_id };
        }
      }

      ledger.set(params.p_event_id, {
        status: "COMPLETED",
        occurred_at: params.p_occurred_at,
      });

      subscriptions.set(params.p_owner_user_id, {
        plan_id: params.p_plan_id,
        status: params.p_status,
        last_event_at: params.p_occurred_at,
      });

      return {
        success: true,
        updated: true,
        event_id: params.p_event_id,
        plan_id: params.p_plan_id,
        status: params.p_status,
        quarantined: params.p_quarantined,
      };
    },
  };

  const body = JSON.stringify({
    event_id: "evt_seq_dup_001",
    event_type: "subscription.created",
    occurred_at: "2026-10-27T10:00:00Z",
    data: {
      id: "sub_001",
      customer_id: "ctm_001",
      status: "active",
      items: [{ price: { id: PRO_PRICE_ID } }],
      custom_data: { owner_user_id: VALID_USER_ID },
    },
  });

  const ts = Math.floor(Date.now() / 1000);
  const sig = signPayload(body, TEST_SECRET, ts);

  const makeReq = () =>
    new Request("https://example.com/api/v1/billing/webhook", {
      method: "POST",
      headers: { "paddle-signature": sig },
      body,
    });

  // First delivery: updated = true
  const res1 = await processPaddleWebhookRequest(makeReq(), { env: TEST_ENV, dbClient: mockDb });
  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.equal(data1.updated, true);
  assert.equal(data1.plan_id, "pro");

  // Second delivery (duplicate): duplicate = true
  const res2 = await processPaddleWebhookRequest(makeReq(), { env: TEST_ENV, dbClient: mockDb });
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.duplicate, true);
});

test("Paddle webhook: concurrent delivery returns 409 Conflict with Retry-After", async () => {
  const mockDb: WebhookDbClient = {
    async processPaddleEventRpc(params) {
      return {
        success: false,
        concurrent_processing: true,
        event_id: params.p_event_id,
      };
    },
  };

  const body = JSON.stringify({
    event_id: "evt_concurrent_001",
    event_type: "subscription.updated",
    occurred_at: "2026-10-27T11:00:00Z",
    data: {
      id: "sub_001",
      customer_id: "ctm_001",
      status: "active",
      items: [{ price: { id: PRO_PRICE_ID } }],
      custom_data: { owner_user_id: VALID_USER_ID },
    },
  });

  const ts = Math.floor(Date.now() / 1000);
  const sig = signPayload(body, TEST_SECRET, ts);

  const req = new Request("https://example.com/api/v1/billing/webhook", {
    method: "POST",
    headers: { "paddle-signature": sig },
    body,
  });

  const res = await processPaddleWebhookRequest(req, { env: TEST_ENV, dbClient: mockDb });
  assert.equal(res.status, 409);
  assert.equal(res.headers.get("Retry-After"), "5");
});

test("Paddle webhook: out-of-order event protection (older event ignored)", async () => {
  const subscriptions = new Map<string, { plan_id: string; status: string; last_event_at: string }>();
  subscriptions.set(VALID_USER_ID, {
    plan_id: "pro",
    status: "ACTIVE",
    last_event_at: "2026-10-27T12:00:00Z", // newer event timestamp
  });

  const mockDb: WebhookDbClient = {
    async processPaddleEventRpc(params) {
      const existing = subscriptions.get(params.p_owner_user_id);
      if (existing && new Date(params.p_occurred_at) < new Date(existing.last_event_at)) {
        return {
          success: true,
          ignored: true,
          reason: "stale_event",
          occurred_at: params.p_occurred_at,
          current_last_event_at: existing.last_event_at,
        };
      }
      return { success: true, updated: true };
    },
  };

  // Event with older timestamp (11:00:00Z < 12:00:00Z)
  const body = JSON.stringify({
    event_id: "evt_stale_001",
    event_type: "subscription.past_due",
    occurred_at: "2026-10-27T11:00:00Z",
    data: {
      id: "sub_001",
      customer_id: "ctm_001",
      status: "past_due",
      items: [{ price: { id: PRO_PRICE_ID } }],
      custom_data: { owner_user_id: VALID_USER_ID },
    },
  });

  const ts = Math.floor(Date.now() / 1000);
  const sig = signPayload(body, TEST_SECRET, ts);

  const req = new Request("https://example.com/api/v1/billing/webhook", {
    method: "POST",
    headers: { "paddle-signature": sig },
    body,
  });

  const res = await processPaddleWebhookRequest(req, { env: TEST_ENV, dbClient: mockDb });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ignored, true);
  assert.equal(data.reason, "stale_event");
});

test("Paddle webhook: unknown price mapping fails closed and is quarantined", async () => {
  let capturedQuarantine: boolean | undefined;
  let capturedPlanId: string | undefined;

  const mockDb: WebhookDbClient = {
    async processPaddleEventRpc(params) {
      capturedQuarantine = params.p_quarantined;
      capturedPlanId = params.p_plan_id;
      return {
        success: true,
        updated: true,
        plan_id: params.p_plan_id,
        status: params.p_status,
        quarantined: params.p_quarantined,
      };
    },
  };

  const body = JSON.stringify({
    event_id: "evt_unknown_price_001",
    event_type: "subscription.created",
    occurred_at: "2026-10-27T12:00:00Z",
    data: {
      id: "sub_001",
      customer_id: "ctm_001",
      status: "active",
      items: [{ price: { id: "pri_unknown_malicious_price" } }],
      custom_data: { owner_user_id: VALID_USER_ID },
    },
  });

  const ts = Math.floor(Date.now() / 1000);
  const sig = signPayload(body, TEST_SECRET, ts);

  const req = new Request("https://example.com/api/v1/billing/webhook", {
    method: "POST",
    headers: { "paddle-signature": sig },
    body,
  });

  const res = await processPaddleWebhookRequest(req, { env: TEST_ENV, dbClient: mockDb });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.quarantined, true);
  assert.equal(data.plan_id, "free");
  assert.equal(capturedQuarantine, true);
  assert.equal(capturedPlanId, "free");
});

test("Paddle webhook: retry after failure succeeds", async () => {
  let attempts = 0;
  const mockDb: WebhookDbClient = {
    async processPaddleEventRpc(params) {
      attempts++;
      if (attempts === 1) {
        throw new Error("Temporary DB connection timeout");
      }
      return {
        success: true,
        updated: true,
        event_id: params.p_event_id,
        plan_id: params.p_plan_id,
        status: params.p_status,
      };
    },
  };

  const body = JSON.stringify({
    event_id: "evt_retry_001",
    event_type: "subscription.created",
    occurred_at: "2026-10-27T12:00:00Z",
    data: {
      id: "sub_001",
      customer_id: "ctm_001",
      status: "active",
      items: [{ price: { id: PRO_PRICE_ID } }],
      custom_data: { owner_user_id: VALID_USER_ID },
    },
  });

  const ts = Math.floor(Date.now() / 1000);
  const sig = signPayload(body, TEST_SECRET, ts);

  const makeReq = () =>
    new Request("https://example.com/api/v1/billing/webhook", {
      method: "POST",
      headers: { "paddle-signature": sig },
      body,
    });

  // First attempt fails -> 500
  const res1 = await processPaddleWebhookRequest(makeReq(), { env: TEST_ENV, dbClient: mockDb });
  assert.equal(res1.status, 500);

  // Second attempt succeeds -> 200
  const res2 = await processPaddleWebhookRequest(makeReq(), { env: TEST_ENV, dbClient: mockDb });
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.updated, true);
});
