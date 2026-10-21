import type { SupabaseClient } from "@supabase/supabase-js";
import { runSourceAdaptation, type SourceAdaptation } from "@/lib/adaptive-model";
import { assembleAdaptiveSituation } from "@/lib/adaptive-situation";
import { buildSourceCitation } from "@/lib/source-citation";
import { ingestPastedSource, ingestUrlSource } from "@/lib/source-ingestion";
import { detectPastedRoadmapFromText } from "@/lib/research-orchestration";

const MAX_URLS_PER_TURN = 2;

export type UniversalUrlResult = {
  requested_url: string;
  source_id: string | null;
  status: string;
  title: string | null;
  adapted: boolean;
  warning: string | null;
};

export type UniversalInputResult = {
  urls: UniversalUrlResult[];
  handled: boolean;
  pasted_source?: {
    source_id: string | null;
    title: string;
    adapted: boolean;
    warning: string | null;
  } | null;
};

function cleanUrl(value: string): string | null {
  const withoutPunctuation = value.replace(/[),.!?;:'"]+$/g, "");
  try {
    const parsed = new URL(withoutPunctuation);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function extractUrls(text: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  const matches = text.match(/https?:\/\/[^\s<>\]]+/gi) ?? [];

  for (const raw of matches) {
    const url = cleanUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= MAX_URLS_PER_TURN) break;
  }

  return urls;
}

export async function processUniversalInput(
  supabase: SupabaseClient,
  ownerUserId: string,
  pursuitId: string,
  inputText: string,
): Promise<UniversalInputResult> {
  const urls = extractUrls(inputText);
  if (!urls.length) {
    const roadmap = detectPastedRoadmapFromText(inputText);
    if (!roadmap.isRoadmap) return { urls: [], handled: false, pasted_source: null };

    try {
      const ingested = await ingestPastedSource({
        content: roadmap.content,
        title: roadmap.title,
      });

      const { data: source, error: sourceError } = await supabase
        .from("pursuit_source")
        .insert({
          owner_user_id: ownerUserId,
          pursuit_id: pursuitId,
          source_kind: ingested.sourceKind,
          uri: ingested.uri,
          title: ingested.title,
          content_type: ingested.contentType,
          fetch_status: ingested.fetchStatus,
          content_text: ingested.contentText,
          content_sha256: ingested.contentSha256,
          source_metadata: {
            ...ingested.sourceMetadata,
            ingestion: "UNIVERSAL_COMPOSER_PASTED_ROADMAP",
          },
        })
        .select("id, source_kind, uri, title, content_type, fetch_status, content_sha256, source_metadata, created_at, updated_at")
        .single();

      let activeSource = source;
      if (sourceError || !activeSource) {
        if (sourceError?.code === "23505") {
          const { data: duplicate } = await supabase
            .from("pursuit_source")
            .select("id, source_kind, uri, title, content_type, fetch_status, content_sha256, source_metadata, created_at, updated_at")
            .eq("owner_user_id", ownerUserId)
            .eq("pursuit_id", pursuitId)
            .eq("content_sha256", ingested.contentSha256)
            .limit(1)
            .maybeSingle();
          activeSource = duplicate ?? null;
        }
      }

      if (!activeSource) {
        return {
          urls: [],
          handled: false,
          pasted_source: { source_id: null, title: roadmap.title, adapted: false, warning: "Could not save pasted roadmap" },
        };
      }

      let adaptation: SourceAdaptation | null = null;
      let warning: string | null = null;
      const situationResult = await assembleAdaptiveSituation(supabase, ownerUserId, pursuitId);
      if (!situationResult.error && situationResult.situation && ingested.contentText) {
        try {
          const adapted = await runSourceAdaptation({
            source: {
              id: activeSource.id,
              uri: activeSource.uri,
              title: activeSource.title,
              content_text: ingested.contentText,
              content_sha256: activeSource.content_sha256,
              fetch_status: activeSource.fetch_status,
            },
            situation: {
              ...situationResult.situation,
              sources: [
                ...situationResult.situation.sources,
                { ...activeSource, content_text: ingested.contentText },
              ],
            },
          });

          // Mandate: In preliminary roadmap intake before required research runs,
          // methods must not masquerade as research-verified audit findings.
          // Set unverified methods explicitly to UNVERIFIED.
          const preliminaryMethods = (adapted.adaptation.methods ?? []).map((m) => ({
            ...m,
            audit_status: "UNVERIFIED" as const,
          }));

          const { data: insertedAdaptation, error: adaptationError } = await supabase
            .from("pursuit_source_adaptation")
            .insert({
              owner_user_id: ownerUserId,
              pursuit_id: pursuitId,
              source_id: activeSource.id,
              version: 1,
              status: "ADVISED",
              ...adapted.adaptation,
              methods: preliminaryMethods,
            })
            .select("id, source_id, version, status, summary, source_claims, methods, assumptions, prerequisites, expected_outcomes, unknowns, fit, conflicts, gaps, adapted_strategy, goal_candidates, provenance, created_at")
            .single();

          if (!adaptationError && insertedAdaptation) {
            adaptation = insertedAdaptation as unknown as SourceAdaptation;
            const sourceClaims = Array.isArray(adapted.adaptation.source_claims) ? adapted.adaptation.source_claims : [];
            if (sourceClaims.length && activeSource.content_sha256 && ingested.contentText) {
              const citations = [];
              for (const item of sourceClaims) {
                const stmt = typeof item.statement === "string" ? item.statement.trim() : "";
                if (!stmt) continue;
                const built = buildSourceCitation({
                  content: ingested.contentText,
                  contentSha256: activeSource.content_sha256,
                  statement: stmt,
                  basis: typeof item.basis === "string" ? item.basis : "INFERRED",
                });
                if (built) {
                  citations.push({
                    owner_user_id: ownerUserId,
                    pursuit_id: pursuitId,
                    source_id: activeSource.id,
                    adaptation_id: insertedAdaptation.id,
                    ...built,
                  });
                }
              }
              if (citations.length) {
                const { error: insertError } = await supabase.from("pursuit_source_citation").insert(citations);
                if (insertError) {
                  warning = `Roadmap was saved, but evidence citations could not be persisted: ${insertError.message}`;
                }
              }
              if (citations.length < sourceClaims.length) {
                warning = `Roadmap partially verified: ${citations.length} of ${sourceClaims.length} claims substantiated.`;
              }
            }
          } else {
            warning = "Roadmap source saved, but adaptation could not be persisted.";
          }
        } catch (error) {
          warning = error instanceof Error ? error.message : "Roadmap adaptation failed.";
        }
      }

      return {
        urls: [],
        handled: true,
        pasted_source: {
          source_id: activeSource.id,
          title: roadmap.title,
          adapted: Boolean(adaptation),
          warning,
        },
      };
    } catch (error) {
      return {
        urls: [],
        handled: false,
        pasted_source: {
          source_id: null,
          title: roadmap.title,
          adapted: false,
          warning: error instanceof Error ? error.message : "Unable to ingest pasted roadmap",
        },
      };
    }
  }

  const results: UniversalUrlResult[] = [];

  for (const requestedUrl of urls) {
    try {
      const { data: existing, error: existingError } = await supabase
        .from("pursuit_source")
        .select("id, source_kind, uri, title, content_type, fetch_status, content_sha256, source_metadata, created_at, updated_at")
        .eq("owner_user_id", ownerUserId)
        .eq("pursuit_id", pursuitId)
        .eq("uri", requestedUrl)
        .limit(1)
        .maybeSingle();

      if (existingError) throw new Error("Unable to inspect existing source");

      if (existing) {
        results.push({
          requested_url: requestedUrl,
          source_id: existing.id as string,
          status: existing.fetch_status as string,
          title: (existing.title as string | null) ?? null,
          adapted: false,
          warning: "This source is already attached to the Pursuit.",
        });
        continue;
      }

      const ingested = await ingestUrlSource(requestedUrl);

      const { data: source, error: sourceError } = await supabase
        .from("pursuit_source")
        .insert({
          owner_user_id: ownerUserId,
          pursuit_id: pursuitId,
          source_kind: ingested.sourceKind,
          uri: ingested.uri,
          title: ingested.title,
          content_type: ingested.contentType,
          fetch_status: ingested.fetchStatus,
          content_text: ingested.contentText,
          content_sha256: ingested.contentSha256,
          source_metadata: {
            ...ingested.sourceMetadata,
            ingestion: "UNIVERSAL_COMPOSER",
          },
        })
        .select("id, source_kind, uri, title, content_type, fetch_status, content_sha256, source_metadata, created_at, updated_at")
        .single();

      if (sourceError || !source) {
        if (sourceError?.code === "23505") {
          const { data: duplicate } = await supabase
            .from("pursuit_source")
            .select("id, source_kind, uri, title, content_type, fetch_status, content_sha256, source_metadata, created_at, updated_at")
            .eq("owner_user_id", ownerUserId)
            .eq("pursuit_id", pursuitId)
            .eq("uri", ingested.uri)
            .limit(1)
            .maybeSingle();

          if (duplicate) {
            results.push({
              requested_url: requestedUrl,
              source_id: duplicate.id as string,
              status: duplicate.fetch_status as string,
              title: (duplicate.title as string | null) ?? null,
              adapted: false,
              warning: "This source was already attached to the Pursuit.",
            });
            continue;
          }
        }
        throw new Error("Unable to save source");
      }

      let adaptation: SourceAdaptation | null = null;
      let warning: string | null = ingested.fetchStatus === "FAILED"
        ? "Stryde attached the link, but its contents could not be fetched."
        : ingested.fetchStatus === "UNSUPPORTED"
          ? "Stryde attached the link, but the current extractor could not read its contents."
          : null;

      if (ingested.contentText) {
        const situationResult = await assembleAdaptiveSituation(supabase, ownerUserId, pursuitId);
        if (!situationResult.error && situationResult.situation) {
          try {
            const adapted = await runSourceAdaptation({
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
                  { ...source, content_text: ingested.contentText },
                ],
              },
            });

            const preliminaryMethods = (adapted.adaptation.methods ?? []).map((m) => ({
              ...m,
              audit_status: "UNVERIFIED" as const,
            }));

            const { data: insertedAdaptation, error: adaptationError } = await supabase
              .from("pursuit_source_adaptation")
              .insert({
                owner_user_id: ownerUserId,
                pursuit_id: pursuitId,
                source_id: source.id,
                version: 1,
                status: "ADVISED",
                ...adapted.adaptation,
                methods: preliminaryMethods,
              })
              .select("id, source_id, version, status, summary, source_claims, methods, assumptions, prerequisites, expected_outcomes, unknowns, fit, conflicts, gaps, adapted_strategy, goal_candidates, provenance, created_at")
              .single();

            if (adaptationError || !insertedAdaptation) {
              warning = "Stryde attached the source, but could not persist its adaptation.";
            } else {
              adaptation = insertedAdaptation as unknown as SourceAdaptation;

              const sourceClaims = Array.isArray(adapted.adaptation.source_claims) ? adapted.adaptation.source_claims : [];
              if (sourceClaims.length && source.content_sha256 && ingested.contentText) {
                const citations = [];
                for (const item of sourceClaims) {
                  const stmt = typeof item.statement === "string" ? item.statement.trim() : "";
                  if (!stmt) continue;
                  const built = buildSourceCitation({
                    content: ingested.contentText,
                    contentSha256: source.content_sha256,
                    statement: stmt,
                    basis: typeof item.basis === "string" ? item.basis : "INFERRED",
                  });
                  if (built) {
                    citations.push({
                      owner_user_id: ownerUserId,
                      pursuit_id: pursuitId,
                      source_id: source.id,
                      adaptation_id: insertedAdaptation.id,
                      ...built,
                    });
                  }
                }
                if (citations.length) {
                  const { error: insertError } = await supabase.from("pursuit_source_citation").insert(citations);
                  if (insertError) {
                    warning = `Source was saved, but evidence citations could not be persisted: ${insertError.message}`;
                  }
                }
                if (citations.length < sourceClaims.length) {
                  warning = `Source partially verified: ${citations.length} of ${sourceClaims.length} claims substantiated.`;
                }
              }
            }
          } catch (error) {
            warning = error instanceof Error ? error.message : "Source adaptation failed";
          }
        } else {
          warning = situationResult.error ?? "Stryde could not assemble the current situation for source adaptation.";
        }
      }

      results.push({
        requested_url: requestedUrl,
        source_id: source.id as string,
        status: source.fetch_status as string,
        title: (source.title as string | null) ?? null,
        adapted: Boolean(adaptation),
        warning,
      });
    } catch (error) {
      results.push({
        requested_url: requestedUrl,
        source_id: null,
        status: "FAILED",
        title: null,
        adapted: false,
        warning: error instanceof Error ? error.message : "Unable to process source",
      });
    }
  }

  return { urls: results, handled: true };
}
