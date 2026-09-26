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
