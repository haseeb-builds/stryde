import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceClient } from "./supabase/service.ts";

export type ActionStatus = "PROPOSED" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
export type JobStatus = "AUTHORIZED" | "DISPATCHING" | "AWAITING_CALLBACK" | "UNKNOWN" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type ControlledActionFallbackCase =
  | "HUMAN_ACTION"
  | "UNSTARTED_AUTHORIZED"
  | "EXECUTION_UNCERTAIN_UNKNOWN"
  | "ACTIVE_WORKER_LEASE"
  | "LEASE_EXPIRED_UNKNOWN"
  | "JOB_ALREADY_TERMINAL"
  | "UNKNOWN";

export type ControlledActionFallbackEvaluation = {
  allowed: boolean;
  case: ControlledActionFallbackCase;
  shouldCancelJob: boolean;
  reason?: string;
};

export function normalizeUserClaims(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const claims: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const claim = item.trim();
    if (!claim || claim.length > 2_000 || seen.has(claim)) continue;
    seen.add(claim);
    claims.push(claim);
  }
  return claims;
}

export function evaluateControlledActionFallback(input: {
  action: { id: string; execution_mode: string; status: string };
  job?: {
    id: string;
    status: string;
    lease_owner?: string | null;
    lease_expires_at?: string | null;
  } | null;
  now?: Date;
}): ControlledActionFallbackEvaluation {
  const { action, job } = input;
  const now = input.now ?? new Date();

  if (action.status !== "IN_PROGRESS") {
    return {
      allowed: false,
      case: "JOB_ALREADY_TERMINAL",
      shouldCancelJob: false,
      reason: "Action is not in progress",
    };
  }

  if (action.execution_mode === "HUMAN") {
    return {
      allowed: true,
      case: "HUMAN_ACTION",
      shouldCancelJob: false,
    };
  }

  if (action.execution_mode !== "CONTROLLED") {
    return {
      allowed: false,
      case: "UNKNOWN",
      shouldCancelJob: false,
      reason: `Unsupported execution mode: ${action.execution_mode}`,
    };
  }

  // CONTROLLED action without a job row
  if (!job) {
    return {
      allowed: true,
      case: "UNSTARTED_AUTHORIZED",
      shouldCancelJob: false,
    };
  }

  if (job.status === "AUTHORIZED") {
    return {
      allowed: true,
      case: "UNSTARTED_AUTHORIZED",
      shouldCancelJob: true,
    };
  }

  if (job.status === "UNKNOWN") {
    return {
      allowed: true,
      case: "EXECUTION_UNCERTAIN_UNKNOWN",
      shouldCancelJob: false,
    };
  }

  if (job.status === "DISPATCHING" || job.status === "AWAITING_CALLBACK") {
    if (job.lease_expires_at) {
      const expiresAt = new Date(job.lease_expires_at);
      if (expiresAt.getTime() > now.getTime()) {
        return {
          allowed: false,
          case: "ACTIVE_WORKER_LEASE",
          shouldCancelJob: false,
          reason: "Cannot manually settle action while worker holds an active lease; wait for worker lease to expire or complete",
        };
      }
    }
    // Lease expired without callback
    return {
      allowed: true,
      case: "LEASE_EXPIRED_UNKNOWN",
      shouldCancelJob: false,
    };
  }

  if (job.status === "SUCCEEDED" || job.status === "FAILED" || job.status === "CANCELLED") {
    return {
      allowed: false,
      case: "JOB_ALREADY_TERMINAL",
      shouldCancelJob: false,
      reason: `Job is already ${job.status}`,
    };
  }

  return {
    allowed: false,
    case: "UNKNOWN",
    shouldCancelJob: false,
    reason: `Invalid job status: ${job.status}`,
  };
}

export async function syncObservedUserClaims(input: {
  userSupabase: SupabaseClient;
  serviceSupabase?: SupabaseClient;
  userId: string;
  pursuitId: string;
  observationId: string;
  claims: string[];
}): Promise<{ created: number; warnings: string[] }> {
  let created = 0;
  const warnings: string[] = [];

  for (const claimContent of normalizeUserClaims(input.claims)) {
    try {
      const { data: existing, error: existingError } = await input.userSupabase
        .from("claim")
        .select("id")
        .eq("owner_user_id", input.userId)
        .eq("pursuit_id", input.pursuitId)
        .eq("content", claimContent)
        .limit(1)
        .maybeSingle();
      if (existingError) throw new Error("Unable to inspect existing claim");

      let claimId = existing?.id as string | undefined;
      if (!claimId) {
        const { data, error } = await input.userSupabase.rpc("stryde_create_claim", {
          p_scope: "PURSUIT",
          p_kind: "OUTCOME",
          p_content: claimContent,
          p_pursuit_id: input.pursuitId,
        });
        if (error || !data?.id) throw new Error(error?.message || "Unable to create claim");
        claimId = data.id as string;
        created += 1;
      }

      const serviceClient = input.serviceSupabase ?? getSupabaseServiceClient();
      const { error: linkError } = await serviceClient.rpc("stryde_link_claim_observation", {
        p_actor_id: input.userId,
        p_claim_id: claimId,
        p_observation_id: input.observationId,
        p_relation_type: "SUPPORTS",
      });
      if (linkError && !/duplicate|already exists|unique/i.test(linkError.message)) {
        throw new Error(linkError.message || "Unable to link claim evidence");
      }
    } catch (error) {
      const prefix = claimContent.slice(0, 120) + (claimContent.length > 120 ? "…" : "");
      const message = error instanceof Error ? error.message : "claim sync failed";
      warnings.push(prefix + ": " + message);
    }
  }

  return { created, warnings };
}
