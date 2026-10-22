import type { SupabaseClient } from "@supabase/supabase-js";

export type PursuitObservationRecord = {
  id: string;
  observation_kind: string;
  content: unknown;
  observed_at: string;
  source_type: string | null;
  source_reference: string | null;
  source_metadata?: unknown;
};

/**
 * Retrieves all observations associated with a given pursuit for the authenticated user:
 * - Research observations (WEB_SEARCH_RESULT) that carry pursuit_id in content or source_metadata
 * - URL verification observations (URL_VERIFICATION) that carry pursuit_id
 * - Action-linked observations (HUMAN_ACTION_RESULT, MECHANICAL_ATTEMPT_RESULT) where source_reference matches an action of the pursuit
 *
 * Strict tenant and cross-pursuit isolation:
 * - Enforced by the caller's RLS-scoped user client (owner_user_id = auth.uid())
 * - Pursuit existence and ownership are verified before querying observations
 * - Any record with an explicit foreign pursuit_id is dropped
 */
export async function fetchPursuitObservations(
  supabase: SupabaseClient,
  pursuitId: string,
): Promise<{ observations: PursuitObservationRecord[] | null; error: string | null }> {
  // 1. Verify pursuit existence and ownership through the authenticated client (RLS enforced)
  const { data: pursuit, error: pursuitError } = await supabase
    .from("pursuit")
    .select("id")
    .eq("id", pursuitId)
    .maybeSingle();

  if (pursuitError) {
    return { observations: null, error: "Unable to load pursuit" };
  }
  if (!pursuit) {
    return { observations: null, error: "Pursuit not found" };
  }

  // 2. Fetch action IDs belonging to this pursuit
  const { data: actions, error: actionsError } = await supabase
    .from("action")
    .select("id")
    .eq("pursuit_id", pursuitId);

  if (actionsError) {
    return { observations: null, error: "Unable to load actions" };
  }

  const actionIds = (actions ?? [])
    .map((a: { id: string }) => a.id)
    .filter((id: unknown): id is string => typeof id === "string");

  // 3. Fetch observations associated with this pursuit:
  //    - Research observations: carry pursuit_id in content or source_metadata
  //    - Verification observations: carry pursuit_id in content or source_metadata
  //    - Action-linked observations: source_reference matches an action of this pursuit
  const contentQuery = supabase
    .from("observation")
    .select("id, observation_kind, content, observed_at, source_type, source_reference, source_metadata")
    .contains("content", { pursuit_id: pursuitId })
    .order("observed_at", { ascending: false })
    .limit(100);

  const metaQuery = supabase
    .from("observation")
    .select("id, observation_kind, content, observed_at, source_type, source_reference, source_metadata")
    .contains("source_metadata", { pursuit_id: pursuitId })
    .order("observed_at", { ascending: false })
    .limit(100);

  const actionQuery = actionIds.length > 0
    ? supabase
        .from("observation")
        .select("id, observation_kind, content, observed_at, source_type, source_reference, source_metadata")
        .in("source_reference", actionIds)
        .order("observed_at", { ascending: false })
        .limit(100)
    : Promise.resolve({ data: [] as PursuitObservationRecord[], error: null });

  const [contentResult, metaResult, actionResult] = await Promise.all([
    contentQuery,
    metaQuery,
    actionQuery,
  ]);

  if (contentResult.error || metaResult.error || actionResult.error) {
    return { observations: null, error: "Unable to load observations" };
  }

  const results = [
    (contentResult.data ?? []) as unknown as PursuitObservationRecord[],
    (metaResult.data ?? []) as unknown as PursuitObservationRecord[],
    (actionResult.data ?? []) as unknown as PursuitObservationRecord[],
  ];

  // 4. Combine and deduplicate by id, enforcing cross-pursuit tenant isolation
  const map = new Map<string, PursuitObservationRecord>();
  for (const items of results) {
    for (const obs of items) {
      if (!map.has(obs.id)) {
        const content = obs.content as Record<string, unknown> | null;
        const meta = obs.source_metadata as Record<string, unknown> | null;

        // Strict cross-pursuit guard: if either explicit pursuit identifier exists and
        // does not equal the active pursuit ID, reject the observation.
        // A matching identifier in one field must never override a conflicting identifier in the other.
        const contentPursuitId =
          content && typeof content === "object" && typeof content.pursuit_id === "string"
            ? content.pursuit_id
            : null;
        const metaPursuitId =
          meta && typeof meta === "object" && typeof meta.pursuit_id === "string"
            ? meta.pursuit_id
            : null;

        if (
          (contentPursuitId && contentPursuitId !== pursuitId) ||
          (metaPursuitId && metaPursuitId !== pursuitId)
        ) {
          continue; // Belongs to a different pursuit or has conflicting pursuit identifiers; drop immediately
        }

        map.set(obs.id, obs);
      }
    }
  }

  // 5. Order chronologically descending
  const observations = Array.from(map.values()).sort(
    (a, b) => new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime(),
  );

  return { observations, error: null };
}

/**
 * Predicate determining whether an observation can be linked as evidence to a claim in the UI.
 */
export function isSelectableObservationForClaim(obs: { observation_kind?: string }): boolean {
  return typeof obs.observation_kind === "string" && obs.observation_kind.length > 0;
}

/**
 * Human-readable label for an observation option in the claims evidence dropdown.
 */
export function formatObservationOptionLabel(obs: {
  observation_kind: string;
  observed_at: string;
}): string {
  const dateStr = new Date(obs.observed_at).toLocaleString();
  if (obs.observation_kind === "HUMAN_ACTION_RESULT") {
    return `Action result · ${dateStr}`;
  }
  if (obs.observation_kind === "WEB_SEARCH_RESULT") {
    return `Research evidence · ${dateStr}`;
  }
  if (obs.observation_kind === "URL_VERIFICATION") {
    return `URL verification · ${dateStr}`;
  }
  return `${obs.observation_kind.toLowerCase().replace(/_/g, " ")} · ${dateStr}`;
}
