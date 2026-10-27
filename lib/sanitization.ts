/**
 * Stryde Content & URL Sanitization
 * Enforces strict URI allowlisting (http, https, mailto, safe relative paths)
 * and safely strips raw HTML while strictly preserving code blocks and examples.
 */

/**
 * Sanitizes URLs to prevent XSS (e.g. javascript:, data:, vbscript:)
 * and protocol-relative open-redirects (e.g. //attacker.example, /\attacker.example).
 * Strictly allowlists http:, https:, mailto:, safe single-slash relative paths, and safe fragment anchors.
 */
export function sanitizeUrl(url: unknown): string {
  if (typeof url !== "string") return "#";
  const trimmed = url.trim();
  if (!trimmed) return "#";

  // Reject protocol-relative URLs (//...) and Windows-style UNC paths (\\...)
  if (trimmed.startsWith("//") || trimmed.startsWith("\\\\")) return "#";

  // Reject backslash variants of protocol-relative URLs (/\..., /\/..., /\\...)
  if (trimmed.startsWith("/\\") || trimmed.startsWith("\\/")) return "#";

  // Allow safe fragment anchor links (e.g., #section-1)
  if (trimmed.startsWith("#")) {
    // Ensure no control characters or suspicious protocols inside anchor
    if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) return "#";
    return trimmed;
  }

  // Allow safe single-slash relative links (e.g., /dashboard, /pursuits/123)
  // Must start with '/' and the second character must NOT be '/' or '\'
  if (trimmed.startsWith("/")) {
    if (trimmed.length > 1 && (trimmed[1] === "/" || trimmed[1] === "\\")) {
      return "#";
    }
    return trimmed;
  }

  // Remove control characters and whitespace to prevent scheme-splitting attacks (e.g. jav\tascript:)
  const normalized = trimmed.replace(/[\u0000-\u001F\u007F-\u009F\s]+/g, "");

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === "http:" || protocol === "https:" || protocol === "mailto:") {
      // Ensure normalized string starts with the exact safe protocol name
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
 * Strips raw HTML tags from text while preserving fenced code blocks
 * (``` ... ```) and inline code (`...`) completely intact.
 */
export function stripRawHtmlPreservingCode(text: string): string {
  if (!text) return "";

  const placeholders: string[] = [];
  let tokenIndex = 0;

  // 1. Temporarily replace fenced code blocks
  let protectedText = text.replace(/(```[\s\S]*?```)/g, (_match, code) => {
    const placeholder = `__CODE_BLOCK_PLACEHOLDER_${tokenIndex++}__`;
    placeholders.push(code);
    return placeholder;
  });

  // 2. Temporarily replace inline code spans
  protectedText = protectedText.replace(/(`[^`]+`)/g, (_match, code) => {
    const placeholder = `__CODE_SPAN_PLACEHOLDER_${tokenIndex++}__`;
    placeholders.push(code);
    return placeholder;
  });

  // 3. Strip script and style blocks from non-code prose
  let cleaned = protectedText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // 4. Strip remaining raw HTML tags
  cleaned = cleaned.replace(/<\/?[a-zA-Z][^>]*>/g, "");

  // 5. Restore protected code blocks and inline code
  tokenIndex = 0;
  cleaned = cleaned.replace(/__CODE_BLOCK_PLACEHOLDER_\d+__|__CODE_SPAN_PLACEHOLDER_\d+__/g, () => {
    return placeholders[tokenIndex++];
  });

  return cleaned;
}
