-- User-configurable autonomy policy (docs/DECISIONS.md D9): bounded authority
-- is LOCKED as a direction; the exact policy grammar is deliberately minimal.
-- A user with no policy row keeps the default behavior (every delegation still
-- requires explicit per-action approval downstream — that semantic never
-- changes). A row exists only when the user has configured governance, and it
-- can then TIGHTEN what Stryde may propose and execute on their behalf.
create table public.user_autonomy_policy (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  allow_worker_delegation boolean not null default false,
  allowed_worker_types text[] not null default '{}',
  auto_execute_research boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(allowed_worker_types) <= 2)
);

alter table public.user_autonomy_policy enable row level security;

create policy user_autonomy_policy_owner_select on public.user_autonomy_policy
  for select to authenticated
  using (owner_user_id = (select auth.uid()));

create policy user_autonomy_policy_owner_insert on public.user_autonomy_policy
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

create policy user_autonomy_policy_owner_update on public.user_autonomy_policy
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy user_autonomy_policy_owner_delete on public.user_autonomy_policy
  for delete to authenticated
  using (owner_user_id = (select auth.uid()));
