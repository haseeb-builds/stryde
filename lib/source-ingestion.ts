import { createHash } from "node:crypto";
import dns from "node:dns/promises";
// Relative .ts imports (not the @/ alias): this module is exercised under
// node --experimental-strip-types by the tests, which cannot resolve tsconfig
// path aliases.
import { fetchPageText, htmlToText } from "./page-fetch.ts";

const MAX_SOURCE_CHARS = 120_000;

export type IngestedSource = {
  sourceKind: "URL" | "PASTED";
  uri: string | null;
  title: string | null;
  contentType: string | null;
  fetchStatus: "FETCHED" | "PARTIAL" | "FAILED" | "UNSUPPORTED";
  contentText: string | null;
  contentSha256: string | null;
  sourceMetadata: Record<string, unknown>;
};

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isPrivateIp(value: string) {
  const ip = value.toLowerCase().replace(/^::ffff:/, "");
  if (ip === "::1" || ip === "localhost") return true;
  const octets = ip.split(".").map(Number);
  if (octets.length === 4 && octets.every((n) => Number.isInteger(n))) {
    const [a, b] = octets;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb")) return true;
  return false;
}

export async function assertPublicHttpUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Source URL is invalid");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Source URL must use http or https");
  if (parsed.username || parsed.password) throw new Error("Source URL must not include credentials");
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") throw new Error("Source URL must use the standard HTTP(S) ports");
  if (parsed.hostname === "localhost" || parsed.hostname.endsWith(".local")) throw new Error("Private source hosts are not allowed");

  const addresses = await dns.lookup(parsed.hostname, { all: true });
  if (!addresses.length || addresses.some((item) => isPrivateIp(item.address))) {
    throw new Error("Source host resolves to a private or local network address");
  }
  return parsed;
}

export async function ingestPastedSource(input: { content: string; title?: string | null; uri?: string | null }): Promise<IngestedSource> {
  const content = input.content.trim();
  if (!content) throw new Error("Pasted source content is empty");
  if (content.length > MAX_SOURCE_CHARS) throw new Error("Pasted source is too large");
  const contentSha256 = hash(content);
  return {
    sourceKind: "PASTED",
    uri: input.uri?.trim() || null,
    title: input.title?.trim().slice(0, 500) || null,
    contentType: "text/plain",
    fetchStatus: "FETCHED",
    contentText: content,
    contentSha256,
    sourceMetadata: { ingestion: "PASTED" },
  };
}

export async function ingestUrlSource(rawUrl: string): Promise<IngestedSource> {
  // SSRF stays HERE: assertPublicHttpUrl resolves DNS and blocks private
  // targets before any fetch. fetchPageText performs no network guard of its
  // own — same division as the verification check.
  const url = await assertPublicHttpUrl(rawUrl.trim());
  try {
    // Direct GET first; the approved Firecrawl scrape adapter re-observes the
    // page (rendered markdown) when it is configured and the direct body is a
    // suspiciously thin JS-rendered shell or the direct fetch failed at the
    // network level. `renderer` in the metadata records which path served.
    const page = await fetchPageText(url.toString());
    if (!page.text) {
      return {
        sourceKind: "URL",
        uri: url.toString(),
        title: null,
        contentType: null,
        fetchStatus: "FAILED",
        contentText: null,
        contentSha256: null,
        sourceMetadata: {
          ingestion: "URL",
          requested_url: url.toString(),
          renderer: page.renderer,
          retrieval_at: new Date().toISOString(),
          error: page.error ?? "Page fetch returned no content",
        },
      };
    }
    // Content stays extracted text: Firecrawl markdown as served, or — for a
    // direct fetch — the page's visible text (tags/scripts stripped), so a
    // raw HTML dump never becomes source material.
    let contentText = page.renderer === "FIRECRAWL" ? page.text : htmlToText(page.text);
    let fetchStatus: IngestedSource["fetchStatus"] = "FETCHED";
    if (contentText.length > MAX_SOURCE_CHARS) { contentText = contentText.slice(0, MAX_SOURCE_CHARS); fetchStatus = "PARTIAL"; }
    return {
      sourceKind: "URL",
      uri: url.toString(),
      title: null,
      contentType: page.renderer === "FIRECRAWL" ? "text/markdown" : null,
      fetchStatus,
      contentText,
      contentSha256: contentText ? hash(contentText) : null,
      sourceMetadata: {
        ingestion: "URL",
        requested_url: url.toString(),
        renderer: page.renderer,
        retrieval_at: new Date().toISOString(),
        ...(page.error ? { note: page.error } : {}),
        truncated: contentText ? contentText.length >= MAX_SOURCE_CHARS : false,
      },
    };
  } catch (error) {
    if (error instanceof Error && /private|local|invalid|standard HTTP/i.test(error.message)) throw error;
    return {
      sourceKind: "URL",
      uri: url.toString(),
      title: null,
      contentType: null,
      fetchStatus: "FAILED",
      contentText: null,
      contentSha256: null,
      sourceMetadata: { error: error instanceof Error ? error.message.slice(0, 500) : "source fetch failed" },
    };
  }
}
