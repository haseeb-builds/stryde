import assert from "node:assert/strict";
import test from "node:test";
import { fetchPageText } from "../lib/page-fetch.ts";

test("SSRF redirect protection: follows safe public redirects to 200", async () => {
  let directHops = 0;
  const mockFetch = (async (url: unknown) => {
    const target = String(url);
    if (target === "https://example.com/start") {
      directHops++;
      return new Response(null, {
        status: 302,
        headers: { location: "https://example.com/target" },
      });
    }
    if (target === "https://example.com/target") {
      directHops++;
      return new Response("<p>Safe redirected content.</p>", { status: 200 });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  const result = await fetchPageText("https://example.com/start", { fetchImpl: mockFetch });
  assert.equal(directHops, 2, "must follow safe redirect hop");
  assert.equal(result.renderer, "DIRECT");
  assert.equal(result.status, 200);
  assert.ok(result.text.includes("Safe redirected content"));
  assert.equal(result.error, null);
});

test("SSRF redirect protection: blocks redirect to private loopback/metadata IP", async () => {
  for (const forbidden of [
    "http://127.0.0.1/admin",
    "http://localhost/internal",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.1/secret",
    "http://127.0.0.1:8080/admin",
  ]) {
    const mockFetch = (async (url: unknown) => {
      const target = String(url);
      if (target === "https://example.com/start") {
        return new Response(null, {
          status: 302,
          headers: { location: forbidden },
        });
      }
      return new Response("private data", { status: 200 });
    }) as typeof fetch;

    const result = await fetchPageText("https://example.com/start", { fetchImpl: mockFetch });
    assert.equal(result.status, 302);
    assert.ok(result.error, `must block redirect to ${forbidden}`);
    assert.ok(
      result.error.includes("private") ||
      result.error.includes("Private") ||
      result.error.includes("forbidden") ||
      result.error.includes("standard HTTP(S) ports"),
      `error for ${forbidden} must indicate SSRF restriction, got: ${result.error}`
    );
  }
});

test("SSRF redirect protection: stops on redirect loop after max redirects", async () => {
  let hops = 0;
  const mockFetch = (async () => {
    hops++;
    return new Response(null, {
      status: 302,
      headers: { location: "https://example.com/loop" },
    });
  }) as typeof fetch;

  const result = await fetchPageText("https://example.com/loop", { fetchImpl: mockFetch });
  assert.ok(hops <= 7, `hops (${hops}) must be bounded by maxRedirects`);
  assert.ok(result.error && result.error.includes("redirects"));
});
