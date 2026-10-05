import type { SupabaseClient } from "@supabase/supabase-js";
import { WORKER_TYPES } from "./actor.ts";

// Autonomy policy semantics (docs/DECISIONS.md D9): the direction — bounded,
// user-configurable authority — is locked; this is the smallest sound grammar.
// No row means unconfigured: Stryde keeps its default behavior, where every
// delegation still requires explicit per-action approval. A row can only
// TIGHTEN behavior, never grant authority by itself.
export type AutonomyPolicy = {
  allow_worker_delegation: boolean;
  allowed_worker_types: string[];
  auto_execute_research: boolean;
};

export type AutonomyDecision = { allowed: boolean; reason: string | null };

// Derived from WORKER_TYPES so a newly declared worker type is automatically
// policy-addressable; REGISTERED is the set a user may enable, which is every
// declared worker type. A capability that must NOT be user-enableable would be
// subtracted here explicitly — never tracked by hand in a second list.
export const REGISTERED_WORKER_TYPES = WORKER_TYPES;

export async function loadAutonomyPolicy(
  supabase: SupabaseClient,
  ownerUserId: string,
): Promise<AutonomyPolicy | null> {
  const { data } = await supabase
    .from("user_autonomy_policy")
    .select("allow_worker_delegation, allowed_worker_types, auto_execute_research")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (!data) return null;
  return {
    allow_worker_delegation: data.allow_worker_delegation as boolean,
    allowed_worker_types: Array.isArray(data.allowed_worker_types) ? (data.allowed_worker_types as string[]) : [],
    auto_execute_research: data.auto_execute_research as boolean,
  };
}

export function checkWorkerDelegation(
  policy: AutonomyPolicy | null,
  workerType: string,
): AutonomyDecision {
  if (!policy) return { allowed: true, reason: null };
  if (!policy.allow_worker_delegation) {
    return { allowed: false, reason: "Worker delegation is switched off in your autonomy settings." };
  }
  if (!policy.allowed_worker_types.includes(workerType)) {
    return {
      allowed: false,
      reason:
        policy.allowed_worker_types.length > 0
          ? `Only ${policy.allowed_worker_types.join(" and ")} workers are enabled in your autonomy settings.`
          : "No worker types are enabled in your autonomy settings.",
    };
  }
  return { allowed: true, reason: null };
}

export function checkAutoResearch(policy: AutonomyPolicy | null): boolean {
  if (!policy) return true;
  return policy.auto_execute_research;
}
