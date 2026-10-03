import assert from "node:assert/strict";
import test from "node:test";
import { fetchPageText } from "../lib/page-fetch.ts";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const RICH_BODY = "<html><body>" + "<p>Plenty of readable listing content. </p>".repeat(50) + "</body></html>";
const THIN_BODY = '<html><head><script>var state={hydrated:false};</script></head><body><div id="root"></div></body></html>';

// Routes calls by URL: the target URL goes to `direct`, anything on
// api.firecrawl.dev goes to `scrape`. Records every call URL in `log`.
function routedFetch(direct: () => Promise<Response>, scrape?: (url: unknown, init?: RequestInit) => Promise<Response>, log?: string[]): typeof fetch {
  return (async (url: unknown, init?: RequestInit) => {
    const target = String(url);
    log?.push(target);
    if (target.includes("api.firecrawl.dev")) {
      if (!scrape) throw new Error("scrape endpoint must not be called");
      return scrape(url, init);
    }
    return direct();
  }) as typeof fetch;
}

test("a rich direct body is returned as-is without calling Firecrawl", async () => {
  const log: string[] = [];
  const result = await fetchPageText("https://example.com/page", {
    fetchImpl: routedFetch(async () => new Response(RICH_BODY, { status: 200 }), undefined, log),
    firecrawlApiKey: "test-key",
  });
  assert.equal(log.length, 1, "only the direct fetch must happen");
  assert.equal(result.renderer, "DIRECT");
  assert.equal(result.status, 200);
  assert.equal(result.text, RICH_BODY);
  assert.equal(result.error, null);
});

test("a thin JS-rendered shell is re-observed through the Firecrawl scrape when a key is configured", async () => {
  const log: string[] = [];
  // Holder object: the scrape closure assigns from inside a callback, which
  // TypeScript's control-flow analysis cannot see through.
  const scrapeRequest: { current: { url: string; auth: string; body: Record<string, unknown> } | null } = { current: null };
  const result = await fetchPageText("https://example.com/spa", {
    fetchImpl: routedFetch(
      async () => new Response(THIN_BODY, { status: 200 }),
      async (url, init) => {
        scrapeRequest.current = {
          url: String(url),
          auth: String((init?.headers as Record<string, string>).Authorization),
          body: JSON.parse(String(init?.body)),
        };
        return jsonResponse({ success: true, data: { markdown: "The Berlin Apartment is available from May." } });
      },
      log,
    ),
    firecrawlApiKey: "test-key",
  });
  assert.equal(log.length, 2, "direct fetch first, then the scrape");
  assert.ok(scrapeRequest.current && scrapeRequest.current.url.endsWith("/v1/scrape"));
  assert.equal(scrapeRequest.current.auth, "Bearer test-key");
  assert.deepEqual(scrapeRequest.current.body, { url: "https://example.com/spa", formats: ["markdown"] });
  assert.equal(result.renderer, "FIRECRAWL");
  assert.equal(result.status, 200);
  assert.equal(result.text, "The Berlin Apartment is available from May.");
  assert.equal(result.error, null);
});

test("a thin direct body stays DIRECT when no Firecrawl key is configured", async () => {
  const previous = process.env.FIRECRAWL_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;
  try {
    const log: string[] = [];
    const result = await fetchPageText("https://example.com/spa", {
      fetchImpl: routedFetch(async () => new Response(THIN_BODY, { status: 200 }), undefined, log),
    });
    assert.equal(log.length, 1, "no scrape without a key");
    assert.equal(result.renderer, "DIRECT");
    assert.equal(result.text, THIN_BODY);
    assert.equal(result.error, null);
  } finally {
    if (previous !== undefined) process.env.FIRECRAWL_API_KEY = previous;
  }
});

test("a failed scrape keeps the thin direct body with an honest error", async () => {
  const result = await fetchPageText("https://example.com/spa", {
    fetchImpl: routedFetch(
      async () => new Response(THIN_BODY, { status: 200 }),
      async () => jsonResponse({ error: "overloaded" }, 502),
    ),
    firecrawlApiKey: "test-key",
  });
  assert.equal(result.renderer, "DIRECT");
  assert.equal(result.status, 200);
  assert.equal(result.text, THIN_BODY);
  assert.ok(result.error && result.error.includes("Firecrawl scrape failed (HTTP 502)"));
});

