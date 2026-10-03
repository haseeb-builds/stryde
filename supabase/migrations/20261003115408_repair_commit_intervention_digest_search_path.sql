-- Repair: qualify schema resolution for digest() in the controlled-execution
-- authority repair functions (2026-10-02 body).
--
-- Live drift found 2026-10-03: the 20261002180000 body was written with
-- `set search_path = public, pg_temp` while calling digest() unqualified.
-- pgcrypto's digest() lives in the `extensions` schema on Supabase, which is
-- NOT on that search_path, so every call to stryde_internal.commit_intervention
-- (and therefore every HUMAN Action start, and every CONTROLLED delegation)
-- failed at runtime with:
--     500 {"error":"function digest(text, unknown) does not exist"}
-- This blocked the entire create -> approve -> start -> report loop.
--
-- Fix: recreate the same function bodies with `extensions` on the search_path,
-- matching the working 20260926161200 body which used extensions.digest(...)
-- and `set search_path = public, extensions, pg_temp`. No behavioral change
-- beyond making the already-intended authority/authorization logic callable.

-- Controlled-execution authority repair (2026-10-02).
--
-- Live drift found by audit: stryde_internal.commit_intervention on the live
-- project still carried the legacy body that (a) wrote job.status='QUEUED',
-- which violates job_status_check, and (b) inserted job_authorization rows
-- using columns that no longer exist (capability_grant_id, approved_by_type,
-- approved_by_id, approved_at). Every CONTROLLED delegation therefore failed
-- at commit time. The repository's canonical body (20260915000400) writes
-- 'AUTHORIZED' with the immutable authorization snapshot; this migration
-- restores that body on live.
--
-- Authority provisioning: CONTROLLED commits previously required a pre-existing
-- unrestricted capability_grant and failed when none existed (0 grants in
-- production made worker delegation unreachable). Instead of adding a separate
-- grant-management surface, the grant is now provisioned by the trusted plane
-- from the explicit user approval that is already required for every commit:
-- each CONTROLLED commit provisions (or reuses) a time-bounded unrestricted
-- grant sourced from the approval decision. Authority stays with the user per
-- delegation (routes enforce explicit approval; each commit records its own
-- ACTION_APPROVAL decision); the grant is the durable, revocable, expiring
-- record of that authority. No data is touched by this migration.

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
set search_path = public, extensions, pg_temp
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

    if not found then
      insert into public.capability_grant (
        owner_user_id, tool_id, tool_family, scope_constraints, target_constraints,
        budget_ceiling, granted_at, expires_at, revoked_at, source_decision_id
      ) values (
        v_owner, v_tool.id, null, '{}'::jsonb, '{}'::jsonb,
        null, now(), now() + interval '24 hours', null, v_decision.id
      ) returning * into v_grant;

      insert into public.event (
        owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
      ) values (
        v_owner, 'CAPABILITY_GRANT', v_grant.id, 'CAPABILITY_GRANTED', 'USER', v_owner,
        jsonb_build_object(
          'capability_grant_id', v_grant.id,
          'decision_id', v_decision.id,
          'action_id', v_action.id,
          'tool_id', v_tool.id,
          'tool_version', v_tool.tool_version,
          'expires_at', v_grant.expires_at,
          'authorization_rationale', nullif(btrim(p_authorization_rationale), '')
        )
      );
    end if;

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
set search_path = public, extensions, pg_temp
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
