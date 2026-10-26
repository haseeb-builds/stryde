/**
 * Stryde Content & URL Sanitization
 * Enforces strict URI whitelisting (http, https, mailto, relative) and strips raw HTML tags.
 */

/**
 * Sanitizes URLs to prevent XSS (e.g. javascript:, data:, vbscript:)
 * and protocol-relative open-redirects.
 * Strictly whitelists http:, https:, mailto:, safe relative paths, and safe fragment anchors.
 */
export function sanitizeUrl(url: unknown): string {
  if (typeof url !== "string") return "#";
  const trimmed = url.trim();
  if (!trimmed) return "#";

  // Reject protocol-relative URLs (e.g., //attacker.com)
  if (trimmed.startsWith("//")) return "#";

  // Allow safe relative anchor links (e.g., #section)
  if (trimmed.startsWith("#")) return trimmed;

  // Allow safe single-slash relative links (e.g., /dashboard, /pursuits/123)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;

  // Remove control characters and whitespace to prevent scheme-splitting attacks (e.g. jav\tascript:)
  const normalized = trimmed.replace(/[\u0000-\u001F\u007F-\u009F\s]+/g, "");

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === "http:" || protocol === "https:" || protocol === "mailto:") {
      // Also ensure normalized string matches safe protocol prefix
      const normPrefix = normalized.split(":")[0]?.toLowerCase();
      if (normPrefix === "http" || normPrefix === "https" || normPrefix === "mailto") {
        return trimmed;
      }
    }
  } catch {
    // Malformed URL, reject
    return "#";
  }

  return "#";
}

/**
 * Strips raw HTML tags from markdown/user text to ensure raw tags
 * cannot be injected into the DOM or markdown renderers.
 */
export function stripRawHtml(text: string): string {
  if (!text) return "";
  // Strip <script>...</script> and <style>...</style> blocks with content
  let cleaned = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  // Strip remaining HTML tags
  cleaned = cleaned.replace(/<\/?[a-zA-Z][^>]*>/g, "");
  return cleaned;
}
