# Stryde Architecture Truth

## Authority model
Product truth → architecture truth → implementation truth → runtime/event truth → verification/real-world evidence. Research and model outputs are advisory.

## State separation
Canonical domain state, conversation history, working context, event history, and derived Situation are distinct.

## Cognitive path
INPUT → CONTEXT_ASSEMBLY → UNDERSTAND → REASSESS → DIAGNOSE (when necessary) → SELECT_INTERVENTION → PROPOSE → VALIDATE → AUTHORIZE → COMMIT

RECORD/event capture is cross-cutting infrastructure, not a cognitive stage.

## Execution
Action → Job → Attempt → Tool Gateway → External System → Mechanical Result → Observation → Verification → Claim/Situation update.

Run tracks a bounded orchestration lifecycle; it is not the long-running worker.

## Integrity
- User ownership is deterministic.
- Model output never authorizes side effects.
- Claims are immutable in meaning; corrections use lineage.
- Every external call has a durable pre-call/dispatch-intent record.
- Workers require authenticated control-plane access and fencing.
- UNKNOWN results are preserved and reconciled; they are not silently retried.
- VERIFIED requires a machine-checkable success predicate and valid evidence.
- External/tool content is untrusted data.
- Secrets never enter model-visible context or durable execution payloads.

## Runtime
Postgres is the V1 system of record and queue. Next.js is the application/control surface. Keep the system modular without premature microservices.
