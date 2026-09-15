# STRYDE — Step 14 Authorization + Commit v1

## Status
IMPLEMENTED AND LIVE-VALIDATED

## Objective
Create the deterministic control-plane boundary that turns an explicitly approved, validated intervention proposal into durable domain state without allowing model output to directly authorize side effects.

## Canonical flow

`validated proposal → explicit user approval → ACTION_APPROVAL Decision → Action commit → [CONTROLLED: Job + immutable authorization snapshot]`

The cognitive Run ends at authorization + Job commitment. Real execution remains outside the Run.

## API

### `POST /api/v1/pursuits/:id/commit`

Requires a valid Supabase bearer token and `approved: true`.

Accepted fields:

- `intent_summary`
- `intent_parameters`
- `execution_mode` = `HUMAN | CONTROLLED`
- CONTROLLED only: `tool_id`, `tool_version`
- optional explanatory fields: `why`, `expected_result`, `success_condition`, `reversibility`, `authorization_rationale`

The route validates shape and ownership through the authenticated Supabase request context. It then calls the transactional `stryde_commit_intervention` function.

## Database control

`public.stryde_commit_intervention` is `SECURITY INVOKER` and requires authentication. It delegates privileged append-only/control-plane writes to `stryde_internal.commit_intervention`, a narrowly scoped `SECURITY DEFINER` function in an unexposed schema.

The privileged function:

1. verifies the authenticated owner and non-terminal Pursuit;
2. creates and immediately resolves an `ACTION_APPROVAL` Decision attributed to the user;
3. creates the frozen Decision Option;
4. creates the Action in `IN_PROGRESS`;
5. emits semantic Events atomically;
6. for CONTROLLED Actions, verifies exact Tool + version and an active unrestricted capability grant;
7. computes the SHA-256 arguments hash from the frozen JSON arguments;
8. creates a durable `AUTHORIZED` Job;
9. creates the immutable `Job Authorization` snapshot bound to the exact decision, action, tool/version and args hash;
10. emits `JOB_AUTHORIZED` atomically.

All of these writes occur in one transaction. Any failed authorization check aborts the complete commit.

## Safety boundaries

- Explicit user approval is required by the API contract.
- Client ownership fields are never trusted.
- CONTROLLED Actions cannot be committed without a registered Tool/version.
- CONTROLLED Actions require an active unrestricted capability grant for the exact Tool.
- Frozen arguments are persisted before execution can occur.
- `args_hash` binds authorization to the exact frozen arguments.
- No credentials are accepted or persisted by this endpoint.
- No external tool is invoked by this endpoint.
- No Claim is upgraded to `VERIFIED` by this path.

## Remaining implementation boundary

Tool argument JSON Schema validation, capability target/scope constraint evaluation beyond unrestricted grants, budget reservation/consumption, worker leasing, tool dispatch, mechanical Attempts, UNKNOWN reconciliation, and verification belong to later execution/control-plane steps.

## Verification

- Live Supabase project: `pvijrnwdnolvnoibarrj`
- Project status: `ACTIVE_HEALTHY`
- Public wrapper verified as `SECURITY INVOKER`.
- Internal helper verified as `SECURITY DEFINER` with fixed `search_path`.
- Supabase security advisor retains only the pre-existing informational `public.loops` RLS-no-policy finding.
- Performance advisor findings remain expected query/index tuning work rather than Step 14 blockers.
