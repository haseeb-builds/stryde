-- Security hardening for the capability/resource platform.
--
-- Supabase's function default privileges grant EXECUTE to authenticated in this
-- project. The original migrations revoked anon and PUBLIC but did not revoke
-- the direct authenticated grant, contrary to the trusted-plane contract.
-- Server routes and maintenance jobs use the service-role client for these RPCs.
begin;

revoke execute on function public.stryde_effective_plan(uuid) from anon, authenticated, public;
grant execute on function public.stryde_effective_plan(uuid) to service_role;

revoke execute on function public.stryde_resource_available(uuid, text) from anon, authenticated, public;
grant execute on function public.stryde_resource_available(uuid, text) to service_role;

revoke execute on function public.stryde_reserve_resources(uuid, uuid, text, jsonb, integer) from anon, authenticated, public;
grant execute on function public.stryde_reserve_resources(uuid, uuid, text, jsonb, integer) to service_role;

revoke execute on function public.stryde_reconcile_reservation(uuid, text, numeric) from anon, authenticated, public;
grant execute on function public.stryde_reconcile_reservation(uuid, text, numeric) to service_role;

revoke execute on function public.stryde_release_reservations(uuid) from anon, authenticated, public;
grant execute on function public.stryde_release_reservations(uuid) to service_role;

revoke execute on function public.stryde_expire_reservations() from anon, authenticated, public;
grant execute on function public.stryde_expire_reservations() to service_role;

revoke execute on function public.stryde_record_resource_usage(uuid, uuid, text, numeric, text) from anon, authenticated, public;
grant execute on function public.stryde_record_resource_usage(uuid, uuid, text, numeric, text) to service_role;

revoke execute on function public.stryde_fire_trigger(uuid, text) from anon, authenticated, public;
grant execute on function public.stryde_fire_trigger(uuid, text) to service_role;

-- This helper returns only the start of a fixed accounting window. It does
-- not need to resolve names from the mutable public schema.
alter function public.stryde_resource_window_start(text) set search_path = pg_catalog;

-- Artifact revision is intentionally callable by an authenticated user, but
-- its SECURITY DEFINER body must never trust a caller-supplied actor ID.
create or replace function public.stryde_revise_artifact(
  p_artifact uuid,
  p_content text,
  p_actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old record;
  v_new uuid;
begin
  if auth.uid() is null or p_actor is distinct from auth.uid() then
    raise exception 'Not authorized to revise artifact';
  end if;

  select * into v_old
  from public.artifact
  where id = p_artifact and owner_user_id = auth.uid();
  if not found then
    raise exception 'artifact not found';
  end if;
  if v_old.superseded_by is not null then
    raise exception 'artifact already superseded';
  end if;

  insert into public.artifact
    (owner_user_id, pursuit_id, run_id, action_id, content_text, mime_type,
     artifact_type, title, version, provenance, verification_state)
  values
    (v_old.owner_user_id, v_old.pursuit_id, v_old.run_id, v_old.action_id,
     p_content, v_old.mime_type, v_old.artifact_type, v_old.title,
     v_old.version + 1,
     v_old.provenance || jsonb_build_object('revised_from', v_old.id),
     v_old.verification_state)
  returning id into v_new;

  update public.artifact
  set superseded_by = v_new, updated_at = now()
  where id = v_old.id and owner_user_id = auth.uid();

  return v_new;
end;
$$;

revoke execute on function public.stryde_revise_artifact(uuid, text, uuid) from anon, public;
grant execute on function public.stryde_revise_artifact(uuid, text, uuid) to authenticated, service_role;

commit;
