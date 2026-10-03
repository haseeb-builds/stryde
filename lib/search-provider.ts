export type SearchResult = {
  url: string;
  title: string | null;
  rank: number;
  publishedAt: string | null;
  highlights: string[];
  providerMetadata: Record<string, unknown>;
};

export type SearchProvider = {
  name: string;
  search(input: { query: string; maxResults: number; freshnessDays?: number; signal?: AbortSignal }): Promise<{ results: SearchResult[]; providerMetadata: Record<string, unknown> }>;
};

type ExaPayload = { results?: unknown; requestId?: unknown; autopromptString?: unknown };

export function createExaSearchProvider(input: { apiKey: string; baseUrl?: string; fetchImpl?: typeof fetch }): SearchProvider {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = (input.baseUrl ?? "https://api.exa.ai").replace(/\/$/, "");
  return {
    name: "exa",
    async search({ query, maxResults, freshnessDays, signal }) {
      const response = await fetchImpl(`${baseUrl}/search`, {
        method: "POST",
        headers: { "x-api-key": input.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ query, type: "auto", numResults: maxResults, ...(freshnessDays ? { startPublishedDate: new Date(Date.now() - freshnessDays * 86400000).toISOString() } : {}), contents: { highlights: { maxCharacters: 800 } } }),
        signal: signal ?? AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Search provider failed (${response.status})`);
      let payload: ExaPayload;
      try { payload = await response.json() as ExaPayload; } catch { throw new Error("Search provider returned malformed JSON"); }
      if (!Array.isArray(payload.results)) throw new Error("Search provider returned malformed results");
      const results = payload.results.slice(0, maxResults).map((item, index) => {
        if (!item || typeof item !== "object" || typeof (item as { url?: unknown }).url !== "string") throw new Error("Search provider returned an invalid result");
        const row = item as { url: string; title?: unknown; publishedDate?: unknown; highlights?: unknown; [key: string]: unknown };
        return { url: row.url, title: typeof row.title === "string" ? row.title : null, rank: index + 1, publishedAt: typeof row.publishedDate === "string" ? row.publishedDate : null, highlights: Array.isArray(row.highlights) ? row.highlights.filter((value): value is string => typeof value === "string").slice(0, 5) : [], providerMetadata: { id: typeof row.id === "string" ? row.id : null, score: typeof row.score === "number" ? row.score : null } };
      });
      return { results, providerMetadata: { provider: "exa", request_id: typeof payload.requestId === "string" ? payload.requestId : null } };
    },
  };
}

export function getExaSearchProvider(): SearchProvider {
  const configuredProvider = (process.env.STRYDE_SEARCH_PROVIDER ?? "exa").trim().toLowerCase();
  if (configuredProvider !== "exa") throw new Error(`Unsupported STRYDE_SEARCH_PROVIDER: ${configuredProvider}`);
  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing research configuration: EXA_API_KEY");
  return createExaSearchProvider({ apiKey });
}

type FirecrawlSearchPayload = { success?: unknown; data?: unknown; id?: unknown; requestId?: unknown };

export function createFirecrawlSearchProvider(input: { apiKey: string; baseUrl?: string; fetchImpl?: typeof fetch }): SearchProvider {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = (input.baseUrl ?? "https://api.firecrawl.dev").replace(/\/$/, "");
  return {
    name: "firecrawl",
    async search({ query, maxResults, signal }) {
      // Firecrawl /v1/search takes {query, limit} and has no freshness window,
      // so freshnessDays is mechanically unsupported on this leg; recency is
      // judged from each result's published date, never requested.
      const response = await fetchImpl(`${baseUrl}/v1/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: maxResults }),
        signal: signal ?? AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Search provider failed (${response.status})`);
      const headerRequestId = response.headers.get("x-request-id") ?? response.headers.get("x-firecrawl-request-id");
      let payload: FirecrawlSearchPayload;
      try { payload = await response.json() as FirecrawlSearchPayload; } catch { throw new Error("Search provider returned malformed JSON"); }
      if (!Array.isArray(payload.data)) throw new Error("Search provider returned malformed results");
      const results = payload.data.slice(0, maxResults).map((item, index) => {
        if (!item || typeof item !== "object" || typeof (item as { url?: unknown }).url !== "string") throw new Error("Search provider returned an invalid result");
        const row = item as { url: string; title?: unknown; description?: unknown; markdown?: unknown; metadata?: { publishedTime?: unknown; publishedDate?: unknown; sourceURL?: unknown }; [key: string]: unknown };
        const publishedAt = typeof row.metadata?.publishedTime === "string" ? row.metadata.publishedTime : typeof row.metadata?.publishedDate === "string" ? row.metadata.publishedDate : null;
        const highlights = [typeof row.description === "string" ? row.description : null, typeof row.markdown === "string" ? row.markdown.slice(0, 800) : null].filter((value): value is string => Boolean(value)).slice(0, 5);
        return { url: row.url, title: typeof row.title === "string" ? row.title : null, rank: index + 1, publishedAt, highlights, providerMetadata: { sourceURL: typeof row.metadata?.sourceURL === "string" ? row.metadata.sourceURL : null } };
      });
      return { results, providerMetadata: { provider: "firecrawl", request_id: headerRequestId ?? (typeof payload.requestId === "string" ? payload.requestId : typeof payload.id === "string" ? payload.id : null) } };
    },
  };
}

// Ordered chain over the CONFIGURED legs: Exa is configured iff EXA_API_KEY is
// present, Firecrawl iff FIRECRAWL_API_KEY. STRYDE_SEARCH_PROVIDER
// (= exa | firecrawl, default exa) chooses the preferred order, not
// exclusivity: when the preferred leg fails at call time (429/402/5xx/network)
// the caller may fall through to the other configured leg. With a single key
// present the chain holds exactly one entry, which is the previous
// single-provider behavior unchanged.
export function getSearchProviderChain(): SearchProvider[] {
  const preferred = (process.env.STRYDE_SEARCH_PROVIDER ?? "exa").trim().toLowerCase();
  if (preferred !== "exa" && preferred !== "firecrawl") throw new Error(`Unsupported STRYDE_SEARCH_PROVIDER: ${preferred}`);
  const exaKey = process.env.EXA_API_KEY?.trim();
  const firecrawlKey = process.env.FIRECRAWL_API_KEY?.trim();
  const exa = exaKey ? createExaSearchProvider({ apiKey: exaKey }) : null;
  const firecrawl = firecrawlKey ? createFirecrawlSearchProvider({ apiKey: firecrawlKey }) : null;
  if (preferred === "firecrawl") return [...(firecrawl ? [firecrawl] : []), ...(exa ? [exa] : [])];
  return [...(exa ? [exa] : []), ...(firecrawl ? [firecrawl] : [])];
}

export function getSearchProvider(): SearchProvider {
  const chain = getSearchProviderChain();
  if (!chain.length) throw new Error("Missing research configuration: EXA_API_KEY or FIRECRAWL_API_KEY");
  return chain[0];
}
