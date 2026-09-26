-- STRYDE Step 20: adaptive pursuit structural boundary checks.
-- These are deterministic catalog/constraint checks. Authenticated HTTP behavior
-- is covered by the API routes and must still be proven in a deployed environment.

select count(*) = 1 as source_table_exists
from information_schema.tables
where table_schema = 'public' and table_name = 'pursuit_source';

select count(*) = 1 as adaptation_table_exists
from information_schema.tables
where table_schema = 'public' and table_name = 'pursuit_source_adaptation';

select count(*) = 1 as source_kind_constraint_exists
from pg_constraint
where conrelid = 'public.pursuit_source'::regclass
  and pg_get_constraintdef(oid) like '%URL%PASTED%';

select count(*) = 1 as adaptation_status_constraint_exists
from pg_constraint
where conrelid = 'public.pursuit_source_adaptation'::regclass
  and pg_get_constraintdef(oid) like '%ADVISED%SUPERSEDED%';

select count(*) = 1 as objective_rpc_exists
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'stryde_set_objective_claim';

select count(*) = 1 as human_feedback_rpc_exists
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'stryde_complete_human_action';

select count(*) = 2 as source_rls_policies
from pg_policies
where schemaname = 'public'
  and tablename = 'pursuit_source'
  and policyname in ('pursuit sources owned insert','pursuit sources owned select');

select count(*) = 2 as adaptation_rls_policies
from pg_policies
where schemaname = 'public'
  and tablename = 'pursuit_source_adaptation'
  and policyname in ('source adaptations owned insert','source adaptations owned select');

select count(*) = 1 as action_terminal_constraint
from pg_constraint
where conrelid = 'public.action'::regclass
  and pg_get_constraintdef(oid) like '%PROPOSED%IN_PROGRESS%COMPLETED%FAILED%CANCELLED%';
