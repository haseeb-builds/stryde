create or replace function public.stryde_lease_next_job(p_worker_id text, p_lease_seconds integer default 60)
returns public.job
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.job;
  v_previous_status text;
begin
  if coalesce((select auth.jwt() ->> 'role'),'') <> 'service_role' then raise exception 'Worker authentication required'; end if;
  if p_worker_id is null or btrim(p_worker_id) = '' then raise exception 'worker_id must be non-empty'; end if;
  if p_lease_seconds < 5 or p_lease_seconds > 900 then raise exception 'lease_seconds must be between 5 and 900'; end if;

  select j.* into v_job
  from public.job j
  where j.status in ('AUTHORIZED','QUEUED')
    and (j.next_retry_at is null or j.next_retry_at <= now())
    and j.cancel_requested_at is null
  order by j.created_at asc
  for update skip locked
  limit 1;

  if v_job.id is null then return null; end if;
  v_previous_status := v_job.status;

  update public.job j
  set status='DISPATCHING',
      lease_owner=btrim(p_worker_id),
      lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
      fencing_token=j.fencing_token+1,
      updated_at=now()
  where j.id=v_job.id
  returning j.* into v_job;

  insert into public.event(owner_user_id,entity_type,entity_id,event_type,actor_type,payload)
  values(
    v_job.owner_user_id,'JOB',v_job.id,'JOB_LEASED','WORKER',
    jsonb_build_object(
      'worker_id',btrim(p_worker_id),
      'fencing_token',v_job.fencing_token,
      'previous_status',v_previous_status
    )
  );

  return v_job;
end;
$$;

revoke execute on function public.stryde_lease_next_job(text,integer) from public,anon,authenticated;
grant execute on function public.stryde_lease_next_job(text,integer) to service_role;