## 2026-10-30 — Stryde Pre-Launch Verification, AppSec Hardening & Legal Compliance Mandate Complete (`ops/agent-maintainability-production-readiness`)

### Branch status
- Branch: `ops/agent-maintainability-production-readiness` on [PR #15](https://github.com/haseeb-builds/stryde/pull/15), base `main` at `f1d2cd0161cfa7f5189f6e363a0e87818145589b`.
- **Pre-Launch Engineering, Legal & AppSec Outcomes:**
  - **Statutory Legal & Privacy Compliance Harmonization:**
    - Corrected table count in `app/privacy/page.tsx` from outdated 30 to 40 verified user-scoped tables matching `lib/account-deletion.ts` (`ORDERED_USER_TABLES`).
    - Added statutory financial tax retention clause documenting mandatory 7-year invoice retention under UK HMRC / EU VAT laws for Paddle.com (Merchant of Record).
    - Added essential authentication cookies and local storage disclosures (`sb-*-auth-token`).
    - Added COPPA & GDPR Art. 8 age restrictions (13+ US, 16+ EEA/UK).
    - Clarified transient model data processing with zero foundation model training under commercial enterprise API terms.
    - Added Data Subject Access Request (DSAR) and portability procedure with 30-day statutory response timeline via `privacy@stryde.dev`.
    - Added Delaware governing law, informal dispute resolution, AAA binding individual arbitration, class action waiver, and comprehensive limitation of liability in `app/terms/page.tsx`.
    - Verified by new test suite `tests/legal-compliance-disclosures.test.ts` (3/3 pass).
  - **AppSec Hardening (0 to 100):**
    - Hardened SSRF defense in `lib/sanitization.ts` and `lib/ssrf.ts`: comprehensive detection and rejection of private IPv4 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16 metadata, 0.0.0.0/8, CGNAT 100.64.0.0/10, multicast/reserved), decimal/hex/octal encoded IP bypasses (e.g. 2130706433, 0x7f000001, 0177.0.0.1), IPv6 loopback (::1, ::), IPv4-mapped IPv6 hex variations (::ffff:7f00:1), unique local (fc00::/7), link-local (fe80::/10), and internal TLDs (`.local`, `.internal`, `.localhost`, `.lan`, `.localdomain`, `.home.arpa`).
    - Verified by `tests/markdown-sanitization.test.ts` (11/11 pass) and `tests/page-fetch-ssrf.test.ts` (3/3 pass).
  - **Rendered Visual QA (Real Browser Verification):**
    - Rendered live application via Puppeteer across desktop (1440×900), common laptop (1280×800), and mobile (390×844).
    - Verified intake composer, live goal input, accessible auth modal with backdrop blur and form controls, `/privacy`, and `/terms`.
    - Checked against `docs/AI_WEBSITE_DESIGN_ANTI_PATTERNS.md` (high contrast WCAG AA, no generic violet gradients, no fake controls, zero horizontal clipping).
  - **Verification Matrix:**
    - Full test suite: **424 passed, 0 failed across 53 test suites**.
    - TypeScript: **0 errors** (`npx tsc --noEmit`).
    - ESLint: **0 errors, 0 warnings** (`npm run lint`).
    - Supply chain audit: **0 vulnerabilities** (`npm audit --omit=dev`).
    - Production build: **Clean Turbopack compile across all 32 static/dynamic routes** (`npm run build`).

## 2026-10-28 — Stryde Agent-Maintainability and Production-Readiness Mandate Final Verification Complete (`ops/agent-maintainability-production-readiness`)

