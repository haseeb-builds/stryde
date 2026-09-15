-- STRYDE Step 15 deterministic invariants.
-- These checks are designed for a privileged test database with isolated fixtures.

-- 1. Worker functions must be callable by service_role but not browser roles.
select has_function_privilege('service_role', 'public.stryde_lease_next_job(text, integer)', 'EXECUTE');
select has_function_privilege('authenticated', 'public.stryde_lease_next_job(text, integer)', 'EXECUTE');
select has_function_privilege('service_role', 'public.stryde_start_attempt(uuid, text)', 'EXECUTE');
select has_function_privilege('authenticated', 'public.stryde_start_attempt(uuid, text)', 'EXECUTE');
select has_function_privilege('service_role', 'public.stryde_finish_attempt(uuid, text, text, text, jsonb, jsonb)', 'EXECUTE');
select has_function_privilege('authenticated', 'public.stryde_finish_attempt(uuid, text, text, text, jsonb, jsonb)', 'EXECUTE');

-- 2. Attempt lifecycle remains separated into dispatch state and mechanical result state.
select count(*) = 1 as has_expected_dispatch_states
from pg_constraint
where conrelid='public.attempt'::regclass
  and conname='attempt_dispatch_state_check'
  and pg_get_constraintdef(oid) like '%DISPATCH_INTENT_COMMITTED%';

select count(*) = 1 as has_expected_mechanical_states
from pg_constraint
where conrelid='public.attempt'::regclass
  and conname='attempt_mechanical_result_state_check'
  and pg_get_constraintdef(oid) like '%UNKNOWN%';

-- 3. One non-terminal Job per Action remains enforced.
select count(*) = 1 as one_nonterminal_job_constraint
from pg_indexes
where schemaname='public'
  and tablename='job'
  and indexname='job_one_nonterminal_per_action_idx';

-- 4. Fencing token remains durable and monotonic by the lease function implementation.
select pg_get_functiondef('public.stryde_lease_next_job(text, integer)'::regprocedure) like '%fencing_token = j.fencing_token + 1%'
  as lease_increments_fence;

-- 5. Ambiguous mechanical execution must map to UNKNOWN rather than FAILED.
select pg_get_functiondef('public.stryde_finish_attempt(uuid, text, text, text, jsonb, jsonb)'::regprocedure) like '%WHEN p_result_status=''UNKNOWN''%'
  as unknown_path_present;
