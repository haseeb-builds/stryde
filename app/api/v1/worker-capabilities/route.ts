import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
const WORKERS = ["worker.hermes", "worker.opencode"] as const;
type Context = { params: Promise<Record<string, never>> };

export async function GET(request: Request) {
  const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
  const { data, error } = await supabase.from("capability_grant").select("id,tool_id,granted_at,expires_at,revoked_at,tool:tool_id(tool_key,tool_version)").eq("owner_user_id", user.id).is("revoked_at", null);
  if (error) return NextResponse.json({ error: "Unable to load worker capabilities" }, { status: 500 });
  return NextResponse.json({ capabilities: (data ?? []).filter((grant) => WORKERS.includes((grant.tool as { tool_key?: string } | null)?.tool_key as typeof WORKERS[number])) });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
  const body = (await request.json()) as { worker_type?: unknown };
  const toolKey = body.worker_type === "HERMES" ? "worker.hermes" : body.worker_type === "OPENCODE" ? "worker.opencode" : null;
  if (!toolKey) return NextResponse.json({ error: "worker_type must be HERMES or OPENCODE" }, { status: 400 });
  const { data: tool, error: toolError } = await supabase.from("tool").select("id").eq("tool_key", toolKey).eq("tool_version", "v1").maybeSingle();
  if (toolError || !tool) return NextResponse.json({ error: "Worker capability is not registered" }, { status: 409 });
  const { data, error } = await supabase.from("capability_grant").insert({ owner_user_id: user.id, tool_id: tool.id, scope_constraints: { worker_type: body.worker_type } }).select("id,tool_id,granted_at,expires_at").single();
  if (error) return NextResponse.json({ error: "Unable to enable worker capability" }, { status: 500 });
  return NextResponse.json({ capability: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const { error } = await supabase.from("capability_grant").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("owner_user_id", user.id).is("revoked_at", null);
  if (error) return NextResponse.json({ error: "Unable to revoke worker capability" }, { status: 500 });
  return NextResponse.json({ revoked: true });
}
