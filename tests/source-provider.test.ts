import assert from "node:assert/strict";
import test from "node:test";
import { createFirecrawlSourceProvider } from "../lib/source-provider.ts";
import { ingestPastedSource, assertPublicHttpUrl } from "../lib/source-ingestion.ts";
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
  assert.deepEqual(citation.locator, { type: "CHARACTER_RANGE", start: 0, end: 10 });
  assert.equal(citation.source_content_sha256, "hash-1");
  assert.equal(citation.basis, "EXPLICIT_SOURCE");
  const inferred = buildSourceCitation({ content: "same", contentSha256: "hash-2", statement: "inferred conflict", basis: "INFERRED" });
  assert.notEqual(citation.source_content_sha256, inferred.source_content_sha256);
  assert.equal(inferred.basis, "INFERRED");
});
