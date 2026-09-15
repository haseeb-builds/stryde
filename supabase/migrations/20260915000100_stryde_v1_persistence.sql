-- STRYDE V1 persistence foundation
-- Implements Step 8 persistence contract without removing the legacy prototype.

create extension if not exists pgcrypto;

create table if not exists public.claim_kind (
  id text primary key,
  created_at timestamptz not null default now()
);

insert into public.claim_kind (id) values
  ('OBJECTIVE'), ('OUTCOME'), ('GENERAL')
on conflict (id) do nothing;

create table public.thread (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED','EXPIRED','DISCARDED')),
  content text not null,
  resolution_pursuit_id uuid null,
  resolution_claim_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, id)
);

create table public.pursuit (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  origin_thread_id uuid null,
  predecessor_pursuit_id uuid null,
  title text null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','COMPLETED','ABANDONED')),
  objective_claim_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active_at timestamptz null,
  paused_at timestamptz null,
  completed_at timestamptz null,
  abandoned_at timestamptz null,
  unique (owner_user_id, id),
  foreign key (owner_user_id, origin_thread_id) references public.thread(owner_user_id, id),
  foreign key (owner_user_id, predecessor_pursuit_id) references public.pursuit(owner_user_id, id)
);

create table public.claim (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  scope text not null check (scope in ('USER','PURSUIT')),
  pursuit_id uuid null,
  kind text not null references public.claim_kind(id),
  content text not null,
  structured_detail jsonb null,
  structured_detail_schema_version smallint null,
  epistemic_status text not null default 'REPORTED' check (epistemic_status in ('REPORTED','OBSERVED','VERIFIED','CONTRADICTED','UNVERIFIABLE')),
  supersedes_claim_id uuid null,
  superseded_by_claim_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, id),
  foreign key (owner_user_id, pursuit_id) references public.pursuit(owner_user_id, id),
  foreign key (owner_user_id, supersedes_claim_id) references public.claim(owner_user_id, id),
  foreign key (owner_user_id, superseded_by_claim_id) references public.claim(owner_user_id, id)
);

alter table public.pursuit
  add constraint pursuit_objective_claim_fk
  foreign key (owner_user_id, objective_claim_id)
  references public.claim(owner_user_id, id);

create unique index claim_single_successor_idx
  on public.claim (owner_user_id, supersedes_claim_id)
  where supersedes_claim_id is not null;

create table public.pursuit_claim_link (
  pursuit_id uuid not null,
  claim_id uuid not null,
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (pursuit_id, claim_id),
  foreign key (owner_user_id, pursuit_id) references public.pursuit(owner_user_id, id),
  foreign key (owner_user_id, claim_id) references public.claim(owner_user_id, id),
  unique (owner_user_id, pursuit_id, claim_id)
);

create table public.claim_relation (
  from_claim_id uuid not null,
  to_claim_id uuid not null,
  relation_type text not null check (relation_type in ('SUPPORTS','CONTRADICTS','VERIFIES')),
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (from_claim_id, to_claim_id, relation_type),
  foreign key (owner_user_id, from_claim_id) references public.claim(owner_user_id, id),
  foreign key (owner_user_id, to_claim_id) references public.claim(owner_user_id, id),
  check (from_claim_id <> to_claim_id)
);

create table public.observation (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  observation_kind text not null,
  content jsonb not null,
  raw_payload jsonb null,
  observed_at timestamptz not null,
  source_type text null,
  source_reference text null,
  source_uri text null,
  source_metadata jsonb null,
  created_at timestamptz not null default now(),
  unique (owner_user_id, id)
);

create table public.claim_observation_link (
  claim_id uuid not null,
  observation_id uuid not null,
  relation_type text not null check (relation_type in ('SUPPORTS','CONTRADICTS','VERIFIES')),
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (claim_id, observation_id, relation_type),
  foreign key (owner_user_id, claim_id) references public.claim(owner_user_id, id),
  foreign key (owner_user_id, observation_id) references public.observation(owner_user_id, id)
);

create table public.claim_status_event (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null,
  owner_user_id uuid not null references auth.users(id),
  from_status text null check (from_status is null or from_status in ('REPORTED','OBSERVED','VERIFIED','CONTRADICTED','UNVERIFIABLE')),
  to_status text not null check (to_status in ('REPORTED','OBSERVED','VERIFIED','CONTRADICTED','UNVERIFIABLE')),
  actor_type text not null,
  actor_id uuid null,
  evidence_observation_id uuid null,
  occurred_at timestamptz not null default now(),
  reason text null,
  foreign key (owner_user_id, claim_id) references public.claim(owner_user_id, id),
  foreign key (owner_user_id, evidence_observation_id) references public.observation(owner_user_id, id)
);

