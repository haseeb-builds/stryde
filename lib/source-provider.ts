export type SourceProviderResult = {
  finalUrl: string | null;
  title: string | null;
  contentType: string | null;
  content: string | null;
  status: "FETCHED" | "PARTIAL" | "FAILED" | "UNSUPPORTED";
  provider: string;
  providerVersion: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
};

export type SourceProvider = {
  name: string;
  extractPublicUrl(input: { url: string; signal?: AbortSignal }): Promise<SourceProviderResult>;
};

type FirecrawlResponse = {
  success?: unknown;
  id?: unknown;
  data?: { markdown?: unknown; html?: unknown; metadata?: Record<string, unknown> };
};

export function createFirecrawlSourceProvider(input: { apiKey: string; baseUrl?: string; fetchImpl?: typeof fetch; version?: string | null }): SourceProvider {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = (input.baseUrl ?? "https://api.firecrawl.dev/v1").replace(/\/$/, "");
  return {
    name: "firecrawl",
    async extractPublicUrl({ url, signal }) {
      const response = await fetchImpl(`${baseUrl}/scrape`, {
        method: "POST",
        headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
        signal: signal ?? AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      const requestId = response.headers.get("x-request-id") ?? response.headers.get("x-firecrawl-request-id");
      if (!response.ok) return { finalUrl: url, title: null, contentType: null, content: null, status: "FAILED", provider: "firecrawl", providerVersion: input.version ?? null, requestId, metadata: { http_status: response.status } };
      let payload: FirecrawlResponse;
      try { payload = await response.json() as FirecrawlResponse; } catch { return { finalUrl: url, title: null, contentType: null, content: null, status: "FAILED", provider: "firecrawl", providerVersion: input.version ?? null, requestId, metadata: { reason: "malformed provider response" } }; }
      const data = payload.data;
      const markdown = typeof data?.markdown === "string" ? data.markdown.trim() : "";
      const metadata = data?.metadata ?? {};
      const finalUrl = typeof metadata.sourceURL === "string" ? metadata.sourceURL : url;
      const title = typeof metadata.title === "string" ? metadata.title.trim().slice(0, 500) || null : null;
      const contentType = typeof metadata.contentType === "string" ? metadata.contentType : "text/markdown";
      if (payload.success === false || !markdown) return { finalUrl, title, contentType, content: null, status: "FAILED", provider: "firecrawl", providerVersion: input.version ?? null, requestId: requestId ?? (typeof payload.id === "string" ? payload.id : null), metadata: { provider_status: payload.success === false ? "failed" : "empty" } };
      return { finalUrl, title, contentType, content: markdown, status: "FETCHED", provider: "firecrawl", providerVersion: input.version ?? null, requestId: requestId ?? (typeof payload.id === "string" ? payload.id : null), metadata: { provider_metadata: metadata } };
    },
  };
}

export function getFirecrawlSourceProvider(): SourceProvider {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing source configuration: FIRECRAWL_API_KEY");
  return createFirecrawlSourceProvider({ apiKey, version: process.env.FIRECRAWL_API_VERSION?.trim() || null });
}
