-- Stryde adaptive pursuit: source provenance, source adaptation, objective binding, and human-action feedback.

create table if not exists public.pursuit_source (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  pursuit_id uuid not null references public.pursuit(id) on delete cascade,
  source_kind text not null check (source_kind in ('URL','PASTED')),
  uri text null,
  title text null,
  content_type text null,
  fetch_status text not null default 'NOT_FETCHED'
    check (fetch_status in ('NOT_FETCHED','FETCHED','PARTIAL','FAILED','UNSUPPORTED')),
  content_text text null,
  content_sha256 text null,
  source_metadata jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, id)
);

create unique index if not exists pursuit_source_owner_uri_unique_idx
  on public.pursuit_source(owner_user_id, pursuit_id, uri)
  where uri is not null;

create index if not exists pursuit_source_pursuit_created_idx
  on public.pursuit_source(owner_user_id, pursuit_id, created_at desc);

create table if not exists public.pursuit_source_adaptation (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  pursuit_id uuid not null references public.pursuit(id) on delete cascade,
  source_id uuid not null references public.pursuit_source(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  status text not null default 'ADVISED' check (status in ('ADVISED','SUPERSEDED')),
  summary text not null,
  source_claims jsonb not null default '[]'::jsonb,
  methods jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  prerequisites jsonb not null default '[]'::jsonb,
  expected_outcomes jsonb not null default '[]'::jsonb,
  unknowns jsonb not null default '[]'::jsonb,
  fit jsonb not null default '{}'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  adapted_strategy jsonb not null default '[]'::jsonb,
  goal_candidates jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, version),
  foreign key (owner_user_id, source_id) references public.pursuit_source(owner_user_id, id),
  foreign key (owner_user_id, pursuit_id) references public.pursuit(owner_user_id, id),
  unique (owner_user_id, id)
);

create index if not exists pursuit_source_adaptation_source_version_idx
  on public.pursuit_source_adaptation(owner_user_id, source_id, version desc);

create index if not exists pursuit_source_adaptation_pursuit_created_idx
  on public.pursuit_source_adaptation(owner_user_id, pursuit_id, created_at desc);

alter table public.pursuit_source enable row level security;
alter table public.pursuit_source_adaptation enable row level security;

drop policy if exists "pursuit sources owned select" on public.pursuit_source;
create policy "pursuit sources owned select"
  on public.pursuit_source
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

drop policy if exists "pursuit sources owned insert" on public.pursuit_source;
create policy "pursuit sources owned insert"
  on public.pursuit_source
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
  );

drop policy if exists "source adaptations owned select" on public.pursuit_source_adaptation;
create policy "source adaptations owned select"
  on public.pursuit_source_adaptation
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

drop policy if exists "source adaptations owned insert" on public.pursuit_source_adaptation;
create policy "source adaptations owned insert"
  on public.pursuit_source_adaptation
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
        and s.pursuit_id = pursuit_source_adaptation.pursuit_id
        and s.owner_user_id = (select auth.uid())
    )
  );

create trigger pursuit_source_touch_updated_at
before update on public.pursuit_source
for each row execute function public.stryde_touch_updated_at();

create schema if not exists stryde_internal;

create or replace function stryde_internal.set_objective_claim(
  p_pursuit_id uuid,
  p_claim_id uuid
)
returns public.pursuit
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_pursuit public.pursuit;
  v_claim public.claim;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;

  select *
  into v_pursuit
  from public.pursuit
  where id = p_pursuit_id
    and owner_user_id = v_owner
  for update;

  if not found then raise exception 'Pursuit not found'; end if;
  if v_pursuit.status in ('COMPLETED','ABANDONED') then raise exception 'Cannot change objective on terminal Pursuit'; end if;

  select *
  into v_claim
  from public.claim
  where id = p_claim_id
    and owner_user_id = v_owner
    and scope = 'PURSUIT'
    and pursuit_id = p_pursuit_id
    and kind = 'OBJECTIVE'
  for share;

  if not found then raise exception 'Objective Claim not found for this Pursuit'; end if;

  update public.pursuit
  set objective_claim_id = p_claim_id,
      updated_at = now()
  where id = p_pursuit_id
    and owner_user_id = v_owner;

  insert into public.event (
    owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    v_owner, 'PURSUIT', p_pursuit_id, 'OBJECTIVE_CLAIM_SET', 'USER', v_owner,
    jsonb_build_object('claim_id', p_claim_id)
  );

  select * into v_pursuit
  from public.pursuit
  where id = p_pursuit_id
    and owner_user_id = v_owner;

  return v_pursuit;
