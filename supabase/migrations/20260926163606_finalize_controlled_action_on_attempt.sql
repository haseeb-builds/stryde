create or replace function public.stryde_finish_attempt(
  p_attempt_id uuid,
  p_worker_id text,
  p_result_status text,
  p_external_correlation_id text default null,
  p_mechanical_result jsonb default null,
  p_error_detail jsonb default null
)
returns public.attempt
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempt public.attempt;
  v_job public.job;
  v_event text;
  v_action_status text;
  v_action_event text;
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

  update public.attempt
  set completed_at=now(),
      dispatched_at=coalesce(dispatched_at,now()),
      dispatch_state=case when p_result_status='UNKNOWN' then 'DISPATCH_UNKNOWN' else 'DISPATCHED' end,
      mechanical_result_state=p_result_status,
      terminal_resolution=p_result_status,
      external_correlation_id=p_external_correlation_id,
      redacted_result=p_mechanical_result,
      error_details=p_error_detail,
      callback_authenticity_state='VERIFIED'
  where id=v_attempt.id;

  update public.job
  set status=case when p_result_status='SUCCEEDED' then 'SUCCEEDED' when p_result_status='FAILED' then 'FAILED' else 'UNKNOWN' end,
      lease_owner=null,
      lease_expires_at=null,
      resolved_at=case when p_result_status in ('SUCCEEDED','FAILED') then now() else null end,
      updated_at=now()
  where id=v_job.id and fencing_token=v_attempt.fencing_token and lease_owner=btrim(p_worker_id);

  if p_result_status in ('SUCCEEDED','FAILED') then
    v_action_status := case when p_result_status='SUCCEEDED' then 'COMPLETED' else 'FAILED' end;
    v_action_event := case when p_result_status='SUCCEEDED' then 'ACTION_COMPLETED_BY_WORKER' else 'ACTION_FAILED_BY_WORKER' end;

    update public.action
    set status=v_action_status, terminal_at=now(), updated_at=now()
    where id=v_job.action_id and owner_user_id=v_job.owner_user_id and execution_mode='CONTROLLED' and status='IN_PROGRESS';

    insert into public.event(owner_user_id,entity_type,entity_id,event_type,actor_type,payload)
    values(v_job.owner_user_id,'ACTION',v_job.action_id,v_action_event,'WORKER',
           jsonb_build_object('attempt_id',v_attempt.id,'job_id',v_job.id,'result_status',p_result_status));
  end if;

  v_event:=case when p_result_status='SUCCEEDED' then 'ATTEMPT_SUCCEEDED' when p_result_status='FAILED' then 'ATTEMPT_FAILED' else 'ATTEMPT_UNKNOWN' end;

  insert into public.event(owner_user_id,entity_type,entity_id,event_type,actor_type,payload)
  values(v_job.owner_user_id,'ATTEMPT',v_attempt.id,v_event,'WORKER',
         jsonb_build_object('job_id',v_job.id,'fencing_token',v_attempt.fencing_token,'result_status',p_result_status));

  select * into v_attempt from public.attempt where id=v_attempt.id;
  return v_attempt;
end;
$$;

revoke execute on function public.stryde_finish_attempt(uuid,text,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.stryde_finish_attempt(uuid,text,text,text,jsonb,jsonb) to service_role;