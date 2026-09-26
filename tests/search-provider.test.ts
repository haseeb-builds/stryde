import assert from "node:assert/strict";
import test from "node:test";
import { createExaSearchProvider, getExaSearchProvider } from "../lib/search-provider.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("Exa adapter returns bounded ranked mechanical results", async () => {
  let requestBody: Record<string, unknown> = {};
  const provider = createExaSearchProvider({ apiKey: "secret", fetchImpl: async (_url, init) => { requestBody = JSON.parse(String(init?.body)); return json({ requestId: "req-1", results: [{ id: "a", url: "https://a.example", title: "A", publishedDate: "2026-01-01", highlights: ["snippet"] }, { url: "https://b.example", title: "B" }] }); } });
  const result = await provider.search({ query: "question", maxResults: 1 });
  assert.equal(requestBody.numResults, 1); assert.equal(result.results.length, 1); assert.equal(result.results[0].rank, 1); assert.equal(result.results[0].url, "https://a.example"); assert.equal(result.providerMetadata.request_id, "req-1");
});

test("Exa adapter rejects malformed responses and propagates provider failures/cancellation", async () => {
  const malformed = createExaSearchProvider({ apiKey: "secret", fetchImpl: async () => json({ results: [{ title: "missing url" }] }) });
  await assert.rejects(malformed.search({ query: "q", maxResults: 2 }), /invalid result/);
  const failed = createExaSearchProvider({ apiKey: "secret", fetchImpl: async () => json({}, 503) });
  await assert.rejects(failed.search({ query: "q", maxResults: 2 }), /failed \(503\)/);
  const controller = new AbortController(); const cancelled = createExaSearchProvider({ apiKey: "secret", fetchImpl: async (_url, init) => { assert.equal(init?.signal, controller.signal); throw new DOMException("Aborted", "AbortError"); } });
  await assert.rejects(cancelled.search({ query: "q", maxResults: 2, signal: controller.signal }), /Aborted/);
});

test("search results are references and do not contain canonical mutations", async () => {
  const provider = createExaSearchProvider({ apiKey: "secret", fetchImpl: async () => json({ results: [{ url: "https://example.com", title: "Reference", highlights: ["text"] }] }) });
  const result = await provider.search({ query: "q", maxResults: 1 });
  assert.equal((result.results[0] as Record<string, unknown>).claim, undefined);
  assert.equal((result.results[0] as Record<string, unknown>).working_state, undefined);
});

test("search provider configuration rejects a non-Exa provider", () => {
  const previous = process.env.STRYDE_SEARCH_PROVIDER;
  process.env.STRYDE_SEARCH_PROVIDER = "other";
  assert.throws(() => getExaSearchProvider(), /Unsupported STRYDE_SEARCH_PROVIDER/);
  if (previous === undefined) delete process.env.STRYDE_SEARCH_PROVIDER; else process.env.STRYDE_SEARCH_PROVIDER = previous;
});
