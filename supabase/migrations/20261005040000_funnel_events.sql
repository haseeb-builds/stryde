-- First-party funnel instrumentation (Issue #6 decision on market
-- instrumentation): landing → signup → first pursuit → first meaningful turn
-- → action → worker execution → verified outcome → return → paid CTA.
--
-- Rules: events are counters, never content — no prompt text, no message
-- bodies, no personal attributes in metadata. Everything is queryable SQL.
-- Recording is fail-open on the product side: a missing table or a failed
-- insert must never break a user-visible flow.

create table if not exists public.funnel_event (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'SIGNUP',
    'PURSUIT_CREATED',
    'FIRST_TURN',
    'ACTION_STARTED',
    'WORKER_EXECUTION',
    'VERIFIED_OUTCOME',
    'RETURN_SESSION',
    'PAID_CTA_CLICK'
  )),
  pursuit_id uuid references public.pursuit(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists funnel_event_type_time_idx
  on public.funnel_event (event_type, created_at);
create index if not exists funnel_event_owner_idx
  on public.funnel_event (owner_user_id, created_at);

alter table public.funnel_event enable row level security;

-- Owners may record their own events (client-originated SIGNUP / PAID_CTA_CLICK)
-- and read their own funnel. Everything else is written by trusted server paths.
drop policy if exists "funnel events are ownable" on public.funnel_event;
create policy "funnel events are ownable"
  on public.funnel_event
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "funnel events are readable by owner" on public.funnel_event;
create policy "funnel events are readable by owner"
  on public.funnel_event
  for select
  to authenticated
  using (owner_user_id = auth.uid());
