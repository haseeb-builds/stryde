import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const provider = (process.env.STRYDE_MODEL_PROVIDER ?? "openrouter").trim().toLowerCase();
  const configured = Boolean(process.env.STRYDE_MODEL_API_KEY?.trim());
  const model = (process.env.STRYDE_MODEL_NAME ?? "openrouter/free").trim();

  return NextResponse.json({
    provider,
    model,
    configured,
    ready: provider === "openrouter" && configured && Boolean(model),
  });
}
