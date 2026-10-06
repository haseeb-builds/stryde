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
15. docs/GLM_WORLD_CLASS_SINGLE_SESSION_BUILD_MANDATE.md

## Next action

Use `docs/GLM_WORLD_CLASS_SINGLE_SESSION_BUILD_MANDATE.md` for the new GLM session. Do not restart the old documentation-reconciliation/migration work.

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

## 2026-10-06 (latest) — capability platform shipped; next engineer starts here

The Issue #8 capability-composition platform pass is IMPLEMENTED, TESTED
(251/251 unit), and DEPLOYED. Registry/discovery/entitlements, resource
reservation, Skills V2, plugin manifest, MCP normalization, research
planner + evidence-graph novelty, triggers, artifacts, notifications,
task-aware routing, sub-agent spec, policy hooks, and draft API contracts
are all in. Migration parity 40/40. Production cron runs the platform
maintenance surface (verified live). Four real streamed conversation turns
proven on production after the 55s-timeout repair.

### Remaining work, in priority order

1. Re-run the complete production journey (`.prod-journey.mjs` from the
   workspace root, with STRYDE_JOURNEY_EMAIL/PASSWORD of a confirmed user)
   once OpenRouter free-models-per-day quota resets — the last unobserved
   boundary is convergence-to-action on the deployed build. Then observe
   whether the adaptive controller's convergence/answer rules hold.
2. Funded provider credential (OpenRouter credits or billed Gemini) —
   structural; free tiers are non-viable for a public product.
3. EXA / FIRECRAWL keys to move research from honest degradation to live;
   the planner, novelty classification, and reservation wiring are ready.
4. Trigger → dispatcher job enqueueing E2E (the firing window and cron
   evaluation are proven; the enqueue leg needs a scheduled-run harness).
5. Artifacts UI surface (API + RPC + migration are done).
6. Substrate decisions for sandboxed code, connectors (OAuth), transcripts —
   registered BLOCKED/UNAVAILABLE in the live capability catalog.
