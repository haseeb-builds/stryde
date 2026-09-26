-- Slice 1: server-owned conversation writes and turn idempotency.
alter table public.conversation_message
  add column if not exists turn_key uuid;

create unique index if not exists conversation_message_user_turn_key_idx
  on public.conversation_message(session_id, turn_key)
  where role = 'USER' and turn_key is not null;

create unique index if not exists conversation_message_assistant_turn_key_idx
  on public.conversation_message(session_id, turn_key)
  where role = 'STRYDE' and turn_key is not null;

drop policy if exists "conversation messages owned insert" on public.conversation_message;
drop policy if exists "conversation sessions owned insert" on public.conversation_session;
drop policy if exists "conversation sessions owned update" on public.conversation_session;

create or replace function public.stryde_create_conversation_session(p_pursuit_id uuid)
returns public.conversation_session
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_actor uuid := auth.uid(); v_session public.conversation_session;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.pursuit where id = p_pursuit_id and owner_user_id = v_actor) then raise exception 'Pursuit not found'; end if;
  update public.conversation_session set status = 'ARCHIVED', updated_at = now()
  where pursuit_id = p_pursuit_id and owner_user_id = v_actor and status = 'ACTIVE';
  insert into public.conversation_session(owner_user_id, pursuit_id, status)
  values (v_actor, p_pursuit_id, 'ACTIVE') returning * into v_session;
  return v_session;
end;
$$;

create or replace function public.stryde_archive_conversation_session(p_session_id uuid)
returns public.conversation_session
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_actor uuid := auth.uid(); v_session public.conversation_session;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  update public.conversation_session set status = 'ARCHIVED', updated_at = now()
  where id = p_session_id and owner_user_id = v_actor returning * into v_session;
  if not found then raise exception 'Conversation not found'; end if;
  return v_session;
end;
$$;
drop policy if exists "conversation sessions owned update" on public.conversation_session;

create or replace function public.stryde_record_conversation_user_input(
  p_session_id uuid,
  p_turn_key uuid,
  p_content text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.conversation_session;
  v_user public.conversation_message;
  v_assistant public.conversation_message;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_session_id is null or p_turn_key is null then raise exception 'session_id and turn_key are required'; end if;
  if p_content is null or length(btrim(p_content)) = 0 or length(p_content) > 12000 then raise exception 'Invalid message'; end if;

  select * into v_session from public.conversation_session
  where id = p_session_id and owner_user_id = v_actor for update;
  if not found then raise exception 'Conversation not found'; end if;
  if v_session.status <> 'ACTIVE' then raise exception 'Conversation is archived'; end if;

  select * into v_user from public.conversation_message
  where session_id = p_session_id and role = 'USER' and turn_key = p_turn_key;
  if found then
    select * into v_assistant from public.conversation_message
    where session_id = p_session_id and role = 'STRYDE' and turn_key = p_turn_key;
    return jsonb_build_object('user', to_jsonb(v_user), 'assistant', case when v_assistant.id is null then null else to_jsonb(v_assistant) end);
  end if;

  insert into public.conversation_message(session_id, owner_user_id, role, content, sequence_no, turn_key)
  values (p_session_id, v_actor, 'USER', btrim(p_content), coalesce((select max(sequence_no) from public.conversation_message where session_id = p_session_id), 0) + 1, p_turn_key)
  returning * into v_user;
  update public.conversation_session set updated_at = now() where id = p_session_id;
  return jsonb_build_object('user', to_jsonb(v_user), 'assistant', null);
end;
$$;

create or replace function public.stryde_commit_conversation_turn(
  p_session_id uuid,
  p_turn_key uuid,
  p_content text,
  p_metadata jsonb,
  p_working_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.conversation_session;
  v_user public.conversation_message;
  v_assistant public.conversation_message;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_session_id is null or p_turn_key is null then raise exception 'session_id and turn_key are required'; end if;
  if p_content is null or length(btrim(p_content)) = 0 then raise exception 'Assistant content is required'; end if;
  select * into v_session from public.conversation_session
  where id = p_session_id and owner_user_id = v_actor for update;
  if not found then raise exception 'Conversation not found'; end if;
  select * into v_user from public.conversation_message
  where session_id = p_session_id and owner_user_id = v_actor and role = 'USER' and turn_key = p_turn_key;
  if not found then raise exception 'User turn not found'; end if;
  select * into v_assistant from public.conversation_message
  where session_id = p_session_id and owner_user_id = v_actor and role = 'STRYDE' and turn_key = p_turn_key;
  if found then return jsonb_build_object('message', to_jsonb(v_assistant), 'working_state', v_session.working_state, 'committed', false); end if;

  insert into public.conversation_message(session_id, owner_user_id, role, content, sequence_no, metadata, turn_key)
  values (p_session_id, v_actor, 'STRYDE', btrim(p_content), coalesce((select max(sequence_no) from public.conversation_message where session_id = p_session_id), 0) + 1, p_metadata, p_turn_key)
  returning * into v_assistant;
  update public.conversation_session set working_state = p_working_state, updated_at = now() where id = p_session_id;
  return jsonb_build_object('message', to_jsonb(v_assistant), 'working_state', p_working_state, 'committed', true);
end;
$$;

revoke all privileges on function public.stryde_record_conversation_user_input(uuid, uuid, text) from public, anon;
revoke all privileges on function public.stryde_commit_conversation_turn(uuid, uuid, text, jsonb, jsonb) from public, anon;
revoke all privileges on function public.stryde_create_conversation_session(uuid) from public, anon;
revoke all privileges on function public.stryde_archive_conversation_session(uuid) from public, anon;
grant execute on function public.stryde_record_conversation_user_input(uuid, uuid, text) to authenticated;
grant execute on function public.stryde_commit_conversation_turn(uuid, uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.stryde_create_conversation_session(uuid) to authenticated;
grant execute on function public.stryde_archive_conversation_session(uuid) to authenticated;
