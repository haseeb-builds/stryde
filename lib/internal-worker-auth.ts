import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

export function requireWorkerSecret(request: Request): void {
  const expected = process.env.STRYDE_WORKER_SECRET;
  const provided = request.headers.get("x-stryde-worker-secret");
  if (!expected || !provided || !safeEqual(provided, expected)) {
    throw new Error("Worker authentication failed");
  }
}
