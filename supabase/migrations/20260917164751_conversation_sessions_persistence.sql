create table if not exists public.conversation_session (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  pursuit_id uuid not null references public.pursuit(id) on delete cascade,
  title text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversation_session_owner_pursuit_updated_idx
  on public.conversation_session(owner_user_id, pursuit_id, updated_at desc);

create unique index if not exists conversation_session_one_active_idx
  on public.conversation_session(pursuit_id)
  where status = 'ACTIVE';

create table if not exists public.conversation_message (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.conversation_session(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('USER','STRYDE')),
  content text not null check (length(btrim(content)) > 0),
  sequence_no bigint not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, sequence_no)
);

create index if not exists conversation_message_session_sequence_idx
  on public.conversation_message(session_id, sequence_no);

alter table public.conversation_session enable row level security;
alter table public.conversation_message enable row level security;

create policy "conversation sessions owned select"
  on public.conversation_session
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy "conversation sessions owned insert"
  on public.conversation_session
  for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_user_id
    and exists (
      select 1 from public.pursuit p
      where p.id = pursuit_id
        and p.owner_user_id = (select auth.uid())
    )
  );

create policy "conversation sessions owned update"
  on public.conversation_session
  for update
  to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

create policy "conversation messages owned select"
  on public.conversation_message
  for select
  to authenticated
  using (
    (select auth.uid()) = owner_user_id
    and exists (
      select 1 from public.conversation_session s
      where s.id = session_id
        and s.owner_user_id = (select auth.uid())
    )
  );

create policy "conversation messages owned insert"
  on public.conversation_message
  for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_user_id
    and exists (
      select 1 from public.conversation_session s
      where s.id = session_id
        and s.owner_user_id = (select auth.uid())
    )
  );
