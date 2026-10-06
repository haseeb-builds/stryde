// Capability discovery / eligibility (Phase 2 of the capability platform).
//
// Answers one question: what can Stryde use for this task, for this user,
// right now? Outputs eligible and ineligible capabilities WITH reasons,
// expected resource cost, and required authority. Discovery is not authority:
// every capability that can touch the world still requires the existing
// authorization path before execution.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Entitlement } from "./entitlement.ts";
import { limitFor, normalizePlanId } from "./entitlement.ts";

export type CapabilityRecord = {
  capability_key: string;
  version: string;
  provider: string;
  description: string;
  trust_class: string;
  risk_class: string;
  side_effect_class: string;
  reversible: boolean;
  plan_eligibility: string[] | null;
  cost_model: Record<string, number> | null;
  availability: string;
  metadata: Record<string, unknown> | null;
};

export type EligibilityReason =
  | "PLAN_NOT_ELIGIBLE"
  | "RESOURCE_EXHAUSTED"
  | "UNAVAILABLE"
  | "DEGRADED"
  | "TRUST_BLOCKED"
  | "ELIGIBLE";

export type CapabilityEvaluation = {
  capabilityKey: string;
  provider: string;
  description: string;
  riskClass: string;
  sideEffectClass: string;
  costModel: Record<string, number>;
  eligibility: EligibilityReason;
  reasons: string[];
  // Which capabilities would serve as alternatives if this one is unusable.
  fallbackFor: string[];
  requiredAuthority: "NONE" | "EXPLICIT_USER_APPROVAL";
};

export type DiscoveryInput = {
  // Remaining units per resource name, as computed by the trusted plane
  // (stryde_resource_available). null = unlimited; absent = unknown → closed.
  remaining: Record<string, number | null>;
  entitlement: Pick<Entitlement, "planId">;
  capabilities: CapabilityRecord[];
  // Task context narrows ranking, never eligibility.
  taskHint?: string;
};

function requiresExplicitApproval(cap: CapabilityRecord): boolean {
  return cap.side_effect_class === "EXTERNAL_COMMUNICATION"
    || cap.side_effect_class === "STATE_CHANGE"
    || cap.side_effect_class === "DESTRUCTIVE";
}

function fallbackPairs(caps: CapabilityRecord[]): Map<string, string[]> {
  // Static lane fallbacks: extract/observe can serve for search gaps; direct
  // page fetch is the always-configured observation floor.
  const pairs: Array<[string, string]> = [
    ["research.web_search", "research.page_fetch"],
    ["research.web_extraction", "research.page_fetch"],
    ["worker.execution", "research.page_fetch"],
  ];
  const map = new Map<string, string[]>();
  for (const [from, to] of pairs) {
    if (caps.some((c) => c.capability_key === to)) {
      map.set(from, [...(map.get(from) ?? []), to]);
    }
  }
  return map;
}

export function evaluateCapabilities(input: DiscoveryInput): CapabilityEvaluation[] {
  const fallbacks = fallbackPairs(input.capabilities);
  return input.capabilities.map((cap) => {
    const reasons: string[] = [];
    let eligibility: EligibilityReason = "ELIGIBLE";

    if (cap.trust_class === "BLOCKED") {
      eligibility = "TRUST_BLOCKED";
      reasons.push("capability implementation is BLOCKED by trust policy");
    }
    if (cap.availability === "UNAVAILABLE") {
      eligibility = eligibility === "ELIGIBLE" ? "UNAVAILABLE" : eligibility;
      reasons.push("no configured provider or substrate for this capability");
    } else if (cap.availability === "DEGRADED") {
      reasons.push("provider credentials absent; capability degrades honestly");
    }

    const planEligible = cap.plan_eligibility ?? [];
    if (planEligible.length > 0 && !planEligible.includes(input.entitlement.planId)) {
      eligibility = eligibility === "ELIGIBLE" ? "PLAN_NOT_ELIGIBLE" : eligibility;
      reasons.push(`plan ${input.entitlement.planId} is not eligible (requires ${planEligible.join("/")})`);
    }

    const costModel = cap.cost_model ?? {};
    for (const [resource, amount] of Object.entries(costModel)) {
      if (!(resource in input.remaining)) {
        eligibility = eligibility === "ELIGIBLE" ? "RESOURCE_EXHAUSTED" : eligibility;
        reasons.push(`resource ${resource} is not metered; failing closed`);
        continue;
      }
      const remaining = input.remaining[resource];
      if (remaining !== null && amount > remaining) {
        eligibility = eligibility === "ELIGIBLE" ? "RESOURCE_EXHAUSTED" : eligibility;
        reasons.push(`needs ${amount} ${resource}, ${remaining} remain`);
      }
    }

    return {
      capabilityKey: cap.capability_key,
      provider: cap.provider,
      description: cap.description,
      riskClass: cap.risk_class,
      sideEffectClass: cap.side_effect_class,
      costModel,
      eligibility,
      reasons,
      fallbackFor: fallbacks.get(cap.capability_key) ?? [],
      requiredAuthority: requiresExplicitApproval(cap) ? "EXPLICIT_USER_APPROVAL" : "NONE",
    };
  });
}

