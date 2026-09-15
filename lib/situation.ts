import type { SupabaseClient } from "@supabase/supabase-js";

export const SITUATION_LIMITS = {
  pursuits: 20,
  claims: 50,
  decisions: 20,
  actions: 50,
  events: 100,
} as const;

export type Situation = {
  generated_at: string;
  pursuit: {
    id: string;
    title: string | null;
    status: string;
    objective_claim_id: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  claims: unknown[];
  decisions: unknown[];
  actions: unknown[];
  events: unknown[];
};

type SupabaseLike = SupabaseClient;

export async function assembleSituation(
  supabase: SupabaseLike,
  ownerUserId: string,
  pursuitId: string,
): Promise<{ situation: Situation | null; error: string | null }> {
  const { data: pursuit, error: pursuitError } = await supabase
    .from("pursuit")
    .select("id, title, status, objective_claim_id, created_at, updated_at")
    .eq("id", pursuitId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (pursuitError) return { situation: null, error: "Unable to load pursuit" };
  if (!pursuit) return { situation: null, error: "Pursuit not found" };

  const [claimsResult, decisionsResult, actionsResult, eventsResult] =
    await Promise.all([
      supabase
        .from("claim")
        .select(
          "id, scope, kind, content, structured_detail, epistemic_status, supersedes_claim_id, superseded_by_claim_id, created_at, updated_at",
        )
        .eq("owner_user_id", ownerUserId)
        .eq("pursuit_id", pursuitId)
        .is("superseded_by_claim_id", null)
        .order("created_at", { ascending: false })
        .limit(SITUATION_LIMITS.claims),
      supabase
        .from("decision")
        .select(
          "id, kind, status, predecessor_decision_id, chosen_option_id, resolution_actor_type, resolution_rationale, resolved_at, structured_context, created_at, updated_at",
        )
        .eq("owner_user_id", ownerUserId)
        .eq("pursuit_id", pursuitId)
        .order("updated_at", { ascending: false })
        .limit(SITUATION_LIMITS.decisions),
      supabase
        .from("action")
        .select(
          "id, execution_mode, originating_decision_id, originating_decision_option_id, predecessor_action_id, intent_summary, intent_parameters, status, created_at, updated_at, terminal_at",
        )
        .eq("owner_user_id", ownerUserId)
        .eq("pursuit_id", pursuitId)
        .order("updated_at", { ascending: false })
        .limit(SITUATION_LIMITS.actions),
      supabase
        .from("event")
        .select(
          "id, entity_type, entity_id, event_type, occurred_at, actor_type, actor_id, payload",
        )
        .eq("owner_user_id", ownerUserId)
        .order("occurred_at", { ascending: false })
        .limit(SITUATION_LIMITS.events),
    ]);

  if (claimsResult.error || decisionsResult.error || actionsResult.error || eventsResult.error) {
    return { situation: null, error: "Unable to assemble situation" };
  }

  const pursuitEntityIds = new Set<string>([
    pursuitId,
    ...((claimsResult.data ?? []).map((claim) => claim.id)),
    ...((decisionsResult.data ?? []).map((decision) => decision.id)),
    ...((actionsResult.data ?? []).map((action) => action.id)),
  ]);

  const relevantEvents = (eventsResult.data ?? []).filter((event) =>
    pursuitEntityIds.has(event.entity_id),
  );

  return {
    situation: {
      generated_at: new Date().toISOString(),
      pursuit,
      claims: claimsResult.data ?? [],
      decisions: decisionsResult.data ?? [],
      actions: actionsResult.data ?? [],
      events: relevantEvents,
    },
    error: null,
  };
}
