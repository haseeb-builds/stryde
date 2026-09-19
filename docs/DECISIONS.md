# Stryde Locked Decisions

## D1 — Canonical state is not conversation history
Conversation is persisted for continuity, but canonical truth lives in typed domain records and evidence.

## D2 — Model authority is bounded
Models can propose interpretation, diagnosis, intervention, and structured inputs. They cannot authorize or directly mutate consequential canonical state.

## D3 — Execution shape
The V1 execution model is Action → Job → Attempt with durable dispatch intent, leases, fencing, and explicit mechanical result states.

## D4 — Verification semantics
REPORTED, OBSERVED, VERIFIED, CONTRADICTED, and UNVERIFIABLE are distinct. A model cannot self-declare VERIFIED.

## D5 — UNKNOWN is first-class
Ambiguous external execution outcomes become UNKNOWN and enter reconciliation. Never silently repeat a potentially side-effecting call.

## D6 — Postgres first
Postgres remains the V1 system of record and queue. No broker, vector database, microservice split, or dynamic orchestration layer without evidence.

## D7 — Provider replaceability
Gemini is the current primary reasoning provider. Provider/model choice remains an adapter concern; OpenRouter remains secondary/lab infrastructure.

## D8 — Self-improvement is out of V1
No self-modifying control/invariant system until strong eval coverage and promotion gates exist.

## D9 — Build-control separation
Agent collaboration is governed by canonical repo artifacts, explicit task contracts, tests, and runtime evidence. External agents do not silently redefine Stryde.
