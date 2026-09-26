import { NextResponse } from "next/server";
import { getExaSearchProvider } from "@/lib/search-provider";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { ingestUrlSource } from "@/lib/source-ingestion";
import { buildSourceCitation } from "@/lib/source-citation";
import { runSourceAdaptation, type SourceAdaptation } from "@/lib/adaptive-model";
import { assembleAdaptiveSituation } from "@/lib/adaptive-situation";

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
    if (body.action !== "MATERIALIZE_RESULT") {
      if (!question || question.length > 1000) return NextResponse.json({ error: "question must be a non-empty string of 1000 characters or fewer" }, { status: 400 });
      if (scope.length > 1000) return NextResponse.json({ error: "scope must be 1000 characters or fewer" }, { status: 400 });
      if (body.freshness_days !== undefined && freshnessDays === null) return NextResponse.json({ error: "freshness_days must be an integer between 1 and 3650" }, { status: 400 });
    }
    const { data: pursuit, error } = await supabase.from("pursuit").select("id, title").eq("id", id).eq("owner_user_id", user.id).maybeSingle();
    if (error) return NextResponse.json({ error: "Unable to load Pursuit" }, { status: 500 });
    if (!pursuit) return NextResponse.json({ error: "Pursuit not found" }, { status: 404 });

    if (body.action === "MATERIALIZE_RESULT") {
      const url = typeof body.url === "string" ? body.url.trim() : "";
      if (!url || url.length > 2000) return NextResponse.json({ error: "url must be provided" }, { status: 400 });
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 500) : null;
      const rank = typeof body.rank === "number" && Number.isInteger(body.rank) ? body.rank : null;
      const highlights = Array.isArray(body.highlights) ? body.highlights.filter((value): value is string => typeof value === "string").slice(0, 5) : [];
      const { data: existing } = await supabase.from("pursuit_source").select("id, source_kind, uri, title, content_type, fetch_status, content_sha256, source_metadata, created_at, updated_at").eq("pursuit_id", id).eq("owner_user_id", user.id).eq("uri", url).maybeSingle();
      if (existing) return NextResponse.json({ source: existing, materialized: false });
      const ingested = await ingestUrlSource(url);
      if (!ingested.contentText || (ingested.fetchStatus !== "FETCHED" && ingested.fetchStatus !== "PARTIAL")) return NextResponse.json({ error: "Selected result could not be extracted into usable source content", status: ingested.fetchStatus }, { status: 502 });
      const sourceMetadata = { ...ingested.sourceMetadata, research_materialization: { search_provider: "exa", result_url: url, result_title: title, result_rank: rank, result_highlights: highlights } };
      const { data: source, error: sourceError } = await supabase.from("pursuit_source").insert({ owner_user_id: user.id, pursuit_id: id, source_kind: "URL", uri: ingested.uri, title: ingested.title ?? title, content_type: ingested.contentType, fetch_status: ingested.fetchStatus, content_text: ingested.contentText, content_sha256: ingested.contentSha256, source_metadata: sourceMetadata }).select("id, source_kind, uri, title, content_type, fetch_status, content_sha256, source_metadata, created_at, updated_at").single();
      if (sourceError || !source) {
        if (sourceError?.code === "23505") {
          const { data: duplicate } = await supabase.from("pursuit_source").select("id, source_kind, uri, title, content_type, fetch_status, content_sha256, source_metadata, created_at, updated_at").eq("pursuit_id", id).eq("owner_user_id", user.id).eq("uri", ingested.uri).maybeSingle();
          if (duplicate) return NextResponse.json({ source: duplicate, materialized: false });
        }
        return NextResponse.json({ error: "Unable to materialize source" }, { status: 500 });
      }
      let adaptation: SourceAdaptation | null = null;
      let warning: string | null = null;
      const situationResult = await assembleAdaptiveSituation(supabase, user.id, id);
      if (!situationResult.error && situationResult.situation) {
        try {
          const adapted = await runSourceAdaptation({ source: { id: source.id, uri: source.uri, title: source.title, content_text: ingested.contentText, content_sha256: source.content_sha256, fetch_status: source.fetch_status }, situation: { ...situationResult.situation, sources: [...situationResult.situation.sources, { ...source, content_text: ingested.contentText }] } });
          const { data: insertedAdaptation, error: adaptationError } = await supabase.from("pursuit_source_adaptation").insert({ owner_user_id: user.id, pursuit_id: id, source_id: source.id, version: 1, status: "ADVISED", ...adapted.adaptation }).select("id, source_id, version, status, summary, source_claims, methods, assumptions, prerequisites, expected_outcomes, unknowns, fit, conflicts, gaps, adapted_strategy, goal_candidates, provenance, created_at").single();
          if (adaptationError || !insertedAdaptation) warning = "Source was materialized, but adaptation could not be persisted.";
          else adaptation = insertedAdaptation as unknown as SourceAdaptation;
        } catch (error) { warning = error instanceof Error ? error.message : "Source adaptation failed"; }
      } else warning = situationResult.error ?? "Unable to assemble situation for source adaptation";
      if (source.content_sha256) {
        const citation = buildSourceCitation({ content: ingested.contentText, contentSha256: source.content_sha256, statement: highlights[0] || title || url, basis: "EXPLICIT_SOURCE" });
        await supabase.from("pursuit_source_citation").insert({ owner_user_id: user.id, pursuit_id: id, source_id: source.id, adaptation_id: adaptation ? (adaptation as { id?: string }).id ?? null : null, source_content_sha256: citation.source_content_sha256, locator: citation.locator, excerpt: citation.excerpt, basis: citation.basis });
      }
      return NextResponse.json({ source, adaptation, materialized: true, warning }, { status: 201 });
    }
    const query = scope ? `${question}\nScope: ${scope}` : question;
    const result = await getExaSearchProvider().search({ query, maxResults, freshnessDays: freshnessDays ?? undefined, signal: request.signal });
    return NextResponse.json({ research: { question, scope: scope || null, freshness_days: freshnessDays ?? null, results: result.results, provider: result.providerMetadata } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research search failed";
    return NextResponse.json({ error: message }, { status: message.includes("token") ? 401 : 502 });
  }
}
