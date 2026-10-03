import assert from "node:assert/strict";
import test from "node:test";

import { executeVerificationCheck, relationForOutcome } from "../lib/verification-check.ts";

function fetchReturning(body: string, status = 200): typeof fetch {
  return (async () => new Response(body, { status })) as typeof fetch;
}

test("a page containing the expected text MATCHES with excerpt evidence", async () => {
  const result = await executeVerificationCheck({
    url: "https://example.com/listing",
    expectText: "Berlin Apartment",
    fetchImpl: fetchReturning(
      "<html><body>Welcome to the Berlin  Apartment listing page with photos and floor plans.</body></html>",
    ),
  });
  assert.equal(result.outcome, "MATCHED");
  assert.equal(result.httpStatus, 200);
  assert.equal(result.error, null);
  assert.ok(result.excerpt, "MATCHED must carry excerpt evidence");
  assert.ok(result.excerpt.includes("berlin apartment"));
});

test("a reachable page without the expected text MISMATCHES", async () => {
  const body = "q".repeat(400);
  const result = await executeVerificationCheck({
    url: "https://example.com/listing",
    expectText: "Berlin Apartment",
    fetchImpl: fetchReturning(body),
  });
  assert.equal(result.outcome, "MISMATCHED");
  assert.equal(result.httpStatus, 200);
  assert.equal(result.error, null);
  // Evidence excerpt: the first 240 chars of what was actually compared.
  assert.ok(result.excerpt, "MISMATCHED must carry excerpt evidence");
  assert.ok(result.excerpt.length <= 240);
  assert.ok(result.excerpt.startsWith("q"));
});

test("a fetch failure is UNREACHABLE, never a contradiction", async () => {
  const result = await executeVerificationCheck({
    url: "https://example.com/listing",
    expectText: "Berlin Apartment",
    fetchImpl: (async () => {
      throw new Error("getaddrinfo ENOTFOUND example.com");
    }) as typeof fetch,
  });
  assert.equal(result.outcome, "UNREACHABLE");
  assert.equal(result.httpStatus, null);
  assert.equal(result.excerpt, null);
  assert.ok(result.error && result.error.includes("ENOTFOUND"));
});

test("a server error page is UNREACHABLE with its HTTP status", async () => {
  const result = await executeVerificationCheck({
    url: "https://example.com/listing",
    expectText: "Berlin Apartment",
    fetchImpl: fetchReturning("<html><body>Internal Server Error</body></html>", 500),
  });
  assert.equal(result.outcome, "UNREACHABLE");
  assert.equal(result.httpStatus, 500);
  assert.equal(result.excerpt, null);
});

test("an aborted request is reported as a timeout", async () => {
  const aborted = new Error("This operation was aborted");
  aborted.name = "AbortError";
  const result = await executeVerificationCheck({
    url: "https://example.com/listing",
    expectText: "Berlin Apartment",
    fetchImpl: (async () => {
      throw aborted;
    }) as typeof fetch,
  });
  assert.equal(result.outcome, "UNREACHABLE");
  assert.ok(result.error && result.error.includes("timed out"));
});

test("matching is case-insensitive and whitespace-collapsed", async () => {
  const result = await executeVerificationCheck({
    url: "https://example.com/listing",
    expectText: "berlin\napartment",
    fetchImpl: fetchReturning("The BERLIN  Apartment is available from May."),
  });
  assert.equal(result.outcome, "MATCHED");
});

test("a body beyond the 500k cap is not searched", async () => {
  const beyondCap = "x".repeat(500_000) + "berlin apartment";
  const truncated = await executeVerificationCheck({
    url: "https://example.com/listing",
    expectText: "berlin apartment",
    fetchImpl: fetchReturning(beyondCap),
  });
  assert.equal(truncated.outcome, "MISMATCHED");

  const withinCap = "y".repeat(499_000) + "berlin apartment";
  const found = await executeVerificationCheck({
    url: "https://example.com/listing",
    expectText: "berlin apartment",
    fetchImpl: fetchReturning(withinCap),
  });
  assert.equal(found.outcome, "MATCHED");
  assert.ok(found.excerpt && found.excerpt.includes("berlin apartment"));
});

test("the excerpt is bounded around the match", async () => {
  const result = await executeVerificationCheck({
    url: "https://example.com/listing",
    expectText: "needle",
    fetchImpl: fetchReturning("z".repeat(1000) + " needle " + "z".repeat(1000)),
  });
  assert.equal(result.outcome, "MATCHED");
  assert.ok(result.excerpt);
  // match (6) plus up to 120 chars of context on each side.
  assert.ok(result.excerpt.length <= 246);
  assert.ok(result.excerpt.includes("needle"));
});

test("non-http schemes are rejected before any fetch", async () => {
  let called = false;
  const spy = (async () => {
    called = true;
    return new Response("secret");
  }) as typeof fetch;
  const result = await executeVerificationCheck({
    url: "file:///etc/passwd",
    expectText: "secret",
    fetchImpl: spy,
  });
  assert.equal(result.outcome, "UNREACHABLE");
  assert.ok(result.error && result.error.includes("http or https"));
  assert.equal(called, false);
});

