import { timingSafeEqual } from "node:crypto";
import { WORKER_TYPES, type WorkerType } from "./worker-gateway.ts";

// Inbound authentication for the worker plane's HTTP contract.
//
// lib/worker-gateway.ts is the caller: it sends `Authorization: Bearer <token>`
// built from STRYDE_<WORKER>_TOKEN whenever that variable is set. Before this
// module existed nothing on the other side of that socket checked the header, so
// any process that could reach a worker's port could submit and read work. The
// worker servers bind 127.0.0.1 today, but the token is what the plane's
// credential contract (tool.credential_scope = STRYDE_<WORKER>_TOKEN) asserts,
// and an unauthenticated listener contradicts it.
//
// Fails closed exactly like the trusted plane does in
// lib/internal-worker-auth.ts: a worker with no configured token accepts nothing.
// Loosening that would silently re-open the hole, so the deployment must set the
// token rather than the server dropping the check.
//
// Comparison is constant-time and length-checked, matching the trusted plane.

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

// The env prefix is DERIVED from the worker type rather than hardcoded per
// branch, so a third worker type inherits the same configuration contract
// instead of requiring an edit to shared code.
export function workerTokenEnvKey(workerType: WorkerType): string {
  return `STRYDE_${workerType}_TOKEN`;
}

export function workerConfiguredToken(workerType: WorkerType, env: NodeJS.ProcessEnv = process.env): string | null {
  return env[workerTokenEnvKey(workerType)]?.trim() || null;
}

// Reads a Node http.IncomingMessage header bag (always lowercased by Node) and
// returns whether the request carries this worker's bearer token.
export function isAuthorizedWorkerRequest(
  workerType: WorkerType,
  headers: Record<string, string | string[] | undefined>,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const expected = workerConfiguredToken(workerType, env);
  if (!expected) return false;
  const raw = headers["authorization"];
  const provided = Array.isArray(raw) ? raw[0] : raw;
  if (!provided) return false;
  const prefix = "Bearer ";
  if (!provided.startsWith(prefix)) return false;
  return safeEqual(provided.slice(prefix.length), expected);
}

// Guards the env contract: every known worker type must round-trip through the
// derived key, and an unknown type can never be smuggled through.
export function isKnownWorkerType(value: unknown): value is WorkerType {
  return typeof value === "string" && (WORKER_TYPES as readonly string[]).includes(value);
}
