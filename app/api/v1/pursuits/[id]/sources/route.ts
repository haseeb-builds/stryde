import { NextResponse } from "next/server";
import { runSourceAdaptation, type SourceAdaptation } from "@/lib/adaptive-model";
import { assembleAdaptiveSituation } from "@/lib/adaptive-situation";
import { ingestPastedSource, ingestUrlSource } from "@/lib/source-ingestion";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { buildSourceCitation } from "@/lib/source-citation";

export const runtime = "nodejs";
export const maxDuration = 55;

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function nullableText(value: unknown, max: number) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Expected a string");
  const result = value.trim();
  if (result.length > max) throw new Error("Text exceeds maximum length");
  return result || null;
}

function normalizeAdaptationRows(rows: Array<Record<string, unknown>>) {
  const latestBySource = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const sourceId = typeof row.source_id === "string" ? row.source_id : "";
    if (sourceId && !latestBySource.has(sourceId)) latestBySource.set(sourceId, row);
  }
  return [...latestBySource.values()];
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;

    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuit")
      .select("id")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (pursuitError) return errorResponse("Unable to load Pursuit", 500);
    if (!pursuit) return errorResponse("Pursuit not found", 404);

    const { data: sources, error: sourcesError } = await supabase
      .from("pursuit_source")
      .select("id, source_kind, uri, title, content_type, fetch_status, content_sha256, source_metadata, created_at, updated_at")
      .eq("owner_user_id", user.id)
      .eq("pursuit_id", id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (sourcesError) return errorResponse("Unable to load source material", 500);

    const { data: citations, error: citationsError } = await supabase
      .from("pursuit_source_citation")
      .select("id, source_id, adaptation_id, source_content_sha256, locator, excerpt, basis, created_at")
      .eq("owner_user_id", user.id)
      .eq("pursuit_id", id)
      .order("created_at", { ascending: true });
    if (citationsError) return errorResponse("Unable to load source citations", 500);

    const sourceIds = (sources ?? []).map((row) => row.id);
    let adaptations: Record<string, unknown>[] = [];
    if (sourceIds.length) {
      const { data, error } = await supabase
        .from("pursuit_source_adaptation")
        .select("id, source_id, version, status, summary, source_claims, methods, assumptions, prerequisites, expected_outcomes, unknowns, fit, conflicts, gaps, adapted_strategy, goal_candidates, provenance, created_at")
        .eq("owner_user_id", user.id)
        .eq("pursuit_id", id)
        .in("source_id", sourceIds)
        .order("version", { ascending: false })
        .limit(50);
      if (error) return errorResponse("Unable to load source adaptations", 500);
      adaptations = normalizeAdaptationRows((data ?? []) as Record<string, unknown>[]);
    }

    return NextResponse.json({ sources: sources ?? [], adaptations, citations: citations ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load sources";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const url = nullableText(body.url, 2_000);
    const content = nullableText(body.content, 120_000);
    const title = nullableText(body.title, 500);
    const pastedUri = nullableText(body.uri, 2_000);

    if (!!url === !!content) {
      return errorResponse("Provide exactly one of url or content", 400);
    }

    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuit")
      .select("id, title")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (pursuitError) return errorResponse("Unable to load Pursuit", 500);
    if (!pursuit) return errorResponse("Pursuit not found", 404);

    const ingested = url
      ? await ingestUrlSource(url)
      : await ingestPastedSource({ content: content!, title, uri: pastedUri });

    const { data: source, error: sourceError } = await supabase
      .from("pursuit_source")
      .insert({
        owner_user_id: user.id,
        pursuit_id: id,
        source_kind: ingested.sourceKind,
        uri: ingested.uri,
        title: ingested.title ?? title,
        content_type: ingested.contentType,
        fetch_status: ingested.fetchStatus,
        content_text: ingested.contentText,
        content_sha256: ingested.contentSha256,
        source_metadata: ingested.sourceMetadata,
      })
      .select("id, source_kind, uri, title, content_type, fetch_status, content_sha256, source_metadata, created_at, updated_at")
      .single();

    if (sourceError || !source) {
      const message = sourceError?.code === "23505"
        ? "This source is already attached to this Pursuit."
        : "Unable to save source material";
      return errorResponse(message, sourceError?.code === "23505" ? 409 : 500);
    }

    let adaptation: SourceAdaptation | null = null;
    let adaptationWarning: string | null = null;

    if (ingested.contentText) {
      const situationResult = await assembleAdaptiveSituation(supabase, user.id, id);
      if (situationResult.error || !situationResult.situation) {
        adaptationWarning = situationResult.error ?? "Unable to assemble situation for source adaptation";
      } else {
        try {
          const result = await runSourceAdaptation({
            source: {
              id: source.id,
              uri: source.uri,
              title: source.title,
              content_text: ingested.contentText,
              content_sha256: source.content_sha256,
              fetch_status: source.fetch_status,
            },
            situation: {
              ...situationResult.situation,
              sources: [
                ...situationResult.situation.sources,
                {
                  ...source,
                  content_text: ingested.contentText,
                },
              ],
            },
          });

          const { data: insertedAdaptation, error: adaptationError } = await supabase
            .from("pursuit_source_adaptation")
            .insert({
              owner_user_id: user.id,
              pursuit_id: id,
              source_id: source.id,
              version: 1,
              status: "ADVISED",
              ...result.adaptation,
            })
            .select("id, source_id, version, status, summary, source_claims, methods, assumptions, prerequisites, expected_outcomes, unknowns, fit, conflicts, gaps, adapted_strategy, goal_candidates, provenance, created_at")
            .single();

          if (adaptationError || !insertedAdaptation) {
            adaptationWarning = "Source was saved, but its adaptation could not be persisted.";
          } else {
            adaptation = insertedAdaptation as unknown as SourceAdaptation;

            const sourceClaims = Array.isArray(result.adaptation.source_claims) ? result.adaptation.source_claims : [];
            if (sourceClaims.length && ingested.contentText && source.content_sha256) {
              const citations = sourceClaims.map((item) => ({
                owner_user_id: user.id,
                pursuit_id: id,
                source_id: source.id,
                adaptation_id: insertedAdaptation.id,
                ...buildSourceCitation({ content: ingested.contentText!, contentSha256: source.content_sha256, statement: typeof item.statement === "string" ? item.statement : "", basis: typeof item.basis === "string" ? item.basis : "INFERRED" }),
              }));
              if (citations.length) await supabase.from("pursuit_source_citation").insert(citations);
            }
          }
        } catch (error) {
          adaptationWarning = error instanceof Error ? error.message : "Source adaptation failed";
        }
      }
    } else {
      adaptationWarning = ingested.fetchStatus === "UNSUPPORTED"
        ? "Stryde saved the source, but the current runtime cannot extract usable text from it yet."
        : ingested.fetchStatus === "FAILED"
          ? "Stryde saved the source reference, but fetching its contents failed."
          : "The source did not yield usable text.";
    }

    return NextResponse.json(
      { source, adaptation, warning: adaptationWarning },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Request body must be valid JSON", 400);
    const message = error instanceof Error ? error.message : "Unable to add source";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