end;
$$;

create or replace function public.stryde_set_objective_claim(
  p_pursuit_id uuid,
  p_claim_id uuid
)
returns public.pursuit
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return stryde_internal.set_objective_claim(p_pursuit_id, p_claim_id);
end;
$$;

revoke all privileges on function stryde_internal.set_objective_claim(uuid,uuid) from public, anon, authenticated;
grant execute on function stryde_internal.set_objective_claim(uuid,uuid) to authenticated;
revoke all privileges on function public.stryde_set_objective_claim(uuid,uuid) from public, anon;
grant execute on function public.stryde_set_objective_claim(uuid,uuid) to authenticated;

create or replace function stryde_internal.complete_human_action(
  p_action_id uuid,
  p_terminal_status text,
  p_result jsonb default '{}'::jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_action public.action;
  v_observation public.observation;
  v_event text;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_terminal_status not in ('COMPLETED','FAILED','CANCELLED') then
    raise exception 'Invalid human action terminal status';
  end if;
  if p_note is not null and length(p_note) > 4000 then
    raise exception 'Action note is too long';
  end if;

  select *
  into v_action
  from public.action
  where id = p_action_id
    and owner_user_id = v_owner
  for update;

  if not found then raise exception 'Action not found'; end if;
  if v_action.execution_mode <> 'HUMAN' then raise exception 'Only HUMAN actions can use user result recording'; end if;
  if v_action.status <> 'IN_PROGRESS' then raise exception 'Human Action is not in progress'; end if;

  insert into public.observation (
    owner_user_id,
    observation_kind,
    content,
    raw_payload,
    observed_at,
    source_type,
    source_reference,
    source_metadata
  ) values (
    v_owner,
    'HUMAN_ACTION_RESULT',
    jsonb_build_object(
      'action_id', v_action.id,
      'terminal_status', p_terminal_status,
      'result', coalesce(p_result, '{}'::jsonb),
      'note', nullif(btrim(p_note), '')
    ),
    coalesce(p_result, '{}'::jsonb),
    now(),
    'USER_REPORTED',
    v_action.id::text,
    jsonb_build_object('actor_type','USER')
  )
  returning * into v_observation;

  v_event := case p_terminal_status
    when 'COMPLETED' then 'ACTION_COMPLETED'
    when 'FAILED' then 'ACTION_FAILED'
    else 'ACTION_CANCELLED'
  end;

  update public.action
  set status = p_terminal_status,
      terminal_at = now(),
      updated_at = now()
  where id = v_action.id
    and owner_user_id = v_owner;

  insert into public.event (
    owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    v_owner, 'ACTION', v_action.id, v_event, 'USER', v_owner,
    jsonb_build_object(
      'observation_id', v_observation.id,
      'terminal_status', p_terminal_status
    )
  );

  select * into v_action from public.action where id = v_action.id and owner_user_id = v_owner;

  return jsonb_build_object(
    'action', to_jsonb(v_action),
    'observation', to_jsonb(v_observation)
  );
end;
$$;

create or replace function public.stryde_complete_human_action(
  p_action_id uuid,
  p_terminal_status text,
  p_result jsonb default '{}'::jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return stryde_internal.complete_human_action(p_action_id, p_terminal_status, p_result, p_note);
end;
$$;

revoke all privileges on function stryde_internal.complete_human_action(uuid,text,jsonb,text) from public, anon, authenticated;
grant execute on function stryde_internal.complete_human_action(uuid,text,jsonb,text) to authenticated;
revoke all privileges on function public.stryde_complete_human_action(uuid,text,jsonb,text) from public, anon;
grant execute on function public.stryde_complete_human_action(uuid,text,jsonb,text) to authenticated;
