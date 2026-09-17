create or replace function stryde_internal.run_transition(p_run_id uuid, p_to_stage text, p_status text default null, p_failure_reason text default null)
returns public.run
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_run public.run;
  v_owner uuid := (select auth.uid());
  v_current text;
  v_status text;
  v_allowed boolean := false;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_to_stage not in ('INPUT','CONTEXT_ASSEMBLY','UNDERSTAND','REASSESS','DIAGNOSE','SELECT_INTERVENTION','PROPOSE','VALIDATE','AUTHORIZE','COMMIT','DONE','FAILED','WAITING') then raise exception 'Invalid Run stage'; end if;
  select r.* into v_run from public.run r where r.id=p_run_id and r.owner_user_id=v_owner for update;
  if not found then raise exception 'Run not found'; end if;
  if v_run.status in ('SUCCEEDED','FAILED') then raise exception 'Run is terminal'; end if;
  v_current := v_run.current_stage;
  v_status := coalesce(p_status, v_run.status);
  if v_current='INPUT' and p_to_stage='CONTEXT_ASSEMBLY' then v_allowed:=true;
  elsif v_current='CONTEXT_ASSEMBLY' and p_to_stage='UNDERSTAND' then v_allowed:=true;
  elsif v_current='UNDERSTAND' and p_to_stage='REASSESS' then v_allowed:=true;
  elsif v_current='REASSESS' and p_to_stage in ('DIAGNOSE','SELECT_INTERVENTION','WAITING','FAILED') then v_allowed:=true;
  elsif v_current='DIAGNOSE' and p_to_stage in ('SELECT_INTERVENTION','WAITING','FAILED') then v_allowed:=true;
  elsif v_current='SELECT_INTERVENTION' and p_to_stage in ('PROPOSE','WAITING','FAILED') then v_allowed:=true;
  elsif v_current='PROPOSE' and p_to_stage in ('VALIDATE','WAITING','FAILED') then v_allowed:=true;
  elsif v_current='VALIDATE' and p_to_stage in ('AUTHORIZE','WAITING','FAILED') then v_allowed:=true;
  elsif v_current='AUTHORIZE' and p_to_stage in ('COMMIT','WAITING','FAILED') then v_allowed:=true;
  elsif v_current='COMMIT' and p_to_stage='DONE' then v_allowed:=true;
  elsif v_current='WAITING' and p_to_stage in ('REASSESS','DIAGNOSE','SELECT_INTERVENTION','FAILED') then v_allowed:=true;
  elsif p_to_stage='FAILED' then v_allowed:=true;
  end if;
  if not v_allowed then raise exception 'Invalid Run transition: % -> %', v_current, p_to_stage; end if;
  update public.run set current_stage=p_to_stage, status=case when p_to_stage='DONE' then 'SUCCEEDED' when p_to_stage='FAILED' then 'FAILED' when p_to_stage='WAITING' then 'WAITING' else v_status end, failure_reason=case when p_to_stage='FAILED' then nullif(btrim(p_failure_reason),'') else failure_reason end, updated_at=now(), completed_at=case when p_to_stage in ('DONE','FAILED') then now() else completed_at end, version=version+1 where id=v_run.id;
  insert into public.event(owner_user_id,entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values(v_owner,'RUN',v_run.id,'RUN_STAGE_TRANSITION','USER',v_owner,jsonb_build_object('from_stage',v_current,'to_stage',p_to_stage,'status',case when p_to_stage='DONE' then 'SUCCEEDED' when p_to_stage='FAILED' then 'FAILED' when p_to_stage='WAITING' then 'WAITING' else v_status end));
  select * into v_run from public.run where id=v_run.id; return v_run;
end;
$function$;
