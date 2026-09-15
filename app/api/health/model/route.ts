import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const provider = (process.env.STRYDE_MODEL_PROVIDER ?? "openai").trim().toLowerCase();
  const configured = Boolean((process.env.STRYDE_MODEL_API_KEY ?? process.env.OPENAI_API_KEY)?.trim());
  const model = (process.env.STRYDE_MODEL_NAME ?? process.env.OPENAI_MODEL ?? "gpt-5.6-luna").trim();

  return NextResponse.json({
    provider,
    model,
    configured,
    ready: provider === "openai" && configured && Boolean(model),
  });
}
