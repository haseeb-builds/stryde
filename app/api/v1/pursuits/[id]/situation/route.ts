import { NextResponse } from "next/server";
import { assembleSituation } from "@/lib/situation";
import { assembleAdaptiveSituation } from "@/lib/adaptive-situation";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// ?adaptive=1 returns the full adaptive situation (memories, episodic memory,
// sources, capabilities) that actually reaches the model — read-only and
// owner-scoped, so what Stryde "sees" stays inspectable.
export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(
      request.headers.get("authorization"),
    );
    const { id } = await context.params;
    const adaptive = new URL(request.url).searchParams.get("adaptive") === "1";

    const result = adaptive
      ? await assembleAdaptiveSituation(supabase, user.id, id)
      : await assembleSituation(supabase, user.id, id);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === "Pursuit not found" ? 404 : 500 },
      );
    }

    return NextResponse.json({ situation: result.situation });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message.includes("token") ? 401 : 500 },
    );
  }
}
