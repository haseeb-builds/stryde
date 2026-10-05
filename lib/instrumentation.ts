// First-party funnel instrumentation. Events are counters with scope, never
// content: no prompt text, no message bodies, no personal attributes. The
// funnel mirrors the product journey (Issue #6 market instrumentation):
// signup → first pursuit → first meaningful turn → action → worker execution
// → verified outcome → return → paid CTA.
//
// Every recording path is fail-open: instrumentation is a business surface
// and must never break a user-visible flow, and a runtime database without
// the funnel_event table yet (migration pending) degrades to a no-op.
import type { SupabaseClient } from "@supabase/supabase-js";

export const FUNNEL_EVENT_TYPES = [
  "SIGNUP",
  "PURSUIT_CREATED",
  "FIRST_TURN",
  "ACTION_STARTED",
  "WORKER_EXECUTION",
  "VERIFIED_OUTCOME",
  "RETURN_SESSION",
  "PAID_CTA_CLICK",
] as const;

export type FunnelEventType = (typeof FUNNEL_EVENT_TYPES)[number];

export async function recordFunnelEvent(
  supabase: SupabaseClient,
  input: {
    ownerUserId: string | null;
    eventType: FunnelEventType;
    pursuitId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from("funnel_event").insert({
      owner_user_id: input.ownerUserId,
      event_type: input.eventType,
      pursuit_id: input.pursuitId ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) {
      // Migration-pending runtimes surface here; a count is not worth a 500.
      console.error("[instrumentation] insert failed:", error.message);
    }
  } catch (error) {
    console.error("[instrumentation] recording threw:", error instanceof Error ? error.message : error);
  }
}
