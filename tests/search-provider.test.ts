import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createExaSearchProvider, createFirecrawlSearchProvider, getExaSearchProvider, getSearchProvider, getSearchProviderChain } from "../lib/search-provider.ts";
import { executeWebResearch } from "../lib/research-execution.ts";

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

test("Firecrawl search adapter returns bounded ranked mechanical results", async () => {
  let requestBody: Record<string, unknown> = {};
  let authHeader: string | null = null;
  let requestUrl = "";
  const provider = createFirecrawlSearchProvider({ apiKey: "secret", fetchImpl: async (url, init) => {
    requestUrl = String(url);
    authHeader = String((init?.headers as Record<string, string>).Authorization);
    requestBody = JSON.parse(String(init?.body));
    return json({ success: true, id: "job-9", data: [{ url: "https://a.example", title: "A", description: "snippet a", metadata: { publishedTime: "2026-01-01T00:00:00Z", sourceURL: "https://a.example" } }, { url: "https://b.example" }] });
  } });
  const result = await provider.search({ query: "question", maxResults: 1 });
  assert.equal(requestUrl, "https://api.firecrawl.dev/v1/search");
  assert.equal(authHeader, "Bearer secret");
  assert.deepEqual(requestBody, { query: "question", limit: 1 });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].rank, 1);
  assert.equal(result.results[0].url, "https://a.example");
  assert.equal(result.results[0].title, "A");
  assert.equal(result.results[0].publishedAt, "2026-01-01T00:00:00Z");
  assert.deepEqual(result.results[0].highlights, ["snippet a"]);
  assert.equal(result.providerMetadata.request_id, "job-9");
  assert.equal(result.providerMetadata.provider, "firecrawl");
});

test("Firecrawl search adapter rejects malformed responses and propagates provider failures", async () => {
  const malformed = createFirecrawlSearchProvider({ apiKey: "secret", fetchImpl: async () => json({ success: true, data: [{ title: "missing url" }] }) });
  await assert.rejects(malformed.search({ query: "q", maxResults: 2 }), /invalid result/);
  const notArray = createFirecrawlSearchProvider({ apiKey: "secret", fetchImpl: async () => json({ success: true, data: {} }) });
  await assert.rejects(notArray.search({ query: "q", maxResults: 2 }), /malformed results/);
  const badJson = createFirecrawlSearchProvider({ apiKey: "secret", fetchImpl: async () => new Response("not-json", { status: 200 }) });
  await assert.rejects(badJson.search({ query: "q", maxResults: 2 }), /malformed JSON/);
  const failed = createFirecrawlSearchProvider({ apiKey: "secret", fetchImpl: async () => json({}, 429) });
  await assert.rejects(failed.search({ query: "q", maxResults: 2 }), /failed \(429\)/);
});

function setEnv(overrides: Record<string, string | undefined>) {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(overrides)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  };
}

test("the provider chain orders the CONFIGURED legs by STRYDE_SEARCH_PROVIDER", () => {
  const restore = setEnv({ EXA_API_KEY: "exa-key", FIRECRAWL_API_KEY: "fc-key", STRYDE_SEARCH_PROVIDER: undefined });
  try {
    assert.deepEqual(getSearchProviderChain().map((p) => p.name), ["exa", "firecrawl"]);
    process.env.STRYDE_SEARCH_PROVIDER = "firecrawl";
    assert.deepEqual(getSearchProviderChain().map((p) => p.name), ["firecrawl", "exa"]);
    delete process.env.FIRECRAWL_API_KEY;
    assert.deepEqual(getSearchProviderChain().map((p) => p.name), ["exa"]);
    process.env.STRYDE_SEARCH_PROVIDER = "firecrawl";
    assert.deepEqual(getSearchProviderChain().map((p) => p.name), ["exa"], "a preferred but unconfigured leg is skipped, not fatal");
    process.env.STRYDE_SEARCH_PROVIDER = "other";
    assert.throws(() => getSearchProviderChain(), /Unsupported STRYDE_SEARCH_PROVIDER/);
  } finally {
    restore();
  }
});

