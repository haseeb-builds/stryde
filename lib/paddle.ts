import crypto from "node:crypto";

export type PaddleEnvironment = "sandbox" | "production";

export type PaddleConfig = {
  apiKey: string;
  webhookSecret: string;
  priceIdPro: string;
  priceIdMax: string;
  environment: PaddleEnvironment;
  baseUrl: string;
  pricePlanMap: Record<string, "pro" | "max">;
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
  quarantined?: boolean;
  quarantineReason?: string;
};

export type PaddleWebhookEvent = {
  event_id: string;
  event_type: string;
  occurred_at: string;
  data: {
    id: string;
    status: string;
    customer_id: string;
    subscription_id?: string | null;
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

export type PaddleEnvSource = NodeJS.ProcessEnv | Record<string, string | undefined>;

function stripQuotes(val?: string): string {
  if (!val) return "";
  let trimmed = val.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Resolves the webhook secret from standard and legacy environment variable aliases.
 */
export function resolvePaddleWebhookSecret(env: PaddleEnvSource = process.env): string {
  return stripQuotes(env.PADDLE_WEBHOOK_SECRET_KEY) || stripQuotes(env.PADDLE_WEBHOOK_SECRET);
}

/**
 * Resolves price-to-plan mappings from standard and legacy environment variable aliases.
 */
export function resolvePaddlePricePlanMap(env: PaddleEnvSource = process.env): Record<string, "pro" | "max"> {
  const map: Record<string, "pro" | "max"> = {};

  const proAliases = [
    env.PADDLE_PRO_PRICE_ID,
    env.PADDLE_PRICE_ID_PRO,
    env.PADDLE_PRICE_ID,
  ];
  for (const alias of proAliases) {
    const cleaned = stripQuotes(alias);
    if (cleaned) {
      map[cleaned] = "pro";
    }
  }

  const maxAliases = [
    env.PADDLE_MAX_PRICE_ID,
    env.PADDLE_PRICE_ID_MAX,
  ];
  for (const alias of maxAliases) {
    const cleaned = stripQuotes(alias);
    if (cleaned) {
      map[cleaned] = "max";
    }
  }

  return map;
}

export function isPaddleConfigured(env: PaddleEnvSource = process.env): boolean {
  const apiKey = stripQuotes(env.PADDLE_API_KEY);
  const webhookSecret = resolvePaddleWebhookSecret(env);
  const priceId =
    stripQuotes(env.PADDLE_PRO_PRICE_ID) ||
    stripQuotes(env.PADDLE_PRICE_ID_PRO) ||
    stripQuotes(env.PADDLE_PRICE_ID);
  return Boolean(apiKey && webhookSecret && priceId);
}

export function getPaddleConfig(env: PaddleEnvSource = process.env): PaddleConfig {
  const apiKey = stripQuotes(env.PADDLE_API_KEY);
  const webhookSecret = resolvePaddleWebhookSecret(env);
  const priceIdPro =
    stripQuotes(env.PADDLE_PRO_PRICE_ID) ||
    stripQuotes(env.PADDLE_PRICE_ID_PRO) ||
    stripQuotes(env.PADDLE_PRICE_ID);
  const priceIdMax = stripQuotes(env.PADDLE_MAX_PRICE_ID) || stripQuotes(env.PADDLE_PRICE_ID_MAX);
  const environment: PaddleEnvironment =
    stripQuotes(env.PADDLE_ENVIRONMENT).toLowerCase() === "sandbox" ? "sandbox" : "production";

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
    pricePlanMap: resolvePaddlePricePlanMap(env),
  };
}

/**
 * Verifies Paddle Billing v2 webhook signatures (HMAC-SHA256).
 *
 * Header format: ts=1729800000;h1=a9c8f... (or h=a9c8f...)
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

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }

  const payload = `${timestampStr}:${rawBody}`;
  const computedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
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

export type CreatePaddleCheckoutOptions = {
  ownerUserId: string;
  userEmail?: string;
  planId?: "pro" | "max";
  returnUrl?: string;
  env?: PaddleEnvSource;
  fetchImpl?: typeof fetch;
};

export type PaddleCheckoutResult = {
  checkoutUrl: string;
  transactionId: string;
};

/**
 * Creates a Paddle Billing v2 transaction for user checkout.
 */
export async function createPaddleCheckoutTransaction(
  options: CreatePaddleCheckoutOptions
): Promise<PaddleCheckoutResult> {
  const { ownerUserId, userEmail, planId = "pro", returnUrl, env, fetchImpl = fetch } = options;
  const config = getPaddleConfig(env);

  const priceId = planId === "max" && config.priceIdMax ? config.priceIdMax : config.priceIdPro;

  if (!priceId) {
    throw new Error(`No Paddle price configured for plan: ${planId}`);
  }

  const payload: Record<string, unknown> = {
    items: [
      {
        price_id: priceId,
        quantity: 1,
      },
    ],
    custom_data: {
      owner_user_id: ownerUserId,
      plan_id: planId,
    },
  };

  if (userEmail) {
    payload.customer_email = userEmail;
    payload.customer = {
      email: userEmail,
    };
  }

  if (returnUrl) {
    payload.checkout = {
      url: returnUrl,
    };
  }

  const response = await fetchImpl(`${config.baseUrl}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const body = (await response.json()) as {
    data?: {
      id?: string;
      checkout_url?: string;
    };
    error?: {
      detail?: string;
      message?: string;
    };
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
 * Normalizes Paddle subscription and transaction events into Stryde's subscription_state structure.
 *
 * Enforces strict fail-closed state:
 * - Never assigns Pro/Max by default.
 * - Safely quarantines unrecognized price mappings.
 * - Handles both subscription lifecycle and transaction.completed.
 */
export function normalizePaddleBillingEvent(
  event: PaddleWebhookEvent,
  pricePlanMap?: Record<string, "pro" | "max">
): NormalizedSubscriptionUpdate | null {
  const eventType = event.event_type;
  if (!eventType) {
    return null;
  }

  const isSubscriptionEvent = eventType.startsWith("subscription.");
  const isTransactionEvent = eventType.startsWith("transaction.");

  if (!isSubscriptionEvent && !isTransactionEvent) {
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
  let planId: "free" | "pro" | "max" | null = null;
  const customPlan = (data.custom_data?.plan_id as string | undefined)?.toLowerCase();
  if (customPlan === "max" || customPlan === "pro" || customPlan === "free") {
    planId = customPlan;
  } else {
    const itemPriceId = data.items?.[0]?.price_id || data.items?.[0]?.price?.id;
    if (itemPriceId && pricePlanMap && pricePlanMap[itemPriceId]) {
      planId = pricePlanMap[itemPriceId];
    }
  }

  // Normalize status
  const rawStatus = (data.status || "").toLowerCase();
  let status: NormalizedSubscriptionStatus = "UNKNOWN";

  if (rawStatus === "active" || rawStatus === "completed" || rawStatus === "paid") {
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

  // Fail-closed quarantine:
  // If plan cannot be resolved:
  // - If canceled or expired, demote to free and record status.
  // - If active / trialing / past_due / paused, DO NOT assign pro/max!
  //   Quarantine to "free" with status "UNKNOWN".
  let quarantined = false;
  let quarantineReason: string | undefined;

  if (!planId) {
    if (status === "CANCELLED" || status === "EXPIRED") {
      planId = "free";
    } else {
      quarantined = true;
      planId = "free";
      status = "UNKNOWN";
      quarantineReason = `Unrecognized price mapping: ${data.items?.[0]?.price_id || data.items?.[0]?.price?.id || "none"}`;
    }
  }

  const effectiveAt = data.started_at || data.created_at || event.occurred_at || new Date().toISOString();
  const expiresAt = data.canceled_at || data.next_billed_at || null;

  const subscriptionRef = isSubscriptionEvent ? data.id : (data.subscription_id || data.id);

  return {
    ownerUserId,
    planId,
    provider: "paddle",
    providerCustomerRef: data.customer_id || "",
    providerSubscriptionRef: subscriptionRef,
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
    quarantined,
    quarantineReason,
  };
}

/**
 * Normalizes Paddle subscription webhook events. Only processes subscription.* events.
 */
export function normalizePaddleSubscriptionEvent(
  event: PaddleWebhookEvent,
  pricePlanMap?: Record<string, "pro" | "max">
): NormalizedSubscriptionUpdate | null {
  if (!event.event_type || !event.event_type.startsWith("subscription.")) {
    return null;
  }
  return normalizePaddleBillingEvent(event, pricePlanMap);
}

/**
 * Cancels an active Paddle Billing v2 subscription.
 */
export async function cancelPaddleSubscription(
  subscriptionRef: string,
  options?: {
    effectiveFrom?: "immediately" | "next_billing_period";
    env?: PaddleEnvSource;
    fetchImpl?: typeof fetch;
  }
): Promise<{ success: boolean; status?: string; error?: string }> {
  const env = options?.env;
  if (!isPaddleConfigured(env)) {
    return { success: false, error: "Paddle is not configured" };
  }
  const config = getPaddleConfig(env);
  const fetchImpl = options?.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(
      `${config.baseUrl}/subscriptions/${encodeURIComponent(subscriptionRef)}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          effective_from: options?.effectiveFrom ?? "immediately",
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      const lower = errText.toLowerCase();
      // If the subscription is already canceled/cancelled in Paddle, acknowledge as idempotent success
      if (
        lower.includes("already_canceled") ||
        lower.includes("already_cancelled") ||
        lower.includes("subscription_canceled") ||
        lower.includes("subscription_cancelled") ||
        lower.includes("subscription is already canceled") ||
        lower.includes("subscription is already cancelled")
      ) {
        return { success: true, status: "canceled" };
      }
      return {
        success: false,
        error: `Paddle cancellation returned HTTP ${response.status}: ${errText}`,
      };
    }

    const body = (await response.json()) as { data?: { status?: string } };
    return { success: true, status: body.data?.status ?? "canceled" };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error contacting Paddle",
    };
  }
}
