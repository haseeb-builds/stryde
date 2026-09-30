-- Owner UPDATE policy on claim.
--
-- stryde_adjudicate_claim and the claim evidence flow lock the claim row with
-- SELECT ... FOR UPDATE and then UPDATE its epistemic_status. The claim table
-- had INSERT/SELECT RLS policies only: under RLS, rows not covered by an
-- UPDATE policy are silently skipped in a FOR UPDATE cursor, so every
-- user-path adjudication failed with "Claim not found" even though the claim
-- row existed, and the status UPDATE itself would have updated zero rows.

CREATE POLICY "claim_owner_update"
  ON public.claim FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
