// Agent selection (Issue #6 decision 2, option B): the user may set a
// preferred execution agent globally, override it per pursuit, or leave the
// choice to Stryde. The preference is a HINT, never authority: the autonomy
// policy still governs what may be delegated at all, and explicit per-action
// approval still applies. Stryde's own recommendation must respect what is
// actually available (granted, unexpired worker capabilities) — a preference
// for a capability the user has not connected degrades to Stryde's choice,
// never to an error.
import type { SupabaseClient } from "@supabase/supabase-js";
import { WORKER_TYPES, type WorkerType } from "./actor.ts";

export type AgentSelection = {
  preferred: WorkerType | null; // what the user asked for, if anyone did
  source: "PURSUIT_OVERRIDE" | "GLOBAL_PREFERENCE" | "STRYDE_AUTO";
};

function isValidType(value: unknown): value is WorkerType {
  return typeof value === "string" && (WORKER_TYPES as readonly string[]).includes(value);
}

// Loads both scopes in one query; the pursuit override wins over the global
// preference. A runtime database without this table yet (migration pending)
// degrades to Stryde's choice rather than erroring the turn.
export async function loadAgentSelection(
  supabase: SupabaseClient,
  ownerUserId: string,
  pursuitId: string,
): Promise<AgentSelection> {
  const { data, error } = await supabase
    .from("user_agent_preference")
    .select("pursuit_id, preferred_worker_type")
    .eq("owner_user_id", ownerUserId)
    .or(`pursuit_id.is.null,pursuit_id.eq.${pursuitId}`);
  if (error || !data) return { preferred: null, source: "STRYDE_AUTO" };

  const override = data.find((row) => row.pursuit_id === pursuitId);
  if (override && isValidType(override.preferred_worker_type)) {
    return { preferred: override.preferred_worker_type, source: "PURSUIT_OVERRIDE" };
  }
  const global = data.find((row) => row.pursuit_id === null);
  if (global && isValidType(global.preferred_worker_type)) {
    return { preferred: global.preferred_worker_type, source: "GLOBAL_PREFERENCE" };
  }
  return { preferred: null, source: "STRYDE_AUTO" };
}

// Writes one scope. preferred_worker_type null deletes the scope's row, so
// "cleared" and "never set" are the same state.
export async function saveAgentPreference(
  supabase: SupabaseClient,
  ownerUserId: string,
  input: { preferredWorkerType: WorkerType | null; pursuitId?: string | null },
): Promise<boolean> {
  const pursuitId = input.pursuitId ?? null;
  if (!input.preferredWorkerType) {
    let query = supabase
      .from("user_agent_preference")
      .delete()
      .eq("owner_user_id", ownerUserId);
    query = pursuitId ? query.eq("pursuit_id", pursuitId) : query.is("pursuit_id", null);
    const { error } = await query;
    return !error;
  }
  // Upsert against the partial unique indexes via delete+insert keeps the
  // scope semantics simple and idempotent.
  await saveAgentPreference(supabase, ownerUserId, { preferredWorkerType: null, pursuitId });
  const { error } = await supabase.from("user_agent_preference").insert({
    owner_user_id: ownerUserId,
    pursuit_id: pursuitId,
    preferred_worker_type: input.preferredWorkerType,
  });
  return !error;
}

// The final instruction to the planner: the effective worker set is the
// intersection of what the user prefers and what is actually connected. When
// the preference is unavailable or unconnected, Stryde chooses from what IS
// available and the planner is told why.
export function resolvePreferredWorkers(
  selection: AgentSelection,
  availableWorkers: readonly WorkerType[],
): { allowed: WorkerType[]; note: string | null } {
  if (selection.preferred) {
    if (availableWorkers.includes(selection.preferred)) {
      return {
        allowed: [selection.preferred],
        note: `The user prefers the ${selection.preferred} agent for this work; honor it when allocating a worker.`,
      };
    }
    return {
      allowed: [...availableWorkers],
      note: `The user prefers the ${selection.preferred} agent, but it is not connected right now; choose the best available capability and say what is available instead.`,
    };
  }
  return {
    allowed: [...availableWorkers],
    note: selection.source === "STRYDE_AUTO"
      ? "The user left agent selection to Stryde: weigh task fit, availability, cost, and reliability."
      : null,
  };
}