create table public.decision (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  pursuit_id uuid not null,
  kind text not null check (kind in ('STRATEGIC','ACTION_APPROVAL')),
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED','WITHDRAWN')),
  predecessor_decision_id uuid null,
  chosen_option_id uuid null,
  resolution_actor_type text null,
  resolution_actor_id uuid null,
  resolution_rationale text null,
  resolved_at timestamptz null,
  structured_context jsonb null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, id),
  foreign key (owner_user_id, pursuit_id) references public.pursuit(owner_user_id, id),
  foreign key (owner_user_id, predecessor_decision_id) references public.decision(owner_user_id, id)
);

create table public.decision_option (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null,
  owner_user_id uuid not null references auth.users(id),
  label text not null,
  description text null,
  structured_parameters jsonb null,
  created_at timestamptz not null default now(),
  unique (owner_user_id, id),
  foreign key (owner_user_id, decision_id) references public.decision(owner_user_id, id)
);

alter table public.decision
  add constraint decision_chosen_option_fk
  foreign key (owner_user_id, chosen_option_id)
  references public.decision_option(owner_user_id, id);

create table public.decision_premise (
  decision_id uuid not null,
  claim_id uuid not null,
  owner_user_id uuid not null references auth.users(id),
  claim_status_at_premise_time text not null check (claim_status_at_premise_time in ('REPORTED','OBSERVED','VERIFIED','CONTRADICTED','UNVERIFIABLE')),
  created_at timestamptz not null default now(),
  primary key (decision_id, claim_id),
  foreign key (owner_user_id, decision_id) references public.decision(owner_user_id, id),
  foreign key (owner_user_id, claim_id) references public.claim(owner_user_id, id)
);

