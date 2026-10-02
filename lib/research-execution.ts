import type { SupabaseClient } from "@supabase/supabase-js";
import { getExaSearchProvider } from "@/lib/search-provider";

export type ResearchExecution = {
  query: string;
  provider: string;
  results: Array<{
    url: string;
    title: string | null;
    rank: number;
    publishedAt: string | null;
    highlights: string[];
    providerMetadata: Record<string, unknown>;
  }>;
  observation_id: string | null;
};

export async function executeWebResearch(
  supabase: SupabaseClient,
  ownerUserId: string,
  pursuitId: string,
  query: string,
): Promise<ResearchExecution> {
  const normalizedQuery = query.trim().slice(0, 1_000);
  if (!normalizedQuery) throw new Error("Research query is empty");

  const provider = getExaSearchProvider();
  const result = await provider.search({
    query: normalizedQuery,
    maxResults: 5,
  });

  const observationPayload = {
    query: normalizedQuery,
    provider: provider.name,
    results: result.results,
    provider_metadata: result.providerMetadata,
  };

  const { data: observation } = await supabase
    .from("observation")
    .insert({
      owner_user_id: ownerUserId,
      observation_kind: "WEB_SEARCH_RESULT",
      content: observationPayload,
      raw_payload: observationPayload,
      observed_at: new Date().toISOString(),
      source_type: "WEB_SEARCH",
      source_reference: result.providerMetadata.request_id ?? provider.name,
      source_metadata: {
        query: normalizedQuery,
        provider: provider.name,
        result_count: result.results.length,
      },
    })
    .select("id")
    .single();

  return {
    query: normalizedQuery,
    provider: provider.name,
    results: result.results,
    observation_id: observation?.id ?? null,
  };
}
