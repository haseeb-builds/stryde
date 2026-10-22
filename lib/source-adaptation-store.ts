// Shared source-adaptation persistence. The sources route, URL ingestion, and
// pursuit intake all attach a source and then run the model's source
// interpreter over it; this helper keeps that flow in one place so the
// epistemic wiring (adaptation persisted as ADVISED, citations bound to the
// source content hash, honest warnings on failure) cannot drift between paths.
import type { SupabaseClient } from "@supabase/supabase-js";
import { runSourceAdaptation, type SourceAdaptation } from "./adaptive-model.ts";
import { assembleAdaptiveSituation } from "./adaptive-situation.ts";
import { buildSourceCitation } from "./source-citation.ts";
import { updateAdaptationAuditStatus } from "./research-orchestration.ts";
import { getSupabaseServiceClient } from "./supabase/service.ts";

export type StoredAdaptation = {
  adaptation: SourceAdaptation | null;
  adaptation_id: string | null;
  warning: string | null;
};

export async function adaptAndStoreSource(input: {
  supabase: SupabaseClient;
  trustedPlane?: SupabaseClient;
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
    if (sourceClaims.length && input.source.contentSha256 && input.source.contentText) {
      const citations = [];
      for (const item of sourceClaims) {
        const stmt = typeof item.statement === "string" ? item.statement.trim() : "";
        if (!stmt) continue;
        const built = buildSourceCitation({
          content: input.source.contentText,
          contentSha256: input.source.contentSha256,
          statement: stmt,
          basis: typeof item.basis === "string" ? item.basis : "INFERRED",
        });
        if (built) {
          citations.push({
            owner_user_id: input.ownerUserId,
            pursuit_id: input.pursuitId,
            source_id: input.source.id,
            adaptation_id: inserted.id,
            ...built,
          });
        }
      }

      const serviceClient = input.trustedPlane ?? getSupabaseServiceClient();
      const unverifiedMethods = (Array.isArray(inserted.methods) ? inserted.methods : []).map(
        (m: Record<string, unknown>) => ({ ...m, audit_status: "UNVERIFIED" })
      );

      if (citations.length === 0) {
        // All claims unlocatable: update adaptation audit status to INCOMPLETE with unsubstantiated: true
        const updateRes = await updateAdaptationAuditStatus(serviceClient, {
          adaptationId: inserted.id,
          ownerUserId: input.ownerUserId,
          pursuitId: input.pursuitId,
          summary: "Source saved, but claims could not be substantiated in the source content.",
          methods: unverifiedMethods,
          provenance: {
            ...(typeof inserted.provenance === "object" && inserted.provenance !== null ? inserted.provenance : {}),
            audit_status: "INCOMPLETE",
            unsubstantiated: true,
          },
        });
        const baseWarning = "Source adaptation claims could not be verified in the source content.";
        return {
          adaptation: {
            ...adapted.adaptation,
            methods: unverifiedMethods as unknown as SourceAdaptation["methods"],
            provenance: {
              ...(typeof inserted.provenance === "object" && inserted.provenance !== null ? (inserted.provenance as Record<string, unknown>) : {}),
              audit_status: "INCOMPLETE",
              unsubstantiated: true,
            } as unknown as SourceAdaptation["provenance"],
          },
          adaptation_id: inserted.id,
          warning: updateRes.success ? baseWarning : `${baseWarning} (warning: audit update failed: ${updateRes.error})`,
        };
      }

      const { error: citInsertError } = await input.supabase.from("pursuit_source_citation").insert(citations);
      if (citInsertError) {
        const updateRes = await updateAdaptationAuditStatus(serviceClient, {
          adaptationId: inserted.id,
          ownerUserId: input.ownerUserId,
          pursuitId: input.pursuitId,
          summary: `Source saved, but evidence citations could not be persisted: ${citInsertError.message}`,
          methods: unverifiedMethods,
          provenance: {
            ...(typeof inserted.provenance === "object" && inserted.provenance !== null ? inserted.provenance : {}),
            audit_status: "INCOMPLETE",
            citation_error: citInsertError.message,
          },
        });
        const baseWarning = `Source was saved, but evidence citations could not be persisted: ${citInsertError.message}`;
        return {
          adaptation: {
            ...adapted.adaptation,
            methods: unverifiedMethods as unknown as SourceAdaptation["methods"],
            provenance: {
              ...(typeof inserted.provenance === "object" && inserted.provenance !== null ? (inserted.provenance as Record<string, unknown>) : {}),
              audit_status: "INCOMPLETE",
              citation_error: citInsertError.message,
            } as unknown as SourceAdaptation["provenance"],
          },
          adaptation_id: inserted.id,
          warning: updateRes.success ? baseWarning : `${baseWarning} (warning: audit update failed: ${updateRes.error})`,
        };
      }

      if (citations.length < sourceClaims.length) {
        const updateRes = await updateAdaptationAuditStatus(serviceClient, {
          adaptationId: inserted.id,
          ownerUserId: input.ownerUserId,
          pursuitId: input.pursuitId,
          summary: `Source adaptation partially verified: ${citations.length} of ${sourceClaims.length} claims were substantiated.`,
          methods: unverifiedMethods,
          provenance: {
            ...(typeof inserted.provenance === "object" && inserted.provenance !== null ? inserted.provenance : {}),
            audit_status: "INCOMPLETE",
            partial_evidence: true,
            substantiated_claims: citations.length,
            total_claims: sourceClaims.length,
          },
        });
        const baseWarning = `Source adaptation partially verified: ${citations.length} of ${sourceClaims.length} claims were substantiated.`;
        return {
          adaptation: {
            ...adapted.adaptation,
            methods: unverifiedMethods as unknown as SourceAdaptation["methods"],
            provenance: {
              ...(typeof inserted.provenance === "object" && inserted.provenance !== null ? (inserted.provenance as Record<string, unknown>) : {}),
              audit_status: "INCOMPLETE",
              partial_evidence: true,
              substantiated_claims: citations.length,
              total_claims: sourceClaims.length,
            } as unknown as SourceAdaptation["provenance"],
          },
          adaptation_id: inserted.id,
          warning: updateRes.success ? baseWarning : `${baseWarning} (warning: audit update failed: ${updateRes.error})`,
        };
      }
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