create table public.action (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  pursuit_id uuid not null,
  execution_mode text not null check (execution_mode in ('HUMAN','CONTROLLED')),
  originating_decision_id uuid null,
  originating_decision_option_id uuid null,
  predecessor_action_id uuid null,
  intent_summary text not null,
  intent_parameters jsonb null,
  status text not null default 'PROPOSED' check (status in ('PROPOSED','IN_PROGRESS','COMPLETED','FAILED','CANCELLED')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  terminal_at timestamptz null,
  unique (owner_user_id, id),
  foreign key (owner_user_id, pursuit_id) references public.pursuit(owner_user_id, id),
  foreign key (owner_user_id, originating_decision_id) references public.decision(owner_user_id, id),
  foreign key (owner_user_id, originating_decision_option_id) references public.decision_option(owner_user_id, id),
  foreign key (owner_user_id, predecessor_action_id) references public.action(owner_user_id, id)
);

create table public.tool (
  id uuid primary key default gen_random_uuid(),
  tool_key text not null,
  tool_version text not null,
  argument_schema jsonb not null,
  output_schema jsonb null,
  output_classification jsonb null,
  side_effect_class text null,
  reversibility text null,
  idempotency_behavior text null,
  timeout_ms integer null check (timeout_ms is null or timeout_ms > 0),
  retry_policy jsonb null,
  credential_scope text null,
  egress_policy jsonb null,
  environment_restrictions jsonb null,
  verification_capability jsonb null,
  created_at timestamptz not null default now(),
  unique (tool_key, tool_version),
  unique (id, tool_version)
);

create table public.capability_grant (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  tool_id uuid null,
  tool_family text null,
  scope_constraints jsonb null,
  target_constraints jsonb null,
  budget_ceiling numeric null check (budget_ceiling is null or budget_ceiling >= 0),
  granted_at timestamptz not null default now(),
  expires_at timestamptz null,
  revoked_at timestamptz null,
  source_decision_id uuid null,
  created_at timestamptz not null default now(),
  unique (owner_user_id, id),
  foreign key (tool_id) references public.tool(id),
  foreign key (owner_user_id, source_decision_id) references public.decision(owner_user_id, id),
  check (tool_id is not null or tool_family is not null),
  check (revoked_at is null or revoked_at >= granted_at)
);

create table public.credential_reference (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  provider text not null,
  external_reference text not null,
  scope_metadata jsonb null,
  created_at timestamptz not null default now(),
  unique (owner_user_id, id),
  unique (owner_user_id, provider, external_reference)
);

create table public.job (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  action_id uuid not null,
  tool_id uuid not null,
  tool_version text not null,
  frozen_arguments jsonb not null,
  args_hash text not null,
  idempotency_key text not null unique,
  authorization_basis jsonb not null,
  status text not null default 'AUTHORIZED' check (status in ('AUTHORIZED','DISPATCHING','AWAITING_CALLBACK','UNKNOWN','SUCCEEDED','FAILED','CANCELLED')),
  retry_count integer not null default 0 check (retry_count >= 0),
  max_retries integer not null default 0 check (max_retries >= 0),
  next_retry_at timestamptz null,
  lease_owner text null,
  lease_expires_at timestamptz null,
  fencing_token bigint not null default 0 check (fencing_token >= 0),
  cancel_requested_at timestamptz null,
  cancel_reason text null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique (owner_user_id, id),
  foreign key (owner_user_id, action_id) references public.action(owner_user_id, id),
  foreign key (tool_id, tool_version) references public.tool(id, tool_version)
);

create unique index job_one_nonterminal_per_action_idx
  on public.job (owner_user_id, action_id)
  where status not in ('SUCCEEDED','FAILED','CANCELLED');

create table public.job_authorization (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  job_id uuid not null,
  action_id uuid not null,
  decision_id uuid null,
  authorization_type text not null,
  args_hash text not null,
  authorized_by_type text not null,
  authorized_by_id uuid null,
  authorized_at timestamptz not null default now(),
  authorization_snapshot jsonb null,
  unique (owner_user_id, id),
  foreign key (owner_user_id, job_id) references public.job(owner_user_id, id),
  foreign key (owner_user_id, action_id) references public.action(owner_user_id, id),
  foreign key (owner_user_id, decision_id) references public.decision(owner_user_id, id)
);

create table public.attempt (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  owner_user_id uuid not null references auth.users(id),
  attempt_number integer not null check (attempt_number > 0),
  fencing_token bigint not null check (fencing_token >= 0),
  dispatch_state text not null check (dispatch_state in ('NOT_DISPATCHED','DISPATCH_INTENT_COMMITTED','DISPATCHED','DISPATCH_UNKNOWN')),
  mechanical_result_state text null check (mechanical_result_state is null or mechanical_result_state in ('PENDING','SUCCEEDED','FAILED','UNKNOWN')),
  terminal_resolution text null,
  external_correlation_id text null,
  callback_authenticity_state text null,
  dispatch_intent_at timestamptz null,
  dispatched_at timestamptz null,
  completed_at timestamptz null,
  redacted_result jsonb null,
  raw_result_reference text null,
  error_details jsonb null,
  created_at timestamptz not null default now(),
  unique (job_id, attempt_number),
  unique (owner_user_id, id),
  foreign key (owner_user_id, job_id) references public.job(owner_user_id, id)
);

create index attempt_external_correlation_idx
  on public.attempt (external_correlation_id)
  where external_correlation_id is not null;

create table public.reconciliation_task (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  attempt_id uuid null,
  owner_user_id uuid not null references auth.users(id),
  reason text not null,
  status text not null default 'PENDING',
  next_check_at timestamptz null,
  resolution text null,
  notes text null,
  actor_type text null,
  actor_id uuid null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  unique (owner_user_id, id),
  foreign key (owner_user_id, job_id) references public.job(owner_user_id, id),
  foreign key (owner_user_id, attempt_id) references public.attempt(owner_user_id, id)
);

create unique index reconciliation_one_active_per_job_idx
  on public.reconciliation_task (owner_user_id, job_id)
  where status not in ('RESOLVED','CANCELLED');

create table public.budget (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  budget_key text not null,
  ceiling numeric not null check (ceiling >= 0),
  reserved numeric not null default 0 check (reserved >= 0),
  consumed numeric not null default 0 check (consumed >= 0),
  window_started_at timestamptz null,
  window_ends_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, budget_key)
);

create table public.run (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  trigger_type text not null,
  trigger_metadata jsonb null,
  current_stage text not null check (current_stage in ('INPUT','CONTEXT_ASSEMBLY','UNDERSTAND','REASSESS','DIAGNOSE','SELECT_INTERVENTION','PROPOSE','VALIDATE','AUTHORIZE','COMMIT','DONE','FAILED','WAITING')),
  status text not null,
  resume_state jsonb null,
  wait_state jsonb null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  unique (owner_user_id, id)
);

create table public.run_context_reference (
  run_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (run_id, entity_type, entity_id),
  foreign key (owner_user_id, run_id) references public.run(owner_user_id, id)
);

create table public.event (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  actor_type text not null,
  actor_id uuid null,
  payload jsonb null,
  created_at timestamptz not null default now(),
  unique (owner_user_id, id)
);

-- Indexes driven by the canonical query patterns.
create index pursuit_owner_status_idx on public.pursuit(owner_user_id, status);
create index claim_current_owner_idx on public.claim(owner_user_id, created_at desc) where superseded_by_claim_id is null;
create index decision_open_pursuit_idx on public.decision(owner_user_id, pursuit_id) where status = 'OPEN';
create index action_active_pursuit_idx on public.action(owner_user_id, pursuit_id, status) where status in ('PROPOSED','IN_PROGRESS');
create index job_leaseable_idx on public.job(status, next_retry_at) where status = 'AUTHORIZED';
create index job_expiring_lease_idx on public.job(lease_expires_at) where status in ('DISPATCHING','AWAITING_CALLBACK');
create index job_unknown_idx on public.job(owner_user_id, updated_at desc) where status = 'UNKNOWN';
create index run_waiting_idx on public.run(owner_user_id, updated_at desc) where status = 'WAITING';
create index event_owner_recent_idx on public.event(owner_user_id, occurred_at desc);
create index event_entity_idx on public.event(owner_user_id, entity_type, entity_id, occurred_at desc);

