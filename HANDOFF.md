# Stryde Handoff

Current as of 2026-10-06 post-GLM checkpoint.

## Current truth

- main = `1e3b7d7dd886d2f8e7a0e70b0e84e06e6b06bfec`.
- GLM's streaming malformed-output failover fix = `a67e36d23e1d7528af71277d8e627be5732216e7`, and it is an ancestor of current main.
- Current GitHub Actions `verify` check is SUCCESS on current main.
- Current Vercel production deployment = `dpl_2w7iPjCcKAWZmQ8VdaJ8CeLb5XcP`, READY, serving `1e3b7d7`.
- Current production model configuration: OpenRouter preferred with `nvidia/nemotron-3-super-120b-a12b:free`; Gemini fallback `gemini-flash-latest`; OmniRoute disabled.
- Vercel project plan is Hobby.
- Supabase migration parity is 37/37.
- Live `user_agent_preference`, `skill`, `skill_version`, and `funnel_event` tables now exist with RLS enabled.
- RESEND_API_KEY is no longer present in the Vercel environment.
- Exa / Firecrawl credentials are still absent, so live research legs remain blocked.
- Production worker runtime is still not established.
- A historical 55-second conversation timeout error group remains in Vercel telemetry, last seen on 2026-10-06T15:59:52Z on an older deployment. Fresh current-main conversation proof is still required before calling the production conversation path stable.

## What the interrupted GLM run accomplished

It was useful and should not be discarded.

It:
- reconciled documentation;
- fixed the CI/Linux path defect;
- reconciled/applied the five live migrations;
- removed stale RESEND_API_KEY;
- discovered the production model problem;
- contract-tested free OpenRouter model candidates;
- selected `nvidia/nemotron-3-super-120b-a12b:free`;
- fixed streaming malformed-output retry/failover in `a67e36d`.

The run stopped before completing the final post-fix production conversation journey and before implementing Issue #7's capability-composition layer.

## Read first

1. docs/PRODUCT_CONSTITUTION.md
2. docs/ARCHITECTURE.md
3. docs/STATE.md
4. docs/RUNTIME.md
5. docs/VERIFICATION_MATRIX.md
6. docs/DECISIONS.md
7. docs/INTEGRATIONS.md
8. docs/RESEARCH_REALITY_ENGINE.md
9. docs/SUBSCRIPTION_AND_RESOURCE_MODEL.md
10. docs/RESEARCH_COST_CONTROL.md
11. docs/BILLING_PROVIDER_ARCHITECTURE.md
12. docs/AI_CAPABILITY_LANDSCAPE_AND_GAPS.md
13. docs/GLM_MASTER_IMPLEMENTATION_BRIEF.md
14. docs/GLM_RESUME_MANDATE.md

## Next action

Do not restart the old documentation-reconciliation/migration work.

First run the fresh production conversation proof described in `docs/GLM_RESUME_MANDATE.md`.

If that passes, proceed directly into Issue #7 / `docs/GLM_MASTER_IMPLEMENTATION_BRIEF.md`, beginning with Phase 1: Unified Capability Registry.

## Non-negotiables

- Do not reset the live Supabase database.
- Do not revert `a67e36d` unless a verified regression requires it.
- Do not treat `/api/health/model` as proof of generation quality.
- Do not claim production stability without the current-main conversation proof.
- Do not duplicate existing skills, memory, worker, MCP, research, or job primitives.
- Capability discovery is not authority.
- External content is untrusted.
- Tool success is not outcome success.
- Keep provider interfaces replaceable.
- Keep Free genuinely useful but economically bounded.
- Do not add heavyweight agent frameworks without a demonstrated need.
- Record implemented/tested/deployed/production-proven status separately.
