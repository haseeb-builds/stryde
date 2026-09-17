import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string; sessionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id, sessionId } = await context.params;
    const { data: session, error: sessionError } = await supabase
      .from("conversation_session")
      .select("id, pursuit_id, title, status, created_at, updated_at")
      .eq("id", sessionId)
      .eq("pursuit_id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (sessionError) return NextResponse.json({ error: "Unable to load conversation" }, { status: 500 });
    if (!session) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    const { data: messages, error: messageError } = await supabase
      .from("conversation_message")
      .select("id, role, content, sequence_no, metadata, created_at")
      .eq("session_id", sessionId)
      .eq("owner_user_id", user.id)
      .order("sequence_no", { ascending: true });
    if (messageError) return NextResponse.json({ error: "Unable to load conversation messages" }, { status: 500 });

    return NextResponse.json({
      session,
      messages: (messages ?? []).map((message) => ({
        id: message.id,
        role: message.role === "USER" ? "user" : "stryde",
        content: message.content,
        sequence_no: message.sequence_no,
        metadata: message.metadata,
        created_at: message.created_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load conversation";
    return NextResponse.json({ error: message }, { status: message.includes("token") ? 401 : 500 });
  }
}
