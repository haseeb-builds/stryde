-- Stryde Skills (Issue #6 decision 3, option C): procedural memory, distinct
-- from factual/personal memory. A skill records a repeatable procedure Stryde
-- proposed after solving a non-trivial workflow. Skills carry provenance,
-- versioning, security scanning, usage tracking, staleness, and rollback —
-- and they can never grant authority: execution still flows through the
-- normal autonomy policy and approval gates.

create table if not exists public.skill (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  pursuit_id uuid references public.pursuit(id) on delete cascade,
  title text not null check (length(title) between 1 and 300),
  description text check (description is null or length(description) <= 2000),
  -- The procedure itself: an ordered list of steps with optional notes.
  procedure jsonb not null,
  -- PROPOSED: staged, awaiting policy; ACTIVE: usable procedural memory;
  -- REJECTED: refused at the scan/approval gate; STALE: flagged outdated;
  -- ARCHIVED: retired, never retrieved.
  status text not null default 'PROPOSED'
    check (status in ('PROPOSED','ACTIVE','REJECTED','STALE','ARCHIVED')),
  version integer not null default 1,
  -- Where this skill came from: pursuit/session/action references and whether
  -- it was proposed by Stryde or written by the user.
  provenance jsonb not null default '{}'::jsonb,
  -- The security scan result at the time of the latest proposal/revision.
  security_scan jsonb not null default '{}'::jsonb,
  usage_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists skill_owner_status_idx
  on public.skill (owner_user_id, status, updated_at desc);
create index if not exists skill_pursuit_idx
  on public.skill (pursuit_id) where pursuit_id is not null;

-- Immutable version history: rollback creates a NEW version row copying an
-- old procedure; nothing is ever edited in place.
create table if not exists public.skill_version (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skill(id) on delete cascade,
  version integer not null,
  procedure jsonb not null,
  security_scan jsonb not null default '{}'::jsonb,
  created_from text not null default 'REVISION',
  created_at timestamptz not null default now(),
  unique (skill_id, version)
);

alter table public.skill enable row level security;
alter table public.skill_version enable row level security;

drop policy if exists "skills are owned" on public.skill;
create policy "skills are owned"
  on public.skill
  for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "skill versions are owned" on public.skill_version;
create policy "skill versions are owned"
  on public.skill_version
  for all
  to authenticated
  using (
    exists (
      select 1 from public.skill s
      where s.id = skill_id and s.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.skill s
      where s.id = skill_id and s.owner_user_id = auth.uid()
    )
  );
