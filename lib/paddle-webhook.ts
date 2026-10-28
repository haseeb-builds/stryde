import crypto from "node:crypto";
import {
  verifyPaddleWebhookSignature,
  normalizePaddleBillingEvent,
  resolvePaddleWebhookSecret,
  resolvePaddlePricePlanMap,
  type PaddleWebhookEvent,
} from "./paddle.ts";
import { getSupabaseServiceClient } from "./supabase/service.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProcessPaddleEventParams = {
  p_event_id: string;
  p_event_type: string;
  p_occurred_at: string;
  p_payload_sha256: string;
  p_owner_user_id: string;
  p_plan_id: string;
  p_provider: string;
  p_provider_customer_ref: string | null;
  p_provider_subscription_ref: string | null;
  p_provider_status: string;
  p_status: string;
  p_effective_at: string;
  p_expires_at: string | null;
  p_quarantined?: boolean;
  p_quarantine_reason?: string | null;
};

export type ProcessPaddleEventResult = {
  success: boolean;
  updated?: boolean;
  duplicate?: boolean;
  ignored?: boolean;
  conflict?: boolean;
  retryable?: boolean;
  concurrent_processing?: boolean;
  reason?: string;
  occurred_at?: string;
  current_last_event_at?: string;
  event_id?: string;
  plan_id?: string;
  status?: string;
  quarantined?: boolean;
  error?: string;
};

export interface WebhookDbClient {
  processPaddleEventRpc(params: ProcessPaddleEventParams): Promise<ProcessPaddleEventResult>;
}

export class SupabaseWebhookDbClient implements WebhookDbClient {
  private customSupabase?: ReturnType<typeof getSupabaseServiceClient>;

  constructor(customSupabase?: ReturnType<typeof getSupabaseServiceClient>) {
    this.customSupabase = customSupabase;
  }

  async processPaddleEventRpc(params: ProcessPaddleEventParams): Promise<ProcessPaddleEventResult> {
    const supabase = this.customSupabase || getSupabaseServiceClient();

    // Call atomic RPC
    const { data, error } = await supabase.rpc("stryde_process_paddle_billing_event", params);

    if (!error && data) {
      return data as ProcessPaddleEventResult;
    }

    const isUndefinedFunction =
      error?.code === "42883" ||
      error?.message?.includes("function public.stryde_process_paddle_billing_event") ||
      error?.message?.includes("Could not find the function");

    if (isUndefinedFunction) {
      console.error(
        "[billing/webhook] stryde_process_paddle_billing_event RPC not found in database. Failing with retryable error to await migration deployment."
      );
      return {
        success: false,
        retryable: true,
        error: "stryde_process_paddle_billing_event RPC not found in database; pending migration deployment",
        event_id: params.p_event_id,
      };
    }

    console.error(
      "[billing/webhook] error executing stryde_process_paddle_billing_event RPC:",
      error?.message
    );
    return {
      success: false,
      retryable: true,
      error: error?.message || "Failed to execute stryde_process_paddle_billing_event",
      event_id: params.p_event_id,
    };
  }
}

export type WebhookProcessorOptions = {
  env?: NodeJS.ProcessEnv;
  dbClient?: WebhookDbClient;
};

/**
 * Robust, privacy-safe Paddle Billing v2 Webhook Request Processor.
 */
