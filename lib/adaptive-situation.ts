import type { SupabaseClient } from "@supabase/supabase-js";
import { assembleSituation, type Situation } from "@/lib/situation";

export type AdaptiveSituation = Situation & {
  sources: unknown[];
  source_adaptations: unknown[];
  observations: unknown[];
};

export async function assembleAdaptiveSituation(
  supabase: SupabaseClient,
  ownerUserId: string,
  pursuitId: string,
): Promise<{ situation: AdaptiveSituation | null; error: string | null }> {
  const base = await assembleSituation(supabase, ownerUserId, pursuitId);
  if (base.error || !base.situation) return { situation: null, error: base.error ?? "Unable to assemble Situation" };

  const [sourcesResult, actionsResult, observationsResult] = await Promise.all([
    supabase
      .from("pursuit_source")
      .select("id, source_kind, uri, title, content_type, fetch_status, content_text, content_sha256, source_metadata, created_at, updated_at")
      .eq("owner_user_id", ownerUserId)
      .eq("pursuit_id", pursuitId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("action")
      .select("id")
      .eq("owner_user_id", ownerUserId)
      .eq("pursuit_id", pursuitId)
      .limit(50),
    supabase
      .from("observation")
      .select("id, observation_kind, content, observed_at, source_type, source_reference, source_uri, source_metadata, created_at")
      .eq("owner_user_id", ownerUserId)
      .order("observed_at", { ascending: false })
      .limit(100),
  ]);

  if (sourcesResult.error || actionsResult.error || observationsResult.error) {
    return { situation: null, error: "Unable to assemble adaptive Situation" };
  }

  const sourceIds = (sourcesResult.data ?? []).map((source) => source.id);
  const actionIds = new Set((actionsResult.data ?? []).map((action) => action.id as string));
  const observations = (observationsResult.data ?? []).filter((observation) => {
    const content = observation.content;
    return typeof content === "object" && content !== null && "action_id" in content
      ? typeof content.action_id === "string" && actionIds.has(content.action_id)
      : observation.source_uri
        ? (sourcesResult.data ?? []).some((source) => source.uri === observation.source_uri)
        : false;
  });

  let adaptations: unknown[] = [];
  if (sourceIds.length) {
    const adaptationResult = await supabase
      .from("pursuit_source_adaptation")
      .select("id, source_id, version, status, summary, source_claims, methods, assumptions, prerequisites, expected_outcomes, unknowns, fit, conflicts, gaps, adapted_strategy, goal_candidates, provenance, created_at")
      .eq("owner_user_id", ownerUserId)
      .eq("pursuit_id", pursuitId)
      .in("source_id", sourceIds)
      .order("version", { ascending: false })
      .limit(50);
    if (adaptationResult.error) return { situation: null, error: "Unable to load source adaptations" };

    const latestBySource = new Map<string, unknown>();
    for (const adaptation of adaptationResult.data ?? []) {
      if (!latestBySource.has(adaptation.source_id)) latestBySource.set(adaptation.source_id, adaptation);
    }
    adaptations = [...latestBySource.values()];
  }

  return {
    situation: {
      ...base.situation,
      sources: sourcesResult.data ?? [],
      source_adaptations: adaptations,
      observations,
    },
    error: null,
  };
}
