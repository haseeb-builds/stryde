// Mechanical URL text check for claim verification.
//
// The caller MUST run assertPublicHttpUrl (lib/source-ingestion.ts) on the URL
// before invoking executeVerificationCheck — that guard performs DNS
// resolution and blocks private-network targets (SSRF). This module takes the
// already-validated URL and only re-checks the scheme as defense in depth.
//
// The check is deliberately mechanical: it can only state whether a public
// page's body does or does not contain a literal text. Its outcome is
// evidence for a human, never a claim verdict.
//
// The page is observed through lib/page-fetch.ts: a direct GET first, and —
// only when FIRECRAWL_API_KEY is configured and the direct body is a
// suspiciously thin JS-rendered shell (or the direct fetch failed at the
// network level) — the approved Firecrawl scrape adapter. `renderer` on the
// result records HOW the page was actually observed.

import { fetchPageText, type PageRenderer } from "./page-fetch.ts";

export type VerificationOutcome = "MATCHED" | "MISMATCHED" | "UNREACHABLE";

export type VerificationCheckResult = {
  outcome: VerificationOutcome;
  httpStatus: number | null;
  excerpt: string | null;
  error: string | null;
  renderer: PageRenderer;
};

const EXCERPT_RADIUS = 120;
const EXCERPT_MAX = 240;

// Matching happens on this normalized form, so excerpts are cut from it too —
// they always show exactly what was compared.
function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function unreachable(error: string, renderer: PageRenderer = "DIRECT", httpStatus: number | null = null): VerificationCheckResult {
  return { outcome: "UNREACHABLE", httpStatus, excerpt: null, error, renderer };
}

export async function executeVerificationCheck(input: {
  url: string;
  expectText: string;
  fetchImpl?: typeof fetch;
}): Promise<VerificationCheckResult> {
  // Defense in depth: the caller runs the full SSRF guard
  // (assertPublicHttpUrl). Here we only enforce the http(s) scheme so the
  // module can never be pointed at file:, data:, or other non-HTTP targets
  // even if a caller forgets the guard.
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return unreachable("Verification URL is invalid");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return unreachable("Verification URL must use http or https");
  }

  const expected = normalizeText(input.expectText);
  if (!expected) {
    return unreachable("Expected verification text is empty");
  }

  try {
    const page = await fetchPageText(parsed.toString(), { fetchImpl: input.fetchImpl });
    if (!page.text) {
      return unreachable(
        page.error ?? "Verification URL returned no content",
        page.renderer,
        page.status,
      );
    }

    // The body was capped by the page fetch (500k after reading); a match
    // hiding beyond the cap is honestly reported as MISMATCHED-against-what-
    // was-fetched evidence rather than read unbounded.
    const normalizedBody = normalizeText(page.text);
    if (normalizedBody.includes(expected)) {
      const index = normalizedBody.indexOf(expected);
      const start = Math.max(0, index - EXCERPT_RADIUS);
      const end = Math.min(normalizedBody.length, index + expected.length + EXCERPT_RADIUS);
      return { outcome: "MATCHED", httpStatus: page.status, excerpt: normalizedBody.slice(start, end), error: page.error, renderer: page.renderer };
    }
    return { outcome: "MISMATCHED", httpStatus: page.status, excerpt: normalizedBody.slice(0, EXCERPT_MAX), error: page.error, renderer: page.renderer };
  } catch (error) {
    // fetchPageText never throws by contract; this catch is defense in depth
    // so an unexpected fault can never turn into a false contradiction.
    return unreachable(error instanceof Error ? error.message.slice(0, 300) : "Verification request failed");
  }
}

// UNREACHABLE is unknown evidence: an unreachable page must never be linked as
// a contradiction (nor as confirmation). Only a completed check links.
export function relationForOutcome(outcome: VerificationOutcome): "VERIFIES" | "CONTRADICTS" | null {
  if (outcome === "MATCHED") return "VERIFIES";
  if (outcome === "MISMATCHED") return "CONTRADICTS";
  return null;
}
