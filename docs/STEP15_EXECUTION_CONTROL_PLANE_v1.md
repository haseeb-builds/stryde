# STRYDE — Step 15 Execution Control Plane v1

## Status
IMPLEMENTED AND LIVE-VALIDATED

## Purpose
Establish the durable execution boundary after an authorized CONTROLLED Action exists.

Canonical path:

`Action → Job → lease → Attempt → Tool Gateway / external system → mechanical result → verification`

This step does not implement external tool adapters or semantic verification. It implements the durable control-plane primitives those layers depend on.

## Locked controls

- Jobs are the durable authorized execution units and queue primitive.
- Workers lease Jobs, not Actions.
- `SELECT ... FOR UPDATE SKIP LOCKED` prevents competing workers from taking the same ready Job in the same transaction.
- Every lease increments a durable `fencing_token`.
- Attempt records capture the Job fencing token so stale workers cannot finalize a newer lease.
- Attempt dispatch state and mechanical result state are separate dimensions.
- `UNKNOWN` is preserved for ambiguous execution outcomes; it is never silently converted to `FAILED`.
- Expired dispatch leases reconcile to `UNKNOWN` and emit a reconciliation Event.
- Worker RPCs require the server-only `service_role` JWT and are not executable by browser roles.
- The service-role key is resolved only inside a server-only module and is never returned to clients.
- Internal worker HTTP routes additionally require `STRYDE_WORKER_SECRET`.

## HTTP control surface

- `POST /api/internal/execution/lease`
- `POST /api/internal/execution/attempt/start`
- `POST /api/internal/execution/attempt/finish`
- `POST /api/internal/execution/reconcile`

These routes are infrastructure endpoints, not end-user product APIs.

## Important non-goals

- No external tool implementation yet.
- No credential retrieval into model context.
- No automatic retry after ambiguous external dispatch.
- No semantic Claim verification.
- No long-lived Vercel worker process. Hosting/worker scheduling remains a deployment concern to solve when the execution adapter is introduced.

## Verification

Live Supabase project is ACTIVE_HEALTHY. The Step 15 functions exist with `SECURITY INVOKER` in `public`; their execution privilege is restricted to `service_role`. A separate internal reconciliation helper is not used by the HTTP path.

The repository also contains `supabase/tests/step15_execution_control_plane.sql`, covering function privilege boundaries, UNKNOWN state support, the one-nonterminal-Job constraint, fencing-token increment behavior, and UNKNOWN mapping.

## Current advisory state

Supabase security advisory remains only the known informational RLS-without-policy notice on legacy `public.loops`. Performance advisories are pre-production query/index tuning signals and are not blocking this control-plane step.
