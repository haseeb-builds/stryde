-- STRYDE Step 18 Run lifecycle invariants.
-- These checks are designed for a privileged test database with isolated fixtures.

-- Run stages are canonical and exclude RECORD / EXECUTE / VERIFY.
select count(*) = 1 as canonical_stage_constraint
from pg_constraint
where conrelid = 'public.run'::regclass
  and pg_get_constraintdef(oid) like '%CONTEXT_ASSEMBLY%'
  and pg_get_constraintdef(oid) like '%AUTHORIZE%'
  and pg_get_constraintdef(oid) like '%COMMIT%'
  and pg_get_constraintdef(oid) not like '%RECORD%'
  and pg_get_constraintdef(oid) not like '%EXECUTE%'
  and pg_get_constraintdef(oid) not like '%VERIFY%';

-- Browser roles cannot directly mutate durable Run rows.
select not has_table_privilege('authenticated', 'public.run', 'INSERT') as authenticated_insert_blocked;
select not has_table_privilege('authenticated', 'public.run', 'UPDATE') as authenticated_update_blocked;
select not has_table_privilege('authenticated', 'public.run', 'DELETE') as authenticated_delete_blocked;

-- Anonymous callers cannot invoke lifecycle functions.
select not has_function_privilege('anon', 'public.stryde_create_run(text,jsonb)', 'EXECUTE') as anon_create_blocked;
select not has_function_privilege('anon', 'public.stryde_transition_run(uuid,text,text,text)', 'EXECUTE') as anon_transition_blocked;

-- Authenticated callers may use the public lifecycle wrappers.
select has_function_privilege('authenticated', 'public.stryde_create_run(text,jsonb)', 'EXECUTE') as authenticated_create_allowed;
select has_function_privilege('authenticated', 'public.stryde_transition_run(uuid,text,text,text)', 'EXECUTE') as authenticated_transition_allowed;

-- The transition helper explicitly rejects terminal Runs.
select pg_get_functiondef('stryde_internal.run_transition(uuid,text,text,text)'::regprocedure) like '%Run is terminal%'
  as terminal_run_guard;

-- Execution remains outside the Run stage machine.
select pg_get_functiondef('stryde_internal.run_transition(uuid,text,text,text)'::regprocedure) not like '%EXECUTE%'
  and pg_get_functiondef('stryde_internal.run_transition(uuid,text,text,text)'::regprocedure) not like '%VERIFY%'
  as execution_boundary_preserved;
