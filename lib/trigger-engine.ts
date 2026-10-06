// Trigger engine (Phase 9): evaluates due triggers and turns them into jobs
// on the EXISTING controlled-execution infrastructure. There is no second
// orchestration system here — a trigger that wins its condition window
// merely enqueues the same work the authorization-commit path already
// governs. Triggers never grant authority and never bypass the resource
// plane: the enqueued job's execution reserves budget like any other.
import type { SupabaseClient } from "@supabase/supabase-js";

export type TriggerRow = {
  id: string;
  owner_user_id: string;
  pursuit_id: string | null;
  name: string;
  trigger_kind: "ONE_TIME" | "RECURRING" | "EVENT" | "STATE" | "MONITOR";
  condition: {
    fire_at?: string;
    interval_minutes?: number;
    event_entity?: string;
    event_type?: string;
    blocked_days?: number;
    watch_uri?: string;
    expect_text?: string;
  } | null;
  action: Record<string, unknown>;
  status: "ACTIVE" | "PAUSED" | "FIRED" | "CANCELLED";
  last_fired_at: string | null;
  next_fire_at: string | null;
  max_fires: number | null;
  fire_count: number;
};

export type DueTrigger = {
  trigger: TriggerRow;
  windowKey: string;
};

// Pure condition evaluation — unit-testable without a database.
export function isDue(
  trigger: TriggerRow,
  now: Date,
  context: { pursuitUpdatedAt?: string | null; inFlightAction?: boolean; recentEvent?: { entity_type: string; event_type: string; occurred_at: string } | null },
): { due: boolean; windowKey: string; reason: string } {
  const dayWindow = now.toISOString().slice(0, 10);
  switch (trigger.trigger_kind) {
    case "ONE_TIME": {
      const fireAt = trigger.next_fire_at ?? trigger.condition?.fire_at ?? null;
      if (!fireAt) return { due: false, windowKey: dayWindow, reason: "no fire time" };
      return {
        due: new Date(fireAt).getTime() <= now.getTime() && trigger.fire_count === 0,
        windowKey: "once",
        reason: "one-time schedule reached",
      };
    }
    case "RECURRING": {
      const interval = Math.max(trigger.condition?.interval_minutes ?? 1440, 1);
      const last = trigger.last_fired_at ? new Date(trigger.last_fired_at).getTime() : 0;
      const next = trigger.next_fire_at ? new Date(trigger.next_fire_at).getTime() : null;
      const due = now.getTime() - last >= interval * 60_000 || (next !== null && now.getTime() >= next);
      return { due, windowKey: dayWindow, reason: `interval ${interval}m` };
    }
    case "EVENT": {
      const event = context.recentEvent;
      const matches = Boolean(
        event
        && (!trigger.condition?.event_entity || event.entity_type === trigger.condition.event_entity)
        && (!trigger.condition?.event_type || event.event_type === trigger.condition.event_type),
      );
      return { due: matches, windowKey: dayWindow, reason: matches ? `event ${event?.entity_type}/${event?.event_type}` : "no matching event" };
    }
    case "STATE": {
      const blockedDays = trigger.condition?.blocked_days ?? 3;
      if (context.inFlightAction) return { due: false, windowKey: dayWindow, reason: "action already in flight" };
      const updated = context.pursuitUpdatedAt ? new Date(context.pursuitUpdatedAt).getTime() : 0;
      const due = now.getTime() - updated >= blockedDays * 86_400_000;
      return { due, windowKey: dayWindow, reason: due ? `no movement for ${blockedDays}d` : "pursuit recently active" };
    }
    case "MONITOR": {
      // Monitoring fires through the normal capability path (a VERIFY_WEB-style
      // check of the watched URI). The cron marks it due once per window; the
      // observation comparison happens in the executing job, not here.
      const last = trigger.last_fired_at ? new Date(trigger.last_fired_at).getTime() : 0;
      const interval = Math.max(trigger.condition?.interval_minutes ?? 1440, 60);
      return { due: now.getTime() - last >= interval * 60_000, windowKey: dayWindow, reason: "monitor interval reached" };
    }
  }
}

// Evaluate all ACTIVE triggers for due-ness and fire the due ones (trusted
// plane). Firing is idempotent per window via stryde_fire_trigger; the
// winner records a firing row. Enqueuing the actual job is the caller's
// responsibility (it needs the worker-plane dispatcher).
export async function evaluateTriggers(
  service: SupabaseClient,
  now: Date,
): Promise<{ evaluated: number; fired: Array<{ id: string; name: string; windowKey: string }> }> {
  const { data: triggers, error } = await service
    .from("trigger")
    .select("*")
    .eq("status", "ACTIVE");
  if (error) throw new Error(`Unable to list triggers: ${error.message}`);

  const fired: Array<{ id: string; name: string; windowKey: string }> = [];
  for (const raw of (triggers ?? []) as TriggerRow[]) {
    const context = { pursuitUpdatedAt: null as string | null, inFlightAction: false, recentEvent: null };
    const verdict = isDue(raw, now, context);
    if (!verdict.due) continue;
    const { data: won, error: fireError } = await service
      .rpc("stryde_fire_trigger", { p_trigger: raw.id, p_window_key: verdict.windowKey });
    if (fireError) continue;
    if (won) fired.push({ id: raw.id, name: raw.name, windowKey: verdict.windowKey });
  }
  return { evaluated: (triggers ?? []).length, fired };
}
