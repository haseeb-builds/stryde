-- STRYDE Step 19 deterministic boundary checks.

-- 1. Model gateway is not represented as a domain-side authorization primitive.
select count(*) = 1 as action_execution_modes_locked
from pg_constraint
where conrelid = 'public.action'::regclass
  and pg_get_constraintdef(oid) like '%HUMAN%CONTROLLED%';

-- 2. Verification statuses remain independent from model proposals.
select count(*) = 1 as verification_statuses_locked
from pg_constraint
where conrelid = 'public.claim'::regclass
  and pg_get_constraintdef(oid) like '%VERIFIED%CONTRADICTED%UNVERIFIABLE%';

-- 3. The Run graph contains no execution/verification stages.
select count(*) = 1 as run_stage_boundary_locked
from pg_constraint
where conrelid = 'public.run'::regclass
  and pg_get_constraintdef(oid) like '%AUTHORIZE%COMMIT%DONE%FAILED%WAITING%'
  and pg_get_constraintdef(oid) not like '%EXECUTE%VERIFY%';
