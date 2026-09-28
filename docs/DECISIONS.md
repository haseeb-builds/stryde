# Stryde Decision Register

Status: canonical decision register
Reconciliation date: 2026-09-28

## D1 — Conversation is not canonical state

Conversation is an interaction/continuity surface. Durable domain truth lives in typed records and evidence.

Status: CONFIRMED in current architecture and live schema.

## D2 — Model authority is bounded

Models may propose interpretation, diagnosis, interventions, and working state. They cannot independently authorize consequential side effects or mark verification complete.

Status: IMPLEMENTED in code/database; production end-to-end behavior remains UNPROVEN.

## D3 — Action → Job → Attempt

Controlled external execution uses durable Actions, Jobs, and Attempts with lease/fencing semantics.

Status: IMPLEMENTED; live external execution is UNPROVEN.

## D4 — Verification is separate from mechanical success

Reported, observed, verified, contradicted, and unverifiable states are distinct.

Status: IMPLEMENTED at the persistence/control-plane level; real end-to-end verification is UNPROVEN.

## D5 — UNKNOWN is first-class

Ambiguous execution outcomes remain UNKNOWN and require reconciliation rather than silent retry.

Status: IMPLEMENTED at the persistence level; not demonstrated against a real external side effect.

## D6 — Postgres first

Postgres remains the V1 system of record and queue. Do not introduce a broker, vector database, graph database, or service split without evidence.

Status: CONFIRMED.

## D7 — Model provider is replaceable

There is an unresolved historical contradiction.

An existing decision document says Gemini is the current primary provider. STEP19_MODEL_GATEWAY_v1 says OpenRouter/openrouter-free is current. Current repository code supports Gemini, Groq, and OpenRouter and defaults to Gemini when no provider override is supplied. Live Run failures dated 2026-09-18 contain OpenRouter-specific errors.

Therefore:
- OpenRouter was used in the runtime at least on 2026-09-18.
- Current deployed provider is UNKNOWN because Vercel environment access is unavailable.
- Source default is Gemini when STRYDE_MODEL_PROVIDER is absent.

Status: CONTRADICTED / UNRESOLVED.

## D8 — Self-improvement remains outside V1

No self-modifying control/invariant system without strong evaluations and promotion gates.

Status: CONFIRMED.

## D9 — Repository is durable project memory

Repository documents/code/migrations, live database state, deployment/runtime evidence, and verification artifacts form the durable project record. Conversation is only the control interface.

Status: CONFIRMED from the operating model adopted on 2026-09-28.

## D10 — Reuse mature infrastructure

Specialized execution capabilities should reuse mature infrastructure rather than be rebuilt inside Stryde. Stryde owns control, authority, canonical state, reconciliation, evidence, and continuation.

Status: INTENDED ARCHITECTURAL DECISION. No external browser/crawler/media/document stack is installed in the current repository.

## D11 — No opportunistic cleanup

Reconciliation is not a feature/refactor task. Changes outside the declared scope require a separate task.

Status: CONFIRMED.

## Historical decision documents

Existing STEP and roadmap documents are historical evidence/intent unless referenced by the current canonical documents. Current-state contradictions are recorded in docs/STATE.md and docs/RUNTIME.md rather than silently rewriting historical claims.
