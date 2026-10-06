# Stryde GLM Resume Mandate

Status: current execution checkpoint
Date: 2026-10-06

## You are NOT starting over

An earlier GLM execution already performed documentation reconciliation, fixed the Linux CI defect, reconciled the five live migrations, removed stale RESEND_API_KEY, found the production model failure, contract-tested free OpenRouter candidates, selected nvidia/nemotron-3-super-120b-a12b:free, and implemented streaming malformed-output retry/failover in commit a67e36d23e1d7528af71277d8e627be5732216e7.

That repair is already an ancestor of current main. Do not reimplement it.

## Current repository/runtime checkpoint

- main = 1e3b7d7dd886d2f8e7a0e70b0e84e06e6b06bfec
- GitHub Actions verify = SUCCESS on current main
- Production deployment = dpl_2w7iPjCcKAWZmQ8VdaJ8CeLb5XcP, READY
- Production model health = OpenRouter / nvidia/nemotron-3-super-120b-a12b:free; Gemini fallback; OmniRoute disabled
- Supabase = 37/37 migrations applied
- user_agent_preference, skill, skill_version, funnel_event = live
- RESEND_API_KEY = removed
- Exa/Firecrawl live keys = absent
- Vercel plan = Hobby
- production worker runtime = not established
- one historical conversation timeout signal remains in telemetry; latest occurrence 2026-10-06T15:59:52Z on an older deployment

## Phase A — finish the interrupted production proof

First verify a fresh authenticated production conversation on current main.

Prove:

confirmed user → pursuit → first structured conversation turn → adaptive working state → second turn → persistence

Do not use /api/health/model as generation proof.

Do not declare success from a single HTTP 200 if the structured turn is malformed or the pursuit state is not persisted.

If it fails, diagnose from actual production evidence and make the smallest targeted repair. Preserve the provider abstraction.

After any repair:

npm test → typecheck → lint → build → deploy → fresh production verification

## Phase B — reconcile documentation one final time

Update docs/STATE.md, docs/RUNTIME.md, docs/VERIFICATION_MATRIX.md, docs/INTEGRATIONS.md, and HANDOFF.md only where new evidence changes current truth.

Do not duplicate historical narratives unnecessarily. Current entries must remain clearly authoritative.

## Phase C — begin Issue #7

Once the current production conversation proof passes, stop closure archaeology and implement:

1. Unified Capability Registry
2. Capability Discovery / Eligibility / Authority boundary
3. Entitlement + Resource Enforcement
4. Skills V2
5. Dynamic MCP capability discovery
6. Adaptive Research Planner
7. Scheduler / Triggers
8. Artifacts
9. Notifications
10. Task-aware model routing
11. Task-local sub-agent orchestration
12. Multimodal / computer expansion
13. Capability / economic / security / outcome evaluation

Use docs/GLM_MASTER_IMPLEMENTATION_BRIEF.md as the canonical implementation specification.

## Most important implementation constraint

Do not build all of this as disconnected features.

Build a coherent vertical slice:

pursuit → capability discovery → entitlement/budget → planner → capability execution → evidence/result → artifact where useful → authority → observation → verification → updated pursuit → next move

Reuse the existing primitives.

## Existing primitives to preserve

- Context Compiler
- pursuit/conversation state
- memory lifecycle
- skill lifecycle
- Hermes/OpenCode workers
- browser worker
- MCP transport
- Exa/Firecrawl adapters
- observation/claim/verification model
- model provider abstraction
- job/attempt/lease execution control plane
- continuity cron

Do not create parallel replacements unless the current abstraction is demonstrably incapable of the required behavior.

## Commercial boundary

Free / Pro / Max entitlements and resource budgets are architecture targets but are not yet runtime-complete.

Implement entitlement and metering server-side. Do not hard-code vendor API call counts into plan semantics.

## Safety

- Capability discovery is not authority.
- External content is untrusted.
- Tool success is not outcome success.
- Never reset production Supabase.
- Never silently treat provider failure as absence of evidence.
- Never claim production-proven behavior without the required evidence.
- Max does not bypass safety ceilings.

## Definition of progress

Each phase must end with:

implemented + tested + deployed + production evidence where applicable + explicit remaining unknowns

Do not stop at a green build.

## Final instruction

Resume from the actual current repository state. Do not restart previously completed work. First close the production proof gap, then build Issue #7's capability-composition layer.
