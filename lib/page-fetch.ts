// Mechanical page text observation, shared by VERIFY_WEB checks and URL
// source ingestion.
//
// Division of responsibility (same as before this module existed): the CALLER
// runs assertPublicHttpUrl (lib/source-ingestion.ts) on the target URL first —
// that guard performs DNS resolution and blocks private-network targets
// (SSRF). This module takes an already-validated URL and never applies its own
// network guard; callers that skip theirs own the consequence.
//
// Renderers, in the order they are tried:
//   DIRECT    — a plain GET of the URL. Exact, but it sees only the raw HTML:
//               a JS-rendered page usually yields a script-heavy shell whose
//               visible text is nearly empty.
//   FIRECRAWL — the approved Firecrawl scrape adapter (docs/INTEGRATIONS.md),
//               which renders JavaScript and returns markdown. A real browser
//               runtime is neither pre-approved nor possible on Vercel
//               serverless, so this adapter is the only JS-rendering path.
//
// The FIRECRAWL leg is attempted only when FIRECRAWL_API_KEY is configured AND
// (the direct body is suspiciously thin OR the caller explicitly asks for
// render). A network-level direct failure is also retried through Firecrawl;
// a definitive origin error status (404, 500, ...) is not — the origin
// answered, and that answer is the honest observation.

export type PageRenderer = "DIRECT" | "FIRECRAWL";

export type PageFetchResult = {
  // The observed page text. Empty string means nothing was observed; the
  // error/status fields then say why. This module never throws.
  text: string;
  // Which renderer produced `text` (or, when text is empty, the renderer that
  // was last attempted).
  renderer: PageRenderer;
  // HTTP status of the response that produced `text` (or of the failed direct
  // response). Null when no HTTP response was ever received.
  status: number | null;
  // Null when text was observed through a fully successful path; otherwise an
  // honest note (degraded evidence, origin error, network failure).
  error: string | null;
};

const MAX_BODY_CHARS = 500_000;
const TIMEOUT_MS = 15_000;
const SCRAPE_TIMEOUT_MS = 30_000;
// Below this much visible text a direct body is treated as a suspiciously thin
// shell (JS-rendered SPA, interstitial, consent wall) rather than real content.
const THIN_TEXT_CHARS = 500;

const DIRECT_HEADERS = {
  "user-agent": "Stryde-MechanicalVerification/1 (claim URL text check)",
  accept: "text/*,*/*;q=0.5",
} as const;

// Visible-text estimate of an HTML body: scripts, styles, comments, and tags
// removed. Used only to judge DIRECT-renderer thinness and to extract
// readable text; it is never returned as observed content itself.
export function htmlToText(body: string): string {
  return body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

type DirectOutcome = { body: string | null; status: number | null; error: string | null };

async function fetchDirect(url: string, fetchImpl: typeof fetch): Promise<DirectOutcome> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { ...DIRECT_HEADERS },
    });
    // Only a 2xx body is page content. A 4xx/5xx is the origin's definitive
    // answer: report the status, never read an error page as content.
    if (response.status < 200 || response.status >= 300) {
      return { body: null, status: response.status, error: `HTTP ${response.status}` };
    }
    // The body is capped after reading; content beyond the cap is never read
    // unbounded (same semantics the verification check has always had).
    return { body: (await response.text()).slice(0, MAX_BODY_CHARS), status: response.status, error: null };
  } catch (error) {
    const aborted = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
    return {
      body: null,
      status: null,
      error: aborted
        ? `Page fetch timed out after ${TIMEOUT_MS / 1000}s`
        : error instanceof Error
          ? error.message.slice(0, 300)
          : "Page fetch failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

type ScrapeOutcome = { markdown: string | null; status: number | null; error: string | null };

type FirecrawlScrapePayload = { success?: unknown; data?: { markdown?: unknown } };

async function scrapeViaFirecrawl(url: string, apiKey: string, baseUrl: string, fetchImpl: typeof fetch): Promise<ScrapeOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"] }),
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    return {
      markdown: null,
      status: null,
      error: error instanceof Error ? `Firecrawl scrape failed: ${error.message.slice(0, 300)}` : "Firecrawl scrape failed",
    };
  }
  if (!response.ok) return { markdown: null, status: response.status, error: `Firecrawl scrape failed (HTTP ${response.status})` };
  let payload: FirecrawlScrapePayload;
  try { payload = await response.json() as FirecrawlScrapePayload; } catch { return { markdown: null, status: response.status, error: "Firecrawl scrape returned malformed JSON" }; }
  const markdown = typeof payload.data?.markdown === "string" ? payload.data.markdown.trim() : "";
  if (payload.success === false || !markdown) return { markdown: null, status: response.status, error: "Firecrawl scrape returned no content" };
  return { markdown: markdown.slice(0, MAX_BODY_CHARS), status: response.status, error: null };
}

export async function fetchPageText(
  url: string,
  options?: { fetchImpl?: typeof fetch; firecrawlApiKey?: string; firecrawlBaseUrl?: string; render?: boolean },
): Promise<PageFetchResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const apiKey = (options?.firecrawlApiKey ?? process.env.FIRECRAWL_API_KEY)?.trim() || null;
  const baseUrl = (options?.firecrawlBaseUrl ?? "https://api.firecrawl.dev/v1").replace(/\/$/, "");

  const direct = await fetchDirect(url, fetchImpl);

  // Firecrawl triggers: the caller explicitly asked for render, the direct
  // body is a suspiciously thin shell, or the direct fetch failed at the
  // network level (no origin answer at all — the page may still be reachable
  // through the rendering adapter).
  const wantsRender = options?.render === true;
  const thin = direct.body !== null && htmlToText(direct.body).length < THIN_TEXT_CHARS;
  const networkFailed = direct.body === null && direct.status === null;

  if (apiKey && (wantsRender || thin || networkFailed)) {
    const scrape = await scrapeViaFirecrawl(url, apiKey, baseUrl, fetchImpl);
    if (scrape.markdown) {
      return { text: scrape.markdown, renderer: "FIRECRAWL", status: scrape.status, error: null };
    }
    if (direct.body !== null) {
      // The direct body is real (if thin) content: keep it and say honestly
      // that the better renderer was tried and failed.
      return { text: direct.body, renderer: "DIRECT", status: direct.status, error: scrape.error };
    }
    return {
      text: "",
      renderer: "DIRECT",
      status: direct.status,
      error: [direct.error, scrape.error].filter(Boolean).join("; ") || "Page fetch failed",
    };
  }

  if (direct.body !== null) return { text: direct.body, renderer: "DIRECT", status: direct.status, error: null };
  return { text: "", renderer: "DIRECT", status: direct.status, error: direct.error };
}
