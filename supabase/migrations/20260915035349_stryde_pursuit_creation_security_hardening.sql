create or replace function public.stryde_create_pursuit(
  p_title text default null,
  p_origin_thread_id uuid default null
)
returns public.pursuit
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pursuit public.pursuit;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if p_title is not null and length(btrim(p_title)) > 500 then
    raise exception 'title is too long';
  end if;

  insert into public.pursuit (owner_user_id, title, origin_thread_id)
  values ((select auth.uid()), nullif(btrim(p_title), ''), p_origin_thread_id)
  returning * into v_pursuit;

  insert into public.event (
    owner_user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
  )
  values (
    (select auth.uid()),
    'PURSUIT',
    v_pursuit.id,
    'PURSUIT_CREATED',
    'USER',
    (select auth.uid()),
    jsonb_build_object('pursuit_id', v_pursuit.id)
  );

  return v_pursuit;
end;
$function$;

revoke execute on function public.stryde_create_pursuit(text, uuid) from public;
revoke execute on function public.stryde_create_pursuit(text, uuid) from anon;
grant execute on function public.stryde_create_pursuit(text, uuid) to authenticated;
