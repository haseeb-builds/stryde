import { NextResponse } from "next/server";
import { assembleSituation } from "@/lib/situation";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(
      request.headers.get("authorization"),
    );
    const { id } = await context.params;
    const result = await assembleSituation(supabase, user.id, id);

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
