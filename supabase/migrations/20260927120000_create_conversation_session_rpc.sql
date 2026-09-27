-- Restore the RPC used by the authenticated conversation-session endpoint.
create or replace function public.stryde_create_conversation_session(p_pursuit_id uuid)
returns public.conversation_session
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.conversation_session;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.pursuit
    where id = p_pursuit_id
      and owner_user_id = v_actor
  ) then
    raise exception 'Pursuit not found';
  end if;

  -- Serialize creation for this pursuit before replacing its active session.
  perform pg_advisory_xact_lock(hashtextextended(p_pursuit_id::text, 0));

  update public.conversation_session
  set status = 'ARCHIVED', updated_at = now()
  where pursuit_id = p_pursuit_id
    and owner_user_id = v_actor
    and status = 'ACTIVE';

  insert into public.conversation_session(owner_user_id, pursuit_id, status)
  values (v_actor, p_pursuit_id, 'ACTIVE')
  returning * into v_session;

  return v_session;
end;
$$;

revoke all privileges on function public.stryde_create_conversation_session(uuid) from public, anon;
grant execute on function public.stryde_create_conversation_session(uuid) to authenticated;
