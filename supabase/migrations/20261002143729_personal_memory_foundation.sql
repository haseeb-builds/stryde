create table public.memory_item (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  pursuit_id uuid null references public.pursuit(id) on delete cascade,
  memory_scope text not null check (memory_scope in ('USER','PURSUIT')),
  memory_type text not null check (memory_type in ('FACT','CONSTRAINT','PREFERENCE','DECISION','COMMITMENT','EXPERIENCE','PATTERN','GOAL')),
  status text not null default 'CANDIDATE' check (status in ('CANDIDATE','ACTIVE','STALE','CONTRADICTED','SUPERSEDED')),
  content text not null check (btrim(content) <> '' and length(content) <= 4000),
  structured_detail jsonb null,
  provenance_type text not null check (provenance_type in ('USER_REPORTED','OBSERVED','VERIFIED','SOURCE','MODEL_INFERENCE','SYSTEM_DERIVED')),
  provenance jsonb null,
  confidence numeric(4,3) not null default 0.500 check (confidence >= 0 and confidence <= 1),
  importance numeric(4,3) not null default 0.500 check (importance >= 0 and importance <= 1),
  first_seen_at timestamptz not null default now(),
  last_confirmed_at timestamptz null,
  stale_at timestamptz null,
  source_observation_id uuid null references public.observation(id) on delete set null,
  source_claim_id uuid null references public.claim(id) on delete set null,
  source_id uuid null references public.pursuit_source(id) on delete set null,
  supersedes_memory_id uuid null references public.memory_item(id) on delete set null,
  superseded_by_memory_id uuid null references public.memory_item(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((memory_scope = 'USER' and pursuit_id is null) or (memory_scope = 'PURSUIT' and pursuit_id is not null))
);

create index memory_item_owner_status_idx on public.memory_item(owner_user_id, status, updated_at desc);
create index memory_item_owner_type_idx on public.memory_item(owner_user_id, memory_type, updated_at desc);
create index memory_item_pursuit_idx on public.memory_item(owner_user_id, pursuit_id, status, updated_at desc);
create index memory_item_source_observation_idx on public.memory_item(source_observation_id);
create index memory_item_source_claim_idx on public.memory_item(source_claim_id);

alter table public.memory_item enable row level security;

create policy memory_item_owner_select on public.memory_item
  for select to authenticated
  using (owner_user_id = (select auth.uid()));

create policy memory_item_owner_insert on public.memory_item
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

create policy memory_item_owner_update on public.memory_item
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy memory_item_owner_delete on public.memory_item
  for delete to authenticated
  using (owner_user_id = (select auth.uid()));
