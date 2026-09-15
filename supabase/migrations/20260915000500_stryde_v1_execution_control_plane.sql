-- STRYDE V1 Step 15: execution control plane.
-- Durable worker primitives: lease -> attempt -> mechanical result.
-- Worker calls require the server-only service_role JWT. External side effects remain outside this layer.

create or replace function public.stryde_lease_next_job(p_worker_id text, p_lease_seconds integer default 60)
returns public.job
language plpgsql
security invoker
set search_path = ''
as $$
declare v_job public.job;
begin
  if coalesce((select auth.jwt() ->> 'role'),'') <> 'service_role' then raise exception 'Worker authentication required'; end if;
  if p_worker_id is null or btrim(p_worker_id) = '' then raise exception 'worker_id must be non-empty'; end if;
  if p_lease_seconds < 5 or p_lease_seconds > 900 then raise exception 'lease_seconds must be between 5 and 900'; end if;
  with candidate as (
    select j.id from public.job j
    where j.status = 'AUTHORIZED' and (j.next_retry_at is null or j.next_retry_at <= now())
    order by j.created_at asc for update skip locked limit 1
  )
  update public.job j
  set status='DISPATCHING', lease_owner=btrim(p_worker_id),
      lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
      fencing_token=j.fencing_token+1, updated_at=now()
  from candidate c where j.id=c.id returning j.* into v_job;
  if v_job.id is not null then
    insert into public.event(owner_user_id,entity_type,entity_id,event_type,actor_type,payload)
    values(v_job.owner_user_id,'JOB',v_job.id,'JOB_LEASED','WORKER',jsonb_build_object('worker_id',btrim(p_worker_id),'fencing_token',v_job.fencing_token));
  end if;
  return v_job;
end;
$$;

create or replace function public.stryde_start_attempt(p_job_id uuid, p_worker_id text)
returns public.attempt
language plpgsql
security invoker
set search_path = ''
as $$
declare v_job public.job; v_attempt public.attempt; v_next integer;
begin
  if coalesce((select auth.jwt() ->> 'role'),'') <> 'service_role' then raise exception 'Worker authentication required'; end if;
  if p_worker_id is null or btrim(p_worker_id) = '' then raise exception 'worker_id must be non-empty'; end if;
  select j.* into v_job from public.job j where j.id=p_job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if v_job.status <> 'DISPATCHING' or v_job.lease_owner <> btrim(p_worker_id) then raise exception 'Job is not leased by worker'; end if;
  if v_job.lease_expires_at is null or v_job.lease_expires_at <= now() then raise exception 'Job lease expired'; end if;
  select coalesce(max(a.attempt_number),0)+1 into v_next from public.attempt a where a.job_id=v_job.id;
  insert into public.attempt(owner_user_id,job_id,attempt_number,fencing_token,dispatch_state,mechanical_result_state,terminal_resolution,callback_authenticity_state,dispatch_intent_at)
  values(v_job.owner_user_id,v_job.id,v_next,v_job.fencing_token,'DISPATCH_INTENT_COMMITTED','PENDING',null,'PENDING',now()) returning * into v_attempt;
  insert into public.event(owner_user_id,entity_type,entity_id,event_type,actor_type,payload)
  values(v_job.owner_user_id,'ATTEMPT',v_attempt.id,'ATTEMPT_DISPATCH_INTENT_COMMITTED','WORKER',jsonb_build_object('job_id',v_job.id,'fencing_token',v_job.fencing_token));
  return v_attempt;
end;
$$;

