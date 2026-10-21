## Runtime checkpoint — 2026-10-22 (R-1, R-2, R-3, R-6 verified across all integration boundaries on fix/conversation-turn-reliability)

- Branch `fix/conversation-turn-reliability` resolves all independently identified release blockers:
  - **R-1:** `buildSourceCitation` returns `null` for unlocatable statements (eliminating full-source `located:false` fallback stubs). In both `/sources` and research orchestration, mixed claims (`0 < citations.length < claims.length`) persist defensible citations while updating adaptation to `INCOMPLETE` with `partial_evidence: true` and demoting unsupported methods to `UNVERIFIED`. Citation persistence failures update adaptation to `INCOMPLETE` with `citation_error` logged via `trustedPlane`.
  - **R-2:** `supersedeAdaptation` and `updateAdaptationAuditStatus` fail closed on empty update results (`affectedCount: 0`). Orchestration aborts inserting new adaptation on both the normal try path and error catch path if supersession fails.
  - **R-3:** `executeWebResearch` writes `pursuit_id` to observation `content`, `raw_payload`, and `source_metadata`. `assembleAdaptiveSituation` enforces a strict cross-pursuit guard: drops observations whose explicit `pursuit_id` belongs to another pursuit, even when sharing a `source_uri`, while preserving source-less observations for the active pursuit.
  - **R-6:** Direct `/sources` URL extraction uses atomic `reserveResources` + `reconcile` / `release` on `source_extraction` quota, returning HTTP 429 on exhaustion and HTTP 503 on reconciliation failure, eliminating concurrency races.
- All 332 tests pass (`npm test`). `npx tsc --noEmit` clean. ESLint 0 errors, 0 warnings. Next.js Turbopack production build clean across all routes. Production audit 0 vulnerabilities.

## Runtime checkpoint — 2026-10-21 (R-1, R-2, R-3, R-6, R-7, R-8 closed on fix/conversation-turn-reliability)

- Branch `fix/conversation-turn-reliability` implements and verifies all core release-hardening defects:
  - **R-1:** Exact text excerpt and locator match against actual external source; no arbitrary fallback; honest `INCOMPLETE` marking on persistence failure.
  - **R-2:** `supersedeAdaptation` and `updateAdaptationAuditStatus` executed via `trustedPlane` with owner and pursuit scoping.
  - **R-3:** Pursuit-scoped search observations preserved in `assembleAdaptiveSituation`.
  - **R-4:** Pre-stream research blocker guard avoids ungrounded model hallucination.
  - **R-6:** `checkAutoResearch` enforced in `/work`, `research_rounds` reservation/reconciliation lifecycle in background worker, `source_extractions` metered in `/sources`, `model_turns` metered on blocker turn.
  - **R-7:** Context compiler preserves all adaptation audit metadata.
  - **R-8:** Provider configuration supports `STRYDE_SEARCH_PROVIDER=auto`.
- All 317 tests pass. Next.js Turbopack production build succeeds with 0 errors. Production audit reports 0 vulnerabilities.

## Runtime checkpoint — 2026-10-21 (R-1 & R-4 verified on fix/conversation-turn-reliability)

- Branch `fix/conversation-turn-reliability` implements schema-conforming citation persistence for defect R-1:
  - Post-research roadmap adaptation cites retrieved external `pursuit_source` rows, populating required fields (`owner_user_id`, `pursuit_id`, `source_id`, `adaptation_id`, `source_content_sha256`, `locator` with `claim_text`, `excerpt`, `basis`).
  - Insertion failures are explicitly handled; adaptation is marked `audit_status: "INCOMPLETE"` with `citation_error` documented and methods demoted to `UNVERIFIED`.
  - Verified by `tests/research-citation-persistence.test.ts` (4/4 passed).

- Branch `fix/conversation-turn-reliability` implements pre-stream research-blocker interception for defect R-4:
  - If `researchBlocker` is detected during conversation turn setup (due to `checkAutoResearch` refusing automatic execution, unconfigured provider, quota exhaustion via `reserveResources`, or provider outage), the route does not invoke `streamConversationTurn`.
  - Honest blocker guidance is streamed via SSE (`message_delta`), saved to database via `stryde_commit_conversation_turn` with `p_working_state` updated to `WAITING_USER` / `WAITING_EXTERNAL`, and completed with `complete` event without model token consumption.
  - Verified by `tests/research-blocked-ungrounded-guard.test.ts` across streaming and non-streaming contracts.

- Branch `fix/conversation-turn-reliability` is synchronized with `main` at commit `5259e7d0004000b3459e2a7ce7f9d6371a6feecc`.
- Production is live on `main` at `68f98517522ea8d50311b53aebaf3974217216c9` (Vercel deployment `7232279533` / `U9TyZuZdtBFRAckVU7Hp7NRdbWD8`, READY), aliased to `https://stryde-topaz.vercel.app`.
- Next.js 16.4.2 + puppeteer-core 25.14.0 live in production; `npm audit --omit=dev` verified clean with 0 vulnerabilities.
- GitHub Actions CI run `39640958877` (`verify`) PASSED on merge commit `68f9851`.
- Live smoke test results:
  - `/`: HTTP 200 (Turbopack SSR / static shell rendered).
  - `/api/health/model`: HTTP 200 (OpenRouter / Gemini chain configured, `ready: true`).
  - `/api/v1/pursuits`: HTTP 401 Unauthorized (auth boundary verified).
