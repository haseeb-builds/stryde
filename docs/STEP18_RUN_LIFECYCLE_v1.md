# STRYDE — Step 18 Run Lifecycle v1

## Status
IMPLEMENTED AND APPLICATION-WIRED

## Canonical role
A Run is the durable lifecycle of a single cognitive/orchestration cycle. It is not the lifecycle of real-world execution.

Canonical graph:

`INPUT → CONTEXT_ASSEMBLY → UNDERSTAND → REASSESS → DIAGNOSE? → SELECT_INTERVENTION → PROPOSE → VALIDATE → AUTHORIZE → COMMIT → DONE`

Exceptional exits are `WAITING` and `FAILED`.

## Application flow

`POST /api/v1/pursuits/:id/reason`
1. Creates a Run at `INPUT`.
2. Persists `CONTEXT_ASSEMBLY → UNDERSTAND → REASSESS`.
3. Assembles bounded Situation context.
4. Validates the model proposal through the deterministic reasoning kernel.
5. Persists the remaining cognitive stages produced by the kernel.
6. Pure answer responses close the Run with `DONE`.
7. Interventions pause at `AUTHORIZE` for explicit user approval.

`POST /api/v1/pursuits/:id/commit`
- Requires explicit approval.
- When `run_id` is supplied, validates ownership, Pursuit binding, and `AUTHORIZE` state.
- After successful Action authorization/commit, advances `COMMIT → DONE`.
- Controlled execution continues separately through `Job → Attempt → Observation → Verification`.

## HTTP surface

- `POST /api/v1/runs`
- `GET /api/v1/runs`
- `GET /api/v1/runs/:id`
- `POST /api/v1/runs/:id/transition`
- `POST /api/v1/pursuits/:id/reason`
- `POST /api/v1/pursuits/:id/commit`

## Locked invariants

- Run state is durable and reconstructable from PostgreSQL.
- Browser roles cannot mutate `run` rows directly.
- Anonymous callers cannot invoke Run lifecycle functions.
- Stage transitions are deterministic and server-enforced.
- Terminal Runs cannot be reopened.
- `RECORD`, `EXECUTE`, and `VERIFY` are not Run stages.
- The cognitive Run ends at commit/response completion; it does not remain open while a real-world Job executes.
- Failed lifecycle recovery does not claim execution was verified.

## Important boundary

A successful `COMMIT` means the authorized domain Action/Job has been durably created. It does not mean the external side effect succeeded or the intended outcome is verified.

## Tests

`supabase/tests/step18_run_lifecycle.sql` covers stage constraints, direct-mutation blocking, public function privilege boundaries, terminal guards, and separation from execution/verification.
