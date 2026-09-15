-- Step 17: verification engine.
-- Mechanical execution evidence becomes an immutable Observation. Claims are
-- updated only through the trusted verification boundary. LLM output is never
-- allowed to set VERIFIED.

create schema if not exists stryde_internal;

create or replace function stryde_internal.record_attempt_observation(
  p_attempt_id uuid,
  p_claim_id uuid default null,
  p_relation_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempt public.attempt;
  v_job public.job;
  v_observation public.observation;
  v_claim public.claim;
begin
  if coalesce((select auth.jwt() ->> 'role'),'') <> 'service_role' then
    raise exception 'Verification worker authentication required';
  end if;
  if p_attempt_id is null then raise exception 'attempt_id is required'; end if;

  select * into v_attempt from public.attempt where id = p_attempt_id;
  if not found then raise exception 'Attempt not found'; end if;
  select * into v_job from public.job where id = v_attempt.job_id;
  if not found then raise exception 'Job not found'; end if;

  insert into public.observation (
    owner_user_id, observation_kind, content, raw_payload,
    observed_at, source_type, source_reference, source_uri, source_metadata
  ) values (
    v_job.owner_user_id,
    'MECHANICAL_ATTEMPT_RESULT',
    jsonb_build_object(
      'attempt_id', v_attempt.id,
      'job_id', v_job.id,
      'mechanical_result_state', v_attempt.mechanical_result_state,
      'dispatch_state', v_attempt.dispatch_state,
      'external_correlation_id', v_attempt.external_correlation_id,
      'result', v_attempt.redacted_result,
      'error', v_attempt.error_details
    ),
    v_attempt.redacted_result,
    coalesce(v_attempt.completed_at, v_attempt.created_at),
    'CONTROLLED_EXECUTION', v_attempt.id::text, null,
    jsonb_build_object('tool_id', v_job.tool_id, 'tool_version', v_job.tool_version, 'args_hash', v_job.args_hash)
  ) returning * into v_observation;

  if p_claim_id is not null then
    select * into v_claim
    from public.claim
    where id = p_claim_id and owner_user_id = v_job.owner_user_id;
    if not found then raise exception 'Claim not found for observation owner'; end if;
    if p_relation_type not in ('SUPPORTS','CONTRADICTS','VERIFIES') then
      raise exception 'Invalid observation relation type';
    end if;

    insert into public.claim_observation_link (
      claim_id, observation_id, relation_type, owner_user_id
    ) values (
      v_claim.id, v_observation.id, p_relation_type, v_job.owner_user_id
    );

    if v_claim.epistemic_status = 'REPORTED' then
      update public.claim
      set epistemic_status = 'OBSERVED', updated_at = now()
      where id = v_claim.id and owner_user_id = v_job.owner_user_id;

      insert into public.claim_status_event (
        claim_id, owner_user_id, from_status, to_status, actor_type,
        evidence_observation_id, occurred_at, reason
      ) values (
        v_claim.id, v_job.owner_user_id, 'REPORTED', 'OBSERVED', 'WORKER',
        v_observation.id, now(), 'Mechanical execution evidence recorded'
      );

      insert into public.event (
        owner_user_id, entity_type, entity_id, event_type, actor_type, payload
      ) values (
        v_job.owner_user_id, 'CLAIM', v_claim.id, 'CLAIM_OBSERVED', 'WORKER',
        jsonb_build_object('observation_id', v_observation.id, 'attempt_id', v_attempt.id)
      );
    end if;
  end if;

  return jsonb_build_object('observation', to_jsonb(v_observation), 'claim_id', p_claim_id);
end;
$$;

create or replace function public.stryde_record_attempt_observation(
  p_attempt_id uuid,
  p_claim_id uuid default null,
  p_relation_type text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if coalesce((select auth.jwt() ->> 'role'),'') <> 'service_role' then
    raise exception 'Verification worker authentication required';
  end if;
  return stryde_internal.record_attempt_observation(p_attempt_id, p_claim_id, p_relation_type);
end;
$$;

create or replace function public.stryde_adjudicate_claim(
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
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_to_status not in ('VERIFIED','CONTRADICTED','UNVERIFIABLE') then
    raise exception 'Invalid adjudication status';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 or length(p_reason) > 2000 then
    raise exception 'reason is required';
  end if;

  select * into v_claim from public.claim
  where id=p_claim_id and owner_user_id=v_actor for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_claim.epistemic_status = p_to_status then raise exception 'Claim already has this epistemic status'; end if;

  if p_observation_id is not null then
    select * into v_observation from public.observation
    where id=p_observation_id and owner_user_id=v_actor;
    if not found then raise exception 'Observation not found'; end if;
    if not exists (
      select 1 from public.claim_observation_link l
      where l.claim_id=v_claim.id and l.observation_id=v_observation.id and l.owner_user_id=v_actor
    ) then
      raise exception 'Observation is not linked to this Claim';
    end if;
  end if;

  update public.claim
  set epistemic_status=p_to_status, updated_at=now()
  where id=v_claim.id and owner_user_id=v_actor;

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

  select * into v_claim from public.claim where id=v_claim.id;
  return v_claim;
end;
$$;

revoke all privileges on function public.stryde_adjudicate_claim(uuid,text,text,uuid) from public, anon;
grant execute on function public.stryde_adjudicate_claim(uuid,text,text,uuid) to authenticated;
revoke all privileges on function public.stryde_record_attempt_observation(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.stryde_record_attempt_observation(uuid,uuid,text) to service_role;
revoke all privileges on function stryde_internal.record_attempt_observation(uuid,uuid,text) from public, anon, authenticated;
grant execute on function stryde_internal.record_attempt_observation(uuid,uuid,text) to service_role;
grant usage on schema stryde_internal to service_role;
revoke all privileges on schema stryde_internal from public, anon, authenticated;
