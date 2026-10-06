// Provider-neutral notification delivery (Phase 11). Notifications are rows
// first: deduplicated by (owner, channel, dedupe_key), linked to their
// pursuit/run/action, priority-aware. Delivery adapters are pluggable; a
// channel without configured credentials stays PENDING with the channel
// marked unavailable — never silently dropped, never fabricated as delivered.
import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationChannel = "IN_APP" | "EMAIL" | "WEBHOOK";

export type NotificationInput = {
  ownerUserId: string;
  pursuitId?: string | null;
  runId?: string | null;
  actionId?: string | null;
  channel?: NotificationChannel;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  title: string;
  body: string;
  linkPath?: string | null;
  // Logical identity for deduplication (e.g. "continuity:nudge:pursuit:2026-10-06").
  dedupeKey: string;
};

export type DeliveryResult = { delivered: number; pending: number; skipped: number };

// Record a notification. Deduplication happens in the database: a repeated
// (owner, channel, dedupe_key) insert collides and is treated as already
// recorded. Fail-open: notification recording must never break product flow.
export async function recordNotification(
  service: SupabaseClient,
  input: NotificationInput,
): Promise<{ recorded: boolean }> {
  const { error } = await service.from("notification").insert({
    owner_user_id: input.ownerUserId,
    pursuit_id: input.pursuitId ?? null,
    run_id: input.runId ?? null,
    action_id: input.actionId ?? null,
    channel: input.channel ?? "IN_APP",
    priority: input.priority ?? "NORMAL",
    title: input.title.slice(0, 300),
    body: input.body.slice(0, 4000),
    link_path: input.linkPath ?? null,
    dedupe_key: input.dedupeKey,
  });
  if (error) {
    if (error.code === "23505") return { recorded: false };
    console.error("[notifications] record failed (fail-open):", error.message);
    return { recorded: false };
  }
  return { recorded: true };
}

// Deliver PENDING notifications through the channels the runtime actually
// has configured. IN_APP is always deliverable (the row is the inbox).
// EMAIL needs RESEND_API_KEY (currently absent: stays pending, honestly).
// WEBHOOK needs STRYDE_NOTIFICATION_WEBHOOK_URL.
export function configuredChannels(env: NodeJS.ProcessEnv): Record<NotificationChannel, boolean> {
  return {
    IN_APP: true,
    EMAIL: Boolean(env.RESEND_API_KEY),
    WEBHOOK: Boolean(env.STRYDE_NOTIFICATION_WEBHOOK_URL),
  };
}

export async function deliverPendingNotifications(
  service: SupabaseClient,
  env: NodeJS.ProcessEnv,
  limit = 100,
): Promise<DeliveryResult> {
  const channels = configuredChannels(env);
  const { data: pending, error } = await service
    .from("notification")
    .select("id, channel, title, body, link_path, owner_user_id")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Unable to list pending notifications: ${error.message}`);

  let delivered = 0;
  let pendingCount = 0;
  let skipped = 0;
  for (const n of (pending ?? []) as Array<{ id: string; channel: NotificationChannel; title: string; body: string; link_path: string | null }>) {
    if (n.channel === "IN_APP") {
      // In-app delivery is the row itself becoming visible: mark delivered.
      await service.from("notification").update({ status: "DELIVERED", delivered_at: new Date().toISOString(), provider: "in_app" }).eq("id", n.id);
      delivered += 1;
    } else if (n.channel === "WEBHOOK" && channels.WEBHOOK) {
      try {
        const res = await fetch(env.STRYDE_NOTIFICATION_WEBHOOK_URL!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: n.id, title: n.title, body: n.body, link: n.link_path }),
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) {
          await service.from("notification").update({ status: "DELIVERED", delivered_at: new Date().toISOString(), provider: "webhook", provider_reference: res.headers.get("x-request-id") }).eq("id", n.id);
          delivered += 1;
        } else {
          await service.from("notification").update({ status: "FAILED", provider: "webhook" }).eq("id", n.id);
          skipped += 1;
        }
      } catch {
        pendingCount += 1; // transient: stays PENDING for the next run
      }
    } else {
      pendingCount += 1; // channel unconfigured: honest PENDING
    }
  }
  return { delivered, pending: pendingCount, skipped };
}
