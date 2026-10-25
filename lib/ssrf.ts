import dns from "node:dns/promises";

export function isPrivateIp(value: string): boolean {
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
  if (
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe8") ||
    ip.startsWith("fe9") ||
    ip.startsWith("fea") ||
    ip.startsWith("feb")
  ) {
    return true;
  }
  return false;
}

export async function assertPublicHttpUrl(value: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Source URL is invalid");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Source URL must use http or https");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Source URL must not include credentials");
  }
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    throw new Error("Source URL must use the standard HTTP(S) ports");
  }
  if (parsed.hostname === "localhost" || parsed.hostname.endsWith(".local") || parsed.hostname.endsWith(".internal")) {
    throw new Error("Private source hosts are not allowed");
  }

  const addresses = await dns.lookup(parsed.hostname, { all: true });
  if (!addresses.length || addresses.some((item) => isPrivateIp(item.address))) {
    throw new Error("Source host resolves to a private or local network address");
  }
  return parsed;
}
