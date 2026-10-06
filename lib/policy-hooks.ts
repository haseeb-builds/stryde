// Policy hooks (Phase 17): lifecycle hooks at the boundaries where policy,
// cost, security, and escalation decisions matter. Hooks are AUDIT records
// in the existing public.event stream (no second system) — they observe and
// can prompt escalation, but they can NEVER bypass the authority layer: no
// hook grants permission, upgrades evidence status, or executes anything.
//
// Recording is fail-open by design: a missing table or failed insert must
// never break the product flow it observes.
import type { SupabaseClient } from "@supabase/supabase-js";

export const POLICY_HOOK_EVENTS = [
  "HOOK_BEFORE_RESEARCH",
  "HOOK_AFTER_RESEARCH",
  "HOOK_BEFORE_CAPABILITY_EXECUTION",
  "HOOK_AFTER_CAPABILITY_EXECUTION",
  "HOOK_BEFORE_EXTERNAL_WRITE",
  "HOOK_AFTER_EXTERNAL_WRITE",
  "HOOK_BUDGET_THRESHOLD",
  "HOOK_VERIFICATION_FAILURE",
  "HOOK_RESOURCE_EXHAUSTED",
] as const;

export type PolicyHookEvent = (typeof POLICY_HOOK_EVENTS)[number];

export type PolicyHookInput = {
  ownerUserId: string;
  pursuitId?: string | null;
  entityType: string;
  entityId: string;
  hook: PolicyHookEvent;
  // Bounded, non-content metadata: capability key, resource names, counts.
  metadata?: Record<string, unknown>;
};

export async function emitPolicyHook(supabase: SupabaseClient, input: PolicyHookInput): Promise<boolean> {
  try {
    const { error } = await supabase.from("event").insert({
      owner_user_id: input.ownerUserId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      event_type: input.hook,
      actor_type: "SYSTEM",
      payload: input.metadata ?? {},
    });
    return !error;
  } catch {
    return false;
  }
}

// Budget-threshold check: fires when remaining units cross the fraction
// floor of the limit. Pure; the cron/routes call this before deciding.
export function isBudgetThresholdCrossed(remaining: number | null, limit: number | null, fraction = 0.1): boolean {
  if (remaining === null || limit === null || limit <= 0) return false;
  return remaining / limit <= fraction;
}
