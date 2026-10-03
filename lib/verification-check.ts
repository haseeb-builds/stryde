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

export type VerificationOutcome = "MATCHED" | "MISMATCHED" | "UNREACHABLE";

export type VerificationCheckResult = {
  outcome: VerificationOutcome;
  httpStatus: number | null;
  excerpt: string | null;
  error: string | null;
};

const MAX_BODY_CHARS = 500_000;
const TIMEOUT_MS = 15_000;
const EXCERPT_RADIUS = 120;
const EXCERPT_MAX = 240;

// Matching happens on this normalized form, so excerpts are cut from it too —
// they always show exactly what was compared.
function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function executeVerificationCheck(input: {
  url: string;
  expectText: string;
  fetchImpl?: typeof fetch;
}): Promise<VerificationCheckResult> {
  const fetchImpl = input.fetchImpl ?? fetch;

  // Defense in depth: the caller runs the full SSRF guard
  // (assertPublicHttpUrl). Here we only enforce the http(s) scheme so the
  // module can never be pointed at file:, data:, or other non-HTTP targets
  // even if a caller forgets the guard.
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return { outcome: "UNREACHABLE", httpStatus: null, excerpt: null, error: "Verification URL is invalid" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { outcome: "UNREACHABLE", httpStatus: null, excerpt: null, error: "Verification URL must use http or https" };
  }

  const expected = normalizeText(input.expectText);
  if (!expected) {
    return { outcome: "UNREACHABLE", httpStatus: null, excerpt: null, error: "Expected verification text is empty" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Stryde-MechanicalVerification/1 (claim URL text check)",
        accept: "text/*,*/*;q=0.5",
      },
    });

    // Only a 2xx page is checkable evidence. A 4xx/5xx (or a redirect landing
    // on an error status) says nothing about the claim: record UNREACHABLE
    // with the status so an error page is never read as a contradiction.
    if (response.status < 200 || response.status >= 300) {
      return {
        outcome: "UNREACHABLE",
        httpStatus: response.status,
        excerpt: null,
        error: `Verification URL returned HTTP ${response.status}`,
      };
    }

    // The body is capped after reading; a match hiding beyond the cap is
    // honestly reported as MISMATCHED-against-what-was-fetched evidence
    // rather than read unbounded.
    const body = (await response.text()).slice(0, MAX_BODY_CHARS);
    const normalizedBody = normalizeText(body);
    if (normalizedBody.includes(expected)) {
      const index = normalizedBody.indexOf(expected);
      const start = Math.max(0, index - EXCERPT_RADIUS);
      const end = Math.min(normalizedBody.length, index + expected.length + EXCERPT_RADIUS);
      return { outcome: "MATCHED", httpStatus: response.status, excerpt: normalizedBody.slice(start, end), error: null };
    }
    return { outcome: "MISMATCHED", httpStatus: response.status, excerpt: normalizedBody.slice(0, EXCERPT_MAX), error: null };
  } catch (error) {
    const aborted = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
    return {
      outcome: "UNREACHABLE",
      httpStatus: null,
      excerpt: null,
      error: aborted
        ? `Verification request timed out after ${TIMEOUT_MS / 1000}s`
        : error instanceof Error
          ? error.message.slice(0, 300)
          : "Verification request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

// UNREACHABLE is unknown evidence: an unreachable page must never be linked as
// a contradiction (nor as confirmation). Only a completed check links.
export function relationForOutcome(outcome: VerificationOutcome): "VERIFIES" | "CONTRADICTS" | null {
  if (outcome === "MATCHED") return "VERIFIES";
  if (outcome === "MISMATCHED") return "CONTRADICTS";
  return null;
}
