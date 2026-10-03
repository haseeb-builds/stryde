import type { SupabaseClient } from "@supabase/supabase-js";
import { assertPublicHttpUrl } from "./source-ingestion";
import { executeVerificationCheck, relationForOutcome, type VerificationCheckResult } from "./verification-check";

// One mechanical verification execution, shared by the /work route's model
// path (the controller proposed VERIFY_WEB) and its degraded path (the model
// is unavailable but a persisted VERIFY_WEB move is still the working truth).
//
// The rules that make this honest regardless of which path calls it:
//   - the claim must exist for this owner inside this pursuit, and only a
//     REPORTED claim is checked (an already-observed claim is never re-checked,
//     so a repeated /work call cannot accumulate duplicate evidence);
//   - an SSRF-rejected or unreachable URL is UNREACHABLE evidence, never a
//     contradiction and never an error thrown at the user;
//   - the link runs on the trusted plane and can only move REPORTED ->
//     OBSERVED. Nothing here can produce VERIFIED.
export type MechanicalVerificationResult = {
  claimFound: boolean;
  claimChecked: boolean;
  check: VerificationCheckResult | null;
  observationId: string | null;
  relationType: string | null;
  error: string | null;
};

export async function executeMechanicalVerification(input: {
  userSupabase: SupabaseClient;
  serviceSupabase: SupabaseClient;
  userId: string;
  pursuitId: string;
  verify: { claim_id: string; url: string; expect_text: string };
}): Promise<MechanicalVerificationResult> {
  const { userSupabase, serviceSupabase, userId, pursuitId, verify } = input;
  const failure = (error: string): MechanicalVerificationResult => ({
    claimFound: false,
    claimChecked: false,
    check: null,
    observationId: null,
    relationType: null,
    error,
  });

  // The referenced claim must exist for this owner inside this pursuit; a
  // dangling reference must never become mechanical evidence.
  const { data: verifyClaim, error: verifyClaimError } = await userSupabase
    .from("claim")
    .select("id, epistemic_status")
    .eq("id", verify.claim_id)
    .eq("owner_user_id", userId)
    .eq("pursuit_id", pursuitId)
    .maybeSingle();
  if (verifyClaimError) return failure(verifyClaimError.message);
  if (!verifyClaim) return failure("The claim referenced for verification could not be found in this pursuit.");
  if (verifyClaim.epistemic_status !== "REPORTED") {
    // Skipped, not failed: the claim already carries evidence (claimFound and
    // no error distinguish this from a dangling reference).
    return { claimFound: true, claimChecked: false, check: null, observationId: null, relationType: null, error: null };
  }

  try {
    // SSRF guard first. A rejection is honest evidence that the page cannot
    // be observed from Stryde — recorded below as UNREACHABLE, never thrown
    // at the user and never read as a contradiction.
    let check: VerificationCheckResult;
    try {
      await assertPublicHttpUrl(verify.url);
      check = await executeVerificationCheck({
        url: verify.url,
        expectText: verify.expect_text,
      });
    } catch (urlError) {
      check = {
        outcome: "UNREACHABLE",
        httpStatus: null,
        excerpt: null,
        error: urlError instanceof Error ? urlError.message : "Verification URL was rejected",
        renderer: "DIRECT",
      };
    }

    const checkedAt = new Date().toISOString();
    const observationPayload = {
      claim_id: verify.claim_id,
      url: verify.url,
      expect_text: verify.expect_text,
      outcome: check.outcome,
      http_status: check.httpStatus,
      renderer: check.renderer,
      excerpt: check.excerpt,
      error: check.error,
      checked_at: checkedAt,
    };

    // Trusted-plane insert: the persistence hardening removed owner INSERT on
    // observation (migration 20260915000200), matching how stryde_complete_
    // human_action and the worker RPCs record observations. Ownership was
    // proven through the user's RLS-scoped claim read above; the observation
    // itself is server-generated evidence, not user input.
    const { data: observation, error: observationError } = await serviceSupabase
      .from("observation")
      .insert({
        owner_user_id: userId,
        observation_kind: "URL_VERIFICATION",
        content: observationPayload,
        raw_payload: observationPayload,
        observed_at: checkedAt,
        source_type: "URL_CHECK",
        source_uri: verify.url,
        source_metadata: {
          claim_id: verify.claim_id,
          outcome: check.outcome,
          http_status: check.httpStatus,
        },
      })
      .select("id")
      .single();
    if (observationError || !observation) {
      return failure(observationError?.message ?? "Unable to record the URL verification observation");
    }

    // Same trusted-plane link mechanism as the claims observations route:
    // ownership was proven through the user's RLS-scoped reads, and the
    // epistemic transition runs inside the service-role RPC. The RPC only
    // ever moves REPORTED -> OBSERVED; a mechanical check can never set
    // VERIFIED — that stays a human adjudication.
    let relationType: string | null = null;
    if (check.outcome === "MATCHED" || check.outcome === "MISMATCHED") {
      relationType = relationForOutcome(check.outcome);
      if (relationType) {
        const { error: linkError } = await serviceSupabase.rpc("stryde_link_claim_observation", {
          p_actor_id: userId,
          p_claim_id: verify.claim_id,
          p_observation_id: observation.id,
          p_relation_type: relationType,
        });
        if (linkError) {
          return {
            claimFound: true,
            claimChecked: true,
            check,
            observationId: observation.id,
            relationType: null,
            error: linkError.message,
          };
        }
      }
    }

    return {
      claimFound: true,
      claimChecked: true,
      check,
      observationId: observation.id,
      relationType,
      error: check.error,
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "URL verification failed");
  }
}
