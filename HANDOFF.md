# Stryde Handoff

Reconciliation date: 2026-09-28
Repository baseline commit: 2420caa605e15ee59ca0472dd1975f7c7d1d8731

## Current verified state

GitHub main was inspected directly. The repository contains a substantial but partial Stryde control-plane implementation.

Supabase is reachable and healthy. The live schema contains the canonical persistence model, conversation persistence, source/adaptation/citation structures, execution tables, worker tool registry, and verification primitives.

GitHub reports a successful Vercel deployment for the baseline repository commit.

Direct Vercel runtime access is currently denied, so current deployed page behavior, runtime logs, and production environment values cannot be verified from this control-room session.

## Intended product

Stryde is intended to be a persistent situational-intelligence workspace that continuously turns reality and useful external knowledge into adaptive next moves while preserving human authority and evidence-based verification.

Core intended loop:

REALITY → SITUATION → UNKNOWN / BOTTLENECK → NEXT MOVE → WORK → RESULT → EVIDENCE → VERIFICATION → STATE UPDATE → NEXT MOVE

Conversation/Bar is the control surface, not project memory.

## Major blockers

1. No current production end-to-end proof exists for the core pursuit/conversation/model loop.
2. Vercel runtime access is blocked.
3. Repository migration lineage and live Supabase migration history have major drift.
4. Repository contains duplicate migration version 20260915000500.
5. Live database contains 9 RUNNING Runs, including records older than a week.
6. Worker execution is unproven: tools=2, grants=0, jobs=0, attempts=0, observations=0.
7. Verification E2E is unproven: claims=0, observations=0.
8. Current provider is unresolved: source default Gemini, historical live OpenRouter errors, current deployment env inaccessible.

## Contradictions

### Migration lineage
Repository: 20 migrations. Live history: 11. Live-only migrations: 20260927083712 and 20260927083847. Repository-only migrations include several whose effects exist in the live schema.

### Duplicate migration
Two repository files share 20260915000500.

### Model provider
Existing docs disagree about Gemini vs OpenRouter. Historical live failures prove OpenRouter use on 2026-09-18. Current deployed provider is unknown.

### Conversation documentation
Older docs state that durable transcript storage or streaming were deferred, while current code/live DB contain persisted conversation state and SSE streaming code.

### Privilege posture
Live privileges are broader than some intended authenticated-only boundaries, even where function bodies enforce auth.uid().

## Dangerous assumptions

- CI success does not prove production behavior.
- Vercel deployment success does not prove the deployed user flow.
- A model adapter is not proof of current model configuration.
- A worker gateway/tool row is not proof of worker execution.
- A Job/Attempt schema is not proof that a real external side effect occurred safely.
- Mechanical success is not VERIFIED.
- Live schema shape does not prove migration reproducibility.
- Conversation history must not override repository/DB/runtime truth.

## Current database state

Counts at reconciliation:
Pursuits 3
Conversation sessions 6
Conversation messages 5
Sources 0
Source adaptations 0
Source citations 0
Tools 2
Capability grants 0
Jobs 0
Attempts 0
Observations 0
Claims 0
Actions 1
Decisions 1
Runs 16
Events 98

Current Action: HUMAN / IN_PROGRESS.
Current Decision: ACTION_APPROVAL / RESOLVED.

## Current verification state

The repository contains deterministic tests and Supabase verification SQL for several invariants, but the latest CI run does not execute npm test.

Live database proves that verification primitives exist, but zero live Claims and zero Observations means no current evidence→verification cycle is proven.

## Recommended next action

Restore access to the deployed Vercel runtime and execute one authenticated production verification of the existing loop, without changing product/schema/code:

sign in → create/open Pursuit → create/open Conversation → send message → receive real model response → verify exactly-once persistence → reload → verify history and working state → inspect corresponding DB records and runtime evidence.

Classify any failure before changing code or schema.

Migration reconciliation should be a separate control-room task immediately after the production loop is observable.

## Canonical reading order

docs/PRODUCT.md
docs/ARCHITECTURE.md
docs/STATE.md
docs/DECISIONS.md
docs/INTEGRATIONS.md
docs/RUNTIME.md
docs/VERIFICATION_MATRIX.md
docs/OPERATING_MODEL.md
HANDOFF.md

Existing docs/STEP*.md remain historical evidence unless explicitly superseded by the canonical current-state documents above.