export type DiscoveryResult = {
  eligible: CapabilityEvaluation[];
  ineligible: CapabilityEvaluation[];
  // The planner's default ordering: eligible first, cheapest-sufficient cost,
  // lowest risk within equal cost.
  recommended: string[];
};

export function rankEligible(evaluations: CapabilityEvaluation[]): string[] {
  const eligible = evaluations.filter((e) => e.eligibility === "ELIGIBLE" || e.eligibility === "DEGRADED");
  const cost = (e: CapabilityEvaluation) => Object.values(e.costModel).reduce((a, b) => a + b, 0);
  const risk = (e: CapabilityEvaluation) => ({ LOW: 0, MEDIUM: 1, HIGH: 2 }[e.riskClass as "LOW" | "MEDIUM" | "HIGH"] ?? 3);
  return [...eligible]
    .sort((a, b) => (eligibilityPenalty(a) - eligibilityPenalty(b)) || (cost(a) - cost(b)) || (risk(a) - risk(b)))
    .map((e) => e.capabilityKey);
}

function eligibilityPenalty(e: CapabilityEvaluation): number {
  return e.eligibility === "ELIGIBLE" ? 0 : 1;
}

// Live discovery against the database. Runs on the trusted plane: reads the
// capability catalog (public) and remaining resources via the reserved RPCs.
export async function discoverCapabilities(
  service: SupabaseClient,
  input: { ownerUserId: string; planId: string; taskHint?: string },
): Promise<DiscoveryResult> {
  const { data: capabilities, error } = await service
    .from("capability")
    .select("capability_key, version, provider, description, trust_class, risk_class, side_effect_class, reversible, plan_eligibility, cost_model, availability, metadata")
    .neq("availability", "RETIRED");
  if (error) throw new Error(`Capability catalog unavailable: ${error.message}`);

  const records = (capabilities ?? []) as CapabilityRecord[];
  const resources = new Set<string>();
  for (const cap of records) {
    for (const resource of Object.keys(cap.cost_model ?? {})) resources.add(resource);
  }

  const remaining: Record<string, number | null> = {};
  for (const resource of resources) {
    const { data, error: rpcError } = await service
      .rpc("stryde_resource_available", { p_owner: input.ownerUserId, p_resource: resource });
    remaining[resource] = rpcError ? 0 : (data === null ? null : Number(data));
  }

  const evaluations = evaluateCapabilities({
    remaining,
    entitlement: { planId: normalizePlanId(input.planId) },
    capabilities: records,
    taskHint: input.taskHint,
  });
  return {
    eligible: evaluations.filter((e) => e.eligibility === "ELIGIBLE" || e.eligibility === "DEGRADED"),
    ineligible: evaluations.filter((e) => e.eligibility !== "ELIGIBLE" && e.eligibility !== "DEGRADED"),
    recommended: rankEligible(evaluations),
  };
}

export { limitFor };
