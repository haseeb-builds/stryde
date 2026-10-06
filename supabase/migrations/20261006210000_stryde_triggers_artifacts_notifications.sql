-- Capability composition platform, part 2: general triggers (Phase 9),
-- first-class artifacts (Phase 10), and provider-neutral notifications
-- (Phase 11).
--
-- Triggers extend the EXISTING job infrastructure (no second engine): a
-- trigger, when its condition holds, enqueues the same public.job the
-- CONTROLLED plane already leases, executes, and reconciles. Triggers are
-- idempotent per condition window, auditable, budget-aware (the job's
-- execution reserves through the normal resource plane), and authority-aware
-- (a trigger can only fire work the user's autonomy policy and the
-- authorization-commit path already allow).
--
-- Notifications are a delivery queue, not a channel product: rows are
-- deduplicated by dedupe_key, linked to their pursuit/run/action, and
-- delivered by whatever provider the runtime configures. Absence of a
-- provider is honest DEGRADED, never silent loss or fabricated delivery.

-- ---------------------------------------------------------------------------
-- 9. Triggers
-- ---------------------------------------------------------------------------

create table if not exists public.trigger (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  pursuit_id uuid null references public.pursuit(id) on delete cascade,
  name text not null,
  trigger_kind text not null check (trigger_kind in (
    'ONE_TIME',      -- fire at fire_at
    'RECURRING',     -- fire on an interval expression evaluated by the cron
    'EVENT',         -- fire when event (entity_type, event_type) arrives
    'STATE',         -- fire when a pursuit state predicate holds (blocked N days)
    'MONITOR'        -- watch a source/condition via a capability and compare
  )),
  condition jsonb not null default '{}'::jsonb,
  -- The worker unit this trigger enqueues when it fires. Frozen at creation,
  -- validated against the worker contract, and still subject to the normal
  -- authorization path before execution.
  action jsonb not null default '{}'::jsonb,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'PAUSED', 'FIRED', 'CANCELLED')),
  last_fired_at timestamptz null,
  next_fire_at timestamptz null,
  max_fires integer null,
  fire_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (trigger_kind <> 'ONE_TIME' or next_fire_at is not null or condition ? 'fire_at')
);

alter table public.trigger enable row level security;

drop policy if exists "triggers owned" on public.trigger;
create policy "triggers owned"
  on public.trigger
  for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create index if not exists trigger_due_idx
  on public.trigger (status, next_fire_at)
  where status = 'ACTIVE';

