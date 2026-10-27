import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Lightweight, privacy-safe application health check endpoint.
 *
 * Used for synthetic uptime monitoring, container liveness checks, and release verification.
 * Exposes zero secrets, configuration keys, or user data.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "stryde",
    uptime_seconds: Math.floor(process.uptime()),
  });
}
