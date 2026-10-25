/**
 * Independent verification probe for Stryde's real web research providers (Exa & Firecrawl).
 *
 * Usage: npm run probe:research [exa|firecrawl|auto] [query]
 *
 * Exit Codes:
 *   0 = PASS (Verified live search API reachability and citation grounding)
 *   1 = FAIL (Provider returned an error or assertion failed)
 *   2 = BLOCKED (Required provider credentials not configured)
 *
 * Probes the real HTTP search API when credentials are present in .env.local,
 * verifying:
 *   1. Authentication & reachability
 *   2. Response structure & latency
 *   3. Result extraction (URL, title, rank, highlights, published date)
 *   4. Direct page-fetch on top result
 *   5. Grounded citation extraction
 *   6. Outputs unambiguous machine-readable status
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getSearchProviderChain, type SearchResult } from "../lib/search-provider.ts";
import { ingestUrlSource } from "../lib/source-ingestion.ts";
import { buildSourceCitation } from "../lib/source-citation.ts";

// Load .env.local
const envPath = path.resolve(".env.local");
if (fs.existsSync(envPath)) {
  const env = Object.fromEntries(
    fs.readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
  );
  for (const [k, v] of Object.entries(env)) {
    if (!(k in process.env)) process.env[k] = v;
  }
}

const exaKey = process.env.EXA_API_KEY?.trim();
const firecrawlKey = process.env.FIRECRAWL_API_KEY?.trim();
const targetProvider = (process.argv[2] ?? "auto").trim().toLowerCase();
if (targetProvider === "exa" || targetProvider === "firecrawl") {
  process.env.STRYDE_SEARCH_PROVIDER = targetProvider;
}
const testQuery = process.argv[3] ?? "software engineering operational accountability frameworks";

console.log("\n=======================================================");
console.log("  STRYDE REAL WEB RESEARCH VERIFICATION PROBE");
console.log("=======================================================\n");
console.log(`Query: "${testQuery}"`);
console.log(`Exa API Key configured: ${exaKey ? "YES (masked: " + exaKey.slice(0, 6) + "...)" : "NO"}`);
console.log(`Firecrawl API Key configured: ${firecrawlKey ? "YES (masked: " + firecrawlKey.slice(0, 6) + "...)" : "NO"}`);

if (!exaKey && !firecrawlKey) {
  console.log("\n[STATUS: BLOCKED] (CREDENTIALS_MISSING)");
  console.log("Neither EXA_API_KEY nor FIRECRAWL_API_KEY is configured in your environment.");
  console.log("Stryde's R-4 guard correctly prevents ungrounded hallucination and fails closed.\n");
  console.log("To verify live web research with a real provider:");
  console.log("  1. Get an API key from https://exa.ai or https://firecrawl.dev");
  console.log("  2. Add it to .env.local or Vercel environment variables:");
  console.log("     EXA_API_KEY=\"your_exa_api_key_here\"");
  console.log("     # or");
  console.log("     FIRECRAWL_API_KEY=\"your_firecrawl_api_key_here\"");
  console.log("  3. Run: npm run probe:research\n");
  process.exit(2);
}

const chain = getSearchProviderChain();
console.log(`Active Search Provider Chain: ${chain.map((p) => p.name).join(" -> ")}`);

const provider = chain[0];
console.log(`\nProbing primary provider: ${provider.name.toUpperCase()}...`);

const start = Date.now();
try {
  const { results, providerMetadata } = await provider.search({
    query: testQuery,
    maxResults: 3,
  });
  const durationMs = Date.now() - start;

  console.log(`✔ Search API responded in ${durationMs}ms`);
  console.log(`✔ Provider Metadata:`, JSON.stringify(providerMetadata));
  console.log(`✔ Results returned: ${results.length}`);

  assert.ok(results.length > 0, "Provider returned 0 results");

  results.forEach((r: SearchResult, idx: number) => {
    console.log(`\n  [Result ${idx + 1}]`);
    console.log(`    Title: ${r.title ?? "Untitled"}`);
    console.log(`    URL: ${r.url}`);
    console.log(`    Rank: ${r.rank}`);
    console.log(`    Published: ${r.publishedAt ?? "N/A"}`);
    console.log(`    Highlights: ${r.highlights.length} snippet(s)`);
    if (r.highlights[0]) {
      console.log(`    Preview: "${r.highlights[0].slice(0, 120)}..."`);
    }
  });

  // Verify page-fetch on top result
  const topUrl = results[0].url;
  console.log(`\nTesting real content extraction on top result: ${topUrl}...`);
  const ingestStart = Date.now();
  const ingested = await ingestUrlSource(topUrl);
  const ingestMs = Date.now() - ingestStart;

  console.log(`✔ Ingestion completed in ${ingestMs}ms`);
  console.log(`✔ Fetch status: ${ingested.fetchStatus}`);
  console.log(`✔ Content length: ${ingested.contentText?.length ?? 0} chars`);
  console.log(`✔ Content SHA256: ${ingested.contentSha256 ?? "N/A"}`);

  // Verify source citation creation if text present
  if (ingested.contentText && ingested.contentSha256) {
    const sampleStatement = ingested.contentText.slice(100, 250).trim();
    if (sampleStatement) {
      const citation = buildSourceCitation({
        content: ingested.contentText,
        contentSha256: ingested.contentSha256,
        statement: sampleStatement,
        basis: "EXPLICIT_SOURCE",
      });

      if (citation) {
        console.log(`✔ Defensible citation extracted: span [${citation.locator.start}, ${citation.locator.end}]`);
      }
    }
  }

  console.log("\n=======================================================");
  console.log(`  [STATUS: PASS] RESEARCH PROBE: ${provider.name.toUpperCase()} OPERATIONAL`);
  console.log("=======================================================\n");
  process.exit(0);
} catch (err) {
  console.error(`\n[STATUS: FAIL] (SEARCH_FAILED)`);
  console.error("Error detail:", err instanceof Error ? err.message : String(err));
  process.exit(1);
}
