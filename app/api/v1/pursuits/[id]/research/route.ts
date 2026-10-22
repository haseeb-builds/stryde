import { NextResponse } from "next/server";
import { getSearchProviderChain } from "@/lib/search-provider";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { ingestUrlSource } from "@/lib/source-ingestion";
import { buildSourceCitation } from "@/lib/source-citation";
import { runSourceAdaptation, type SourceAdaptation } from "@/lib/adaptive-model";
import { assembleAdaptiveSituation } from "@/lib/adaptive-situation";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { reserveResources, ResourceExhaustedError, type ReservationGroup } from "@/lib/resource-control";
import { classifyResults } from "@/lib/research-planner";
import { updateAdaptationAuditStatus } from "@/lib/research-orchestration";

export const runtime = "nodejs";
export const maxDuration = 120;
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

      const service = getSupabaseServiceClient();
      const operationKey = `source_extraction:${user.id}:${Buffer.from(url).toString("base64").slice(0, 32)}:${Date.now()}`;
      let reservation: ReservationGroup;
      try {
        reservation = await reserveResources(service, {
          ownerUserId: user.id,
          pursuitId: id,
          operationKey,
          capabilityKey: "sources.url_ingest",
          requests: [{ resource: "source_extraction", expected: 1 }],
        });
      } catch (resError) {
        if (resError instanceof ResourceExhaustedError) {
          return NextResponse.json(
            { error: "Daily plan limit reached for source extractions. Your plan resets tomorrow." },
            { status: 429 },
          );
        }
        return NextResponse.json(
          { error: "Resource control is unavailable; source extraction is refused rather than unmetered" },
          { status: 503 },
        );
      }

      let ingested;
      try {
        ingested = await ingestUrlSource(url);
      } catch (ingestError) {
        await reservation.release().catch(() => {});
        throw ingestError;
      }

      if (!ingested.contentText || (ingested.fetchStatus !== "FETCHED" && ingested.fetchStatus !== "PARTIAL")) {
        await reservation.release().catch(() => {});
        return NextResponse.json({ error: "Selected result could not be extracted into usable source content", status: ingested.fetchStatus }, { status: 502 });
      }

      try {
        await reservation.reconcile([{ resource: "source_extraction", expected: 1 }]);
      } catch {
        await reservation.release().catch(() => {});
        return NextResponse.json({ error: "Resource reconciliation failed; extraction cannot be confirmed" }, { status: 503 });
      }
      // Syndication record: identical content under a different URI is a
      // shared primary source, not independent corroboration (Phase 8).
      const { data: shaTwin } = ingested.contentSha256
        ? await supabase.from("pursuit_source").select("id, uri").eq("pursuit_id", id).eq("owner_user_id", user.id).eq("content_sha256", ingested.contentSha256).limit(1).maybeSingle()
        : { data: null };
      const sourceMetadata = { ...ingested.sourceMetadata, research_materialization: { search_provider: "exa", result_url: url, result_title: title, result_rank: rank, result_highlights: highlights }, ...(shaTwin ? { syndication: { canonical_source_id: shaTwin.id, canonical_uri: shaTwin.uri } } : {}) };
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
      if (source.content_sha256 && ingested.contentText) {
        const citation = buildSourceCitation({ content: ingested.contentText, contentSha256: source.content_sha256, statement: highlights[0] || title || url, basis: "EXPLICIT_SOURCE" });
        if (citation) {
          const { error: citError } = await supabase.from("pursuit_source_citation").insert({ owner_user_id: user.id, pursuit_id: id, source_id: source.id, adaptation_id: adaptation ? (adaptation as { id?: string }).id ?? null : null, source_content_sha256: citation.source_content_sha256, locator: citation.locator, excerpt: citation.excerpt, basis: citation.basis });
          if (citError) {
            warning = `Source was materialized, but citation could not be persisted: ${citError.message}`;
            if (adaptation && (adaptation as { id?: string }).id) {
              const serviceClient = getSupabaseServiceClient();
              const unverifiedMethods = (Array.isArray(adaptation.methods) ? adaptation.methods : []).map(
                (m: Record<string, unknown>) => ({ ...m, audit_status: "UNVERIFIED" })
              );
              const statusRes = await updateAdaptationAuditStatus(serviceClient, {
                adaptationId: (adaptation as unknown as { id: string }).id,
                ownerUserId: user.id,
                pursuitId: id,
                summary: `Materialized source citation persistence failed: ${citError.message}`,
                methods: unverifiedMethods,
                provenance: {
                  ...(typeof adaptation.provenance === "object" && adaptation.provenance !== null ? (adaptation.provenance as Record<string, unknown>) : {}),
                  audit_status: "INCOMPLETE",
                  citation_error: citError.message,
                },
              });
              if (!statusRes.success) warning += ` (warning: audit update failed: ${statusRes.error})`;
            }
          }
        } else if (adaptation && (adaptation as { id?: string }).id) {
          const serviceClient = getSupabaseServiceClient();
          const unverifiedMethods = (Array.isArray(adaptation.methods) ? adaptation.methods : []).map(
            (m: Record<string, unknown>) => ({ ...m, audit_status: "UNVERIFIED" })
          );
          const statusRes = await updateAdaptationAuditStatus(serviceClient, {
            adaptationId: (adaptation as unknown as { id: string }).id,
            ownerUserId: user.id,
            pursuitId: id,
            summary: "Materialized source citation could not be verified in text.",
            methods: unverifiedMethods,
            provenance: {
              ...(typeof adaptation.provenance === "object" && adaptation.provenance !== null ? (adaptation.provenance as Record<string, unknown>) : {}),
              audit_status: "INCOMPLETE",
              unsubstantiated: true,
            },
          });
          warning = "Source was materialized, but citation could not be verified in text.";
          if (!statusRes.success) warning += ` (warning: audit update failed: ${statusRes.error})`;
        }
      }
      return NextResponse.json({ source, adaptation, materialized: true, warning }, { status: 201 });
    }
    const query = scope ? `${question}\nScope: ${scope}` : question;
    // Resource control (server-side, mandatory): reserve the round plus the
    // discovery budget before any provider call; reconcile with the actual
    // result count, or release when no provider served. Exhaustion is an
    // honest 429, not a silent overspend.
    const service = getSupabaseServiceClient();
    let reservation: ReservationGroup | null = null;
    try {
      reservation = await reserveResources(service, {
        ownerUserId: user.id,
        pursuitId: id,
        operationKey: "research.search",
        capabilityKey: "research.web_search",
        requests: [
          { resource: "research_rounds", expected: 1 },
          { resource: "source_discovery", expected: maxResults },
        ],
      });
    } catch (reserveError) {
      if (reserveError instanceof ResourceExhaustedError) {
        return NextResponse.json({ error: `Daily plan limit reached: ${reserveError.resource}` }, { status: 429 });
      }
      return NextResponse.json({ error: "Resource control is unavailable; research is refused rather than unmetered" }, { status: 503 });
    }
    // Walk the configured provider chain in preferred order (D11: appropriate
    // evidence) — first successful call serves the request; the last failure
    // surfaces only when every configured leg failed.
    let lastSearchError: unknown = null;
    let search: { results: Array<{ url?: string } & Record<string, unknown>>; providerMetadata: Record<string, unknown> } | null = null;
    try {
      for (const provider of getSearchProviderChain()) {
        try {
          search = await provider.search({ query, maxResults, freshnessDays: freshnessDays ?? undefined, signal: request.signal });
          break;
        } catch (searchError) {
          lastSearchError = searchError;
        }
      }
      if (!search) {
        throw lastSearchError ?? new Error("Missing research configuration: no search provider is configured");
      }
      await reservation.reconcile([
        { resource: "research_rounds", expected: 1 },
        { resource: "source_discovery", expected: search.results.length },
      ]);
      // Evidence-graph classification (Phases 7-8): the same content behind
      // two URIs is one piece of evidence. Annotate each result with its
      // novelty against the pursuit's existing sources so neither the model
      // nor the user mistakes syndication for independent corroboration.
      const { data: knownSources } = await supabase
        .from("pursuit_source")
        .select("uri, content_sha256")
        .eq("pursuit_id", id)
        .eq("owner_user_id", user.id);
      const classified = classifyResults(
        search.results.map((r) => ({ url: r.url, content_sha256: (r as { content_sha256?: string | null }).content_sha256 ?? null })),
        (knownSources ?? []) as Array<{ uri: string; content_sha256: string | null }>,
      );
      const noveltyByUrl = new Map(classified.map((c) => [c.url, c]));
      const annotated = search.results.map((r) => ({
        ...r,
        novelty: noveltyByUrl.get(String(r.url ?? ""))?.novelty ?? "NOVEL",
        canonical_uri: noveltyByUrl.get(String(r.url ?? ""))?.canonicalUri ?? null,
      }));
      return NextResponse.json({ research: { question, scope: scope || null, freshness_days: freshnessDays ?? null, results: annotated, provider: search.providerMetadata, novelty: { novel: annotated.filter((r) => r.novelty === "NOVEL").length, duplicate: annotated.filter((r) => r.novelty === "DUPLICATE").length, syndicated: annotated.filter((r) => r.novelty === "SYNDICATED").length } } });
    } catch (searchError) {
      await reservation.release().catch(() => {});
      throw searchError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research search failed";
    return NextResponse.json({ error: message }, { status: message.includes("token") ? 401 : 502 });
  }
}
