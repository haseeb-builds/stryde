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

    const { data, error } = await supabase
      .from("thread")
      .select("id, status, content, created_at, updated_at")
      .eq("owner_user_id", ownerId(user))
      .order("created_at", { ascending: false });

    if (error) return errorResponse("Unable to load threads", 500);
    return NextResponse.json({ threads: data ?? [] });
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
    if (
      typeof body !== "object" ||
      body === null ||
      !("content" in body) ||
      typeof body.content !== "string" ||
      body.content.trim().length === 0 ||
      body.content.length > 10000
    ) {
      return errorResponse("content must be a non-empty string", 400);
    }

    const { data, error } = await supabase.rpc("stryde_create_thread", {
      p_content: body.content.trim(),
    });

    if (error) return errorResponse("Unable to create thread", 500);
    return NextResponse.json({ thread: data }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return errorResponse("Request body must be valid JSON", 400);
    }
    const message = error instanceof Error ? error.message : "Unauthorized";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
