-- Migration: 20261024143000_repair_controlled_action_fallback.sql
-- Description: Repair manual fallback on CONTROLLED actions and guard worker lease races.

create or replace function stryde_internal.complete_human_action(
  p_action_id uuid,
  p_terminal_status text,
  p_result jsonb default '{}'::jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_action public.action;
  v_job public.job;
  v_job_previous_status text := null;
  v_observation public.observation;
  v_event text;
begin
  if v_owner is null then
    raise exception 'Authentication required';
  end if;

  if p_terminal_status not in ('COMPLETED', 'FAILED', 'CANCELLED') then
    raise exception 'Invalid human action terminal status';
  end if;

  if p_note is not null and length(p_note) > 4000 then
    raise exception 'Action note is too long';
  end if;

  -- Lock target action
  select *
  into v_action
  from public.action
  where id = p_action_id
    and owner_user_id = v_owner
  for update;

  if not found then
    raise exception 'Action not found';
  end if;

  if v_action.execution_mode not in ('HUMAN', 'CONTROLLED') then
    raise exception 'Only HUMAN or CONTROLLED actions can use user result recording';
  end if;

  if v_action.status <> 'IN_PROGRESS' then
    raise exception 'Action is not in progress';
  end if;

  -- Handle CONTROLLED action underlying job lifecycle
  if v_action.execution_mode = 'CONTROLLED' then
    select *
    into v_job
    from public.job
    where action_id = v_action.id
      and owner_user_id = v_owner
      and status not in ('SUCCEEDED', 'FAILED', 'CANCELLED')
    for update;

    if found then
      v_job_previous_status := v_job.status;

      -- CASE C: Worker holds a live lease -> reject manual settlement to avoid split-brain race
      if v_job.status in ('DISPATCHING', 'AWAITING_CALLBACK') and v_job.lease_expires_at is not null and v_job.lease_expires_at > now() then
        raise exception 'Cannot manually settle action while worker holds an active lease';
      end if;

      -- Reconcile expired lease to UNKNOWN if worker failed to respond before lease expiration
      if v_job.status in ('DISPATCHING', 'AWAITING_CALLBACK') and (v_job.lease_expires_at is null or v_job.lease_expires_at <= now()) then
        update public.job
        set status = 'UNKNOWN',
            lease_owner = null,
            lease_expires_at = null,
            updated_at = now()
        where id = v_job.id;

        insert into public.event (
          owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
        ) values (
          v_owner, 'JOB', v_job.id, 'JOB_RECONCILIATION_REQUIRED', 'SYSTEM', v_owner,
          jsonb_build_object('reason', 'lease_expired_on_manual_settlement', 'previous_status', v_job.status)
        );

        v_job.status := 'UNKNOWN';
        v_job_previous_status := 'UNKNOWN';
      end if;

      -- CASE A: Job is AUTHORIZED and demonstrably has not started -> atomically CANCEL job
      if v_job.status = 'AUTHORIZED' then
        update public.job
        set status = 'CANCELLED',
            cancel_requested_at = coalesce(cancel_requested_at, now()),
            cancel_reason = 'MANUAL_USER_SETTLEMENT',
            resolved_at = now(),
            updated_at = now()
        where id = v_job.id;

        insert into public.event (
          owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
        ) values (
          v_owner, 'JOB', v_job.id, 'JOB_CANCELLED', 'USER', v_owner,
          jsonb_build_object('reason', 'MANUAL_USER_SETTLEMENT', 'action_id', v_action.id)
        );
      end if;

      -- CASE B: Job status is UNKNOWN (execution may have started)
      -- Preserve uncertainty: do NOT mark CANCELLED; leave status UNKNOWN
      if v_job.status = 'UNKNOWN' then
        insert into public.event (
          owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
        ) values (
          v_owner, 'JOB', v_job.id, 'JOB_OVERRIDDEN_MANUALLY', 'USER', v_owner,
          jsonb_build_object(
            'reason', 'MANUAL_USER_SETTLEMENT_WITH_EXECUTION_UNCERTAINTY',
            'previous_status', v_job_previous_status,
            'action_id', v_action.id
          )
        );
      end if;
    end if;
  end if;

  -- Record USER_REPORTED observation
  insert into public.observation (
    owner_user_id,
    observation_kind,
    content,
    raw_payload,
    observed_at,
    source_type,
    source_reference,
    source_metadata
  ) values (
    v_owner,
    'HUMAN_ACTION_RESULT',
    jsonb_build_object(
      'action_id', v_action.id,
      'execution_mode', v_action.execution_mode,
      'terminal_status', p_terminal_status,
      'result', coalesce(p_result, '{}'::jsonb),
      'note', nullif(btrim(p_note), ''),
      'previous_job_status', v_job_previous_status
    ),
    coalesce(p_result, '{}'::jsonb),
    now(),
    'USER_REPORTED',
    v_action.id::text,
    jsonb_build_object(
      'actor_type', 'USER',
      'execution_mode', v_action.execution_mode,
      'job_status_at_settlement', v_job_previous_status
    )
  )
  returning * into v_observation;

  v_event := case p_terminal_status
    when 'COMPLETED' then 'ACTION_COMPLETED'
    when 'FAILED' then 'ACTION_FAILED'
    else 'ACTION_CANCELLED'
  end;

  -- Atomically transition action to terminal status
  update public.action
  set status = p_terminal_status,
      terminal_at = now(),
      updated_at = now()
  where id = v_action.id
    and owner_user_id = v_owner;

  insert into public.event (
    owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    v_owner, 'ACTION', v_action.id, v_event, 'USER', v_owner,
    jsonb_build_object(
      'observation_id', v_observation.id,
      'terminal_status', p_terminal_status,
      'execution_mode', v_action.execution_mode,
      'previous_job_status', v_job_previous_status
    )
  );

  select * into v_action from public.action where id = v_action.id and owner_user_id = v_owner;

  return jsonb_build_object(
    'action', to_jsonb(v_action),
    'observation', to_jsonb(v_observation)
  );
end;
$$;

create or replace function public.stryde_complete_human_action(
  p_action_id uuid,
  p_terminal_status text,
  p_result jsonb default '{}'::jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  return stryde_internal.complete_human_action(p_action_id, p_terminal_status, p_result, p_note);
end;
$$;

revoke all privileges on function stryde_internal.complete_human_action(uuid,text,jsonb,text) from public, anon, authenticated;
grant execute on function stryde_internal.complete_human_action(uuid,text,jsonb,text) to authenticated;
revoke all privileges on function public.stryde_complete_human_action(uuid,text,jsonb,text) from public, anon;
grant execute on function public.stryde_complete_human_action(uuid,text,jsonb,text) to authenticated;
