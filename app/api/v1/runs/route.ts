import { NextResponse } from "next/server";
import { createRun, type RunRecord } from "@/lib/run";
import { ownerId, requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(
      request.headers.get("authorization"),
    );
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "25"), 1), 100);

    const { data, error } = await supabase
      .from("run")
      .select(
        "id, owner_user_id, trigger_type, trigger_metadata, current_stage, status, failure_reason, resume_state, wait_state, version, created_at, updated_at, completed_at",
      )
      .eq("owner_user_id", ownerId(user))
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: "Unable to load runs" }, { status: 500 });
    return NextResponse.json({ runs: (data ?? []) as RunRecord[] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.includes("token") ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAuthenticatedSupabase(
      request.headers.get("authorization"),
    );
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const triggerType = "trigger_type" in body && typeof body.trigger_type === "string"
      ? body.trigger_type.trim()
      : "";
    const triggerMetadata =
      "trigger_metadata" in body && body.trigger_metadata !== null && typeof body.trigger_metadata === "object" && !Array.isArray(body.trigger_metadata)
        ? body.trigger_metadata as Record<string, unknown>
        : null;

    if (!triggerType) {
      return NextResponse.json({ error: "trigger_type is required" }, { status: 400 });
    }

    const run = await createRun(supabase, triggerType, triggerMetadata);
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to create Run";
    return NextResponse.json({ error: message }, { status: message.includes("token") ? 401 : 400 });
  }
}
