import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { approveSkill, archiveSkill, rejectSkill, reviseSkill, rollbackSkill } from "@/lib/skills";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

// Skill lifecycle transitions. Approve/reject/archive/rollback are policy
// moves; a revision is a NEW version with a fresh security scan — history is
// never edited in place, so rollback always has somewhere to go back to.
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }
    const record = body as Record<string, unknown>;
    const action = record.action;

    if (action === "approve") {
      const result = await approveSkill(supabase, user.id, id);
      return NextResponse.json(result.ok ? { approved: true } : { error: result.message }, { status: result.ok ? 200 : 409 });
    }
    if (action === "reject") {
      const ok = await rejectSkill(supabase, user.id, id);
      return NextResponse.json(ok ? { rejected: true } : { error: "Unable to reject the skill" }, { status: ok ? 200 : 409 });
    }
    if (action === "archive") {
      const ok = await archiveSkill(supabase, user.id, id);
      return NextResponse.json(ok ? { archived: true } : { error: "Unable to archive the skill" }, { status: ok ? 200 : 409 });
    }
    if (action === "rollback") {
      const result = await rollbackSkill(supabase, user.id, id);
      return NextResponse.json(result.ok ? { rolled_back: true } : { error: result.message }, { status: result.ok ? 200 : 409 });
    }
    if (action === "revise") {
      if (record.procedure === undefined) {
        return NextResponse.json({ error: "procedure is required for a revision" }, { status: 400 });
      }
      const result = await reviseSkill(supabase, user.id, id, record.procedure);
      return NextResponse.json(
        result.ok
          ? { revised: true, requires_approval: result.requiresApproval }
          : { error: result.message },
        { status: result.ok ? 200 : 409 },
      );
    }

    return NextResponse.json({ error: "action must be approve, reject, archive, rollback, or revise" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.includes("token") ? 401 : 500 });
  }
}
