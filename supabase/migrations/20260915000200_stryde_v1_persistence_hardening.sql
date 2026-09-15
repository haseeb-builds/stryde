-- Harden the initial STRYDE persistence migration before application code relies on it.

-- Correct the claim semantic guard so supersession validation does not coerce text into integer.
create or replace function public.stryde_validate_semantics()
returns trigger
language plpgsql
as $$
declare
  predecessor_status text;
  predecessor_epistemic_status text;
  objective_kind text;
  objective_status text;
  objective_pursuit uuid;
begin
  if tg_table_name = 'pursuit' then
    if new.predecessor_pursuit_id is not null then
      select status into predecessor_status
      from public.pursuit
      where id = new.predecessor_pursuit_id and owner_user_id = new.owner_user_id;
      if predecessor_status is null or predecessor_status not in ('COMPLETED','ABANDONED') then
        raise exception 'Pursuit predecessor must be terminal';
      end if;
    end if;

    if new.objective_claim_id is not null then
      select kind, epistemic_status, pursuit_id
      into objective_kind, objective_status, objective_pursuit
      from public.claim
      where id = new.objective_claim_id and owner_user_id = new.owner_user_id;

      if objective_kind is distinct from 'OBJECTIVE'
         or objective_status is null
         or objective_pursuit is distinct from new.id
         or objective_status = 'CONTRADICTED' then
        raise exception 'Objective pointer must reference a current OBJECTIVE Claim owned by this Pursuit';
      end if;
    end if;

  elsif tg_table_name = 'claim' then
    if new.scope = 'PURSUIT' and new.pursuit_id is null then
      raise exception 'PURSUIT-scoped Claim requires pursuit_id';
    end if;

    if new.scope = 'USER' and new.pursuit_id is not null then
      raise exception 'USER-scoped Claim cannot have pursuit_id';
    end if;

    if new.supersedes_claim_id is not null then
      if new.id = new.supersedes_claim_id then
        raise exception 'Claim cannot supersede itself';
      end if;
      select epistemic_status into predecessor_epistemic_status
      from public.claim
      where id = new.supersedes_claim_id and owner_user_id = new.owner_user_id;
      if predecessor_epistemic_status is null then
        raise exception 'Claim supersession target must exist and belong to the same owner';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Owner identity is immutable for all user-owned current-state records.
create or replace function public.stryde_prevent_owner_change()
returns trigger
language plpgsql
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'owner_user_id is immutable';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'thread','pursuit','claim','pursuit_claim_link','claim_relation','observation',
    'claim_observation_link','claim_status_event','decision','decision_option',
    'decision_premise','action','capability_grant','credential_reference','job',
    'job_authorization','attempt','reconciliation_task','budget','run',
    'run_context_reference','event'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_owner_guard', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.stryde_prevent_owner_change()', t || '_owner_guard', t);
  end loop;
end $$;

-- Append-only semantic/support records are never directly updateable or deletable by a user.
-- Insertions also stay behind trusted server/control-plane paths so clients cannot forge provenance/history.
do $$
declare
  t text;
begin
  foreach t in array array['claim_relation','observation','claim_observation_link','claim_status_event','decision_option','decision_premise','job_authorization','attempt','run_context_reference','event'] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_delete', t);
  end loop;
end $$;

-- Thread resolution references are same-owner foreign keys.
alter table public.thread
  add constraint thread_resolution_pursuit_fk
  foreign key (owner_user_id, resolution_pursuit_id)
  references public.pursuit(owner_user_id, id);

alter table public.thread
  add constraint thread_resolution_claim_fk
  foreign key (owner_user_id, resolution_claim_id)
  references public.claim(owner_user_id, id);

-- Action-origin decision option must belong to its originating decision.
create or replace function public.stryde_validate_action_origin()
returns trigger
language plpgsql
as $$
begin
  if new.originating_decision_option_id is not null then
    if not exists (
      select 1
      from public.decision_option o
      where o.id = new.originating_decision_option_id
        and o.owner_user_id = new.owner_user_id
        and o.decision_id = new.originating_decision_id
    ) then
      raise exception 'Action originating decision option must belong to originating decision';
    end if;
  end if;
  return new;
end;
$$;

create trigger action_origin_guard
before insert or update on public.action
for each row execute function public.stryde_validate_action_origin();

-- Decision chosen option must belong to the same Decision.
create or replace function public.stryde_validate_decision_choice()
returns trigger
language plpgsql
as $$
begin
  if new.chosen_option_id is not null then
    if not exists (
      select 1
      from public.decision_option o
      where o.id = new.chosen_option_id
        and o.owner_user_id = new.owner_user_id
        and o.decision_id = new.id
    ) then
      raise exception 'Chosen option must belong to the Decision';
    end if;
  end if;
  return new;
end;
$$;

create trigger decision_choice_guard
before insert or update on public.decision
for each row execute function public.stryde_validate_decision_choice();

-- A Job must freeze the exact tool version it will invoke.
create or replace function public.stryde_validate_job_tool()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.tool t
    where t.id = new.tool_id and t.tool_version = new.tool_version
  ) then
    raise exception 'Job tool/version does not exist';
  end if;
  return new;
end;
$$;

create trigger job_tool_version_guard
before insert or update on public.job
for each row execute function public.stryde_validate_job_tool();
