create table if not exists public.pursuit_source_citation (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  pursuit_id uuid not null references public.pursuit(id) on delete cascade,
  source_id uuid not null references public.pursuit_source(id) on delete cascade,
  adaptation_id uuid references public.pursuit_source_adaptation(id) on delete cascade,
  source_content_sha256 text not null,
  locator jsonb not null,
  excerpt text not null,
  basis text not null check (basis in ('EXPLICIT_SOURCE','INFERRED')),
  created_at timestamptz not null default now()
);

create index if not exists pursuit_source_citation_owner_pursuit_idx
  on public.pursuit_source_citation(owner_user_id, pursuit_id, created_at);

create index if not exists pursuit_source_citation_source_idx
  on public.pursuit_source_citation(source_id);

alter table public.pursuit_source_citation enable row level security;

create policy "pursuit source citations owned select"
  on public.pursuit_source_citation
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy "pursuit source citations owned insert"
  on public.pursuit_source_citation
  for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_user_id
    and exists (
      select 1
      from public.pursuit p
      where p.id = pursuit_id
        and p.owner_user_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.pursuit_source s
      where s.id = source_id
        and s.pursuit_id = pursuit_id
        and s.owner_user_id = (select auth.uid())
    )
  );;