-- Generic updated_at trigger for mutable current-state tables.
create or replace function public.stryde_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['thread','pursuit','claim','decision','action','job','budget','run'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.stryde_touch_updated_at()', t || '_touch_updated_at', t);
  end loop;
end $$;

create or replace function public.stryde_prevent_immutable_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'claim' then
    if new.content is distinct from old.content or new.kind is distinct from old.kind then
      raise exception 'Claim semantic content is immutable';
    end if;
    if new.supersedes_claim_id is distinct from old.supersedes_claim_id then
      raise exception 'Claim supersession pointer is write-once';
    end if;
  elsif tg_table_name = 'thread' then
    if old.status in ('RESOLVED','EXPIRED','DISCARDED') and new is distinct from old then
      raise exception 'Terminal Thread is immutable';
    end if;
  elsif tg_table_name = 'pursuit' then
    if old.status in ('COMPLETED','ABANDONED') then
      raise exception 'Terminal Pursuit is immutable';
    end if;
    if new.owner_user_id is distinct from old.owner_user_id then
      raise exception 'Ownership is immutable';
    end if;
  elsif tg_table_name = 'decision' then
    if old.status in ('RESOLVED','WITHDRAWN') then
      raise exception 'Terminal Decision is immutable';
    end if;
  elsif tg_table_name = 'action' then
    if old.status in ('COMPLETED','FAILED','CANCELLED') then
      raise exception 'Terminal Action is immutable';
    end if;
  end if;
  return new;
end;
$$;

create trigger claim_immutable_guard
before update on public.claim
for each row execute function public.stryde_prevent_immutable_mutation();

create trigger thread_immutable_guard
before update on public.thread
for each row execute function public.stryde_prevent_immutable_mutation();

create trigger pursuit_immutable_guard
before update on public.pursuit
for each row execute function public.stryde_prevent_immutable_mutation();

create trigger decision_immutable_guard
before update on public.decision
for each row execute function public.stryde_prevent_immutable_mutation();

create trigger action_immutable_guard
before update on public.action
for each row execute function public.stryde_prevent_immutable_mutation();

create or replace function public.stryde_validate_semantics()
returns trigger
language plpgsql
as $$
declare
  predecessor_status text;
  successor_count integer;
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
      if objective_kind is distinct from 'OBJECTIVE' or objective_status is null or objective_pursuit is distinct from new.id then
        raise exception 'Objective pointer must reference a current OBJECTIVE Claim owned by this Pursuit';
      end if;
      if objective_status = 'CONTRADICTED' then
        raise exception 'Objective Claim cannot be CONTRADICTED';
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
      select epistemic_status into successor_count
      from public.claim
      where id = new.supersedes_claim_id and owner_user_id = new.owner_user_id;
      if new.id = new.supersedes_claim_id then
        raise exception 'Claim cannot supersede itself';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger pursuit_semantic_guard
before insert or update on public.pursuit
for each row execute function public.stryde_validate_semantics();

create trigger claim_semantic_guard
before insert or update on public.claim
for each row execute function public.stryde_validate_semantics();

-- RLS: user-owned durable records are isolated by owner_user_id.
do $$
declare
  t text;
begin
  foreach t in array array['thread','pursuit','claim','pursuit_claim_link','claim_relation','observation','claim_observation_link','claim_status_event','decision','decision_option','decision_premise','action','capability_grant','credential_reference','job','job_authorization','attempt','reconciliation_task','budget','run','run_context_reference','event'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_delete', t);
    execute format('create policy %I on public.%I for select using (owner_user_id = auth.uid())', t || '_owner_select', t);
    execute format('create policy %I on public.%I for insert with check (owner_user_id = auth.uid())', t || '_owner_insert', t);
    execute format('create policy %I on public.%I for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid())', t || '_owner_update', t);
    execute format('create policy %I on public.%I for delete using (owner_user_id = auth.uid())', t || '_owner_delete', t);
  end loop;
end $$;

alter table public.tool enable row level security;
-- Tools are system-owned; no client write policy is granted in this migration.
create policy tool_authenticated_read on public.tool
for select to authenticated using (true);

alter table public.claim_kind enable row level security;
create policy claim_kind_authenticated_read on public.claim_kind
for select to authenticated using (true);

-- Event, claim_status_event, attempt, job authorization and observations are semantically append-only.
-- Application write paths should use trusted server/control-plane code; RLS remains owner scoped.