- Single Supabase instance: `pvijrnwdnolvnoibarrj` remains active with 41 migrations; no DDL in this release. Test records from pre-merge verification are isolated under test user `5b1dbe29-d6b7-4c0f-86bd-f285b4465a37` by RLS.
- Engineering control plane recorded at `docs/ENGINEERING_CONTROL_PLANE.md`.

## Runtime checkpoint — 2026-10-18 (`fix/conversation-turn-reliability` historical)

- Local branch `fix/conversation-turn-reliability` resolves the observed Turn 2 conversation failure (`CREATE_ACTION` work-mode rejection in `lib/work-controller.ts`, retry amplification on `ModelProviderError` in `lib/model-gateway.ts` and `lib/adaptive-model.ts`, and stale `session.working_state` fallback in `app/api/v1/pursuits/[id]/conversation/route.ts`) as well as the false `"Conversation archived"` reload state in `app/pursuits/[id]/page.tsx`.
- Trigger → dispatcher job enqueueing (`lib/trigger-engine.ts`), the pursuit artifacts UI panel (`app/pursuits/[id]/artifacts-panel.tsx`), and regression tests for all authenticated-callable `SECURITY DEFINER` RPCs (`tests/trusted-plane-rpc-grants.test.ts`) are implemented and verified locally (`npm test` 262/262, `tsc --noEmit`, `npm run lint`, `npm run build`).

## Runtime checkpoint — 2026-10-17 (historical)

- Current production deployment is `dpl_HxMc5YPcdgndAT9KnvaEHYNQKm2G`, READY, built from main commit `1df79487da20bd4066e7ff492f6851c0960e6141`, aliased to `stryde-topaz.vercel.app`.
- Live `/api/health/model` returns HTTP 200 and resolves OpenRouter / `nvidia/nemotron-3-super-120b-a12b:free`, Gemini fallback / `gemini-flash-latest`, OmniRoute disabled. It is configuration evidence, not generation evidence.
- Supabase now records 41 migrations. The 2026-10-17 access-hardening migration is applied as version `20261017185728`.
- Post-migration privilege verification confirms authenticated clients cannot execute the eight trusted-plane resource/trigger RPCs; `service_role` can. Artifact revision remains authenticated but now binds its actor to `auth.uid()`. The resource-window helper's search path is fixed to `pg_catalog`.
- Vercel’s aggregated error query returned no grouped runtime errors in the last seven days. A recent 30-minute error-log query returned no entries. Because this project is on Hobby and runtime-log retention is short, this is not proof of the absence of failures.
- **Still unproven:** a fresh authenticated, two-turn production conversation with valid structured output and persisted adaptive state. A health check and READY deployment do not substitute for that journey.
- **Other blockers:** Exa/Firecrawl production credentials absent; worker runtime not established; trigger-to-dispatcher end-to-end path needs proof; artifact UI remains to be surfaced; leaked-password protection is disabled.

CONFIRMED:
- Production is currently `dpl_2w7iPjCcKAWZmQ8VdaJ8CeLb5XcP`, READY, from main commit `1e3b7d7`.
- Current GitHub Actions `verify` check on `1e3b7d7` is SUCCESS.
- Vercel project plan is Hobby.
- `/api/health/model` currently resolves to OpenRouter with model `nvidia/nemotron-3-super-120b-a12b:free`, Gemini fallback `gemini-flash-latest`, OmniRoute disabled.
- Supabase migration parity is now 37/37; skills, agent preference, funnel instrumentation tables are live.
- The current runtime error aggregation retains one 55-second conversation timeout signal last seen at 2026-10-06T15:59:52Z on an older deployment. Do not call this resolved until a fresh current-production conversation proves it.
- No runtime logs were available in the most recent 30-minute window; this is simply an empty query result, not a production-health certificate.

### Current production proof gap

The important next verification is a fresh authenticated production conversation against current main after the streaming malformed-output failover repair. It must prove:

`signup/login or confirmed existing user → pursuit → conversation turn → structured output → adaptive state update → subsequent turn`

A health endpoint or deployment READY status is insufficient proof of generation reliability.

### Engineering direction after proof

Once the production conversation is re-proven, stop doing closure archaeology and move to Issue #7 / `docs/GLM_MASTER_IMPLEMENTATION_BRIEF.md`: unified capability registry, discovery/eligibility, entitlement/resource enforcement, Skills V2, dynamic MCP discovery, adaptive research planner, scheduler, artifacts, notifications, task-aware routing, and task-local delegation.
