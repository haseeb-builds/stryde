import assert from "node:assert/strict";
import test from "node:test";
import { createFirecrawlSourceProvider } from "../lib/source-provider.ts";
import { ingestPastedSource, ingestUrlSource, assertPublicHttpUrl } from "../lib/source-ingestion.ts";
import { buildSourceCitation } from "../lib/source-citation.ts";

function response(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

test("Firecrawl adapter returns normalized content and provenance", async () => {
  const provider = createFirecrawlSourceProvider({ apiKey: "secret", version: "v1", fetchImpl: async (_url, init) => {
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer secret");
    return response({ success: true, id: "job-123", data: { markdown: "  Extracted text  ", metadata: { sourceURL: "https://example.com/final", title: "Example", contentType: "text/html" } } }, 200, { "x-request-id": "req-1" });
  } });
  const result = await provider.extractPublicUrl({ url: "https://example.com" });
  assert.deepEqual(result, { finalUrl: "https://example.com/final", title: "Example", contentType: "text/html", content: "Extracted text", status: "FETCHED", provider: "firecrawl", providerVersion: "v1", requestId: "req-1", metadata: { provider_metadata: { sourceURL: "https://example.com/final", title: "Example", contentType: "text/html" } } });
});

test("Firecrawl failures and malformed responses remain mechanical failures", async () => {
  const failed = createFirecrawlSourceProvider({ apiKey: "secret", fetchImpl: async () => response({ error: "no" }, 502) });
  assert.equal((await failed.extractPublicUrl({ url: "https://example.com" })).status, "FAILED");
  const malformed = createFirecrawlSourceProvider({ apiKey: "secret", fetchImpl: async () => new Response("not-json", { status: 200 }) });
  assert.equal((await malformed.extractPublicUrl({ url: "https://example.com" })).status, "FAILED");
});

test("public URL validation rejects private, local, and non-standard targets", async () => {
  await assert.rejects(assertPublicHttpUrl("http://127.0.0.1"), /private|local/i);
  await assert.rejects(assertPublicHttpUrl("http://localhost"), /private|local/i);
  await assert.rejects(assertPublicHttpUrl("https://example.com:8443"), /standard/);
});

test("pasted source remains local and does not invoke a provider", async () => {
  const result = await ingestPastedSource({ content: "  pasted material  ", title: "Notes" });
  assert.equal(result.sourceKind, "PASTED");
  assert.equal(result.contentText, "pasted material");
  assert.equal(result.sourceMetadata.ingestion, "PASTED");
  assert.equal(result.sourceMetadata.provider, undefined);
});

test("provider output is extraction data only", async () => {
  const provider = createFirecrawlSourceProvider({ apiKey: "secret", fetchImpl: async () => response({ success: true, data: { markdown: "claim-like text" } }) });
  const result = await provider.extractPublicUrl({ url: "https://example.com" });
  assert.equal(result.content, "claim-like text");
  assert.equal((result as Record<string, unknown>).claim, undefined);
});

test("citations preserve snapshot identity, exact locator, and basis", () => {
  const citation = buildSourceCitation({ content: "alpha\nbeta", contentSha256: "hash-1", statement: "alpha", basis: "EXPLICIT_SOURCE" });
  assert.deepEqual(citation.locator, { type: "CHARACTER_RANGE", start: 0, end: 5, located: true });
  assert.equal(citation.source_content_sha256, "hash-1");
  assert.equal(citation.basis, "EXPLICIT_SOURCE");
  const inferred = buildSourceCitation({ content: "same", contentSha256: "hash-2", statement: "inferred conflict", basis: "INFERRED" });
  assert.notEqual(citation.source_content_sha256, inferred.source_content_sha256);
  assert.equal(inferred.basis, "INFERRED");
});

// --- URL ingestion through the page-fetch renderers ---
// The IP-literal URL keeps assertPublicHttpUrl's DNS step offline (node
// resolves IP literals without a network query).

const LISTING_HTML = "<html><head><title>t</title></head><body><h1>Studio Apartment</h1><p>" + "Details about the listing. ".repeat(40) + "</p></body></html>";
const SPA_SHELL = '<html><head><script>var state={hydrated:false};</script></head><body><div id="root"></div></body></html>';

function routedFetch(direct: () => Promise<Response>, scrape?: (url: unknown, init?: RequestInit) => Promise<Response>): typeof fetch {
  return (async (url: unknown, init?: RequestInit) => {
    if (String(url).includes("api.firecrawl.dev")) {
      if (!scrape) throw new Error("scrape endpoint must not be called");
      return scrape(url, init);
    }
    return direct();
  }) as typeof fetch;
}

test("URL ingestion extracts readable text through the direct renderer", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", routedFetch(async () => new Response(LISTING_HTML, { status: 200 })));
  try {
    const result = await ingestUrlSource("https://93.184.216.34/listing");
    assert.equal(result.sourceKind, "URL");
    assert.equal(result.fetchStatus, "FETCHED");
    assert.equal(result.sourceMetadata.renderer, "DIRECT");
    assert.equal(result.uri, "https://93.184.216.34/listing");
    assert.ok(result.contentText && result.contentText.includes("Studio Apartment"), "content is extracted text");
    assert.ok(!result.contentText.includes("<h1>"), "raw tags never become source content");
    assert.ok(result.contentSha256);
    assert.equal(result.sourceMetadata.truncated, false);
    assert.equal(fetchMock.mock.calls.length, 1, "no Firecrawl call for a rich direct body");
  } finally {
    fetchMock.mock.restore();
  }
});