export async function processPaddleWebhookRequest(
  request: Request,
  options?: WebhookProcessorOptions
): Promise<Response> {
  const env = options?.env || process.env;
  const dbClient = options?.dbClient || new SupabaseWebhookDbClient();

  const secret = resolvePaddleWebhookSecret(env);
  if (!secret) {
    console.error("[billing/webhook] Paddle webhook secret is not configured");
    return Response.json(
      { error: "Webhook endpoint not configured" },
      { status: 503 }
    );
  }

  const signatureHeader = request.headers.get("paddle-signature");
  if (!signatureHeader) {
    return Response.json(
      { error: "Missing Paddle-Signature header" },
      { status: 400 }
    );
  }

  const rawBody = await request.text();
  const isValid = verifyPaddleWebhookSignature(rawBody, signatureHeader, secret);

  if (!isValid) {
    console.warn("[billing/webhook] rejected webhook: invalid signature or expired timestamp");
    return Response.json(
      { error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  let event: PaddleWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaddleWebhookEvent;
  } catch {
    console.error("[billing/webhook] malformed JSON payload");
    return Response.json(
      { error: "Malformed JSON payload" },
      { status: 400 }
    );
  }

  const pricePlanMap = resolvePaddlePricePlanMap(env);
  const update = normalizePaddleBillingEvent(event, pricePlanMap);

  if (!update) {
    // Non-subscription/non-transaction event (e.g. address.created)
    return Response.json({ received: true, ignored: true, event_type: event.event_type });
  }

  // Verify owner user id is valid UUID format
  if (!UUID_REGEX.test(update.ownerUserId)) {
    console.warn(`[billing/webhook] rejected webhook with invalid owner_user_id format: ${update.ownerUserId}`);
    return Response.json(
      { error: "Invalid owner_user_id format in custom_data" },
      { status: 400 }
    );
  }

  if (update.quarantined) {
    console.warn(
      `[billing/webhook] quarantined subscription event for user ${update.ownerUserId}: ${update.quarantineReason}`
    );
  }

  try {
    const payloadSha256 = crypto.createHash("sha256").update(rawBody).digest("hex");

    const result = await dbClient.processPaddleEventRpc({
      p_event_id: event.event_id,
      p_event_type: event.event_type,
      p_occurred_at: update.lastEventAt,
      p_payload_sha256: payloadSha256,
      p_owner_user_id: update.ownerUserId,
      p_plan_id: update.planId,
      p_provider: update.provider,
      p_provider_customer_ref: update.providerCustomerRef || null,
      p_provider_subscription_ref: update.providerSubscriptionRef || null,
      p_provider_status: update.providerStatus,
      p_status: update.status,
      p_effective_at: update.effectiveAt,
      p_expires_at: update.expiresAt,
      p_quarantined: update.quarantined ?? false,
      p_quarantine_reason: update.quarantineReason || null,
    });

    if (result.conflict) {
      console.warn(`[billing/webhook] conflicting payload detected for event ${event.event_id}`);
      return Response.json(
        { error: "Conflicting payload detected for existing event_id" },
        { status: 409 }
      );
    }

    if (result.concurrent_processing) {
      console.warn(`[billing/webhook] concurrent processing in progress for event ${event.event_id}`);
      return Response.json(
        { error: "Concurrent event processing in progress" },
        { status: 409, headers: { "Retry-After": "5" } }
      );
    }

    if (result.retryable || (!result.success && result.error)) {
      console.error(
        `[billing/webhook] retryable error processing event ${event.event_id}:`,
        result.error
      );
      return Response.json(
        { error: result.error || "Retryable processing failure" },
        { status: 500 }
      );
    }

    if (result.duplicate) {
      return Response.json({
        received: true,
        duplicate: true,
        event_id: event.event_id,
      });
    }

    if (result.quarantined) {
      return Response.json({
        received: true,
        quarantined: true,
        event_id: event.event_id,
        reason:
          result.reason ||
          "Unrecognized price plan quarantined; existing subscription preserved",
      });
    }

    if (result.ignored) {
      console.warn(
        `[billing/webhook] ignored out-of-order event for user ${update.ownerUserId}: incoming=${update.lastEventAt}, existing=${result.current_last_event_at}`
      );
      return Response.json({
        received: true,
        ignored: true,
        reason: result.reason || "stale_event",
        occurred_at: update.lastEventAt,
        current_last_event_at: result.current_last_event_at,
      });
    }

    console.log(
      `[billing/webhook] updated subscription for user ${update.ownerUserId}: plan=${update.planId}, status=${update.status}, quarantined=${Boolean(update.quarantined)}`
    );

    return Response.json({
      received: true,
      updated: true,
      event_id: event.event_id,
      event_type: event.event_type,
      plan_id: update.planId,
      status: update.status,
      quarantined: update.quarantined ?? false,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[billing/webhook] unexpected error processing event:", event.event_id, errorMsg);
    return Response.json(
      { error: "Internal server error processing webhook" },
      { status: 500 }
    );
  }
}
