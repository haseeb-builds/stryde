// Resource control (Phase 3 of the capability platform): the reservation /
// reconciliation lifecycle used by server routes on the trusted plane.
//
// Lifecycle: reserve expected units → execute → reconcile with actual usage
// (or release if the operation never ran). All enforcement lives in the
// stryde_* RPCs; this module is the ergonomic wrapper and never a second
// source of truth.
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResourceRequest = { resource: string; expected: number };

export type ReservationGroup = {
  groupId: string;
  release: () => Promise<void>;
  reconcile: (actuals: ResourceRequest[]) => Promise<void>;
};

export class ResourceExhaustedError extends Error {
  readonly resource: string | null;
  constructor(message: string, resource: string | null) {
    super(message);
    this.name = "ResourceExhaustedError";
    this.resource = resource;
  }
}

function parseExhaustion(message: string): string | null {
  const match = /RESOURCE_EXHAUSTED:\s*(\S+)/.exec(message);
  return match ? match[1] : null;
}

export async function reserveResources(
  service: SupabaseClient,
  input: {
    ownerUserId: string;
    pursuitId?: string | null;
    operationKey: string;
    capabilityKey?: string | null;
    requests: ResourceRequest[];
    ttlSeconds?: number;
  },
): Promise<ReservationGroup> {
  const payload = input.requests.map((r) => ({ resource: r.resource, expected: r.expected }));
  const { data, error } = await service.rpc("stryde_reserve_resources", {
    p_owner: input.ownerUserId,
    p_pursuit: input.pursuitId ?? null,
    p_operation: input.operationKey,
    p_resources: payload,
    p_ttl_seconds: input.ttlSeconds ?? 900,
  });
  if (error) {
    const resource = parseExhaustion(error.message);
    throw new ResourceExhaustedError(
      resource ? `Resource budget exhausted: ${resource}` : error.message,
      resource,
    );
  }
  const groupId = String(data);

  return {
    groupId,
    async release() {
      await service.rpc("stryde_release_reservations", { p_group: groupId });
    },
    async reconcile(actuals: ResourceRequest[]) {
      for (const r of actuals) {
        const { error: recError } = await service.rpc("stryde_reconcile_reservation", {
          p_group: groupId,
          p_resource: r.resource,
          p_actual: r.expected,
        });
        if (recError) throw new Error(`Reservation reconciliation failed: ${recError.message}`);
      }
    },
  };
}

// Record post-hoc usage for operations whose cost is only measurable after
// execution (e.g. a model turn). Enforced against the envelope server-side.
export async function recordResourceUsage(
  service: SupabaseClient,
  input: {
    ownerUserId: string;
    pursuitId?: string | null;
    resource: string;
    amount: number;
    capabilityKey?: string | null;
  },
): Promise<{ ok: true } | { ok: false; exhausted: boolean }> {
  const { error } = await service.rpc("stryde_record_resource_usage", {
    p_owner: input.ownerUserId,
    p_pursuit: input.pursuitId ?? null,
    p_resource: input.resource,
    p_amount: input.amount,
    p_capability_key: input.capabilityKey ?? null,
  });
  if (error) {
    if (parseExhaustion(error.message)) return { ok: false, exhausted: true };
    throw new Error(`Usage recording failed: ${error.message}`);
  }
  return { ok: true };
}
