-- Agent selection policy (Issue #6 decision 2, option B):
-- a user may set a preferred execution agent globally, override it per
-- pursuit, or leave the choice to Stryde. Agents are replaceable capabilities;
-- this preference is a HINT, never authority: the autonomy policy still
-- governs what may be delegated at all, and per-action approval still applies.
--
-- One row per scope: pursuit_id NULL is the user's global preference, a
-- non-null pursuit_id is that pursuit's override. A NULL preferred_worker_type
-- on a row means "clear this scope" — the row is simply deleted on update, so
-- absence and cleared are the same thing: Stryde chooses.

create table if not exists public.user_agent_preference (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  pursuit_id uuid references public.pursuit(id) on delete cascade,
  preferred_worker_type text,
  updated_at timestamptz not null default now(),
  constraint user_agent_preference_worker_type_check
    check (preferred_worker_type is null or preferred_worker_type in ('HERMES','OPENCODE','BROWSER'))
);

-- One row per scope: a global row per user, and one row per (user, pursuit).
create unique index if not exists user_agent_preference_global_idx
  on public.user_agent_preference (owner_user_id)
  where pursuit_id is null;
create unique index if not exists user_agent_preference_pursuit_idx
  on public.user_agent_preference (owner_user_id, pursuit_id)
  where pursuit_id is not null;

alter table public.user_agent_preference enable row level security;

drop policy if exists "agent preference is owned" on public.user_agent_preference;
create policy "agent preference is owned"
  on public.user_agent_preference
  for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
