import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { fetchPursuitObservations } from "@/lib/pursuit-observations";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(
      request.headers.get("authorization"),
    );
    const { id } = await context.params;

    const { observations, error } = await fetchPursuitObservations(supabase, id);
    if (error === "Pursuit not found") {
      return NextResponse.json({ error: "Pursuit not found" }, { status: 404 });
    }
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    void user;
    return NextResponse.json({ observations: observations ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message.toLowerCase().includes("token") ? 401 : 500 },
    );
  }
}
