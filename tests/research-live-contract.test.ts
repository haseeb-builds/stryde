import assert from "node:assert/strict";
import test from "node:test";
import {
  createExaSearchProvider,
  createFirecrawlSearchProvider,
  getSearchProviderChain,
  getSearchProvider,
} from "../lib/search-provider.ts";

test("research contract: Exa search provider parses and normalizes result attributes", async () => {
  const mockFetch = async () => {
    return new Response(
      JSON.stringify({
        requestId: "req-exa-1234",
        results: [
          {
            url: "https://example.com/system-design",
            title: "System Design for Real-World Reliability",
            publishedDate: "2026-03-15T00:00:00Z",
            highlights: [
              "Grounded observation loops keep systems aligned with reality.",
              "Explicit action approvals prevent unintended state changes.",
            ],
            score: 0.94,
            id: "exa-doc-1",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const provider = createExaSearchProvider({
    apiKey: "test-exa-key",
    fetchImpl: mockFetch as unknown as typeof fetch,
  });

  const { results, providerMetadata } = await provider.search({
    query: "real-world reliability",
    maxResults: 5,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].url, "https://example.com/system-design");
  assert.equal(results[0].title, "System Design for Real-World Reliability");
  assert.equal(results[0].rank, 1);
  assert.equal(results[0].publishedAt, "2026-03-15T00:00:00Z");
  assert.equal(results[0].highlights.length, 2);
  assert.equal(providerMetadata.provider, "exa");
  assert.equal(providerMetadata.request_id, "req-exa-1234");
});

test("research contract: Firecrawl search provider parses markdown and request headers", async () => {
  const mockFetch = async () => {
    return new Response(
      JSON.stringify({
        success: true,
        data: [
          {
            url: "https://example.com/architecture-patterns",
            title: "Architecture Patterns 2026",
            description: "Modern decoupled architectures.",
            markdown: "# Modern Decoupled Systems\n\nEpistemic grounding is required.",
            metadata: {
              publishedTime: "2026-04-01T12:00:00Z",
              sourceURL: "https://example.com/architecture-patterns",
            },
          },
        ],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "x-firecrawl-request-id": "fc-req-5678",
        },
      }
    );
  };

  const provider = createFirecrawlSearchProvider({
    apiKey: "test-fc-key",
    fetchImpl: mockFetch as unknown as typeof fetch,
  });

  const { results, providerMetadata } = await provider.search({
    query: "decoupled architectures",
    maxResults: 3,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].url, "https://example.com/architecture-patterns");
  assert.equal(results[0].title, "Architecture Patterns 2026");
  assert.equal(results[0].publishedAt, "2026-04-01T12:00:00Z");
  assert.ok(results[0].highlights.length >= 1);
  assert.equal(providerMetadata.provider, "firecrawl");
  assert.equal(providerMetadata.request_id, "fc-req-5678");
});

test("research contract: fail-closed discipline when no search keys are configured", () => {
  const origExa = process.env.EXA_API_KEY;
  const origFc = process.env.FIRECRAWL_API_KEY;
  delete process.env.EXA_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;

  try {
    const chain = getSearchProviderChain();
    assert.deepEqual(chain, []);
    assert.throws(
      () => getSearchProvider(),
      /Missing research configuration: EXA_API_KEY or FIRECRAWL_API_KEY/
    );
  } finally {
    if (origExa) process.env.EXA_API_KEY = origExa;
    if (origFc) process.env.FIRECRAWL_API_KEY = origFc;
  }
});
