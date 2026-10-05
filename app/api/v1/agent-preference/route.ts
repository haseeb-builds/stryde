import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { WORKER_TYPES } from "@/lib/actor";
import { loadAgentSelection, saveAgentPreference } from "@/lib/agent-selection";

export const runtime = "nodejs";

// The user's agent preference (Issue #6 decision 2). With no pursuit_id in the
// query, this is the GLOBAL preference; ?pursuit_id=<id> addresses one
// pursuit's override. A null preference means "Stryde chooses". The preference
// is a hint, never authority: the autonomy policy still governs delegation,
// and explicit per-action approval still applies.
export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const pursuitId = new URL(request.url).searchParams.get("pursuit_id");

    if (pursuitId) {
      const { data: owned } = await supabase
        .from("pursuit")
        .select("id")
        .eq("id", pursuitId)
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (!owned) return NextResponse.json({ error: "Pursuit not found" }, { status: 404 });
      const selection = await loadAgentSelection(supabase, user.id, pursuitId);
      return NextResponse.json({
        configured: selection.source !== "STRYDE_AUTO",
        preferred_worker_type: selection.preferred,
        source: selection.source,
        choices: [...WORKER_TYPES],
      });
    }

    const { data } = await supabase
      .from("user_agent_preference")
      .select("preferred_worker_type")
      .eq("owner_user_id", user.id)
      .is("pursuit_id", null)
      .maybeSingle();
    return NextResponse.json({
      configured: Boolean(data),
      preferred_worker_type: data?.preferred_worker_type ?? null,
      choices: [...WORKER_TYPES],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.includes("token") ? 401 : 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }
    const record = body as Record<string, unknown>;
    const preferred = record.preferred_worker_type;
    if (preferred !== null && preferred !== undefined && !(WORKER_TYPES as readonly string[]).includes(preferred as string)) {
      return NextResponse.json({ error: `preferred_worker_type must be null or one of ${WORKER_TYPES.join(", ")}` }, { status: 400 });
    }
    const pursuitId = typeof record.pursuit_id === "string" && record.pursuit_id.trim() ? record.pursuit_id.trim() : null;

    if (pursuitId) {
      const { data: owned } = await supabase
        .from("pursuit")
        .select("id")
        .eq("id", pursuitId)
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (!owned) return NextResponse.json({ error: "Pursuit not found" }, { status: 404 });
    }

    const ok = await saveAgentPreference(supabase, user.id, {
      preferredWorkerType: (preferred ?? null) as never,
      pursuitId,
    });
    if (!ok) {
      console.error("[agent-preference] write failed");
      return NextResponse.json({ error: "Unable to save agent preference" }, { status: 500 });
    }
    return NextResponse.json({ preferred_worker_type: preferred ?? null, pursuit_id: pursuitId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.includes("token") ? 401 : 500 });
  }
}
