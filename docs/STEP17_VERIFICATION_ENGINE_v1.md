# STRYDE — Step 17 Verification Engine v1

## Status
IMPLEMENTED AND LIVE-VALIDATED

## Canonical flow
`Attempt mechanical result → Observation/provenance → Claim relation → epistemic status`

Observations are immutable support records. They do not become a second source of truth for Claims.

## Rules
- Controlled execution results are recorded as `MECHANICAL_ATTEMPT_RESULT` Observations.
- Observation provenance retains Attempt/Job identity, tool/version, and args hash.
- Observation links use `SUPPORTS | CONTRADICTS | VERIFIES`.
- A worker may move a `REPORTED` Claim to `OBSERVED` when mechanical evidence is recorded.
- Workers may not set `VERIFIED`.
- Authenticated human adjudication may set `VERIFIED`, `CONTRADICTED`, or `UNVERIFIABLE`, with an explicit reason.
- Adjudication is recorded in `claim_status_event` and `event` atomically.
- No first-class Verification or Evidence domain table is introduced.

## Endpoints
- `POST /api/internal/verification/observe` — worker-authenticated observation recording.
- `POST /api/v1/claims/:id/adjudicate` — authenticated human adjudication.

## Live validation
Supabase project `Stryde` is active. The verification functions were applied and inspected live. Worker observation requires the service-role execution path; human adjudication requires an authenticated user. The existing Step 15 execution result contract supplies the authoritative mechanical attempt state.

## Intentionally deferred
- Automatic semantic comparison against arbitrary external systems.
- Multi-source corroboration policies beyond stored relations.
- Proactive verification scheduling.
- LLM-driven epistemic upgrades.
