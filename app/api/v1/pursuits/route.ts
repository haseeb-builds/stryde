import { NextResponse } from "next/server";
import { ownerId, requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { ingestPastedSource } from "@/lib/source-ingestion";
import { adaptAndStoreSource } from "@/lib/source-adaptation-store";
import { recordFunnelEvent } from "@/lib/instrumentation";

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
    // A pursuit list is a calm surface, not an archive: the caller caps what
    // it shows. Default keeps responses bounded for long-lived accounts.
    const limitParam = Number(url.searchParams.get("limit") ?? 50);
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitParam) ? limitParam : 50));
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
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return errorResponse("Unable to load pursuits", 500);

    // A return session is a real product signal (the user came back), recorded
    // at most once per UTC day and fail-open.
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { data: returnedToday } = await supabase
      .from("funnel_event")
      .select("id")
      .eq("owner_user_id", ownerId(user))
      .eq("event_type", "RETURN_SESSION")
      .gte("created_at", dayStart.toISOString())
      .limit(1)
      .maybeSingle();
    if (!returnedToday) {
      void recordFunnelEvent(supabase, { ownerUserId: ownerId(user), eventType: "RETURN_SESSION" });
    }

    return NextResponse.json({ pursuits: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(
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
    // A pursuit can start from a goal alone, an existing roadmap from another
    // AI, or a huge messy dump. Whatever it is, Stryde ingests it as a source
    // attached to the new pursuit — never as a wall of text inside a prompt.
    const initialInput =
      "initial_input" in body && typeof body.initial_input === "string"
        ? body.initial_input.trim()
        : "";

    if (title !== null && title.length > 500) {
      return errorResponse("title is too long", 400);
    }
    if (initialInput.length > 120_000) {
      return errorResponse("initial_input is too long (120,000 character maximum)", 413);
    }

    const { data, error } = await supabase.rpc("stryde_create_pursuit", {
      p_title: title,
      p_origin_thread_id: originThreadId,
    });

    if (error || !data) return errorResponse("Unable to create pursuit", 500);
    const pursuit = data as { id: string };

    let intake: { source_id: string; adapted: boolean; warning: string | null } | null = null;
    if (initialInput) {
      const ingested = await ingestPastedSource({ content: initialInput, title: title ?? "Pursuit intake" });
      const { data: source, error: sourceError } = await supabase
        .from("pursuit_source")
        .insert({
          owner_user_id: user.id,
          pursuit_id: pursuit.id,
          source_kind: ingested.sourceKind,
          uri: ingested.uri,
          title: ingested.title,
          content_type: ingested.contentType,
          fetch_status: ingested.fetchStatus,
          content_text: ingested.contentText,
          content_sha256: ingested.contentSha256,
          source_metadata: { ...ingested.sourceMetadata, ingestion: "PURSUIT_INTAKE" },
        })
        .select("id, fetch_status, content_sha256")
        .single();

      if (sourceError || !source) {
        intake = { source_id: "", adapted: false, warning: "The Pursuit was created, but Stryde could not store the initial input." };
      } else if (ingested.fetchStatus === "FAILED" || ingested.fetchStatus === "UNSUPPORTED") {
        intake = { source_id: source.id as string, adapted: false, warning: "The Pursuit was created, but the initial input could not be read." };
      } else {
        const stored = await adaptAndStoreSource({
          supabase,
          ownerUserId: user.id,
          pursuitId: pursuit.id,
          source: {
            id: source.id as string,
            uri: ingested.uri,
            title: ingested.title,
            contentText: ingested.contentText,
            contentSha256: source.content_sha256 as string | null,
            fetchStatus: ingested.fetchStatus,
          },
        });
        intake = { source_id: source.id as string, adapted: Boolean(stored.adaptation_id), warning: stored.warning };
      }
    }

    void recordFunnelEvent(supabase, {
      ownerUserId: user.id,
      eventType: "PURSUIT_CREATED",
      pursuitId: pursuit.id,
      metadata: { with_initial_input: Boolean(initialInput) },
    });

    return NextResponse.json({ pursuit, intake }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return errorResponse("Request body must be valid JSON", 400);
    }

    const message = error instanceof Error ? error.message : "Unauthorized";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
