-- RPC privilege hardening + citation policy fix.
--
-- Defect 1: pursuit_source_citation INSERT policy contained a tautological
-- predicate (s.pursuit_id = s.pursuit_id). The owner check still applied, but
-- the intended invariant — the citation's source must belong to the cited
-- pursuit — was not actually enforced. Recreate the policy with the correct
-- join predicate.
--
-- Defect 2: anon/PUBLIC held EXECUTE on mutation RPCs whose bodies check
-- auth.uid(). Defense in depth: unauthenticated callers must be rejected at
-- the privilege boundary, not only inside the function body.

-- --- Defect 1: tautological citation policy ---------------------------------

DROP POLICY IF EXISTS "pursuit source citations owned insert" ON public.pursuit_source_citation;

CREATE POLICY "pursuit source citations owned insert"
  ON public.pursuit_source_citation
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1 FROM public.pursuit p
      WHERE p.id = pursuit_source_citation.pursuit_id
        AND p.owner_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.pursuit_source s
      WHERE s.id = pursuit_source_citation.source_id
        AND s.pursuit_id = pursuit_source_citation.pursuit_id
        AND s.owner_user_id = auth.uid()
    )
  );

-- --- Defect 2: revoke anon/PUBLIC EXECUTE on mutation RPCs ------------------

REVOKE EXECUTE ON FUNCTION public.stryde_commit_intervention(uuid, text, jsonb, text, uuid, text, text, text, text, text, text)
  FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.stryde_create_claim(text, text, text, uuid, jsonb, smallint, uuid)
  FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.stryde_create_thread(text)
  FROM anon, public;
