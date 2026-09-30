-- Claim verification RPCs move behind the trusted control plane.
--
-- stryde_validate_semantics enforces: "Claim epistemic status changes require
-- the trusted control plane" (service_role only). The user-role RPCs
-- (stryde_adjudicate_claim, stryde_link_claim_observation) therefore could
-- never complete an epistemic transition when invoked with an authenticated
-- user token — the guard rejects the UPDATE before any status event is
-- written.
--
-- Both RPCs are re-issued as service-role-gated functions that take the
-- acting user explicitly (p_actor_id), mirroring the existing
-- stryde_record_attempt_observation pattern. The HTTP routes authenticate the
-- user, verify ownership through the user's RLS-scoped client, and only then
-- invoke these RPCs with the service client. Raw DB callers — anonymous or
-- authenticated — can no longer reach the transition boundary at all.

create or replace function public.stryde_adjudicate_claim(
  p_actor_id uuid,
  p_claim_id uuid,
  p_to_status text,
  p_reason text,
  p_observation_id uuid default null
)
returns public.claim
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_claim public.claim;
  v_observation public.observation;
  v_actor uuid := p_actor_id;
begin
  if coalesce((select auth.jwt() ->> 'role'),'') <> 'service_role' then
    raise exception 'Claim epistemic status changes require the trusted control plane';
  end if;
  if v_actor is null then raise exception 'Actor required'; end if;
  if p_to_status not in ('VERIFIED','CONTRADICTED','UNVERIFIABLE') then
    raise exception 'Invalid adjudication status';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 or length(p_reason) > 2000 then
    raise exception 'reason is required';
  end if;

  select * into v_claim from public.claim
  where id = p_claim_id and owner_user_id = v_actor for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_claim.epistemic_status = p_to_status then raise exception 'Claim already has this epistemic status'; end if;

  if p_observation_id is not null then
    select * into v_observation from public.observation
    where id = p_observation_id and owner_user_id = v_actor;
    if not found then raise exception 'Observation not found'; end if;
    if not exists (
      select 1 from public.claim_observation_link l
      where l.claim_id = v_claim.id and l.observation_id = v_observation.id and l.owner_user_id = v_actor
    ) then
      raise exception 'Observation is not linked to this Claim';
    end if;
  end if;

  update public.claim
  set epistemic_status = p_to_status, updated_at = now()
  where id = v_claim.id and owner_user_id = v_actor;

  insert into public.claim_status_event (
    claim_id, owner_user_id, from_status, to_status, actor_type, actor_id,
    evidence_observation_id, occurred_at, reason
  ) values (
    v_claim.id, v_actor, v_claim.epistemic_status, p_to_status, 'USER', v_actor,
    p_observation_id, now(), btrim(p_reason)
  );

  insert into public.event (
    owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    v_actor, 'CLAIM', v_claim.id, 'CLAIM_ADJUDICATED', 'USER', v_actor,
    jsonb_build_object('from_status',v_claim.epistemic_status,'to_status',p_to_status,'observation_id',p_observation_id)
  );

  select * into v_claim from public.claim where id = v_claim.id;
  return v_claim;
end;
$$;

create or replace function public.stryde_link_claim_observation(
  p_actor_id uuid,
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
  v_actor uuid := p_actor_id;
begin
  if coalesce((select auth.jwt() ->> 'role'),'') <> 'service_role' then
    raise exception 'Claim epistemic status changes require the trusted control plane';
  end if;
  if v_actor is null then raise exception 'Actor required'; end if;
  if p_relation_type not in ('SUPPORTS','CONTRADICTS','VERIFIES') then
    raise exception 'Invalid observation relation type';
  end if;

  select * into v_claim from public.claim
  where id = p_claim_id and owner_user_id = v_actor
  for update;
  if not found then raise exception 'Claim not found'; end if;

  if not exists (
    select 1 from public.observation
    where id = p_observation_id and owner_user_id = v_actor
  ) then
    raise exception 'Observation not found';
  end if;

  insert into public.claim_observation_link (
    claim_id, observation_id, relation_type, owner_user_id
  ) values (v_claim.id, p_observation_id, p_relation_type, v_actor);

  if v_claim.epistemic_status = 'REPORTED' then
    update public.claim
    set epistemic_status = 'OBSERVED', updated_at = now()
    where id = v_claim.id and owner_user_id = v_actor;

    insert into public.claim_status_event (
      claim_id, owner_user_id, from_status, to_status, actor_type, actor_id,
      evidence_observation_id, occurred_at, reason
    ) values (
      v_claim.id, v_actor, 'REPORTED', 'OBSERVED', 'USER', v_actor,
      p_observation_id, now(), 'Evidence observation linked to Claim'
    );

    insert into public.event (
      owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
    ) values (
      v_actor, 'CLAIM', v_claim.id, 'CLAIM_OBSERVED', 'USER', v_actor,
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

revoke all privileges on function public.stryde_adjudicate_claim(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all privileges on function public.stryde_link_claim_observation(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.stryde_adjudicate_claim(uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.stryde_link_claim_observation(uuid, uuid, uuid, text) to service_role;

-- The earlier user-role signatures are superseded; leave them present but
-- unreachable rather than dropping them (dropping a function other live
-- objects depend on would require a cascade).
revoke all privileges on function public.stryde_adjudicate_claim(uuid, text, text, uuid) from public, anon, authenticated;
revoke all privileges on function public.stryde_link_claim_observation(uuid, uuid, text) from public, anon, authenticated;
