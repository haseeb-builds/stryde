/**
 * Stryde Content & URL Sanitization
 * Enforces strict URI allowlisting (http, https, mailto, safe relative paths)
 * and safely strips raw HTML while strictly preserving code blocks and examples.
 * Also protects against Client-Side and Server-Side Request Forgery (SSRF)
 * by blocking private, loopback, link-local, and internal network addresses.
 */

/**
 * Checks whether a hostname or IP address belongs to a private, loopback,
 * link-local, multicast, or internal network range.
 * Fully compatible with both browser (client-side) and server-side runtimes.
 */
export function isPrivateHost(hostname: string): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase().trim().replace(/^\[|\]$/g, "");

  // Special internal hostnames and TLDs
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host.endsWith(".localdomain") ||
    host.endsWith(".home.arpa")
  ) {
    return true;
  }

  // IPv4 dotted-quad detection
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    const octets = host.split(".").map(Number);
    if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return true; // Malformed IPv4
    }
    const [a, b, c] = octets;

    // 0.0.0.0/8 (Current network / "this" host)
    if (a === 0) return true;
    // 10.0.0.0/8 (Private-Use, RFC 1918)
    if (a === 10) return true;
    // 127.0.0.0/8 (Loopback, RFC 1122)
    if (a === 127) return true;
    // 169.254.0.0/16 (Link-Local / Cloud Metadata, RFC 3927)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (Private-Use, RFC 1918)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (Private-Use, RFC 1918)
    if (a === 192 && b === 168) return true;
    // 100.64.0.0/10 (Shared Address Space / CGNAT, RFC 6598)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 198.18.0.0/15 (Benchmarking, RFC 2544)
    if (a === 198 && (b === 18 || b === 19)) return true;
    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (Documentation / TEST-NET)
    if (a === 192 && b === 0 && c === 2) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    // 224.0.0.0/4 (Multicast) and 240.0.0.0/4 (Reserved / Broadcast)
    if (a >= 224) return true;
  }

  // IPv6 detection
  if (host.includes(":")) {
    // Unspecified (:: or 0:0:0:0:0:0:0:0) and Loopback (::1 or 0:...:1)
    if (host === "::" || host === "::1" || /^0*(:0*)*:?0*1$/.test(host) || /^0*(:0*)+$/.test(host)) {
      return true;
    }
    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or WHATWG hex encoded ::ffff:7f00:1)
    if (host.startsWith("::ffff:") || host.startsWith("0000:0000:0000:0000:0000:ffff:")) {
      const rest = host.replace(/^(::ffff:|0000:0000:0000:0000:0000:ffff:)/, "");
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(rest)) {
        return isPrivateHost(rest);
      }
      const parts = rest.split(":");
      if (parts.length === 2 && /^[0-9a-f]{1,4}$/i.test(parts[0]) && /^[0-9a-f]{1,4}$/i.test(parts[1])) {
        const high = parseInt(parts[0], 16);
        const low = parseInt(parts[1], 16);
        const a = (high >> 8) & 0xff;
        const b = high & 0xff;
        const c = (low >> 8) & 0xff;
        const d = low & 0xff;
        return isPrivateHost(`${a}.${b}.${c}.${d}`);
      }
      return true; // Any other malformed/unknown mapped address is fail-closed
    }
    // Unique Local Addresses (fc00::/7 -> fc00::/8 and fd00::/8)
    if (host.startsWith("fc") || host.startsWith("fd")) return true;
    // Link-Local Unicast (fe80::/10 -> fe8, fe9, fea, feb)
    if (host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb")) return true;
    // Site-Local (deprecated, fec0::/10)
    if (host.startsWith("fec") || host.startsWith("fed") || host.startsWith("fee") || host.startsWith("fef")) return true;
    // Multicast (ff00::/8)
    if (host.startsWith("ff")) return true;
  }

  return false;
}

/**
 * Sanitizes URLs to prevent XSS (e.g. javascript:, data:, vbscript:),
 * protocol-relative open-redirects (e.g. //attacker.example, /\attacker.example),
 * and SSRF / internal host access (e.g. http://127.0.0.1, http://169.254.169.254, http://[::1]).
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
    if (protocol === "mailto:") {
      const normPrefix = normalized.split(":")[0]?.toLowerCase();
      if (normPrefix === "mailto") {
        return trimmed;
      }
    }

    if (protocol === "http:" || protocol === "https:") {
      // Ensure normalized string starts with the exact safe protocol name
      const normPrefix = normalized.split(":")[0]?.toLowerCase();
      if (normPrefix !== "http" && normPrefix !== "https") {
        return "#";
      }

      // Reject private, loopback, link-local, and cloud metadata hosts (SSRF defense)
      if (isPrivateHost(parsed.hostname)) {
        return "#";
      }

      return trimmed;
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
