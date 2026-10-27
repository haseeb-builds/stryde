import { createHash } from "node:crypto";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Stryde dedicated namespace for mapping non-UUID opaque idempotency keys to UUIDv5:
// Same namespace ensures: same input string -> exact same deterministic UUID forever.
const IDEMPOTENCY_NAMESPACE = "4f8a9e22-6b3c-4d1e-8f5a-7c9b0e1d2f3a";

function uuidStringToBytes(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, "");
  return Buffer.from(hex, "hex");
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

/**
 * Ensures any key passed to database UUID columns is guaranteed to be a valid UUID.
 * If the input is already a valid UUID, normalizes to lowercase canonical string.
 * If the input is an arbitrary string (e.g. "idem-abc-123"), deterministically maps
 * it to a RFC 4122 Section 4.3 UUIDv5 using the fixed Stryde idempotency namespace.
 */
export function turnKeyToUuid(key: string): string {
  const trimmed = key.trim();
  if (isUuid(trimmed)) {
    return trimmed.toLowerCase();
  }

  const digest = createHash("sha1")
    .update(uuidStringToBytes(IDEMPOTENCY_NAMESPACE))
    .update(trimmed, "utf8")
    .digest();

  digest[6] = (digest[6] & 0x0f) | 0x50; // version 5
  digest[8] = (digest[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = digest.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export interface ResolvedTurnKey {
  rawKey: string;
  uuidKey: string;
  source: "body" | "header";
}

/**
 * Resolves the turn/idempotency key from request body and headers.
 * Contract:
 * 1. Body `turn_key` takes precedence when provided as a non-empty string.
 * 2. Header `Idempotency-Key` or `X-Idempotency-Key` is used when body key is absent.
 * 3. Returns null if neither is provided.
 * 4. `uuidKey` is guaranteed to be a valid, deterministic UUID format compatible with DB constraints.
 */
export function resolveTurnKey(
  bodyTurnKey: unknown,
  headers: Headers
): ResolvedTurnKey | null {
  if (typeof bodyTurnKey === "string" && bodyTurnKey.trim().length > 0) {
    const rawKey = bodyTurnKey.trim();
    return {
      rawKey,
      uuidKey: turnKeyToUuid(rawKey),
      source: "body",
    };
  }

  const headerKey =
    headers.get("idempotency-key") || headers.get("x-idempotency-key");
  if (headerKey && headerKey.trim().length > 0) {
    const rawKey = headerKey.trim();
    return {
      rawKey,
      uuidKey: turnKeyToUuid(rawKey),
      source: "header",
    };
  }

  return null;
}

/**
 * Validates that a repeated submission with the same idempotency key matches
 * the original payload. If the payload differs, it represents an unsafe conflict.
 */
export function validateTurnPayloadMatch(
  originalPayload: string,
  newPayload: string
): boolean {
  return originalPayload.trim() === newPayload.trim();
}
