import crypto from "node:crypto";

export type PaddleEnvironment = "sandbox" | "production";

export type PaddleConfig = {
  apiKey: string;
  webhookSecret: string;
  priceIdPro: string;
  priceIdMax: string;
  environment: PaddleEnvironment;
  baseUrl: string;
};

export type NormalizedSubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "PAUSED"
  | "CANCELLED"
  | "EXPIRED"
  | "INCOMPLETE"
  | "UNKNOWN";

export type NormalizedSubscriptionUpdate = {
  ownerUserId: string;
  planId: "free" | "pro" | "max";
  provider: "paddle";
  providerCustomerRef: string;
  providerSubscriptionRef: string;
  providerStatus: string;
  status: NormalizedSubscriptionStatus;
  effectiveAt: string;
  expiresAt: string | null;
  lastEventAt: string;
  managementUrls?: {
    updatePaymentMethod?: string | null;
    cancel?: string | null;
  } | null;
};

export type PaddleWebhookEvent = {
  event_id: string;
  event_type: string;
  occurred_at: string;
  data: {
    id: string;
    status: string;
    customer_id: string;
    started_at?: string | null;
    created_at?: string | null;
    next_billed_at?: string | null;
    canceled_at?: string | null;
    paused_at?: string | null;
    custom_data?: Record<string, unknown> | null;
    items?: Array<{
      price_id?: string;
      price?: { id?: string; product_id?: string };
    }>;
    management_urls?: {
      update_payment_method?: string | null;
      cancel?: string | null;
    } | null;
  };
};

export function isPaddleConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const apiKey = env.PADDLE_API_KEY?.trim();
  const webhookSecret = env.PADDLE_WEBHOOK_SECRET_KEY?.trim() || env.PADDLE_WEBHOOK_SECRET?.trim();
  const priceId = env.PADDLE_PRO_PRICE_ID?.trim() || env.PADDLE_PRICE_ID_PRO?.trim() || env.PADDLE_PRICE_ID?.trim();
  return Boolean(apiKey && webhookSecret && priceId);
}

export function getPaddleConfig(env: NodeJS.ProcessEnv = process.env): PaddleConfig {
  const apiKey = env.PADDLE_API_KEY?.trim();
  const webhookSecret = env.PADDLE_WEBHOOK_SECRET_KEY?.trim() || env.PADDLE_WEBHOOK_SECRET?.trim();
  const priceIdPro =
    env.PADDLE_PRO_PRICE_ID?.trim() ||
    env.PADDLE_PRICE_ID_PRO?.trim() ||
    env.PADDLE_PRICE_ID?.trim() ||
    "";
  const priceIdMax = env.PADDLE_PRICE_ID_MAX?.trim() || "";
  const environment: PaddleEnvironment =
    env.PADDLE_ENVIRONMENT?.trim().toLowerCase() === "sandbox" ? "sandbox" : "production";

  if (!apiKey || !webhookSecret || !priceIdPro) {
    throw new Error(
      "Paddle billing is not fully configured. Required environment variables: PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET (or PADDLE_WEBHOOK_SECRET_KEY), and PADDLE_PRO_PRICE_ID (or PADDLE_PRICE_ID_PRO)."
    );
  }

  const baseUrl =
    environment === "sandbox"
      ? "https://sandbox-api.paddle.com"
      : "https://api.paddle.com";

  return {
    apiKey,
    webhookSecret,
    priceIdPro,
    priceIdMax,
    environment,
    baseUrl,
  };
}

/**
 * Verifies Paddle Billing v2 webhook signatures (HMAC-SHA256).
 *
 * Header format: ts=1729800000;h1=a9c8f...
 * Signature payload: ${ts}:${rawBody}
 *
 * @param rawBody - The unparsed raw request body string
 * @param signatureHeader - The value of the 'Paddle-Signature' header
 * @param secret - The notification destination secret key
 * @param toleranceSeconds - Maximum allowed drift in seconds (default: 300 / 5 minutes)
 */
