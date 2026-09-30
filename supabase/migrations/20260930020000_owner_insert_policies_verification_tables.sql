-- Owner INSERT policies for the verification audit tables.
--
-- stryde_create_claim / stryde_adjudicate_claim / stryde_link_claim_observation
-- are SECURITY INVOKER and run as the authenticated user. They insert into
-- event, claim_status_event, and claim_observation_link, but those tables had
-- SELECT-only RLS coverage, so every user-path call failed with 42501
-- ("new row violates row-level security policy"). The worker/service paths
-- never noticed because service_role bypasses RLS.
--
-- Scope deliberately limited to owner-append on the three tables the
-- verification RPCs write; no other table coverage is changed.

CREATE POLICY "event_owner_insert"
  ON public.event FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "claim_status_event_owner_insert"
  ON public.claim_status_event FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "claim_observation_link_owner_insert"
  ON public.claim_observation_link FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());