-- Idempotency: one firing per trigger per condition window (default: per
-- day). The unique index collapses concurrent cron double-fires.
create table if not exists public.trigger_firing (
  id uuid primary key default gen_random_uuid(),
  trigger_id uuid not null references public.trigger(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid null,
  fired_at timestamptz not null default now(),
  window_key text not null,
  outcome text null,
  unique (trigger_id, window_key)
);

alter table public.trigger_firing enable row level security;

drop policy if exists "trigger firings readable by owner" on public.trigger_firing;
create policy "trigger firings readable by owner"
  on public.trigger_firing
  for select
  to authenticated
  using (owner_user_id = auth.uid());

-- Trusted-plane firing: marks the window (idempotent via the unique index),
-- bumps fire accounting, and returns whether THIS call won the window. The
-- caller only enqueues a job when true.
create or replace function public.stryde_fire_trigger(
  p_trigger uuid,
  p_window_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_status text;
begin
  select owner_user_id, status into v_owner, v_status
  from public.trigger where id = p_trigger;
  if not found or v_status <> 'ACTIVE' then
    return false;
  end if;
  begin
    insert into public.trigger_firing (trigger_id, owner_user_id, window_key)
    values (p_trigger, v_owner, p_window_key);
  exception when unique_violation then
    return false; -- already fired in this window
  end;
  update public.trigger
  set last_fired_at = now(),
      fire_count = fire_count + 1,
      status = case
        when max_fires is not null and fire_count + 1 >= max_fires then 'FIRED'
        when trigger_kind = 'ONE_TIME' then 'FIRED'
        else status end,
      updated_at = now()
  where id = p_trigger;
  return true;
end;
$$;

revoke execute on function public.stryde_fire_trigger(uuid, text) from anon, public;
grant execute on function public.stryde_fire_trigger(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 10. Artifacts
-- ---------------------------------------------------------------------------

create table if not exists public.artifact (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  pursuit_id uuid not null references public.pursuit(id) on delete cascade,
  run_id uuid null,
  action_id uuid null,
  -- Durable content lives in Postgres (D13): text/mime are the storage
  -- reference for text-class artifacts; larger binaries are out of scope.
  content_text text null,
  mime_type text not null default 'text/markdown'
    check (mime_type in ('text/markdown', 'text/plain', 'application/json', 'text/csv')),
  artifact_type text not null default 'DOCUMENT'
    check (artifact_type in ('DOCUMENT', 'RESEARCH_DOSSIER', 'CODE', 'DATA', 'REPORT')),
  title text not null,
  version integer not null default 1,
  -- Provenance: which capability/turn/action produced this.
  provenance jsonb not null default '{}'::jsonb,
  verification_state text not null default 'UNVERIFIED'
    check (verification_state in ('UNVERIFIED', 'OBSERVED', 'VERIFIED', 'CONTRADICTED')),
  superseded_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, id)
);

alter table public.artifact enable row level security;

drop policy if exists "artifacts owned" on public.artifact;
create policy "artifacts owned"
  on public.artifact
  for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create index if not exists artifact_pursuit_idx
  on public.artifact (pursuit_id, created_at desc);

-- Versioned update: a change creates a new row superseding the old one
-- (append-only history, rollback by reading the prior version).
create or replace function public.stryde_revise_artifact(
  p_artifact uuid,
  p_content text,
  p_actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old record;
  v_new uuid;
begin
  select * into v_old from public.artifact where id = p_artifact and owner_user_id = p_actor;
  if not found then
    raise exception 'artifact not found';
  end if;
  if v_old.superseded_by is not null then
    raise exception 'artifact already superseded';
  end if;
  insert into public.artifact
    (owner_user_id, pursuit_id, run_id, action_id, content_text, mime_type,
     artifact_type, title, version, provenance, verification_state)
  values
    (v_old.owner_user_id, v_old.pursuit_id, v_old.run_id, v_old.action_id,
     p_content, v_old.mime_type, v_old.artifact_type, v_old.title,
     v_old.version + 1,
     v_old.provenance || jsonb_build_object('revised_from', v_old.id),
     v_old.verification_state)
  returning id into v_new;
  update public.artifact set superseded_by = v_new, updated_at = now() where id = v_old.id;
  return v_new;
end;
$$;

revoke execute on function public.stryde_revise_artifact(uuid, text, uuid) from anon, public;
grant execute on function public.stryde_revise_artifact(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Notifications
-- ---------------------------------------------------------------------------

create table if not exists public.notification (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  pursuit_id uuid null references public.pursuit(id) on delete cascade,
  run_id uuid null,
  action_id uuid null,
  channel text not null default 'IN_APP'
    check (channel in ('IN_APP', 'EMAIL', 'WEBHOOK', 'SLACK', 'DISCORD', 'PUSH')),
  priority text not null default 'NORMAL'
    check (priority in ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  title text not null,
  body text not null,
  link_path text null,
  dedupe_key text null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'DELIVERED', 'DISMISSED', 'FAILED')),
  provider text null,
  provider_reference text null,
  delivered_at timestamptz null,
  created_at timestamptz not null default now(),
  -- Deduplication: the same logical notification is stored once per channel.
  unique (owner_user_id, channel, dedupe_key)
);

alter table public.notification enable row level security;

drop policy if exists "notifications owned" on public.notification;
create policy "notifications owned"
  on public.notification
  for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create index if not exists notification_pending_idx
  on public.notification (owner_user_id, status, created_at desc)
  where status = 'PENDING';
