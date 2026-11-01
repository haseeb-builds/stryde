import dns from "node:dns/promises";
import { isPrivateHost } from "./sanitization.ts";

export function isPrivateIp(value: string): boolean {
  return isPrivateHost(value);
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
  if (isPrivateHost(parsed.hostname)) {
    throw new Error("Private source hosts are not allowed");
  }

  const lookupHost = parsed.hostname.replace(/^\[|\]$/g, "");
  const addresses = await dns.lookup(lookupHost, { all: true });
  if (!addresses.length || addresses.some((item) => isPrivateHost(item.address))) {
    throw new Error("Source host resolves to a private or local network address");
  }
  return parsed;
}
