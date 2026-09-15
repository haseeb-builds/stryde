-- Step 14: deterministic authorization + atomic intervention commit.
-- The public wrapper is SECURITY INVOKER. Privileged writes needed for immutable
-- Event/Job authorization are performed by a narrowly scoped function in an
-- unexposed schema with explicit auth.uid() checks.

create schema if not exists stryde_internal;

create or replace function stryde_internal.commit_intervention(
  p_pursuit_id uuid,
  p_intent_summary text,
  p_intent_parameters jsonb,
  p_execution_mode text,
  p_tool_id uuid default null,
  p_tool_version text default null,
  p_why text default null,
  p_expected_result text default null,
  p_success_condition text default null,
  p_reversibility text default null,
  p_authorization_rationale text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_pursuit public.pursuit;
  v_decision public.decision;
  v_option public.decision_option;
  v_action public.action;
  v_job public.job;
  v_auth public.job_authorization;
  v_tool public.tool;
  v_grant public.capability_grant;
  v_args jsonb := coalesce(p_intent_parameters, '{}'::jsonb);
  v_args_hash text := encode(digest(v_args::text, 'sha256'), 'hex');
  v_idempotency text;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_pursuit_id is null then raise exception 'pursuit_id is required'; end if;
  if p_intent_summary is null or btrim(p_intent_summary) = '' or length(p_intent_summary) > 2000 then
    raise exception 'intent_summary must be non-empty and 2000 characters or fewer';
  end if;
  if p_execution_mode not in ('HUMAN','CONTROLLED') then raise exception 'Invalid execution_mode'; end if;
  if p_execution_mode = 'CONTROLLED' and (p_tool_id is null or p_tool_version is null or btrim(p_tool_version) = '') then
    raise exception 'CONTROLLED actions require tool_id and tool_version';
  end if;

  select * into v_pursuit
  from public.pursuit
  where id = p_pursuit_id and owner_user_id = v_owner
  for update;
  if not found then raise exception 'Pursuit not found'; end if;
  if v_pursuit.status not in ('ACTIVE','PAUSED') then raise exception 'Cannot commit an Action to a terminal Pursuit'; end if;

  insert into public.decision (
    owner_user_id, pursuit_id, kind, status, resolution_actor_type, resolution_actor_id,
    resolution_rationale, resolved_at, structured_context
  ) values (
    v_owner, p_pursuit_id, 'ACTION_APPROVAL', 'RESOLVED', 'USER', v_owner,
    nullif(btrim(p_authorization_rationale), ''), now(),
    jsonb_build_object(
      'why', nullif(btrim(p_why), ''),
      'expected_result', nullif(btrim(p_expected_result), ''),
      'success_condition', nullif(btrim(p_success_condition), ''),
      'reversibility', nullif(btrim(p_reversibility), '')
    )
  ) returning * into v_decision;

  insert into public.decision_option (
    decision_id, owner_user_id, label, description, structured_parameters
  ) values (
    v_decision.id, v_owner, p_intent_summary,
    nullif(btrim(p_expected_result), ''), v_args
  ) returning * into v_option;

  update public.decision
  set chosen_option_id = v_option.id,
      updated_at = now()
  where id = v_decision.id and owner_user_id = v_owner;

  insert into public.event (
    owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    v_owner, 'DECISION', v_decision.id, 'ACTION_APPROVAL_COMMITTED', 'USER', v_owner,
    jsonb_build_object('decision_id', v_decision.id, 'option_id', v_option.id, 'pursuit_id', p_pursuit_id)
  );

  insert into public.action (
    owner_user_id, pursuit_id, execution_mode, originating_decision_id, originating_decision_option_id,
    intent_summary, intent_parameters, status, version
  ) values (
    v_owner, p_pursuit_id, p_execution_mode, v_decision.id, v_option.id,
    btrim(p_intent_summary), v_args, 'IN_PROGRESS', 1
  ) returning * into v_action;

  insert into public.event (
    owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    v_owner, 'ACTION', v_action.id, 'ACTION_COMMITTED', 'USER', v_owner,
    jsonb_build_object('action_id', v_action.id, 'execution_mode', v_action.execution_mode, 'decision_id', v_decision.id)
  );

  if p_execution_mode = 'CONTROLLED' then
    select * into v_tool
    from public.tool
    where id = p_tool_id and tool_version = p_tool_version;
    if not found then raise exception 'Tool/version is not registered'; end if;

    select * into v_grant
    from public.capability_grant
    where owner_user_id = v_owner
      and tool_id = p_tool_id
      and revoked_at is null
      and (expires_at is null or expires_at > now())
      and (scope_constraints is null or scope_constraints = '{}'::jsonb)
      and (target_constraints is null or target_constraints = '{}'::jsonb)
    order by granted_at desc
    limit 1;
    if not found then raise exception 'No active unrestricted capability grant exists for this tool'; end if;

    v_idempotency := 'stryde-action-' || v_action.id::text;

    insert into public.job (
      owner_user_id, action_id, tool_id, tool_version, frozen_arguments, args_hash,
      idempotency_key, authorization_basis, status, retry_count, max_retries, fencing_token
    ) values (
      v_owner, v_action.id, v_tool.id, v_tool.tool_version, v_args, v_args_hash,
      v_idempotency,
      jsonb_build_object(
        'authorization_type','EXPLICIT_USER_APPROVAL',
        'decision_id',v_decision.id,
        'decision_option_id',v_option.id,
        'capability_grant_id',v_grant.id,
        'tool_id',v_tool.id,
        'tool_version',v_tool.tool_version,
        'args_hash',v_args_hash
      ),
      'AUTHORIZED', 0, 0, 0
    ) returning * into v_job;

    insert into public.job_authorization (
      owner_user_id, job_id, action_id, decision_id, authorization_type, args_hash,
      authorized_by_type, authorized_by_id, authorized_at, authorization_snapshot
    ) values (
      v_owner, v_job.id, v_action.id, v_decision.id, 'EXPLICIT_USER_APPROVAL', v_args_hash,
      'USER', v_owner, now(),
      jsonb_build_object(
        'decision_id',v_decision.id,
        'decision_option_id',v_option.id,
        'action_id',v_action.id,
        'tool_id',v_tool.id,
        'tool_version',v_tool.tool_version,
        'args_hash',v_args_hash,
        'capability_grant_id',v_grant.id,
        'authorization_rationale',nullif(btrim(p_authorization_rationale), '')
      )
    ) returning * into v_auth;

    insert into public.event (
      owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
    ) values (
      v_owner, 'JOB', v_job.id, 'JOB_AUTHORIZED', 'USER', v_owner,
      jsonb_build_object('job_id',v_job.id,'action_id',v_action.id,'decision_id',v_decision.id,'args_hash',v_args_hash)
    );
  end if;

  return jsonb_build_object(
    'decision', to_jsonb(v_decision),
    'decision_option', to_jsonb(v_option),
    'action', to_jsonb(v_action),
    'job', case when v_job.id is null then null else to_jsonb(v_job) end,
    'job_authorization', case when v_auth.id is null then null else to_jsonb(v_auth) end
  );
end;
$$;

create or replace function public.stryde_commit_intervention(
  p_pursuit_id uuid,
  p_intent_summary text,
  p_intent_parameters jsonb,
  p_execution_mode text,
  p_tool_id uuid default null,
  p_tool_version text default null,
  p_why text default null,
  p_expected_result text default null,
  p_success_condition text default null,
  p_reversibility text default null,
  p_authorization_rationale text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return stryde_internal.commit_intervention(
    p_pursuit_id, p_intent_summary, p_intent_parameters, p_execution_mode,
    p_tool_id, p_tool_version, p_why, p_expected_result, p_success_condition,
    p_reversibility, p_authorization_rationale
  );
end;
$$;

revoke all on schema stryde_internal from public;
grant usage on schema stryde_internal to authenticated;
revoke all on function stryde_internal.commit_intervention(uuid,text,jsonb,text,uuid,text,text,text,text,text,text) from public;
grant execute on function stryde_internal.commit_intervention(uuid,text,jsonb,text,uuid,text,text,text,text,text,text) to authenticated;
revoke all on function public.stryde_commit_intervention(uuid,text,jsonb,text,uuid,text,text,text,text,text,text) from public;
grant execute on function public.stryde_commit_intervention(uuid,text,jsonb,text,uuid,text,text,text,text,text,text) to authenticated;