test("getSearchProvider returns the preferred configured leg and refuses an empty configuration", () => {
  const restore = setEnv({ EXA_API_KEY: undefined, FIRECRAWL_API_KEY: undefined, STRYDE_SEARCH_PROVIDER: undefined });
  try {
    assert.throws(() => getSearchProvider(), /Missing research configuration/);
    process.env.EXA_API_KEY = "exa-key";
    assert.equal(getSearchProvider().name, "exa");
    process.env.FIRECRAWL_API_KEY = "fc-key";
    process.env.STRYDE_SEARCH_PROVIDER = "firecrawl";
    assert.equal(getSearchProvider().name, "firecrawl");
  } finally {
    restore();
  }
});

function fakeSupabase(label: string, log: string[]) {
  const builder = {
    insert: () => builder,
    select: () => builder,
    single: async () => ({ data: { id: `obs-${label}` }, error: null }),
  };
  return {
    client: {
      from: (table: string) => {
        log.push(`${label}:${table}`);
        return builder;
      },
    } as unknown as SupabaseClient,
  };
}

test("executeWebResearch falls through a failing preferred leg and records the serving provider on the trusted plane", async (t) => {
  const restore = setEnv({ EXA_API_KEY: "exa-key", FIRECRAWL_API_KEY: "fc-key", STRYDE_SEARCH_PROVIDER: undefined });
  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    if (String(url).startsWith("https://api.exa.ai")) return json({ error: "Over quota" }, 429);
    return json({ success: true, data: [{ url: "https://result.example", title: "Result", description: "snippet" }] });
  });
  try {
    const log: string[] = [];
    const { client } = fakeSupabase("service", log);
    const execution = await executeWebResearch(client, "user-1", "pursuit-1", "  chain question  ");
    assert.equal(execution.provider, "firecrawl", "the exa leg failed at call time; firecrawl served");
    assert.equal(execution.results.length, 1);
    assert.equal(execution.results[0].rank, 1);
    assert.equal(execution.results[0].url, "https://result.example");
    assert.equal(execution.observation_id, "obs-service");
    // Trusted-plane semantics: the insert goes through the client the caller
    // designated for observations (here the only client), on the observation
    // table, with the serving provider recorded in the payload.
    assert.deepEqual(log, ["service:observation"]);
    assert.equal(fetchMock.mock.calls.length, 2, "exa first, then firecrawl");
  } finally {
    restore();
  }
});

test("executeWebResearch records through observationSupabase when one is supplied", async (t) => {
  const restore = setEnv({ EXA_API_KEY: "exa-key", FIRECRAWL_API_KEY: undefined, STRYDE_SEARCH_PROVIDER: undefined });
  const fetchMock = t.mock.method(globalThis, "fetch", async () => json({ requestId: "req-7", results: [{ url: "https://a.example", title: "A" }] }));
  try {
    const log: string[] = [];
    const user = fakeSupabase("user", log);
    const service = fakeSupabase("service", log);
    const execution = await executeWebResearch(user.client, "user-1", "pursuit-1", "question", service.client);
    assert.equal(execution.provider, "exa");
    assert.equal(execution.observation_id, "obs-service");
    assert.deepEqual(log, ["service:observation"], "the user client must never be used for the observation insert");
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("executeWebResearch surfaces the last provider failure when every configured leg fails", async (t) => {
  const restore = setEnv({ EXA_API_KEY: "exa-key", FIRECRAWL_API_KEY: "fc-key", STRYDE_SEARCH_PROVIDER: "exa" });
  const fetchMock = t.mock.method(globalThis, "fetch", async () => json({}, 503));
  try {
    const { client } = fakeSupabase("service", []);
    await assert.rejects(
      executeWebResearch(client, "user-1", "pursuit-1", "question"),
      /failed \(503\)/,
    );
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});
