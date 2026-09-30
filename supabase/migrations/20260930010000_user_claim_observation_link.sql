-- User-facing claim/observation evidence linkage.
--
-- The verification engine had exactly one path that inserted into
-- claim_observation_link: the service-role worker attempt path. A user could
-- create a Claim (REPORTED) and produce Observations (e.g. HUMAN_ACTION_RESULT),
-- but had no way to connect evidence to a Claim, which made evidence-backed
-- human adjudication impossible — stryde_adjudicate_claim rejects an
-- observation_id that is not linked.
--
-- This RPC mirrors the worker path's semantics for the authenticated owner:
-- owner checks on both entities, a fixed relation vocabulary, a one-way
-- REPORTED -> OBSERVED epistemic transition, and audit events.

create or replace function public.stryde_link_claim_observation(
  p_claim_id uuid,
  p_observation_id uuid,
  p_relation_type text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_claim public.claim;
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'Authentication required';
  end if;
  if p_relation_type not in ('SUPPORTS','CONTRADICTS','VERIFIES') then
    raise exception 'Invalid observation relation type';
  end if;

  select * into v_claim from public.claim
  where id = p_claim_id and owner_user_id = v_owner
  for update;
  if not found then raise exception 'Claim not found'; end if;

  if not exists (
    select 1 from public.observation
    where id = p_observation_id and owner_user_id = v_owner
  ) then
    raise exception 'Observation not found';
  end if;

  insert into public.claim_observation_link (
    claim_id, observation_id, relation_type, owner_user_id
  ) values (v_claim.id, p_observation_id, p_relation_type, v_owner);

  if v_claim.epistemic_status = 'REPORTED' then
    update public.claim
    set epistemic_status = 'OBSERVED', updated_at = now()
    where id = v_claim.id and owner_user_id = v_owner;

    insert into public.claim_status_event (
      claim_id, owner_user_id, from_status, to_status, actor_type, actor_id,
      evidence_observation_id, occurred_at, reason
    ) values (
      v_claim.id, v_owner, 'REPORTED', 'OBSERVED', 'USER', v_owner,
      p_observation_id, now(), 'Evidence observation linked to Claim'
    );

    insert into public.event (
      owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
    ) values (
      v_owner, 'CLAIM', v_claim.id, 'CLAIM_OBSERVED', 'USER', v_owner,
      jsonb_build_object('observation_id', p_observation_id, 'relation_type', p_relation_type)
    );
  end if;

  return jsonb_build_object(
    'claim_id', v_claim.id,
    'observation_id', p_observation_id,
    'relation_type', p_relation_type,
    'epistemic_status', case when v_claim.epistemic_status = 'REPORTED' then 'OBSERVED' else v_claim.epistemic_status end
  );
end;
$$;

revoke all privileges on function public.stryde_link_claim_observation(uuid, uuid, text) from public, anon;
grant execute on function public.stryde_link_claim_observation(uuid, uuid, text) to authenticated;