test("a thin JS-rendered shell is re-observed through Firecrawl when a key is configured", async (t) => {
  const previous = process.env.FIRECRAWL_API_KEY;
  process.env.FIRECRAWL_API_KEY = "test-key";
  const fetchMock = t.mock.method(globalThis, "fetch", routedFetch(
    async () => new Response(SPA_SHELL, { status: 200 }),
    async () => response({ success: true, data: { markdown: "Rendered listing text." } }),
  ));
  try {
    const result = await ingestUrlSource("https://93.184.216.34/spa");
    assert.equal(result.fetchStatus, "FETCHED");
    assert.equal(result.sourceMetadata.renderer, "FIRECRAWL");
    assert.equal(result.contentType, "text/markdown");
    assert.equal(result.contentText, "Rendered listing text.");
    assert.equal(fetchMock.mock.calls.length, 2);
  } finally {
    fetchMock.mock.restore();
    if (previous === undefined) delete process.env.FIRECRAWL_API_KEY; else process.env.FIRECRAWL_API_KEY = previous;
  }
});

test("an origin error status is an honest FAILED source without content", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", routedFetch(async () => new Response("gone", { status: 404 })));
  try {
    const result = await ingestUrlSource("https://93.184.216.34/gone");
    assert.equal(result.fetchStatus, "FAILED");
    assert.equal(result.contentText, null);
    assert.equal(result.contentSha256, null);
    assert.equal(result.sourceMetadata.error, "HTTP 404");
  } finally {
    fetchMock.mock.restore();
  }
});

test("content beyond the 120k cap is PARTIAL and truncated", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", routedFetch(async () => new Response("<p>" + "word ".repeat(40_000) + "</p>", { status: 200 })));
  try {
    const result = await ingestUrlSource("https://93.184.216.34/huge");
    assert.equal(result.fetchStatus, "PARTIAL");
    assert.equal(result.contentText?.length, 120_000);
    assert.equal(result.sourceMetadata.truncated, true);
  } finally {
    fetchMock.mock.restore();
  }
});

test("an SSRF-rejected URL never reaches any fetch", async (t) => {
  let fetched = false;
  const fetchMock = t.mock.method(globalThis, "fetch", (async () => { fetched = true; return new Response("secret"); }) as typeof fetch);
  try {
    await assert.rejects(ingestUrlSource("http://localhost/listing"), /private|local/i);
    assert.equal(fetched, false);
  } finally {
    fetchMock.mock.restore();
  }
});
