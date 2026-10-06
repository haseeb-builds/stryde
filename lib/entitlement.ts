// Entitlement layer: resolves a user's effective plan and its resource
// envelope. Plans shape capacity, never epistemics — nothing here can change
// the truth status of evidence. All enforcement is server-side; the client is
// never authoritative.
//
// Resolution order: subscription_state row (owner-readable, RLS) → effective
// plan via the SQL rule (expired/unknown paid states resolve to free) →
// plan_envelope limits. An unknown resource fails closed (0), not open.
import type { SupabaseClient } from "@supabase/supabase-js";

export const PLAN_IDS = ["free", "pro", "max"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type ResourceWindowType = "STATIC" | "DAILY" | "MONTHLY";

export type ResourceLimit = {
  resource: string;
  limitValue: number | null; // null = unlimited
  windowType: ResourceWindowType;
};

export type Entitlement = {
  planId: PlanId;
  source: string;
  limits: ResourceLimit[];
};

const DEFAULT_PLAN: PlanId = "free";

export function normalizePlanId(value: unknown): PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value)
    ? (value as PlanId)
    : DEFAULT_PLAN;
}

function normalizeWindow(value: unknown): ResourceWindowType {
  return value === "STATIC" || value === "DAILY" || value === "MONTHLY" ? value : "MONTHLY";
}

export async function getEntitlement(supabase: SupabaseClient, ownerUserId: string): Promise<Entitlement> {
  const { data: sub, error: subError } = await supabase
    .from("subscription_state")
    .select("plan_id, status, source, expires_at")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  let planId: PlanId = DEFAULT_PLAN;
  let source = "DEFAULT";
  if (!subError && sub) {
    const active =
      ["ACTIVE", "TRIALING", "PAST_DUE"].includes(String(sub.status)) &&
      (!sub.expires_at || new Date(String(sub.expires_at)).getTime() > Date.now());
    if (active) {
      planId = normalizePlanId(sub.plan_id);
      source = String(sub.source ?? "DEFAULT");
    }
  }

  const { data: envelope, error: envError } = await supabase
    .from("plan_envelope")
    .select("resource, limit_value, window_type")
    .eq("plan_id", planId);

  // A missing envelope is a server-side enforcement hole, never a reason to
  // grant unlimited capacity: fail closed per resource at the consumer.
  const limits: ResourceLimit[] = (envelope ?? []).map((row) => ({
    resource: String(row.resource),
    limitValue: row.limit_value === null ? null : Number(row.limit_value),
    windowType: normalizeWindow(row.window_type),
  }));
  if (envError) {
    // Leave limits empty; callers must treat unknown resources as exhausted.
  }

  return { planId, source, limits };
}

export function limitFor(entitlement: Entitlement, resource: string): ResourceLimit | null {
  return entitlement.limits.find((l) => l.resource === resource) ?? null;
}
