import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SUPPORTED_PROVIDERS = new Set(["gemini", "openrouter", "groq"]);

export async function GET() {
  const provider = (process.env.STRYDE_MODEL_PROVIDER ?? "gemini").trim().toLowerCase();
  const configured = Boolean(process.env.STRYDE_MODEL_API_KEY?.trim());
  const model = (process.env.STRYDE_MODEL_NAME ?? "gemini-2.5-flash").trim();

  return NextResponse.json({
    provider,
    model,
    configured,
    ready: SUPPORTED_PROVIDERS.has(provider) && configured && Boolean(model),
  });
}
