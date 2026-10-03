import type { SupabaseClient } from "@supabase/supabase-js";
// Relative .ts import (not the @/ alias): this module is exercised under
// node --experimental-strip-types by the tests, which cannot resolve tsconfig
// path aliases.
import { getSearchProviderChain, type SearchProvider } from "./search-provider.ts";

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
  observationSupabase?: SupabaseClient,
): Promise<ResearchExecution> {
  const normalizedQuery = query.trim().slice(0, 1_000);
  if (!normalizedQuery) throw new Error("Research query is empty");

  // Providers are tried in the configured order and the first successful CALL
  // serves the research. A leg failing at call time (429/402/5xx/network)
  // moves the request to the next configured leg; with a single key configured
  // the chain has one entry, which is exactly the previous behavior.
  const chain = getSearchProviderChain();
  if (!chain.length) throw new Error("Missing research configuration: EXA_API_KEY or FIRECRAWL_API_KEY");

  let provider: SearchProvider | null = null;
  let result: Awaited<ReturnType<SearchProvider["search"]>> | null = null;
  let lastError: unknown = null;
  for (const candidate of chain) {
    try {
      result = await candidate.search({ query: normalizedQuery, maxResults: 5 });
      provider = candidate;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!provider || !result) {
    throw lastError instanceof Error ? lastError : new Error("No configured search provider could serve the research");
  }

  const observationPayload = {
    query: normalizedQuery,
    provider: provider.name,
    results: result.results,
    provider_metadata: result.providerMetadata,
  };

  // Observations are trusted-plane writes: the persistence hardening removed
  // owner INSERT on observation (migration 20260915000200), so this must run
  // with the service client the caller supplies. Recording through the user's
  // client silently loses the evidence (the insert violates RLS), which is
  // worse than failing: research results would never reach the situation.
  const observationClient = observationSupabase ?? supabase;
  const { data: observation, error: observationError } = await observationClient
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
  if (observationError || !observation) {
    throw new Error(observationError?.message ?? "Unable to record the research observation");
  }

  return {
    query: normalizedQuery,
    provider: provider.name,
    results: result.results,
    observation_id: observation.id,
  };
}