export function verifyPaddleWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  toleranceSeconds = 300
): boolean {
  if (!signatureHeader || !rawBody || !secret) {
    return false;
  }

  const parts = signatureHeader.split(";").map((p) => p.trim());
  let timestampStr: string | undefined;
  let signatureHex: string | undefined;

  for (const part of parts) {
    if (part.startsWith("ts=")) {
      timestampStr = part.slice(3);
    } else if (part.startsWith("h1=")) {
      signatureHex = part.slice(3);
    } else if (part.startsWith("h=")) {
      signatureHex = part.slice(2);
    }
  }

  if (!timestampStr || !signatureHex) {
    return false;
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return false;
  }

  // Prevent replay attacks: timestamp must be within tolerance window
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }

  // Compute expected HMAC-SHA256
  const payloadToSign = `${timestampStr}:${rawBody}`;
  const computedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadToSign)
    .digest("hex");

  if (computedSignature.length !== signatureHex.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedSignature, "hex"),
      Buffer.from(signatureHex, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Creates a Paddle Billing v2 transaction for user checkout.
 */
export async function createPaddleCheckoutTransaction(
  input: {
    ownerUserId: string;
    userEmail?: string;
    planId: "pro" | "max";
    returnUrl?: string;
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
  }
): Promise<{ checkoutUrl: string; transactionId: string }> {
  const config = getPaddleConfig(input.env ?? process.env);
  const priceId = input.planId === "max" && config.priceIdMax ? config.priceIdMax : config.priceIdPro;

  if (!priceId) {
    throw new Error(`No Paddle price configured for plan: ${input.planId}`);
  }

  const payload: Record<string, unknown> = {
    items: [{ price_id: priceId, quantity: 1 }],
    custom_data: {
      owner_user_id: input.ownerUserId,
      plan_id: input.planId,
    },
  };

  if (input.userEmail) {
    payload.customer_email = input.userEmail;
  }

  if (input.returnUrl) {
    payload.checkout = {
      url: input.returnUrl,
    };
  }

  const fetchFn = input.fetchImpl ?? fetch;
  const response = await fetchFn(`${config.baseUrl}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const body = (await response.json()) as {
    data?: { id?: string; checkout_url?: string };
    error?: { message?: string; detail?: string };
  };

  if (!response.ok || !body.data?.checkout_url || !body.data?.id) {
    const errorMsg =
      body.error?.detail || body.error?.message || `Paddle API returned status ${response.status}`;
    throw new Error(`Paddle transaction creation failed: ${errorMsg}`);
  }

  return {
    checkoutUrl: body.data.checkout_url,
    transactionId: body.data.id,
  };
}

/**
 * Normalizes Paddle subscription webhook events into Stryde's subscription_state structure.
 */
export function normalizePaddleSubscriptionEvent(
  event: PaddleWebhookEvent,
  pricePlanMap?: Record<string, "pro" | "max">
): NormalizedSubscriptionUpdate | null {
  const eventType = event.event_type;
  if (!eventType || !eventType.startsWith("subscription.")) {
    return null;
  }

  const data = event.data;
  if (!data || !data.id) {
    return null;
  }

  const ownerUserId =
    (data.custom_data?.owner_user_id as string) ||
    (data.custom_data?.user_id as string) ||
    (data.custom_data?.userId as string) ||
    "";
  if (!ownerUserId) {
    return null;
  }

  // Resolve plan
  let planId: "free" | "pro" | "max" = "pro";
  const customPlan = data.custom_data?.plan_id as string | undefined;
  if (customPlan === "max" || customPlan === "pro" || customPlan === "free") {
    planId = customPlan;
  } else if (data.items?.[0]?.price_id && pricePlanMap) {
    const mapped = pricePlanMap[data.items[0].price_id];
    if (mapped) planId = mapped;
  }

  // Normalize status
  const rawStatus = (data.status || "").toLowerCase();
  let status: NormalizedSubscriptionStatus = "UNKNOWN";

  if (rawStatus === "active") {
    status = "ACTIVE";
  } else if (rawStatus === "trialing") {
    status = "TRIALING";
  } else if (rawStatus === "past_due") {
    status = "PAST_DUE";
  } else if (rawStatus === "paused") {
    status = "PAUSED";
  } else if (rawStatus === "canceled" || rawStatus === "cancelled") {
    status = "CANCELLED";
  } else if (rawStatus === "inactive") {
    status = "EXPIRED";
  }

  const effectiveAt = data.started_at || data.created_at || event.occurred_at || new Date().toISOString();
  const expiresAt = data.canceled_at || data.next_billed_at || null;

  return {
    ownerUserId,
    planId,
    provider: "paddle",
    providerCustomerRef: data.customer_id || "",
    providerSubscriptionRef: data.id,
    providerStatus: data.status || "unknown",
    status,
    effectiveAt,
    expiresAt,
    lastEventAt: event.occurred_at || new Date().toISOString(),
    managementUrls: data.management_urls
      ? {
          updatePaymentMethod: data.management_urls.update_payment_method ?? null,
          cancel: data.management_urls.cancel ?? null,
        }
      : null,
  };
}
