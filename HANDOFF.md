# Stryde Handoff

Current as of 2026-10-06 (final truth reconciliation pass). This document is
the operator's entry point; history is preserved in docs/STATE.md (dated
sections), docs/VERIFICATION_MATRIX.md, and git history. Every claim below is
CONFIRMED unless labeled otherwise.

## Read first

1. docs/PRODUCT_CONSTITUTION.md — the product is a pursuit system, not a chatbot or a framework.
2. docs/STATE.md (2026-10-06 section) — current verified snapshot.
3. docs/VERIFICATION_MATRIX.md — implemented / tested / deployed / production-proven, per capability.
4. Issue #6 (open) — the active product mandate and the 2026-10-05 execution report.

## Current repository

- main at bc8e92e, clean, pushed; production serves this commit.
- 37 migration files; live Supabase has 32 applied (see below).
- CI is RED on the whole Issue #6 pass (runs 210-212 fail at Unit tests;
  last green e393140). Root cause: tests/mcp-client.test.ts derives the repo
  root with a Windows-only `pathname.replace(/^\//, "")`; on Linux the MCP
  echo server path resolves wrong and both transport tests fail. The suite
  passes 210/210 on Windows. Fix = `fileURLToPath(import.meta.url)` (one
  line) and keep the repo's explicit-`.ts` import convention. Vercel does
  not run tests, so deployment success is not test evidence.

## Production

- https://stryde-topaz.vercel.app — live; deployment stryde-dt58xyg2s
  (Ready, 2026-10-05, commit bc8e92e).
- /api/health/model: openrouter preferred, chain
  [gemini, openrouter, omniroute], omniroute disabled, ready=true. This is
  configuration evidence; the 2026-10-05 production conversation is the
  generation proof.
- Open production defect: runtime errors mention the missing
  `public.funnel_event` table (fail-open funnel instrumentation).
- RESEND_API_KEY is set on the Vercel project but unreferenced by code
  (resend dependency removed 2026-10-04) — remove it.
- No EXA / FIRECRAWL / Stripe keys (BLOCKED on human-owned credentials).

## Live database (Supabase pvijrnwdnolvnoibarrj)

- 32/37 migrations applied. Pending:
  - 20261005000000 register browser worker tool — worker.browser row ALREADY
    exists live (runtime-provisioned 2026-10-05); migration is a plain
    INSERT → verify row parity, then `supabase migration repair --status
    applied 20261005000000`. DO NOT re-run it.
  - 20261005030000 register mcp worker tool — same situation as above.
  - 20261005010000 user_agent_preference — apply normally (table missing).
  - 20261005020000 stryde skills — apply normally (skill, skill_version
    missing).
  - 20261005040000 funnel events — apply normally (funnel_event missing;
    applying it stops the production runtime error).
- Missing live tables (REST 404, 2026-10-06): user_agent_preference, skill,
  skill_version, funnel_event. Product code fails open without them.
- Live tool registry: worker.hermes v1, worker.opencode v1,
  worker.browser v1, worker.mcp v1.
- Live counts (2026-10-06, include E2E harness data): pursuit 153,
  conversation_session 149, conversation_message 234, tool 4,
  capability_grant 6, job 57, attempt 55, observation 121, claim 62,
  action 122, decision 123, run 16, event 941, memory_item 31,
  user_autonomy_policy 0.
- The Supabase CLI in the working environment is linked and authenticated;
  the earlier "no DDL credential by design" note no longer applies.
- Standing rule: never `db push --reset` or reset the live database.

## Proven vs not proven (honesty labels)

- PROVEN (local plane, real agents): Hermes, OpenCode, browser render, MCP
  transport, human action loop, verification cycle, memory lifecycle,
  context compiler, skills, agent selection.
- PROVEN (production): sign-in boundary, pursuit surface, landing UX,
  context compiler (live turns), voice input reachability, one real
  conversation turn (2026-10-05), ui suite 12/12 against production.
- NOT ESTABLISHED: production worker runtime (no publicly reachable worker
  endpoint; serverless cannot host workers/browsers), production browser
  runtime, sustained production model generation, live research legs (no
  keys), billing (honest 503 until keys).

## Operator steps queued (in execution order)

1. Fix the CI path defect (one line) and get main green.
2. Reconcile + apply the five migrations (commands above), verify the four
   tables live, confirm the funnel_event error stops.
3. Remove RESEND_API_KEY from Vercel (Production+Preview).
4. Production loop proof: fresh signup → pursuit → real model turn →
   adaptive planning → action → observation → next move (never cite
   /api/health/model as model evidence).
5. Establish a production-reachable worker/browser runtime (public endpoint
   + bearer token; fail-closed auth already enforced server-side), then
   prove delegation and browser observation from the deployed product.
6. Verify honest degradation on production: provider unavailable, worker
   unavailable, browser unavailable, research unavailable.
7. Optional keys (human-owned): Stripe (founding access), EXA/FIRECRAWL
   (research legs).

## Non-negotiables

- Do not turn Stryde into a generic AI workspace or an agent framework.
- Do not expose internal ontology in normal UX.
- Do not let third-party infrastructure redefine Stryde or own semantic state.
- Do not add dependencies just because they are popular.
- Do not use model output as authority or proof of outcome.
- Do not make the user verify what Stryde can reliably verify itself.
- Do not reset the live database to make migrations look clean.
- Do not declare completion without matching evidence.
- Distinguish implemented / tested / configured / deployed /
  production-proven / customer-proven in every claim.