create or replace function public.stryde_finish_attempt(
  p_attempt_id uuid,p_worker_id text,p_result_status text,
  p_external_correlation_id text default null,p_mechanical_result jsonb default null,p_error_detail jsonb default null
)
returns public.attempt
language plpgsql
security invoker
set search_path = ''
as $$
declare v_attempt public.attempt; v_job public.job; v_event text;
begin
  if coalesce((select auth.jwt() ->> 'role'),'') <> 'service_role' then raise exception 'Worker authentication required'; end if;
  if p_worker_id is null or btrim(p_worker_id)='' then raise exception 'worker_id must be non-empty'; end if;
  if p_result_status not in ('SUCCEEDED','FAILED','UNKNOWN') then raise exception 'invalid attempt result status'; end if;
  select a.* into v_attempt from public.attempt a where a.id=p_attempt_id for update;
  if v_attempt.id is null then raise exception 'Attempt not found'; end if;
  if v_attempt.terminal_resolution is not null then raise exception 'Attempt already terminal'; end if;
  select j.* into v_job from public.job j where j.id=v_attempt.job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if v_job.lease_owner<>btrim(p_worker_id) or v_job.fencing_token<>v_attempt.fencing_token then raise exception 'Stale worker fencing token'; end if;
  if v_job.lease_expires_at is null or v_job.lease_expires_at<=now() then raise exception 'Job lease expired'; end if;
  update public.attempt set completed_at=now(), dispatched_at=coalesce(dispatched_at,now()),
    dispatch_state=case when p_result_status='UNKNOWN' then 'DISPATCH_UNKNOWN' else 'DISPATCHED' end,
    mechanical_result_state=p_result_status, terminal_resolution=p_result_status,
    external_correlation_id=p_external_correlation_id, redacted_result=p_mechanical_result,
    error_details=p_error_detail, callback_authenticity_state='VERIFIED'
  where id=v_attempt.id;
  update public.job set status=case when p_result_status='SUCCEEDED' then 'SUCCEEDED' when p_result_status='FAILED' then 'FAILED' else 'UNKNOWN' end,
    lease_owner=null,lease_expires_at=null,
    resolved_at=case when p_result_status in ('SUCCEEDED','FAILED') then now() else null end,updated_at=now()
  where id=v_job.id and fencing_token=v_attempt.fencing_token and lease_owner=btrim(p_worker_id);
  v_event:=case when p_result_status='SUCCEEDED' then 'ATTEMPT_SUCCEEDED' when p_result_status='FAILED' then 'ATTEMPT_FAILED' else 'ATTEMPT_UNKNOWN' end;
  insert into public.event(owner_user_id,entity_type,entity_id,event_type,actor_type,payload)
  values(v_job.owner_user_id,'ATTEMPT',v_attempt.id,v_event,'WORKER',jsonb_build_object('job_id',v_job.id,'fencing_token',v_attempt.fencing_token,'result_status',p_result_status));
  select * into v_attempt from public.attempt where id=v_attempt.id; return v_attempt;
end;
$$;

create or replace function public.stryde_reconcile_expired_job(p_job_id uuid)
returns public.job
language plpgsql
security invoker
set search_path = ''
as $$
declare v_job public.job;
begin
  if coalesce((select auth.jwt() ->> 'role'),'') <> 'service_role' then raise exception 'Worker authentication required'; end if;
  select j.* into v_job from public.job j where j.id=p_job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if v_job.status in ('DISPATCHING','AWAITING_CALLBACK') and v_job.lease_expires_at is not null and v_job.lease_expires_at<=now() then
    update public.job set status='UNKNOWN',lease_owner=null,lease_expires_at=null,updated_at=now() where id=v_job.id;
    insert into public.event(owner_user_id,entity_type,entity_id,event_type,actor_type,payload)
    values(v_job.owner_user_id,'JOB',v_job.id,'JOB_RECONCILIATION_REQUIRED','SYSTEM',jsonb_build_object('reason','lease_expired','previous_status',v_job.status));
    select * into v_job from public.job where id=v_job.id;
  end if;
  return v_job;
end;
$$;

revoke execute on function public.stryde_lease_next_job(text,integer) from public,anon,authenticated;
revoke execute on function public.stryde_start_attempt(uuid,text) from public,anon,authenticated;
revoke execute on function public.stryde_finish_attempt(uuid,text,text,text,jsonb,jsonb) from public,anon,authenticated;
revoke execute on function public.stryde_reconcile_expired_job(uuid) from public,anon,authenticated;
grant execute on function public.stryde_lease_next_job(text,integer) to service_role;
grant execute on function public.stryde_start_attempt(uuid,text) to service_role;
grant execute on function public.stryde_finish_attempt(uuid,text,text,text,jsonb,jsonb) to service_role;
grant execute on function public.stryde_reconcile_expired_job(uuid) to service_role;