test("a scrape returning success:false or empty markdown counts as a failed scrape", async () => {
  for (const payload of [{ success: false, data: { markdown: "no" } }, { success: true, data: { markdown: "   " } }]) {
    const result = await fetchPageText("https://example.com/spa", {
      fetchImpl: routedFetch(
        async () => new Response(THIN_BODY, { status: 200 }),
        async () => jsonResponse(payload),
      ),
      firecrawlApiKey: "test-key",
    });
    assert.equal(result.renderer, "DIRECT");
    assert.equal(result.text, THIN_BODY);
    assert.ok(result.error && result.error.includes("Firecrawl scrape"));
  }
});

test("a direct network failure is retried through Firecrawl when configured", async () => {
  const result = await fetchPageText("https://example.com/down", {
    fetchImpl: routedFetch(
      async () => { throw new Error("getaddrinfo ENOTFOUND example.com"); },
      async () => jsonResponse({ success: true, data: { markdown: "Rendered after direct failure." } }),
    ),
    firecrawlApiKey: "test-key",
  });
  assert.equal(result.renderer, "FIRECRAWL");
  assert.equal(result.status, 200);
  assert.equal(result.text, "Rendered after direct failure.");
  assert.equal(result.error, null);
});

test("a direct network failure without a key is an honest empty observation", async () => {
  const result = await fetchPageText("https://example.com/down", {
    fetchImpl: routedFetch(async () => { throw new Error("getaddrinfo ENOTFOUND example.com"); }),
  });
  assert.equal(result.renderer, "DIRECT");
  assert.equal(result.text, "");
  assert.equal(result.status, null);
  assert.ok(result.error && result.error.includes("ENOTFOUND"));
});

test("when both legs fail, both failures are reported", async () => {
  const result = await fetchPageText("https://example.com/down", {
    fetchImpl: routedFetch(
      async () => { throw new Error("connection refused"); },
      async () => jsonResponse({ error: "nope" }, 500),
    ),
    firecrawlApiKey: "test-key",
  });
  assert.equal(result.text, "");
  assert.ok(result.error && result.error.includes("connection refused"));
  assert.ok(result.error && result.error.includes("Firecrawl scrape failed (HTTP 500)"));
});

test("an origin error status is reported without a scrape attempt", async () => {
  const log: string[] = [];
  const result = await fetchPageText("https://example.com/gone", {
    fetchImpl: routedFetch(async () => new Response("not found", { status: 404 }), async () => jsonResponse({ success: true, data: { markdown: "rescued" } }), log),
    firecrawlApiKey: "test-key",
  });
  assert.equal(log.length, 1, "the origin answered definitively; Firecrawl must not override it");
  assert.equal(result.renderer, "DIRECT");
  assert.equal(result.status, 404);
  assert.equal(result.text, "");
  assert.equal(result.error, "HTTP 404");
});

test("render:true forces the scrape even for a rich direct body", async () => {
  const log: string[] = [];
  const rendered = await fetchPageText("https://example.com/page", {
    fetchImpl: routedFetch(
      async () => new Response(RICH_BODY, { status: 200 }),
      async () => jsonResponse({ success: true, data: { markdown: "Rendered on request." } }),
      log,
    ),
    firecrawlApiKey: "test-key",
    render: true,
  });
  assert.equal(log.length, 2);
  assert.equal(rendered.renderer, "FIRECRAWL");
  assert.equal(rendered.text, "Rendered on request.");

  const unrendered = await fetchPageText("https://example.com/page", {
    fetchImpl: routedFetch(async () => new Response(RICH_BODY, { status: 200 }), undefined, []),
    firecrawlApiKey: "test-key",
  });
  assert.equal(unrendered.renderer, "DIRECT");
});

test("an aborted direct request is reported as a timeout", async () => {
  const aborted = new Error("This operation was aborted");
  aborted.name = "AbortError";
  const result = await fetchPageText("https://example.com/slow", {
    fetchImpl: routedFetch(async () => { throw aborted; }),
  });
  assert.equal(result.text, "");
  assert.ok(result.error && result.error.includes("timed out"));
});

test("the direct body is capped at 500k chars before any matching consumer sees it", async () => {
  const result = await fetchPageText("https://example.com/huge", {
    fetchImpl: routedFetch(async () => new Response("x".repeat(500_010), { status: 200 })),
  });
  assert.equal(result.text.length, 500_000);
  assert.equal(result.renderer, "DIRECT");
});
