# STRYDE STEP 9 — Persistence Implementation Contract v1

## Objective
Implement and validate the canonical V1 persistence layer defined by `STRYDE_STEP8_PERSISTENCE_CONTRACT_v1.md`.

## Scope
- Add versioned PostgreSQL migrations under `supabase/migrations/`.
- Implement the minimum canonical V1 tables and relationships.
- Implement user ownership and Row Level Security.
- Implement lifecycle, immutability, uniqueness, and referential constraints.
- Implement execution persistence: Action → Job → Attempt.
- Implement Decision, Claim, provenance/observation support, Run, and Event persistence.
- Add query-driven indexes.
- Add/refresh generated TypeScript database types after schema validation.
- Add deterministic tests for the persistence invariants.

## Explicit non-goals
- Do not build the orchestration engine.
- Do not build autonomous agent behavior.
- Do not add proactive monitoring.
- Do not introduce microservices or a separate queue product.
- Do not add MCP as a runtime dependency.
- Do not create a Command or extra execution-request domain object.
- Do not create a separate Approval entity; Action approval is `Decision.kind = ACTION_APPROVAL`.
- Do not add `tenant_id` in V1.
- Do not make Situation, Evidence, Verification, Memory, or Outcome first-class domain tables.
- Do not put execution implementation details such as tool keys or executable arguments directly onto Action unless already required by the locked Step 8 contract.
- Do not place EXECUTE or VERIFY inside the cognitive Run lifecycle. A Run ends after authorization + Job commitment; execution callbacks create a new Run.
- Do not delete or rewrite terminal semantic records to model correction, retry, or reopening.

## Locked semantics
### Ownership
- V1 is user-owned.
- `owner_user_id` is the canonical immutable ownership field on user-owned durable records.
- Client input is never trusted for ownership.
- Child ownership must derive from trusted parent/session context.
- User-facing RLS uses `owner_user_id = auth.uid()`.
- Service-role workers may bypass RLS, but worker authority is narrowed by Job ownership, lease, and fencing.

### Core domain
- Thread: staging/inbox; `OPEN → RESOLVED | EXPIRED | DISCARDED`; never reopens.
- Pursuit: persistent continuity boundary; `ACTIVE ↔ PAUSED`; `ACTIVE | PAUSED → COMPLETED | ABANDONED`. `BLOCKED` is derived.
- Claim: immutable proposition content; corrections create new Claims with supersession lineage. Scope is `PURSUIT | USER`. Thread-scoped Claims are prohibited in V1.
- Decision: `kind = STRATEGIC | ACTION_APPROVAL`; lifecycle `OPEN → RESOLVED | WITHDRAWN`; reopening creates a new linked Decision.
- Action: discrete intended work; `execution_mode = HUMAN | CONTROLLED`; lifecycle `PROPOSED → IN_PROGRESS → COMPLETED | FAILED | CANCELLED`.
- Event: immutable semantic history/audit record.

### Execution
- HUMAN Action: user executes outside the control plane. No fake Job/Attempt. Explicit user report may complete the Action but is `REPORTED` evidence.
- CONTROLLED Action: Action → Job → Attempt → Tool Gateway.
- Job is the durable authorized execution unit and queue primitive.
- Attempt is an immutable mechanical try.
- Do not lease directly against Action.
- Exactly-once external delivery is not assumed.
- UNKNOWN is distinct from FAILED.
- Stale worker results must be fenced out.
- Reconciliation is distinct from retry.

### Verification
- `REPORTED`: someone asserted a result.
- `OBSERVED`: provenance-bearing observation, not necessarily ultimate truth.
- `VERIFIED`: applicable verification policy satisfied.
- `CONTRADICTED`: evidence conflicts under policy.
- `UNVERIFIABLE`: bounded verification exhausted without establishing truth.
- Not-yet-verified is not the same as unverifiable.
- LLM output cannot directly upgrade a Claim to VERIFIED.

### Evidence / provenance
- Evidence relationships: `SUPPORTS | CONTRADICTS | VERIFIES`.
- Provenance identity must retain sufficient source/time/reference information for auditability.
- Physical observation storage is an implementation/support primitive, not a new domain ontology entity.
- Corroborating evidence does not merge or supersede an existing Claim merely because it is semantically similar.

### Run
Canonical cognitive flow:
`INPUT → CONTEXT ASSEMBLY → UNDERSTAND → REASSESS`
with conditional:
`DIAGNOSE → SELECT INTERVENTION → PROPOSE → VALIDATE → AUTHORIZE → COMMIT`.
`RECORD` is infrastructure/cross-cutting, not a cognitive stage.
Execution itself is outside the Run; callbacks create new Runs.

## Required transaction boundaries
- Domain mutation + corresponding Event must commit atomically.
- Action approval + immutable authorization snapshot + Job creation must commit atomically.
- Attempt completion/failure + relevant Event must commit atomically.
- Claim correction/supersession must preserve immutable history and lineage.
- Ownership must be established atomically at creation.

## Required tests
At minimum, cover:
1. Cross-user access is rejected.
2. Relationship rows cannot connect different owners.
3. Terminal Thread cannot reopen.
4. Pursuit lifecycle rejects illegal transitions.
5. Decision reopening creates a new Decision rather than mutating terminal history.
6. Claim content cannot be mutated after creation.
7. Claim correction preserves supersession lineage.
8. Action lifecycle rejects illegal transitions.
9. HUMAN Action cannot fabricate a Job/Attempt path.
10. CONTROLLED Action requires authorized Job creation through the control-plane path.
11. Job lease ownership and fencing reject stale workers.
12. Ambiguous execution is represented as UNKNOWN, not FAILED.
13. Retry/reconciliation semantics do not silently duplicate a dispatched side effect.
14. LLM-originated input cannot directly assign VERIFIED epistemic status.
15. Consequential mutations emit immutable Events.
16. Relevant uniqueness constraints hold under concurrency.

## Implementation discipline
- Prefer the smallest schema that satisfies the locked semantics.
- No speculative infrastructure.
- No semantic duplication across tables.
- Preserve canonical naming and terminology.
- Any conflict between this implementation contract and the canonical PRD/architecture/decision register must halt implementation and be reconciled before code is changed.

## Completion criteria
Step 9 is complete only when:
- migrations are versioned and reproducible;
- schema validates against the actual Stryde Supabase project or an explicitly equivalent development database;
- RLS/security checks pass;
- invariant tests pass;
- generated types match the actual schema;
- the legacy `loops/checkin` model is clearly isolated from the canonical V1 model and is not silently treated as canonical;
- a concise verification record identifies the exact migration(s), test results, and remaining risks.