### Branch status
- Branch: `ops/agent-maintainability-production-readiness` on [PR #15](https://github.com/haseeb-builds/stryde/pull/15), base `main` at `f1d2cd0161cfa7f5189f6e363a0e87818145589b`.
- **Engineering Outcome:**
  - Full execution of `docs/AGENT_MAINTAINABILITY_AND_PRODUCTION_READINESS_MANDATE.md` complete and verified.
  - Durable progress ledger maintained at `docs/EXECUTION_LOG_MANDATE_20261027.md`.
  - 416/416 unit/integration tests passing across 52 test suites (0 failed).
  - TypeScript clean (`npx tsc --noEmit`), ESLint clean (`npm run lint`), zero production CVEs (`npm audit --omit=dev`), Next.js Turbopack build clean (32 static/dynamic routes compiled).
  - CodeRabbit PR #14 findings (all 24 threads) triaged, resolved, and verified.
  - **Correctness & Security Remediations Delivered (TDD):**
    1. Turn Idempotency (`lib/idempotency.ts`): Deterministic RFC 4122 v5 UUID mapping over fixed namespace preventing Postgres UUID cast crashes, header/body precedence resolution, duplicate vs conflicting payload 409 handling.
    2. Model Provider & AI Request Boundaries (`lib/model-provider.ts`, `lib/model-gateway.ts`): Stream cancellation propagation via AbortController, `120_000` chars assembled prompt limit, structured prompt injection delimiters (`<<<UNTRUSTED_INPUT_DATA>>>`) and escaping.
    3. Account Deletion & Concurrent Write Barrier (`lib/account-deletion.ts`, `app/api/v1/user/account/route.ts`, `lib/supabase/server.ts`): Write barrier enforced via `auth.admin.updateUserById(cleanUserId, { app_metadata: { deletion_in_progress: true } })` locking out concurrent user API requests (`AccountDeletionLockedError` / HTTP 423), cancellation of queued/leased worker jobs, Paddle Billing v2 subscription cancellation first across all active/billable/retryable states (`ACTIVE`, `TRIALING`, `PAST_DUE`, `PAUSED`, `UNKNOWN`), topological leaf-to-root purge of 40 real user-scoped tables, retryable via `{ allowDeletionInProgress: true }`, fail-closed auth identity retention.
    4. Paddle Webhook Atomic Deduplication & Ordering (`supabase/migrations/20261027180000_billing_webhook_atomic_ledger.sql`, `lib/paddle-webhook.ts`): Durable ledger table, first-delivery atomic claim via `INSERT ... ON CONFLICT DO NOTHING`, payload SHA-256 conflict detection (HTTP 409), canonical outcome preservation (conflicting deliveries do NOT overwrite completed events, preventing re-processing), subtransaction failure persistence, safe quarantine preserving existing paid entitlements, removal of unsafe read-then-upsert fallback (fails retryable HTTP 500 when RPC is missing to await migration), 409 Conflict with Retry-After on concurrent delivery, stale event rejection.
    5. URL & Markdown Sanitization (`lib/sanitization.ts`, `markdown-content.tsx`): Strict blocking of protocol-relative backslash variations (`/\`, `\\`, `/\\`), code block protection during HTML tag stripping.
    6. Cross-Tenant Authorization: Verified `auth.uid()` caller validation across 5 `SECURITY DEFINER` functions, documented `public.loops` as intentionally deny-all.
    7. Privacy & Terms Pages: Created `app/privacy/page.tsx` and `app/terms/page.tsx` strictly based on verified data flows and actual subprocessors.
    8. Health Check: Added `app/api/health/route.ts` lightweight probe; verified `app/api/health/model/route.ts` has zero secret leakage and bounded 60s probe caching.
    9. CI Alignment: Updated `.github/workflows/ci.yml` from Node 22 to Node 24 matching Vercel and local environments.

## 2026-10-22 — Engineering-Complete V1 Candidate & Google Stitch Handoff Pack (`fix/conversation-turn-reliability`)

### Branch status
- Branch: `fix/conversation-turn-reliability` on PR #13, base `main` at `5259e7d0004000b3459e2a7ce7f9d6371a6feecc`.
- **Engineering Outcome:**
  - Codebase is engineering-complete, verified, and ready for founder Google Stitch pass.
  - 342/342 unit/integration tests passing. Clean TypeScript (`npx tsc --noEmit`), clean ESLint (`npm run lint`), clean Next.js Turbopack production build (`npm run build`), 0 production CVEs (`npm audit --omit=dev`).
  - Hosted CI is green (`verify` job `119561831989`).
  - Vercel Preview is READY (`6YZLWepW18VxCHRY7mXwi2p3b5fx`).
- **Complete Stitch & Founder Handoff Pack Delivered:**
  1. `docs/STITCH_DESIGN_BRIEF.md`: Visual and interaction design brief with ready-to-paste Stitch prompt.
  2. `docs/STITCH_INTEGRATION_CONTRACT.md`: Technical boundary specs for importing Stitch components into Next.js.
  3. `docs/MANUAL_SETUP_AND_ENVIRONMENT_CHECKLIST.md`: Discovered env var inventory, secrets setup, and staging database requirements.
  4. `docs/DEFERRED_WORK_AND_LAUNCH_BLOCKERS.md`: Decision ledger defining owners, acceptance tests, and severity for deferred items.
  5. `docs/POST_STITCH_FINAL_VERIFICATION_MANDATE.md`: Executable `/goal` prompt for post-Stitch verification and pre-launch gating.

## 2026-10-22 — Observation Retrieval Scoping, Worker Honesty, and Secondary Citation Audit Persistence verified (`fix/conversation-turn-reliability`)

### Branch status
- Branch: `fix/conversation-turn-reliability` on PR #13, base `main` at `5259e7d0004000b3459e2a7ce7f9d6371a6feecc`.
- **Independently Identified Gaps Resolved & Verified (TDD):**
  - **Observation Retrieval Contract & Scoping (`lib/pursuit-observations.ts`):**
    - `fetchPursuitObservations`, `isSelectableObservationForClaim`, and `formatObservationOptionLabel` strictly scope observation queries to `owner_user_id` and active `pursuit_id`.
    - Integrated with `/api/v1/pursuits/[id]/observations` and `claims-panel.tsx` to provide selectable search evidence with human-readable labels instead of raw ontology strings.
    - Verified by `tests/pursuit-observations.test.ts` (6/6).
  - **Worker Execution Honesty & Fallback Controls (`page.tsx` & `work-panels.tsx`):**
    - Fixed worker trapping defect by enabling manual "I'm done" and "I'm blocked" buttons for both `HUMAN` and `CONTROLLED` moves.
    - Added transparent disclosure when automated worker daemons are not running in the environment.
  - **Secondary Citation Ingestion Audit Status Persistence:**
    - Updated `adaptAndStoreSource` in `lib/source-adaptation-store.ts`, `lib/universal-input.ts`, and `app/api/v1/pursuits/[id]/research/route.ts` to call `updateAdaptationAuditStatus` via `trustedPlane` on unlocatable claims (`unsubstantiated: true`), citation persistence failures (`citation_error`), and partial evidence (`partial_evidence: true`), demoting methods to `UNVERIFIED`.
    - Verified by `tests/source-adaptation-audit.test.ts` (3/3).
  - **Model Provider Failover & Retry Expanded (TDD):**
    - Expanded test coverage in `tests/model-provider-retry.test.ts` for HTTP 429 rate limit retries and failover across providers, malformed JSON recovery, and immediate abort cancellation (`AbortError`) with zero retries/failover.
    - Verified by `tests/model-provider-retry.test.ts` (6/6).
- **Full Verification Suite:**
  - `node --experimental-strip-types --test tests/**/*.test.ts`: **342/342 tests passing across 46 test suites**.
  - `npx tsc --noEmit`: **0 errors**.
  - `npm run lint`: **0 errors, 0 warnings**.
  - `npm run build`: **Clean Turbopack compile across all 25 routes**.
  - `npm audit --omit=dev`: **0 vulnerabilities**.

## 2026-10-22 — Independently identified release blockers closed & verified: R-1, R-2, R-3, R-6 (`fix/conversation-turn-reliability`)

### Branch status
- Branch: `fix/conversation-turn-reliability` on PR #13, base `main` at `5259e7d0004000b3459e2a7ce7f9d6371a6feecc`.
- **Independently Identified Release Blockers Resolved & Verified (TDD):**
  - **R-1 (Citation Semantics Across All Paths):**
    - `buildSourceCitation` returns `SourceCitation | null`; unlocatable statements return `null` instead of generating fallback stubs with `located: false`.
    - `findSupportingSource` searches candidate sources without falling back to unrelated sources.
    - Research orchestration and direct `/sources` route handle mixed claims (`0 < citations.length < claims.length`): inserts valid citations, updates adaptation to `INCOMPLETE` with `partial_evidence: true`, and demotes unsupported methods to `UNVERIFIED`.
    - Citation persistence failures explicitly update adaptation to `INCOMPLETE` via `trustedPlane` with `citation_error` documented and return clear warning messages.
    - Verified by `tests/source-citation.test.ts`, `tests/research-citation-persistence.test.ts`, and `tests/research-citation-integrity.test.ts` (5/5).
  - **R-2 (Adaptation Supersession & Audit Status Persistence):**
    - `supersedeAdaptation` and `updateAdaptationAuditStatus` fail closed (`affectedCount: 0`, `success: false`) if result data is empty or not an array.
    - Both normal try path and error catch path in `executeResearchAndRoadmapOrchestration` abort inserting a new adaptation if supersession fails or returns 0 affected rows.
    - Verified by `tests/adaptation-supersession.test.ts` (7/7).
  - **R-3 (Search Observation Contract & Cross-Pursuit Isolation):**
    - `executeWebResearch` writes `pursuit_id: pursuitId` inside `content`, `raw_payload`, and `source_metadata`.
    - `assembleAdaptiveSituation` enforces a strict cross-pursuit guard: drops any observation whose explicit `pursuit_id` (`content.pursuit_id` or `source_metadata.pursuit_id`) does not match the active `pursuitId`, even if the observation shares a `source_uri` with the pursuit's sources.
    - Preserves source-less observations belonging to the target pursuit.
    - Verified by `tests/search-observations-situation.test.ts` (3/3).
  - **R-6 (Source Extraction Atomic Quota & Concurrency Safety):**
    - Direct `/sources` URL extraction uses atomic reservation lifecycle: `reserveResources` for `source_extraction: 1`, followed by `reconcile` on success or `release` on failure.
    - Denial throws `ResourceExhaustedError` and returns HTTP 429 ("Daily plan limit reached for source extractions").
    - Ingestion failures or reconciliation failures release reservations and fail closed (HTTP 503).
    - Prevents race conditions and double reservations under concurrent load.
    - Verified by `tests/source-extraction-concurrency.test.ts` (5/5) and `tests/resource-autonomy-controls.test.ts`.
- **Full Verification Suite:**
  - `npm test`: **332/332 tests passing** (all 47 test files passing).
  - `npx tsc --noEmit`: **0 errors**.
  - `npm run lint`: **0 errors, 0 warnings**.
  - `npm run build`: **Clean Turbopack compile across all 25 routes in 2.4s**.
  - `npm audit --omit=dev`: **0 vulnerabilities**.

## 2026-10-21 — Core release-hardening defects closed & verified: R-1, R-2, R-3, R-6, R-7, R-8 (`fix/conversation-turn-reliability`)

### Branch status
- Branch: `fix/conversation-turn-reliability` on PR #13, base `main` at `5259e7d0004000b3459e2a7ce7f9d6371a6feecc`.
- **All Core Release-Hardening Defects Closed & Verified (TDD):**
  - **R-1 (Citation Integrity & Schema):**
    - Enforced exact source text slicing for citation `excerpt` and exact character range `locator` matching.
    - Exported and integrated `findSupportingSource` and `validatePursuitSourceCitationRow`.
    - Eliminated arbitrary fallback to unrelated sources.
    - On citation insertion failure or missing evidence, marks adaptation `INCOMPLETE` with `UNVERIFIED` methods and logs `citation_error` via `trustedPlane`.
    - Verified by `tests/source-citation.test.ts` (8/8), `tests/research-citation-persistence.test.ts` (4/4), and `tests/research-citation-integrity.test.ts` (3/3).
  - **R-2 (Adaptation Supersession & RLS):**
    - Supersedes v1 adaptation and updates audit status strictly through `trustedPlane` (`service_role`), overcoming missing `UPDATE` policy on `public.pursuit_source_adaptation`.
    - Strictly scoped to `owner_user_id` and `pursuit_id` with affected row count assertions.
    - Verified by `tests/adaptation-supersession.test.ts` (5/5).
  - **R-3 (Search Observations Situation Assembly):**
    - Preserves source-less `WEB_SEARCH_RESULT` observations tagged with `pursuit_id` in `assembleAdaptiveSituation`.
    - Ensures search observations reach context compiler and prompt context.
    - Verified by `tests/search-observations-situation.test.ts` (1/1).
  - **R-4 (Blocked Research Ungrounded Output Prevention):**
    - Verified pre-stream interceptor in `/conversation` route prevents ungrounded model output when research is blocked, streaming honest SSE blocker messages.
    - Verified by `tests/research-blocked-ungrounded-guard.test.ts` (6/6).
  - **R-6 (Resource & Autonomy Controls):**
    - Enforced `checkAutoResearch(userPolicy)` in `/work` and guarded research execution with `research_rounds` reservation and release/reconciliation.
    - Added `source_extractions` quota enforcement and usage recording in `/sources`.
    - Metered `model_turns` usage in `/conversation` blocker path.
    - Verified by `tests/resource-autonomy-controls.test.ts` (4/4).
  - **R-7 (Context Compiler Roadmap Integrity):**
    - Preserves full roadmap audit fields in `lib/context-compiler.ts`: `methods` (with `audit_status`), `assumptions`, `prerequisites`, `expected_outcomes`, `unknowns`, `fit`, `gaps`, `conflicts`, `adapted_strategy`, `goal_candidates`, `source_claims`, and `provenance`.
    - Verified by `tests/context-compiler-roadmap-integrity.test.ts` (1/1).
  - **R-8 (Provider Configuration Mismatch):**
    - Implemented `STRYDE_SEARCH_PROVIDER=auto` in `lib/search-provider.ts` with provider chain fallback (Exa -> Firecrawl).
    - Verified by `tests/search-provider-auto.test.ts` (3/3).
  - **R-5 (Ledger Verification):**
    - Confirmed no independent R-5 defect exists; ledgering and atomic reservations are handled via `stryde_record_resource_usage` and `stryde_reserve_resources`.
- **Full Verification Suite:**
  - `npm test`: **332/332 tests passing** across all 47 test files.
  - `npx tsc --noEmit`: **0 errors**.
  - `npm run lint`: **0 errors, 0 warnings**.
  - `npm run build`: **Clean Turbopack compile across all 25 routes in 3.2s**.
  - `npm audit --omit=dev`: **0 vulnerabilities**.

# Stryde Handoff

## 2026-10-21 — R-1 implemented & verified: citation persistence and schema reconciliation (`fix/conversation-turn-reliability`)

### Branch status
- Branch: `fix/conversation-turn-reliability` on PR #13, base `main` at `5259e7d0004000b3459e2a7ce7f9d6371a6feecc`.
- **Defect R-1 implemented & verified (TDD):**
  - Inspected real PostgreSQL migration schema for `public.pursuit_source_citation` (`owner_user_id`, `pursuit_id`, `source_id`, `adaptation_id`, `source_content_sha256`, `locator`, `excerpt`, `basis`).
  - Added `validatePursuitSourceCitationRow` and `PursuitSourceCitationInsert` to `lib/source-citation.ts` to enforce schema constraints and reject legacy incompatible columns (`quote`, `content_sha256`, `locator_type`, `metadata`, `exact_match`, `verification_status`).
  - In `lib/research-orchestration.ts`, replaced incompatible citation payloads with schema-conforming rows. Linked citations to the actual retrieved external `pursuit_source` rows, preserving real content hashes and locator character ranges with `claim_text` in locator JSONB, rather than citing the pasted roadmap.
  - Stopped swallowing insert failures: if citation insertion fails, the adaptation is updated to record `audit_status: "INCOMPLETE"`, methods demoted to `"UNVERIFIED"`, and `citation_error` documented, ensuring Stryde never falsely claims evidence was persisted.
  - Verified by regression suite `tests/research-citation-persistence.test.ts` (4/4 passed).
  - Full test suite: 300/300 passing.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run lint`: 0 errors.
  - `npm run build`: clean Turbopack compile across all 25 routes.
  - `npm audit --omit=dev`: 0 vulnerabilities.

## 2026-10-21 — R-4 implemented & verified: ungrounded model stream blocked when research is impeded (`fix/conversation-turn-reliability`)

### Branch status
- Synchronized with `origin/main` at commit `5259e7d0004000b3459e2a7ce7f9d6371a6feecc` (incorporating Next.js 16.4.2, puppeteer-core 25.14.0, zero production CVEs, and `docs/ENGINEERING_CONTROL_PLANE.md`).
- **Defect R-4 implemented & verified (TDD):**
  - Added `buildBlockedResearchTurn` in `lib/research-orchestration.ts` to construct deterministic blocker turns, honest messaging explaining why research was not performed (unauthorized, unconfigured, budget exhausted, or unavailable), appropriate interactive options, and updated working state (`WAITING_USER` / `WAITING_EXTERNAL`, `ASK_USER`, bottleneck recorded).
  - Added pre-stream interceptor in `app/api/v1/pursuits/[id]/conversation/route.ts` inside `ReadableStream.start`. When `researchBlocker` is present, `streamConversationTurn` is never called. Blocker text is emitted directly as `message_delta` SSE chunks and committed synchronously to `stryde_commit_conversation_turn` before the `complete` event.
  - Eliminated token waste, redundant provider charges, and ungrounded model hallucinations when research cannot run.
  - Verified across SSE streaming and non-streaming / replayed turn contracts via `tests/research-blocked-ungrounded-guard.test.ts` (6/6 tests passing).
  - Full test suite: 296/296 passing.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run lint`: 0 errors.
  - `npm run build`: clean Turbopack compile across all 25 routes.
  - `npm audit --omit=dev`: 0 vulnerabilities.

## 2026-10-21 — security baseline released to production (current production truth)

### What just changed
- **PR #9 squash-merged to main:** commit `68f98517522ea8d50311b53aebaf3974217216c9` merged with head guard on `f0eeefa`.
- **Production deployment READY:** Vercel deployment `7232279533` (`U9TyZuZdtBFRAckVU7Hp7NRdbWD8`) on `68f9851` is live at `https://stryde-topaz.vercel.app`.
- **CI green on main:** GitHub Actions run `39640958877` (`verify`) passed all unit tests, typecheck, lint, audit, and build.
- **Production audit clean:** Next.js 16.4.2 + puppeteer-core 25.14.0 live with 0 production vulnerabilities.
- **Safe production smoke test passed:** HTTP 200 on landing, HTTP 200 on `/api/health/model`, HTTP 401 on unauthenticated `/api/v1/pursuits`.
- **Database disclosure:** PR #9 contained 0 DDL migrations. Isolated test records from local pre-merge E2E runs are preserved in Supabase project `pvijrnwdnolvnoibarrj` under test user `5b1dbe29-d6b7-4c0f-86bd-f285b4465a37` (protected by RLS).

## 2026-10-21 — `fix/conversation-turn-reliability` correctness-closure pass (historical)

### What changed in this correctness-closure pass

1. **Resource Safety & Reservation Lifecycle (`lib/resource-control.ts`, `lib/research-orchestration.ts`, `app/api/v1/pursuits/[id]/conversation/route.ts`):**
   - Replaced naive availability checks with `reserveResources` for `research_rounds`.
   - Distinctly differentiated quota exhaustion (`ResourceExhaustedError`, mapped to `BUDGET_EXHAUSTED` blocker) from RPC / database connection failures (mapped to `UNAVAILABLE` blocker), failing closed without calling external research providers.
   - Guaranteed `releaseReservations` on error, cancellation, or abort.
   - Guaranteed `reconcileReservation` with actual consumption on research success.
   - Idempotent replay protection: checks for consumed reservation on `research:${turnKey}` to avoid double-charging or re-running unmetered work on replayed turns.
2. **Natural Goal Intent Across Domains (`lib/research-orchestration.ts`):**
   - Implemented `detectPursuitGoalIntent` recognizing goal-seeking language for fitness/health, career/learning, business, tech, and roadmap audits.
   - Decoupled pursuit goal recognition from research necessity: casual banter, greetings, and mere mentions do not trigger deep web research.
3. **Roadmap Audit Intake & Post-Research Adaptation (`lib/universal-input.ts`, `lib/research-orchestration.ts`):**
   - Retained original submitted roadmap unchanged in `pursuit_source`.
   - Forced preliminary intake methods unconditionally to `UNVERIFIED` before evidence acquisition.
   - Re-evaluated roadmap post-research against retrieved evidence to create version 2 with linked citations in `pursuit_source_citation` and explicit statuses (`KEEP`, `CHANGE`, `REMOVE`, `MISSING`, `UNVERIFIED`, `NEEDS_EXPERIMENT`).
   - If model analysis fails, persists v2 marked `INCOMPLETE` with `UNVERIFIED` methods, ensuring preliminary steps never masquerade as verified findings.
   - Avoids creating duplicate versions on retries.
4. **Real Retrieval Status & Locators (`lib/research-execution.ts`):**
   - Explicitly differentiates `FULL_TEXT`, `PARTIAL_CONTENT`, `PAYWALLED`, `SNIPPET`, `INACCESSIBLE`, and `TRANSCRIPT_UNAVAILABLE`.
   - Never mislabels partial extracts as `FULL_TEXT`.
   - Sets `primary_source_traced: locator_type === "FULL_TEXT"`.
5. **Comprehensive Verification & Regression Suite (`tests/research-first-orchestration.test.ts`):**
   - 25 route-level integration tests exercising `executeResearchAndRoadmapOrchestration` and `detectPursuitGoalIntent`.
   - Entire test suite: **289/289 tests passing**.
   - `npx tsc --noEmit`: 0 errors.
   - `npm run lint`: 0 errors, 0 warnings.
   - `npm run build`: Production Next.js Turbopack build succeeds in 8.4s.

## 2026-10-18 — `fix/conversation-turn-reliability` engineering completion (historical)

### What changed on `fix/conversation-turn-reliability`

1. **Resolved Second-Turn Production Failure & Retry Amplification (`lib/work-controller.ts`, `lib/adaptive-work-controller.ts`, `lib/model-gateway.ts`, `lib/adaptive-model.ts`, `app/api/v1/pursuits/[id]/conversation/route.ts`):**
   - Added `"CREATE_ACTION"` to `AVAILABLE_WORK_MODES` in `lib/work-controller.ts` so `validateWorkingState` no longer rejects Turn 2+ outputs when the model converges to `CREATE_ACTION`.
   - Aligned `validateWorkingState` and `validateWorkingStateShape` to normalize status aliases, normalize `next_move.mode` case/separators, accept `version: 1 | "1"`, accept string/boolean `ready_for_reasoning`, and slice `known`/`unknowns` arrays to `MAX_ITEMS` (8) instead of throwing on verbose model turns.
   - Eliminated outer-loop retry amplification on `ModelProviderError` in `streamConversationTurn`, `runConversationTurn`, and `runAdaptiveWorkController` (rethrows immediately when the provider router has already exhausted retries or when `signal.aborted` is set, retrying only once on schema validation failure).
   - Threaded `signal: turnSignal` into `runAdaptiveWorkController` and updated the route's `catch` fallback to preserve `result.turn.work ?? session.working_state` rather than overwriting Turn 2's work state with Turn 1's stale `session.working_state`.
2. **Resolved Reload `"Conversation archived"` False Positive (`app/pursuits/[id]/page.tsx`):**
   - Kept the initial workspace loading screen active until `session` finishes bootstrapping (`if (loading && (!pursuit || !session))`) and restricted the `"Conversation archived"` composer placeholder strictly to `session?.status === "ARCHIVED"`.
3. **Completed Trigger → Dispatcher Job Enqueueing & Notification Loop (`lib/trigger-engine.ts`, `app/api/v1/triggers/route.ts`, `app/api/cron/continuity/route.ts`):**
   - Implemented `resolveTriggerContext` (evaluating real pursuit inactivity windows, in-flight actions, and recent events for `STATE` and `EVENT` triggers), `planTriggerDispatch`, and `dispatchFiredTrigger` (enqueuing authorized `CONTROLLED` `action` + `job` + `job_authorization` rows with autonomy policy, active capability grant, and `worker_jobs` resource reservation checks, or recording deduplicated notifications).
4. **Added Artifacts UI Surface (`app/pursuits/[id]/artifacts-panel.tsx`, `app/pursuits/[id]/page.tsx`):**
   - Mounted `PursuitArtifactsPanel` in the pursuit workspace contextual disclosure section to view active artifacts, inspect content and provenance, create new artifacts, and record append-only revisions via `PUT /api/v1/artifacts/[id]`.
5. **Audited & Tested Remaining `SECURITY DEFINER` RPCs (`tests/trusted-plane-rpc-grants.test.ts`):**
   - Verified that all user-callable `SECURITY DEFINER` RPCs (`stryde_create_pursuit`, `stryde_internal.commit_intervention`, `stryde_internal.set_objective_claim`, `stryde_internal.complete_human_action`, `stryde_record_conversation_user_input`, `stryde_commit_conversation_turn`, and `stryde_revise_artifact`) bind ownership to `auth.uid()` and pin an explicit `search_path`.
6. **Implemented Deterministic Research-First Orchestration (`lib/research-orchestration.ts`, `app/api/v1/pursuits/[id]/conversation/route.ts`):**
   - Evaluates incoming intent deterministically for roadmap audit requests, factual inquiries, and bottleneck claims.
   - Executes research on the trusted plane before streaming the turn, refreshing the Situation and compiled context packet.
   - Guarantees no substantive recommendation is streamed or shown before evidence is retrieved, and reconciles the streamed assistant message, options, working state, and next_move against the post-research situation.
   - Added regression test suite `tests/research-first-orchestration.test.ts` (8/8 passing) covering model misclassification, provider failure, empty results, contradictory results, retry failover, and AbortSignal cancellation.
7. **Completed Roadmap Audit & Universal Intake Lifecycle (`lib/universal-input.ts`, `lib/adaptive-model.ts`, `app/pursuits/[id]/work-panels.tsx`):**
   - Ingests pasted roadmaps into `pursuit_source` as canonical `PASTED` sources with SHA-256 hash.
   - `runSourceAdaptation` decomposes steps and assigns `audit_status` (`KEEP`, `CHANGE`, `REMOVE`, `MISSING`, `UNVERIFIED`, `NEEDS_EXPERIMENT`), persisted in `pursuit_source_adaptation` and cited in `pursuit_source_citation`.
   - Renders distinct semantic badge styling in `work-panels.tsx`.

## 2026-10-17 — historical engineering handoff

### What just changed

- Live security audit discovered that eight RPCs documented as trusted-plane/service-role-only were executable by `authenticated` users due to default function grants. The fix is merged in `1df79487da20bd4066e7ff492f6851c0960e6141` and deployed in READY production deployment `dpl_HxMc5YPcdgndAT9KnvaEHYNQKm2G`.
- GitHub Actions passed unit tests, typecheck, lint, and production build.
- The live Supabase migration was applied and verified. The eight trusted-plane RPCs now reject authenticated execution and remain executable by `service_role`.
- Artifact revision remains authenticated by design, but now validates the caller against `auth.uid()` and scopes the old artifact lookup to that identity.
- The source migration filename is being aligned to live version `20261017185728` to avoid local/live migration version drift.

### Next actions — priority order

1. **Run a fresh full production conversation journey** on the current deployment: confirmed user → pursuit → structured first turn → adaptive working state → second turn → persisted transcript/state. Do not equate `/api/health/model` or deployment READY with model reliability. Prior notes say free provider quotas blocked this; current availability still needs to be measured by an actual turn.
2. **Review remaining authenticated SECURITY DEFINER functions** flagged by Supabase Advisor. The current advisor lists the guarded artifact-revision function plus user-facing pursuit/conversation RPCs; inspect each owner check and add cross-user regression tests where needed. Enable leaked-password protection in Supabase Auth before broad launch.
3. **Make model/research economics viable:** verify a real model turn with the production provider chain; Exa/Firecrawl keys are absent, and production research is not proven. Do not assume Google AI Pro subscription includes production API credits.
4. Finish the **trigger → dispatcher job enqueueing E2E** and add the missing **artifacts UI** surface where it is in V1 scope.
5. Establish actual production worker runtime and verify resource/entitlement accounting through a representative pursuit.
6. Update this handoff and the verification matrix only when each result has actual evidence.

### Explicit status

- **PROVEN:** CI pipeline for the security fix; production deployment READY; security migration applied; live RPC privilege changes queried; production model configuration resolves.
- **NOT PROVEN:** full current-production conversational journey, sustained provider reliability, live Exa/Firecrawl research, public worker runtime, customer-paid billing path, trigger-to-dispatcher complete loop.
