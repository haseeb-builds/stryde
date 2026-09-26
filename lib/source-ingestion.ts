import { createHash } from "node:crypto";
import dns from "node:dns/promises";

const MAX_SOURCE_BYTES = 2_500_000;
const MAX_SOURCE_CHARS = 120_000;
const FETCH_TIMEOUT_MS = 25_000;

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

function normalizeWhitespace(value: string) {
  return value.replace(/\u0000/g, "").replace(/[ \t\r\n]+/g, " ").trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value: string) {
  return normalizeWhitespace(
    decodeEntities(
      value
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function htmlTitle(value: string) {
  const match = value.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeWhitespace(decodeEntities(match[1])).slice(0, 500) || null : null;
}

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

async function assertPublicHttpUrl(value: string) {
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

function youtubeVideoId(url: URL) {
  if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
  if (url.hostname.endsWith("youtube.com")) return url.searchParams.get("v");
  return null;
}

type FetchedBody = {
  response: Response;
  contentType: string | null;
  status: "OK" | "UNSUPPORTED" | "FAILED";
  body: string;
  finalUrl: string;
};

async function fetchBody(url: URL): Promise<FetchedBody> {
  let current = url;
  for (let redirectCount = 0; redirectCount < 4; redirectCount += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      cache: "no-store",
      headers: {
        "User-Agent": "StrydeSourceFetcher/1.0",
        Accept: "text/html,text/plain,application/json,application/xml,text/xml,text/vtt,*/*;q=0.1",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { response, contentType: null, status: "FAILED", body: "", finalUrl: current.toString() };
      current = await assertPublicHttpUrl(new URL(location, current).toString());
      continue;
    }

    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || null;
    const contentLength = Number(response.headers.get("content-length") || "0");
    if (contentLength > MAX_SOURCE_BYTES) {
      return { response, contentType, status: "UNSUPPORTED" as const, body: "", finalUrl: current.toString() };
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > MAX_SOURCE_BYTES) {
      return { response, contentType, status: "UNSUPPORTED" as const, body: "", finalUrl: current.toString() };
    }
    return {
      response,
      contentType,
      status: "OK" as const,
      body: new TextDecoder("utf-8", { fatal: false }).decode(buffer),
      finalUrl: current.toString(),
    };
  }
  throw new Error("Source URL redirected too many times");
}

function extractYouTubeTranscript(html: string) {
  const marker = html.match(/"captionTracks":(\[[\s\S]*?\])(?:,"audioTracks"|,"playerCaptionsTracklistRenderer"|,)/);
  if (!marker) return null;
  const escaped = marker[1].replace(/\\u0026/g, "&").replace(/\\u0026amp;/g, "&");
  const urlMatch = escaped.match(/"baseUrl":"([^"]+)"/);
  if (!urlMatch) return null;
  try {
    return JSON.parse('"'+urlMatch[1].replace(/"/g, '\\"')+'"');
  } catch {
    return urlMatch[1].replace(/\\/g, "");
  }
}

async function tryYoutubeTranscript(captionUrl: string) {
  try {
    const safeCaptionUrl = await assertPublicHttpUrl(captionUrl);
    const response = await fetch(safeCaptionUrl, {
      redirect: "follow",
      cache: "no-store",
      headers: { "User-Agent": "StrydeSourceFetcher/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    const raw = await response.text();
    if (!raw.trim()) return null;
    if (contentType.includes("json")) {
      try {
        const json = JSON.parse(raw) as { events?: Array<{ segs?: Array<{ utf8?: string }> }> };
        const text = (json.events ?? [])
          .flatMap((event) => event.segs ?? [])
          .map((segment) => segment.utf8 ?? "")
          .join(" ");
        return normalizeWhitespace(text);
      } catch {
        return null;
      }
    }
    return normalizeWhitespace(
      decodeEntities(
        raw.replace(/<[^>]+>/g, " ").replace(/\{\\[^}]+\}/g, " "),
      ),
    );
  } catch {
    return null;
  }
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
  const url = await assertPublicHttpUrl(rawUrl.trim());
  try {
    const fetched = await fetchBody(url);
    if (!fetched.response.ok) {
      return {
        sourceKind: "URL",
        uri: fetched.finalUrl || url.toString(),
        title: null,
        contentType: fetched.contentType,
        fetchStatus: "FAILED",
        contentText: null,
        contentSha256: null,
        sourceMetadata: { http_status: fetched.response.status },
      };
    }

    if (fetched.status === "UNSUPPORTED") {
      return {
        sourceKind: "URL",
        uri: fetched.finalUrl || url.toString(),
        title: null,
        contentType: fetched.contentType,
        fetchStatus: "UNSUPPORTED",
        contentText: null,
        contentSha256: null,
        sourceMetadata: { reason: "source exceeds the ingestion byte limit" },
      };
    }

    const fetchedContentType = fetched.contentType ?? "";
    const isTextual = fetchedContentType.includes("text/") || fetchedContentType.includes("json") || fetchedContentType.includes("xml");
    if (!isTextual) {
      return {
        sourceKind: "URL",
        uri: fetched.finalUrl || url.toString(),
        title: null,
        contentType: fetched.contentType,
        fetchStatus: "UNSUPPORTED",
        contentText: null,
        contentSha256: null,
        sourceMetadata: { reason: "binary content is not text-extractable in the current runtime" },
      };
    }

    let title = fetchedContentType.includes("html") ? htmlTitle(fetched.body) : null;
    let contentText: string | null = fetchedContentType.includes("html") ? stripHtml(fetched.body) : normalizeWhitespace(fetched.body);
    let fetchStatus: IngestedSource["fetchStatus"] = "FETCHED";
    const videoId = youtubeVideoId(url);

    if (videoId) {
      const captionUrl = extractYouTubeTranscript(fetched.body);
      if (captionUrl) {
        const transcript = await tryYoutubeTranscript(captionUrl);
        if (transcript) {
          contentText = transcript;
          fetchStatus = "FETCHED";
          title = title || "YouTube video transcript";
        } else {
          fetchStatus = "PARTIAL";
        }
      } else {
        fetchStatus = "PARTIAL";
      }
    }

    if (!contentText) {
      fetchStatus = "PARTIAL";
      contentText = null;
    } else if (contentText.length > MAX_SOURCE_CHARS) {
      contentText = contentText.slice(0, MAX_SOURCE_CHARS);
      fetchStatus = "PARTIAL";
    }

    return {
      sourceKind: "URL",
      uri: fetched.finalUrl || url.toString(),
      title,
      contentType: fetched.contentType,
      fetchStatus,
      contentText,
      contentSha256: contentText ? hash(contentText) : null,
      sourceMetadata: {
        ingestion: "URL",
        final_url: fetched.finalUrl ?? fetched.response.url,
        youtube_video_id: videoId,
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
