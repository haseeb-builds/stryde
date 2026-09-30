# Stryde Verification Matrix

Status: canonical verification matrix
Reconciliation date: 2026-09-30

IMPLEMENTED means the machinery exists. TESTED means relevant execution evidence exists. DEPLOYED means deployment evidence exists. PRODUCTION VERIFIED means behavior was demonstrated on the deployed/runtime system. END-TO-END VERIFIED means the whole intended loop was demonstrated. No stronger state is inferred from a weaker one.

| Capability | Implemented | Tested | Deployed | Production Verified | E2E Verified |
|---|---|---|---|---|---|
| Authenticated server boundary | YES | YES (local E2E) | YES | UNKNOWN | NO |
| Pursuit creation/listing | YES | YES (local E2E + UI) | YES | UNKNOWN | NO |
| Conversation persistence | YES | YES (local E2E + UI) | YES | PARTIAL | NO |
| Conversation SSE streaming | YES | PARTIAL | YES | UNKNOWN | NO |
| Adaptive conversation | YES | PARTIAL | YES | UNKNOWN | NO |
| Situation assembly | YES | PARTIAL | YES | UNKNOWN | NO |
| Reasoning Run lifecycle | YES | PARTIAL | YES | PARTIAL | NO |
| Model gateway (routing/fallback) | YES | YES (unit + health route) | YES | HISTORICAL YES | NO (402: unfunded) |
| Model conversation turn (real provider) | YES | NO (blocked: OpenRouter credits 0) | YES | NO | NO |
| Exa search adapter | YES | TESTS PRESENT, execution not evidenced | YES | UNKNOWN | NO |
| Firecrawl source adapter | YES | TESTS PRESENT, execution not evidenced | YES | UNKNOWN | NO |
| Source persistence/adaptation | YES | PARTIAL | YES | UNKNOWN | NO |
| Source citation lineage | YES | PARTIAL | YES | UNKNOWN | NO |
| Human Action approval/start | YES | YES (local E2E + UI) | YES | PARTIAL | NO |
| Human Action report to Observation | YES | YES (`npm run e2e:human`) | YES | UNKNOWN | NO |
| Human Action FAILED cycle (blockers) | YES | YES (`npm run e2e:human`) | YES | UNKNOWN | NO |
| Claim creation + evidence link + adjudication | YES | YES (`npm run e2e:human`, 14 boundaries) | YES | UNKNOWN | NO |
| Claims/evidence UI panel | YES | YES (browser-verified local) | YES | UNKNOWN | NO |
| Controlled Action path | YES | PARTIAL | YES | NO EVIDENCE | NO |
| Worker lease/start/finish | YES | PARTIAL | YES | NO EVIDENCE | NO |
| Hermes execution | YES | CONTRACT ONLY | YES | NO | NO |
| OpenCode execution | YES | CONTRACT ONLY | YES | NO | NO |
| Browser voice input | UI ONLY | UNVERIFIED | YES | UNKNOWN | NO |
| Vercel cron | CONFIGURED | UNVERIFIED | YES | UNKNOWN | NO |
| Playwright/browser capability | NO | NO | NO | NO | NO |
| Crawlee/Crawl4AI/Apify-like capability | NO | NO | NO | NO | NO |
| Saved social-content connectors | NO | NO | NO | NO | NO |
| Media/document ingestion stack | NO | NO | NO | NO | NO |
| General MCP runtime | NO | NO | NO | NO | NO |
| Proactive continuity | NO | NO | NO | NO | NO |

## Test evidence

Repository contains tests for actor normalization, conversation stream/parsing/commit behavior, human observation parsing, Exa adapter behavior, Firecrawl/source handling, and worker contracts. `npm test` = 51/51 passing (2026-09-30).

CI runs `npm test`, typecheck, lint, and build on every push (ci.yml).

`npm run e2e:human` (deterministic, needs dev server) drives the real authenticated routes/RPCs through 14 boundaries: pursuit creation, seeded working state, action start + authorization commit + start dedupe, completion with report → observation → exactly-once turn persistence, turn-key replay idempotency, active-action query, FAILED cycle with blockers, claim creation (REPORTED) → evidence link (auto OBSERVED) → human adjudication (VERIFIED) → invalid-relation rejection. Model-dependent steps run in designed fallback mode and are asserted as fallbacks, never as model success. Last full pass: 2026-09-30, 14/14.

Browser verification (2026-09-30, local dev): sign-in → pursuit creation → new conversation → message persisted → /work fails safely with 402 (no fabricated assistant or working state) → reload restores history/session → claims panel creates a claim and adjudicates it to verified.

Supabase SQL verification scripts exist for execution control, Run lifecycle, model boundary, and adaptive pursuit. Their presence is not execution evidence.

## Live database security fixes applied 2026-09-30

- `pursuit_source_citation` INSERT policy tautology (`s.pursuit_id = s.pursuit_id`) replaced with the correct source↔pursuit join.
- anon/PUBLIC EXECUTE revoked on `stryde_commit_intervention`, `stryde_create_claim`, `stryde_create_thread`.
- Owner INSERT policies added for `event`, `claim_status_event`, `claim_observation_link` (user-path RPC audit writes previously failed with 42501).
- `claim` owner UPDATE policy added (FOR UPDATE lock silently skipped rows before).
- `stryde_adjudicate_claim` re-issued as service-role-gated (p_actor_id); new `stryde_link_claim_observation` likewise; old signatures revoked. Epistemic transitions only happen behind the trusted control plane, matching `stryde_validate_semantics`.

All four migrations (20260930000000/010000/020000/030000/040000) are applied to the linked project and registered in its migration history.