test("relationForOutcome maps outcomes to evidence relations", () => {
  assert.equal(relationForOutcome("MATCHED"), "VERIFIES");
  assert.equal(relationForOutcome("MISMATCHED"), "CONTRADICTS");
  assert.equal(relationForOutcome("UNREACHABLE"), null);
});

// --- JS-rendered page observation (Firecrawl renderer) ---

const SPA_SHELL = '<html><head><script>var state={hydrated:false};</script></head><body><div id="root"></div></body></html>';
const RENDERED_MARKDOWN = "The Berlin Apartment is available from May with photos and floor plans.";

// Routes calls by URL: the target URL gets the direct response, anything on
// api.firecrawl.dev gets the scrape response.
function routedFetch(direct: () => Promise<Response>, scrape?: (url: unknown, init?: RequestInit) => Promise<Response>): typeof fetch {
  return (async (url: unknown, init?: RequestInit) => {
    if (String(url).includes("api.firecrawl.dev")) {
      if (!scrape) throw new Error("scrape endpoint must not be called");
      return scrape(url, init);
    }
    return direct();
  }) as typeof fetch;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("a thin JS-rendered shell is re-observed through Firecrawl when a key is configured", async () => {
  const previous = process.env.FIRECRAWL_API_KEY;
  process.env.FIRECRAWL_API_KEY = "test-key";
  try {
    const result = await executeVerificationCheck({
      url: "https://example.com/spa-listing",
      expectText: "Berlin Apartment",
      fetchImpl: routedFetch(
        async () => new Response(SPA_SHELL, { status: 200 }),
        async () => jsonResponse({ success: true, data: { markdown: RENDERED_MARKDOWN } }),
      ),
    });
    assert.equal(result.renderer, "FIRECRAWL");
    assert.equal(result.outcome, "MATCHED");
    assert.equal(result.httpStatus, 200);
    assert.equal(result.error, null);
    assert.ok(result.excerpt && result.excerpt.includes("berlin apartment"));
  } finally {
    if (previous === undefined) delete process.env.FIRECRAWL_API_KEY; else process.env.FIRECRAWL_API_KEY = previous;
  }
});

test("a direct network failure is retried through Firecrawl when a key is configured", async () => {
  const previous = process.env.FIRECRAWL_API_KEY;
  process.env.FIRECRAWL_API_KEY = "test-key";
  try {
    const result = await executeVerificationCheck({
      url: "https://example.com/blocked",
      expectText: "Berlin Apartment",
      fetchImpl: routedFetch(
        async () => { throw new Error("getaddrinfo ENOTFOUND example.com"); },
        async () => jsonResponse({ success: true, data: { markdown: RENDERED_MARKDOWN } }),
      ),
    });
    assert.equal(result.renderer, "FIRECRAWL");
    assert.equal(result.outcome, "MATCHED");
    assert.equal(result.error, null);
  } finally {
    if (previous === undefined) delete process.env.FIRECRAWL_API_KEY; else process.env.FIRECRAWL_API_KEY = previous;
  }
});

test("without a key the observation stays DIRECT even for a thin shell", async () => {
  const previous = process.env.FIRECRAWL_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;
  try {
    let scrapeCalled = false;
    const result = await executeVerificationCheck({
      url: "https://example.com/spa-listing",
      expectText: "Berlin Apartment",
      fetchImpl: routedFetch(
        async () => new Response(SPA_SHELL, { status: 200 }),
        async () => { scrapeCalled = true; return jsonResponse({ success: true, data: { markdown: RENDERED_MARKDOWN } }); },
      ),
    });
    assert.equal(scrapeCalled, false, "no Firecrawl call without a configured key");
    assert.equal(result.renderer, "DIRECT");
    assert.equal(result.outcome, "MISMATCHED", "the empty shell honestly lacks the text");
    assert.equal(result.error, null);
  } finally {
    if (previous !== undefined) process.env.FIRECRAWL_API_KEY = previous;
  }
});

test("a failed scrape keeps the direct evidence with an honest error note", async () => {
  const previous = process.env.FIRECRAWL_API_KEY;
  process.env.FIRECRAWL_API_KEY = "test-key";
  try {
    const result = await executeVerificationCheck({
      url: "https://example.com/spa-listing",
      expectText: "Berlin Apartment",
      fetchImpl: routedFetch(
        async () => new Response(SPA_SHELL, { status: 200 }),
        async () => jsonResponse({ error: "overloaded" }, 502),
      ),
    });
    assert.equal(result.renderer, "DIRECT");
    assert.equal(result.outcome, "MISMATCHED");
    assert.equal(result.httpStatus, 200);
    assert.ok(result.error && result.error.includes("Firecrawl scrape failed (HTTP 502)"));
  } finally {
    if (previous === undefined) delete process.env.FIRECRAWL_API_KEY; else process.env.FIRECRAWL_API_KEY = previous;
  }
});

test("the renderer is recorded on every outcome, including pre-fetch rejections", async () => {
  const scheme = await executeVerificationCheck({
    url: "file:///etc/passwd",
    expectText: "secret",
    fetchImpl: routedFetch(async () => new Response("secret")),
  });
  assert.equal(scheme.renderer, "DIRECT");
  assert.equal(scheme.outcome, "UNREACHABLE");
});
