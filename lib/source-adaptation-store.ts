// Shared source-adaptation persistence. The sources route, URL ingestion, and
// pursuit intake all attach a source and then run the model's source
// interpreter over it; this helper keeps that flow in one place so the
// epistemic wiring (adaptation persisted as ADVISED, citations bound to the
// source content hash, honest warnings on failure) cannot drift between paths.
import type { SupabaseClient } from "@supabase/supabase-js";
import { runSourceAdaptation, type SourceAdaptation } from "@/lib/adaptive-model";
import { assembleAdaptiveSituation } from "@/lib/adaptive-situation";
import { buildSourceCitation } from "@/lib/source-citation";

export type StoredAdaptation = {
  adaptation: SourceAdaptation | null;
  adaptation_id: string | null;
  warning: string | null;
};

export async function adaptAndStoreSource(input: {
  supabase: SupabaseClient;
  ownerUserId: string;
  pursuitId: string;
  source: {
    id: string;
    uri: string | null;
    title: string | null;
    contentText: string | null;
    contentSha256: string | null;
    fetchStatus: string;
  };
}): Promise<StoredAdaptation> {
  if (!input.source.contentText?.trim()) {
    return { adaptation: null, adaptation_id: null, warning: "Source has no usable content to analyze." };
  }

  const situationResult = await assembleAdaptiveSituation(input.supabase, input.ownerUserId, input.pursuitId);
  if (situationResult.error || !situationResult.situation) {
    return {
      adaptation: null,
      adaptation_id: null,
      warning: situationResult.error ?? "Stryde could not assemble the current situation for source adaptation.",
    };
  }

  try {
    const adapted = await runSourceAdaptation({
      source: {
        id: input.source.id,
        uri: input.source.uri,
        title: input.source.title,
        content_text: input.source.contentText,
        content_sha256: input.source.contentSha256,
        fetch_status: input.source.fetchStatus,
      },
      situation: {
        ...situationResult.situation,
        sources: [
          ...situationResult.situation.sources,
          { ...input.source, content_text: input.source.contentText },
        ],
      },
    });

    const { data: inserted, error: insertError } = await input.supabase
      .from("pursuit_source_adaptation")
      .insert({
        owner_user_id: input.ownerUserId,
        pursuit_id: input.pursuitId,
        source_id: input.source.id,
        version: 1,
        status: "ADVISED",
        ...adapted.adaptation,
      })
      .select("id, source_id, version, status, summary, source_claims, methods, assumptions, prerequisites, expected_outcomes, unknowns, fit, conflicts, gaps, adapted_strategy, goal_candidates, provenance, created_at")
      .single();

    if (insertError || !inserted) {
      return { adaptation: null, adaptation_id: null, warning: "Stryde attached the source, but could not persist its adaptation." };
    }

    const sourceClaims = Array.isArray(adapted.adaptation.source_claims) ? adapted.adaptation.source_claims : [];
    if (sourceClaims.length && input.source.contentSha256) {
      const citations = sourceClaims.map((item) => ({
        owner_user_id: input.ownerUserId,
        pursuit_id: input.pursuitId,
        source_id: input.source.id,
        adaptation_id: inserted.id,
        ...buildSourceCitation({
          content: input.source.contentText as string,
          contentSha256: input.source.contentSha256 as string,
          statement: typeof item.statement === "string" ? item.statement : "",
          basis: typeof item.basis === "string" ? item.basis : "INFERRED",
        }),
      }));
      if (citations.length) await input.supabase.from("pursuit_source_citation").insert(citations);
    }

    return { adaptation: adapted.adaptation, adaptation_id: inserted.id, warning: null };
  } catch (error) {
    return {
      adaptation: null,
      adaptation_id: null,
      warning: error instanceof Error ? error.message : "Source adaptation failed",
    };
  }
}
