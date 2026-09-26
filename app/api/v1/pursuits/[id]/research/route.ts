import { NextResponse } from "next/server";
import { getExaSearchProvider } from "@/lib/search-provider";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const scope = typeof body.scope === "string" ? body.scope.trim() : "";
    const maxResults = typeof body.max_results === "number" && Number.isInteger(body.max_results) ? Math.min(10, Math.max(1, body.max_results)) : 5;
    const freshnessDays = body.freshness_days === undefined ? undefined : typeof body.freshness_days === "number" && Number.isInteger(body.freshness_days) && body.freshness_days > 0 && body.freshness_days <= 3650 ? body.freshness_days : null;
    if (!question || question.length > 1000) return NextResponse.json({ error: "question must be a non-empty string of 1000 characters or fewer" }, { status: 400 });
    if (scope.length > 1000) return NextResponse.json({ error: "scope must be 1000 characters or fewer" }, { status: 400 });
    if (body.freshness_days !== undefined && freshnessDays === null) return NextResponse.json({ error: "freshness_days must be an integer between 1 and 3650" }, { status: 400 });
    const { data: pursuit, error } = await supabase.from("pursuit").select("id, title").eq("id", id).eq("owner_user_id", user.id).maybeSingle();
    if (error) return NextResponse.json({ error: "Unable to load Pursuit" }, { status: 500 });
    if (!pursuit) return NextResponse.json({ error: "Pursuit not found" }, { status: 404 });
    const query = scope ? `${question}\nScope: ${scope}` : question;
    const result = await getExaSearchProvider().search({ query, maxResults, freshnessDays: freshnessDays ?? undefined, signal: request.signal });
    return NextResponse.json({ research: { question, scope: scope || null, freshness_days: freshnessDays ?? null, results: result.results, provider: result.providerMetadata } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research search failed";
    return NextResponse.json({ error: message }, { status: message.includes("token") ? 401 : 502 });
  }
}
