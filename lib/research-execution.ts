import type { SupabaseClient } from "@supabase/supabase-js";
// Relative .ts import (not the @/ alias): this module is exercised under
// node --experimental-strip-types by the tests, which cannot resolve tsconfig
// path aliases.
import { getSearchProviderChain, type SearchProvider } from "./search-provider.ts";
import { ingestUrlSource } from "./source-ingestion.ts";

export type RetrievedSourceInfo = {
  url: string;
  source_id: string | null;
  locator_type: "FULL_TEXT" | "PARTIAL_CONTENT" | "SNIPPET" | "INACCESSIBLE" | "TRANSCRIPT_UNAVAILABLE" | "PAYWALLED";
  content_locator: string;
  title: string | null;
  retrieved_at: string;
  primary_source_traced: boolean;
};

const PAYWALLED_DOMAINS_REGEX =
  /\b(sciencedirect\.com|link\.springer\.com|nature\.com|wiley\.com|ieeexplore\.ieee\.org|tandfonline\.com|nejm\.org|thelancet\.com|jamanetwork\.com|cell\.com|academic\.oup\.com|jstor\.org)\b/i;

const PAYWALLED_CONTENT_REGEX =
  /\b(subscribe to read|purchase this article|access through your institution|institutional access|paywall|subscription required|purchase access|article purchase|buy this article)\b/i;

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
  retrieved_sources: RetrievedSourceInfo[];
  observation_id: string | null;
};

export async function executeWebResearch(
  supabase: SupabaseClient,
  ownerUserId: string,
  pursuitId: string,
  query: string,
  observationSupabase?: SupabaseClient,
  signal?: AbortSignal,
): Promise<ResearchExecution> {
  const normalizedQuery = query.trim().slice(0, 1_000);
  if (!normalizedQuery) throw new Error("Research query is empty");

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

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
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      result = await candidate.search({ query: normalizedQuery, maxResults: 5, signal });
      provider = candidate;
      break;
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
    }
  }
  if (!provider || !result) {
    throw lastError instanceof Error ? lastError : new Error("No configured search provider could serve the research");
  }

  // Ingest top search results into pursuit_source safely using assertPublicHttpUrl/ingestUrlSource
  const retrievedSources: RetrievedSourceInfo[] = [];
  const topHits = (result.results ?? []).slice(0, 2);

  for (const hit of topHits) {
    if (!hit.url || signal?.aborted) continue;
    const isVideoOrAudio = /\b(youtube\.com|youtu\.be|vimeo\.com|spotify\.com|podcasts\.apple\.com)\b/i.test(hit.url);

    if (isVideoOrAudio) {
      retrievedSources.push({
        url: hit.url,
        source_id: null,
        locator_type: "TRANSCRIPT_UNAVAILABLE",
        content_locator: `${hit.url}#media`,
        title: hit.title ?? null,
        retrieved_at: new Date().toISOString(),
        primary_source_traced: false,
      });
      continue;
    }

    try {
      const isPaywalledDomain = PAYWALLED_DOMAINS_REGEX.test(hit.url);
      const ingested = await ingestUrlSource(hit.url);
      const isPaywalledContent = PAYWALLED_CONTENT_REGEX.test(ingested.contentText ?? "");

      if (isPaywalledDomain || isPaywalledContent) {
        retrievedSources.push({
          url: hit.url,
          source_id: null,
          locator_type: "PAYWALLED",
          content_locator: `${hit.url}#paywalled`,
          title: hit.title ?? ingested.title,
          retrieved_at: new Date().toISOString(),
          primary_source_traced: false,
        });
      } else if (ingested.fetchStatus === "FETCHED" || ingested.fetchStatus === "PARTIAL") {
        const { data: savedSource } = await supabase
          .from("pursuit_source")
          .insert({
            owner_user_id: ownerUserId,
            pursuit_id: pursuitId,
            source_kind: "URL",
            uri: ingested.uri,
            title: hit.title ?? ingested.title,
            content_type: ingested.contentType,
            fetch_status: ingested.fetchStatus,
            content_text: ingested.contentText,
            content_sha256: ingested.contentSha256,
            source_metadata: {
              ...ingested.sourceMetadata,
              ingestion: "AUTONOMOUS_RESEARCH_RETRIEVAL",
              query: normalizedQuery,
              rank: hit.rank,
            },
          })
          .select("id")
          .single();

        const locatorType: "FULL_TEXT" | "PARTIAL_CONTENT" =
          ingested.fetchStatus === "FETCHED" ? "FULL_TEXT" : "PARTIAL_CONTENT";

        retrievedSources.push({
          url: hit.url,
          source_id: savedSource?.id ?? null,
          locator_type: locatorType,
          content_locator: `${hit.url}#sha256:${ingested.contentSha256?.slice(0, 16) ?? "text"}`,
          title: hit.title ?? ingested.title,
          retrieved_at: new Date().toISOString(),
          primary_source_traced: locatorType === "FULL_TEXT",
        });
      } else {
        const locatorType = hit.highlights?.length ? "SNIPPET" : "INACCESSIBLE";
        retrievedSources.push({
          url: hit.url,
          source_id: null,
          locator_type: locatorType,
          content_locator: hit.url,
          title: hit.title ?? null,
          retrieved_at: new Date().toISOString(),
          primary_source_traced: false,
        });
      }
    } catch {
      const isPaywalledDomain = PAYWALLED_DOMAINS_REGEX.test(hit.url);
      const locatorType = isPaywalledDomain
        ? "PAYWALLED"
        : hit.highlights?.length
        ? "SNIPPET"
        : "INACCESSIBLE";
      retrievedSources.push({
        url: hit.url,
        source_id: null,
        locator_type: locatorType,
        content_locator: hit.url,
        title: hit.title ?? null,
        retrieved_at: new Date().toISOString(),
        primary_source_traced: false,
      });
    }
  }

  const observationPayload = {
    query: normalizedQuery,
    provider: provider.name,
    results: result.results,
    retrieved_sources: retrievedSources,
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
        retrieved_count: retrievedSources.filter((s) => s.locator_type === "FULL_TEXT" || s.locator_type === "PARTIAL_CONTENT").length,
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
    retrieved_sources: retrievedSources,
    observation_id: observation.id,
  };
}
