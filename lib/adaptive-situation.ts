import type { SupabaseClient } from "@supabase/supabase-js";
import { assembleSituation, type Situation } from "@/lib/situation";

export type MemoryEpisode = {
  session_id: string;
  title: string | null;
  status: string;
  updated_at: string;
  latest_user_message: string | null;
  latest_stryde_message: string | null;
};

export type AdaptiveSituation = Situation & {
  sources: unknown[];
  source_adaptations: unknown[];
  observations: unknown[];
  episodic_memory: MemoryEpisode[];
};

export async function assembleAdaptiveSituation(
  supabase: SupabaseClient,
  ownerUserId: string,
  pursuitId: string,
): Promise<{ situation: AdaptiveSituation | null; error: string | null }> {
  const base = await assembleSituation(supabase, ownerUserId, pursuitId);
  if (base.error || !base.situation) return { situation: null, error: base.error ?? "Unable to assemble Situation" };

  const [sourcesResult, actionsResult, observationsResult, sessionsResult] = await Promise.all([
    supabase
      .from("pursuit_source")
      .select("id, source_kind, uri, title, content_type, fetch_status, content_sha256, source_metadata, created_at, updated_at")
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
    supabase
      .from("conversation_session")
      .select("id, title, status, updated_at")
      .eq("owner_user_id", ownerUserId)
      .eq("pursuit_id", pursuitId)
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  if (sourcesResult.error || actionsResult.error || observationsResult.error || sessionsResult.error) {
    return { situation: null, error: "Unable to assemble adaptive Situation" };
  }

  const sourceRows = sourcesResult.data ?? [];
  const sourceUris = new Set(
    sourceRows.map((source) => source.uri).filter((value): value is string => typeof value === "string"),
  );
  const actionIds = new Set((actionsResult.data ?? []).map((action) => action.id as string));
  const observations = (observationsResult.data ?? []).filter((observation) => {
    const content = observation.content;
    if (typeof content === "object" && content !== null && "action_id" in content) {
      return typeof content.action_id === "string" && actionIds.has(content.action_id);
    }
    return typeof observation.source_uri === "string" && sourceUris.has(observation.source_uri);
  });

  let adaptations: unknown[] = [];
  const sourceIds = sourceRows.map((source) => source.id);
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

  const sessionIds = (sessionsResult.data ?? []).map((session) => session.id as string);
  const memoryMessagesResult = sessionIds.length
    ? await supabase
        .from("conversation_message")
        .select("session_id, role, content, sequence_no")
        .eq("owner_user_id", ownerUserId)
        .in("session_id", sessionIds)
        .order("sequence_no", { ascending: false })
        .limit(64)
    : { data: [], error: null };

  if (memoryMessagesResult.error) return { situation: null, error: "Unable to load episodic memory" };

  const bySession = new Map<string, { user: string | null; stryde: string | null }>();
  for (const message of memoryMessagesResult.data ?? []) {
    const current = bySession.get(message.session_id) ?? { user: null, stryde: null };
    const excerpt = message.content.trim().slice(0, 2_000);
    if (message.role === "USER" && !current.user) current.user = excerpt;
    if (message.role === "STRYDE" && !current.stryde) current.stryde = excerpt;
    bySession.set(message.session_id, current);
  }

  const episodicMemory: MemoryEpisode[] = (sessionsResult.data ?? []).map((session) => {
    const messages = bySession.get(session.id) ?? { user: null, stryde: null };
    return {
      session_id: session.id,
      title: session.title,
      status: session.status,
      updated_at: session.updated_at,
      latest_user_message: messages.user,
      latest_stryde_message: messages.stryde,
    };
  });

  return {
    situation: {
      ...base.situation,
      sources: sourceRows,
      source_adaptations: adaptations,
      observations,
      episodic_memory: episodicMemory,
    },
    error: null,
  };
}
