import { NextResponse } from "next/server";
import { ownerId, requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(
      request.headers.get("authorization"),
    );

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const allowedStatuses = new Set([
      "ACTIVE",
      "PAUSED",
      "COMPLETED",
      "ABANDONED",
    ]);

    if (status && !allowedStatuses.has(status)) {
      return errorResponse("Invalid pursuit status", 400);
    }

    let query = supabase
      .from("pursuit")
      .select(
        "id, title, status, objective_claim_id, origin_thread_id, predecessor_pursuit_id, created_at, updated_at, active_at, paused_at, completed_at, abandoned_at",
      )
      .eq("owner_user_id", ownerId(user))
      .order("updated_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return errorResponse("Unable to load pursuits", 500);
    return NextResponse.json({ pursuits: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAuthenticatedSupabase(
      request.headers.get("authorization"),
    );

    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return errorResponse("Request body must be an object", 400);
    }

    const title = "title" in body && typeof body.title === "string"
      ? body.title.trim()
      : null;
    const originThreadId =
      "origin_thread_id" in body && typeof body.origin_thread_id === "string"
        ? body.origin_thread_id
        : null;

    if (title !== null && title.length > 500) {
      return errorResponse("title is too long", 400);
    }

    const { data, error } = await supabase.rpc("stryde_create_pursuit", {
      p_title: title,
      p_origin_thread_id: originThreadId,
    });

    if (error) return errorResponse("Unable to create pursuit", 500);
    return NextResponse.json({ pursuit: data }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return errorResponse("Request body must be valid JSON", 400);
    }

    const message = error instanceof Error ? error.message : "Unauthorized";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
