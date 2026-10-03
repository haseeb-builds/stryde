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
