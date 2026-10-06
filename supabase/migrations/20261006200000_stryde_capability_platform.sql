-- Capability composition platform, part 1: semantic capability registry,
-- plan resource envelopes (Free/Pro/Max), subscription state, and the
-- server-side reservation/reconciliation resource-control plane.
--
-- Semantic boundaries encoded here:
-- - A capability record describes what Stryde CAN use. It never grants
--   authority: execution still requires the existing authorization commit /
--   capability_grant path. Registry presence is not permission.
-- - Plans shape capacity, never epistemics: nothing in this schema can
--   upgrade the truth status of evidence.
-- - All limits are enforced server-side. The client is never authoritative.
-- - Numbers live in plan_envelope (centralized, configurable), never in
--   product code and never as vendor-specific call counts.

-- ---------------------------------------------------------------------------
-- 1. Semantic capability registry
-- ---------------------------------------------------------------------------

create table if not exists public.capability (
  id uuid primary key default gen_random_uuid(),
  capability_key text not null unique,
  version text not null,
  provider text not null,
  description text not null,
  -- The low-level mechanism record this capability is realized through, when
  -- one exists (worker tools). Pure research lanes have no tool row.
  tool_id uuid null references public.tool(id),
  input_schema jsonb null,
  output_schema jsonb null,
  -- Package/source trust for the capability implementation itself.
  trust_class text not null default 'UNVERIFIED'
    check (trust_class in ('TRUSTED', 'REVIEWED', 'UNVERIFIED', 'BLOCKED')),
  risk_class text not null default 'MEDIUM'
    check (risk_class in ('LOW', 'MEDIUM', 'HIGH')),
  -- What the world looks like after invocation.
  side_effect_class text not null default 'NONE'
    check (side_effect_class in ('NONE', 'OBSERVATIONAL', 'EXTERNAL_COMMUNICATION', 'STATE_CHANGE', 'DESTRUCTIVE')),
  reversible boolean not null default true,
  required_credentials jsonb not null default '[]'::jsonb,
  required_scopes jsonb not null default '[]'::jsonb,
  egress_policy text not null default 'PUBLIC_HTTP'
    check (egress_policy in ('NONE', 'PUBLIC_HTTP', 'REGISTERED_ENDPOINTS', 'USER_AUTHORIZED')),
  -- Which plans may use this capability at all.
  plan_eligibility jsonb not null default '["free","pro","max"]'::jsonb,
  -- Provider-neutral cost model: resource name -> expected units per invocation.
  cost_model jsonb not null default '{}'::jsonb,
  latency_class text null,
  reliability numeric null check (reliability is null or (reliability >= 0 and reliability <= 1)),
  freshness text null,
  verification_capability text null,
  availability text not null default 'AVAILABLE'
    check (availability in ('AVAILABLE', 'DEGRADED', 'UNAVAILABLE')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.capability enable row level security;

-- Capabilities are system catalog data: readable by any authenticated user,
-- writable only by the trusted plane (service role bypasses RLS).
drop policy if exists "capability catalog readable" on public.capability;
create policy "capability catalog readable"
  on public.capability
  for select
  to authenticated
  using (true);

create index if not exists capability_key_idx on public.capability (capability_key);

-- ---------------------------------------------------------------------------
-- 2. Plan resource envelopes (centralized configurable limits)
-- ---------------------------------------------------------------------------

create table if not exists public.plan_envelope (
  plan_id text not null check (plan_id in ('free', 'pro', 'max')),
  resource text not null,
  -- Limit per window. NULL means unlimited for this plan/resource.
  limit_value numeric null check (limit_value is null or limit_value >= 0),
  window_type text not null default 'MONTHLY'
    check (window_type in ('STATIC', 'DAILY', 'MONTHLY')),
  updated_at timestamptz not null default now(),
  unique (plan_id, resource)
);

alter table public.plan_envelope enable row level security;

drop policy if exists "plan envelope readable" on public.plan_envelope;
create policy "plan envelope readable"
  on public.plan_envelope
  for select
  to authenticated
  using (true);

-- Initial envelopes. Intentionally conservative starting numbers that keep
-- Free real-but-bounded, Pro serious, Max high-intensity; they are data, not
-- product semantics, and are tuned from unit-cost telemetry, not intuition.
insert into public.plan_envelope (plan_id, resource, limit_value, window_type) values
  ('free', 'model_turns',        60,   'DAILY'),
  ('free', 'research_rounds',    10,   'DAILY'),
  ('free', 'source_discovery',   40,   'DAILY'),
  ('free', 'source_extraction',  25,   'DAILY'),
  ('free', 'browser_actions',    0,    'DAILY'),
  ('free', 'worker_seconds',     0,    'DAILY'),
  ('free', 'worker_jobs',        5,    'MONTHLY'),
  ('pro',  'model_turns',        600,  'DAILY'),
  ('pro',  'research_rounds',    120,  'DAILY'),
  ('pro',  'source_discovery',   600,  'DAILY'),
  ('pro',  'source_extraction',  400,  'DAILY'),
  ('pro',  'browser_actions',    150,  'DAILY'),
  ('pro',  'worker_seconds',     3600, 'DAILY'),
  ('pro',  'worker_jobs',        120,  'MONTHLY'),
  ('max',  'model_turns',        2400, 'DAILY'),
  ('max',  'research_rounds',    600,  'DAILY'),
  ('max',  'source_discovery',   3000, 'DAILY'),
  ('max',  'source_extraction',  2000, 'DAILY'),
  ('max',  'browser_actions',    900,  'DAILY'),
  ('max',  'worker_seconds',     18000,'DAILY'),
  ('max',  'worker_jobs',        600,  'MONTHLY')
on conflict (plan_id, resource) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Subscription state (entitlement source of truth)
-- ---------------------------------------------------------------------------

create table if not exists public.subscription_state (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'free' check (plan_id in ('free', 'pro', 'max')),
  provider text null,
  provider_customer_ref text null,
  provider_subscription_ref text null,
  -- Raw provider status as last reported, plus our normalized status.
  provider_status text null,
  status text not null default 'ACTIVE'
    check (status in ('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELLED', 'EXPIRED', 'INCOMPLETE', 'UNKNOWN')),
  source text not null default 'DEFAULT'
    check (source in ('DEFAULT', 'FOUNDING_ACCESS', 'BILLING_WEBHOOK', 'ADMIN_GRANT')),
  effective_at timestamptz not null default now(),
  expires_at timestamptz null,
  last_event_at timestamptz null,
  reconciled_at timestamptz null,
  updated_at timestamptz not null default now(),
  -- An unknown provider state must never silently become an active paid plan.
  check (plan_id = 'free' or source in ('FOUNDING_ACCESS', 'BILLING_WEBHOOK', 'ADMIN_GRANT'))
);

alter table public.subscription_state enable row level security;

drop policy if exists "subscription state readable by owner" on public.subscription_state;
create policy "subscription state readable by owner"
  on public.subscription_state
  for select
  to authenticated
  using (owner_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Resource reservations + usage ledger
-- ---------------------------------------------------------------------------

create table if not exists public.budget_reservation (
  id uuid primary key default gen_random_uuid(),
  -- Groups the per-resource rows of one operation.
  group_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  pursuit_id uuid null references public.pursuit(id) on delete set null,
  operation_key text not null,
  capability_key text null,
  resource text not null,
  reserved numeric not null check (reserved >= 0),
  actual numeric null check (actual is null or actual >= 0),
  status text not null default 'RESERVED'
    check (status in ('RESERVED', 'CONSUMED', 'RELEASED', 'EXPIRED')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

alter table public.budget_reservation enable row level security;

drop policy if exists "reservations readable by owner" on public.budget_reservation;
create policy "reservations readable by owner"
  on public.budget_reservation
  for select
  to authenticated
  using (owner_user_id = auth.uid());

create index if not exists budget_reservation_active_idx
  on public.budget_reservation (owner_user_id, resource)
  where status = 'RESERVED';

create table if not exists public.resource_usage (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  pursuit_id uuid null references public.pursuit(id) on delete set null,
  reservation_id uuid null references public.budget_reservation(id),
  capability_key text null,
  resource text not null,
  amount numeric not null check (amount >= 0),
  occurred_at timestamptz not null default now()
);

alter table public.resource_usage enable row level security;

-- Owners read their own metering; inserts happen on the trusted plane only
-- (same posture as observation after the RLS hardening: user-path INSERT was
-- removed because unchecked writes silently lost evidence).
drop policy if exists "resource usage readable by owner" on public.resource_usage;
create policy "resource usage readable by owner"
  on public.resource_usage
  for select
  to authenticated
  using (owner_user_id = auth.uid());

create index if not exists resource_usage_window_idx
  on public.resource_usage (owner_user_id, resource, occurred_at);

-- ---------------------------------------------------------------------------
-- 5. Trusted-plane RPCs
-- ---------------------------------------------------------------------------

-- Effective plan for a user: the active subscription row, or free.
-- An expired paid row resolves to free; unknown status resolves to free.
create or replace function public.stryde_effective_plan(p_owner uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when s.plan_id is null then 'free'
    when s.status in ('ACTIVE', 'TRIALING', 'PAST_DUE')
      and (s.expires_at is null or s.expires_at > now()) then s.plan_id
    else 'free'
  end
  from (select null::text as plan_id) seed
  left join public.subscription_state s on s.owner_user_id = p_owner
$$;

revoke execute on function public.stryde_effective_plan(uuid) from anon, public;

-- Window start for a resource's envelope window.
create or replace function public.stryde_resource_window_start(p_window_type text)
returns timestamptz
language sql
stable
as $$
  select case p_window_type
    when 'DAILY' then date_trunc('day', now())
    when 'MONTHLY' then date_trunc('month', now())
    else '-infinity'::timestamptz
  end
$$;

-- Available units for one resource of one user under their effective plan.
-- NULL means unlimited. Consumed = usage ledger in window + live reservations.
create or replace function public.stryde_resource_available(p_owner uuid, p_resource text)
returns numeric
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_plan text;
  v_limit numeric;
  v_window_type text;
  v_window_start timestamptz;
  v_used numeric;
  v_reserved numeric;
begin
  v_plan := public.stryde_effective_plan(p_owner);
  select e.limit_value, e.window_type into v_limit, v_window_type
  from public.plan_envelope e
  where e.plan_id = v_plan and e.resource = p_resource;
  if not found then
    -- Unknown resource under this plan: fail closed.
    return 0;
  end if;
  if v_limit is null then
    return null;
  end if;
  v_window_start := public.stryde_resource_window_start(v_window_type);
  select coalesce(sum(u.amount), 0) into v_used
  from public.resource_usage u
  where u.owner_user_id = p_owner and u.resource = p_resource
    and u.occurred_at >= v_window_start;
  select coalesce(sum(r.reserved), 0) into v_reserved
  from public.budget_reservation r
  where r.owner_user_id = p_owner and r.resource = p_resource
    and r.status = 'RESERVED';
  return greatest(v_limit - v_used - v_reserved, 0);
end;
$$;

revoke execute on function public.stryde_resource_available(uuid, text) from anon, public;

-- Reserve expected units for one operation. p_resources is a JSON array of
-- {resource, expected} objects. Fails (exception) if any resource is
-- insufficient — the caller surfaces an honest degradation. Returns the
-- reservation group id.
create or replace function public.stryde_reserve_resources(
  p_owner uuid,
  p_pursuit uuid,
  p_operation text,
  p_resources jsonb,
  p_ttl_seconds integer default 900
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid := gen_random_uuid();
  v_entry jsonb;
  v_available numeric;
  v_expected numeric;
  v_expires timestamptz := now() + make_interval(secs => greatest(p_ttl_seconds, 1));
begin
  if p_owner is null or jsonb_typeof(p_resources) <> 'array' or jsonb_array_length(p_resources) = 0 then
    raise exception 'reservation requires an owner and a non-empty resource array';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds <= 0 or p_ttl_seconds > 86400 then
    raise exception 'reservation ttl must be between 1 second and 24 hours';
  end if;

  for v_entry in select * from jsonb_array_elements(p_resources) loop
    -- Serialize concurrent reservations for the same owner+resource so two
    -- simultaneous operations cannot both pass the same remaining balance
    -- (the budget-race boundary).
    perform pg_advisory_xact_lock(
      hashtextextended(p_owner::text || ':' || (v_entry->>'resource'), 0)
    );
    v_expected := (v_entry->>'expected')::numeric;
    if v_expected is null or v_expected < 0 then
      raise exception 'reservation expected amount must be a non-negative number';
    end if;
    v_available := public.stryde_resource_available(p_owner, v_entry->>'resource');
    if v_available is not null and v_expected > v_available then
      raise exception 'RESOURCE_EXHAUSTED: % (requested %, available %)',
        v_entry->>'resource', v_expected, v_available;
    end if;
    insert into public.budget_reservation
      (group_id, owner_user_id, pursuit_id, operation_key, resource, reserved, expires_at)
    values
      (v_group, p_owner, p_pursuit, p_operation, v_entry->>'resource', v_expected, v_expires);
  end loop;
  return v_group;
end;
$$;

revoke execute on function public.stryde_reserve_resources(uuid, uuid, text, jsonb, integer) from anon, public;

-- Reconcile one reservation with actual usage: records the real amount in the
-- usage ledger and closes the reservation. Reconciling a non-reserved row is
-- idempotent- refused so double-accounting cannot happen silently.
create or replace function public.stryde_reconcile_reservation(
  p_group uuid,
  p_resource text,
  p_actual numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if p_actual is null or p_actual < 0 then
    raise exception 'actual usage must be a non-negative number';
  end if;
  select * into r from public.budget_reservation
  where group_id = p_group and resource = p_resource
  order by created_at desc limit 1;
  if not found then
    raise exception 'reservation %/% not found', p_group, p_resource;
  end if;
  if r.status <> 'RESERVED' then
    return; -- already reconciled/released: nothing to do, not an error
  end if;
  update public.budget_reservation
  set status = 'CONSUMED', actual = p_actual, resolved_at = now()
  where id = r.id;
  insert into public.resource_usage
    (owner_user_id, pursuit_id, reservation_id, capability_key, resource, amount)
  values
    (r.owner_user_id, r.pursuit_id, r.id, r.capability_key, r.resource, p_actual);
end;
$$;

revoke execute on function public.stryde_reconcile_reservation(uuid, text, numeric) from anon, public;

-- Release a group's live reservations (operation declined/failed before use).
create or replace function public.stryde_release_reservations(p_group uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.budget_reservation
  set status = 'RELEASED', resolved_at = now()
  where group_id = p_group and status = 'RESERVED'
$$;

revoke execute on function public.stryde_release_reservations(uuid) from anon, public;

-- Expire stale reservations (safety net for crashed operations). Called by
-- the continuity cron. Returns the number expired.
create or replace function public.stryde_expire_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.budget_reservation
  set status = 'EXPIRED', resolved_at = now()
  where status = 'RESERVED' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.stryde_expire_reservations() from anon, public;

-- Record usage without a reservation (operations whose cost is measured only
-- after the fact, e.g. model turns). Enforced against the envelope: recording
-- beyond the limit fails rather than silently overspending.
create or replace function public.stryde_record_resource_usage(
  p_owner uuid,
  p_pursuit uuid,
  p_resource text,
  p_amount numeric,
  p_capability_key text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available numeric;
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'usage amount must be a non-negative number';
  end if;
  v_available := public.stryde_resource_available(p_owner, p_resource);
  if v_available is not null and p_amount > v_available then
    raise exception 'RESOURCE_EXHAUSTED: % (usage %, available %)', p_resource, p_amount, v_available;
  end if;
  insert into public.resource_usage
    (owner_user_id, pursuit_id, capability_key, resource, amount)
  values
    (p_owner, p_pursuit, p_capability_key, p_resource, p_amount);
end;
$$;

revoke execute on function public.stryde_record_resource_usage(uuid, uuid, text, numeric, text) from anon, public;

-- The resource-control plane is trusted-plane only: user clients read their
-- own entitlements/usage through RLS, never through these RPCs.
grant execute on function public.stryde_effective_plan(uuid) to service_role;
grant execute on function public.stryde_resource_available(uuid, text) to service_role;
grant execute on function public.stryde_reserve_resources(uuid, uuid, text, jsonb, integer) to service_role;
grant execute on function public.stryde_reconcile_reservation(uuid, text, numeric) to service_role;
grant execute on function public.stryde_release_reservations(uuid) to service_role;
grant execute on function public.stryde_expire_reservations() to service_role;
grant execute on function public.stryde_record_resource_usage(uuid, uuid, text, numeric, text) to service_role;
