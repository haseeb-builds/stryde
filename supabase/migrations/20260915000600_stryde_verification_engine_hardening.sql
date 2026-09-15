-- Hardening for Step 17 worker observation boundary.
-- Explicitly revoke default PUBLIC/anon/authenticated EXECUTE privileges.
revoke all privileges on function public.stryde_record_attempt_observation(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.stryde_record_attempt_observation(uuid,uuid,text) to service_role;

grant usage on schema stryde_internal to service_role;
revoke all on function stryde_internal.record_attempt_observation(uuid,uuid,text) from public, anon, authenticated;
grant execute on function stryde_internal.record_attempt_observation(uuid,uuid,text) to service_role;
