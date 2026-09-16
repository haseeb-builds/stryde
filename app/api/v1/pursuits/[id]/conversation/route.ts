import { NextResponse } from "next/server";
import { runConversationTurn, type ConversationMessage } from "@/lib/model-gateway";
import { assembleSituation } from "@/lib/situation";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

type RequestBody = {
  message?: unknown;
  conversation?: unknown;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseConversation(value: unknown): ConversationMessage[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("conversation must be an array");

  return value.slice(-16).map((item) => {
    if (typeof item !== "object" || item === null) throw new Error("Invalid conversation message");
    const message = item as Record<string, unknown>;
    if (message.role !== "user" && message.role !== "stryde") throw new Error("Invalid conversation role");
    if (typeof message.content !== "string" || !message.content.trim()) throw new Error("Conversation content must be non-empty");
    return {
      role: message.role,
      content: message.content.trim().slice(0, 8000),
    } as ConversationMessage;
  });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const body = (await request.json()) as RequestBody;

    if (typeof body.message !== "string" || !body.message.trim()) {
      return errorResponse("message must be a non-empty string", 400);
    }

    const conversation = parseConversation(body.conversation);
    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuit")
      .select("id, title, status")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (pursuitError) return errorResponse("Unable to load Pursuit", 500);
    if (!pursuit) return errorResponse("Pursuit not found", 404);

    const situationResult = await assembleSituation(supabase, user.id, id);
    if (situationResult.error || !situationResult.situation) {
      return errorResponse(situationResult.error ?? "Unable to assemble Situation", 500);
    }

    const result = await runConversationTurn({
      pursuitTitle: pursuit.title ?? "Untitled pursuit",
      situation: situationResult.situation,
      conversation,
      userMessage: body.message,
    });

    return NextResponse.json({
      turn: result.turn,
      model: { provider: result.provider, model: result.model },
    });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Request body must be valid JSON", 400);
    const message = error instanceof Error ? error.message : "Conversation failed";
    return errorResponse(message, message.includes("token") ? 401 : 400);
  }
}
