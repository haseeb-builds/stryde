-- Canonical authenticated mutation functions.
-- These functions derive ownership from auth.uid(), perform the domain write,
-- and emit the initiating semantic Event in the same transaction.

create or replace function public.stryde_create_thread(p_content text)
returns public.thread
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_thread public.thread;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_content is null or btrim(p_content) = '' or length(p_content) > 10000 then
    raise exception 'content must be a non-empty string of 10000 characters or fewer';
  end if;

  insert into public.thread (owner_user_id, content)
  values (auth.uid(), btrim(p_content))
  returning * into v_thread;

  insert into public.event (owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (auth.uid(), 'THREAD', v_thread.id, 'THREAD_CREATED', 'USER', auth.uid(),
          jsonb_build_object('thread_id', v_thread.id));

  return v_thread;
end;
$$;

create or replace function public.stryde_create_pursuit(
  p_title text default null,
  p_origin_thread_id uuid default null
)
returns public.pursuit
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_pursuit public.pursuit;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_title is not null and length(btrim(p_title)) > 500 then
    raise exception 'title is too long';
  end if;

  insert into public.pursuit (owner_user_id, title, origin_thread_id)
  values (auth.uid(), nullif(btrim(p_title), ''), p_origin_thread_id)
  returning * into v_pursuit;

  insert into public.event (owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (auth.uid(), 'PURSUIT', v_pursuit.id, 'PURSUIT_CREATED', 'USER', auth.uid(),
          jsonb_build_object('pursuit_id', v_pursuit.id));

  return v_pursuit;
end;
$$;

create or replace function public.stryde_create_claim(
  p_scope text,
  p_kind text,
  p_content text,
  p_pursuit_id uuid default null,
  p_structured_detail jsonb default null,
  p_structured_detail_schema_version smallint default null,
  p_supersedes_claim_id uuid default null
)
returns public.claim
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_claim public.claim;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_content is null or btrim(p_content) = '' then
    raise exception 'content must be non-empty';
  end if;
  if p_scope not in ('USER','PURSUIT') then
    raise exception 'invalid Claim scope';
  end if;
  if p_scope = 'PURSUIT' and p_pursuit_id is null then
    raise exception 'PURSUIT-scoped Claim requires pursuit_id';
  end if;
  if p_scope = 'USER' and p_pursuit_id is not null then
    raise exception 'USER-scoped Claim cannot have pursuit_id';
  end if;

  insert into public.claim (
    owner_user_id, scope, pursuit_id, kind, content,
    structured_detail, structured_detail_schema_version,
    supersedes_claim_id
  )
  values (
    auth.uid(), p_scope, p_pursuit_id, p_kind, btrim(p_content),
    p_structured_detail, p_structured_detail_schema_version,
    p_supersedes_claim_id
  )
  returning * into v_claim;

  insert into public.event (owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (auth.uid(), 'CLAIM', v_claim.id, 'CLAIM_CREATED', 'USER', auth.uid(),
          jsonb_build_object('claim_id', v_claim.id, 'scope', v_claim.scope, 'kind', v_claim.kind));

  if p_supersedes_claim_id is not null then
    update public.claim
    set superseded_by_claim_id = v_claim.id,
        updated_at = now()
    where id = p_supersedes_claim_id
      and owner_user_id = auth.uid();
  end if;

  return v_claim;
end;
$$;

grant execute on function public.stryde_create_thread(text) to authenticated;
grant execute on function public.stryde_create_pursuit(text, uuid) to authenticated;
grant execute on function public.stryde_create_claim(text, text, text, uuid, jsonb, smallint, uuid) to authenticated;
