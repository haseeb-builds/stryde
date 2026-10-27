# Stryde Engineering Mandate — Execution Progress Ledger

**Record Date:** 2026-10-27  
**Branch:** `ops/agent-maintainability-production-readiness`  
**Base Commit (origin/main):** `f1d2cd0161cfa7f5189f6e363a0e87818145589b`  
**Mandate Commit:** `b67c62ace7773ce98a7a6a17a7cf811eaa913fdf` (docs: add agent maintainability and production readiness mandate)  
**Associated PR:** [#15](https://github.com/haseeb-builds/stryde/pull/15)  
**Production Site:** `https://stryde-topaz.vercel.app`  

---

## 1. Verified Baseline Status (Phase 0)

| Check | Command | Result | Evidence / Notes |
|---|---|---|---|
| Runtime (Node) | `node -v` | `v24.18.0` | Matches production Vercel Node 24.x runtime |
| Package Manager | `npm -v` | `11.16.0` | Up-to-date npm |
| Unit / Integration Tests | `npm test` | **PASS** (368 passed, 0 failed, 47 suites) | Initial baseline run with Node test runner |
| TypeScript | `npx tsc --noEmit` | **PASS** (0 errors) | Clean pass after stale `.next` cache cleared |
| ESLint | `npm run lint` | **PASS** (0 errors, 0 warnings) | Clean pass |
| Production Dependency Audit | `npm audit --omit=dev` | **PASS** (0 vulnerabilities) | Clean supply chain |
| Next.js Build | `npm run build` | **PASS** (28 static/dynamic routes compiled in 21.2s) | Turbopack production compile clean |
| CI Runtime Check | `.github/workflows/ci.yml` | **RESOLVED** | CI updated from Node 22 to Node 24, aligning with Vercel & local workstation |

### Environment Variables Inventory (Safe - Names Only)
- Client-exposed (`NEXT_PUBLIC_`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`. No server secrets are client-exposed.
- Server-side only: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `STRYDE_GEMINI_API_KEY`, `STRYDE_OPENROUTER_API_KEY`, `STRYDE_OMNIROUTE_API_KEY`, `AI_API_KEY`, `RESEND_API_KEY`, `EXA_API_KEY`, `FIRECRAWL_API_KEY`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET_KEY`, `CRON_SECRET`, `STRYDE_WORKER_SECRET`, etc.

### E2E / Script Inventory & Safety Classification
- Safe (mocked/unit): `tests/**/*.test.ts`
- External read-only probes (requires credentials, does not mutate user data): `scripts/probe-provider.ts`, `scripts/probe-research.ts`, `scripts/probe-paddle.ts`.
- Worker runners (requires local worker environment): `scripts/worker-dispatcher.ts`, `scripts/hermes-worker.ts`, `scripts/opencode-worker.ts`, `scripts/browser-worker.ts`, `scripts/mcp-worker.ts`.
- E2E loops (potential database mutation if run against live DB): `scripts/e2e-human-loop.ts`, `scripts/e2e-model-loop.ts`, `scripts/e2e-controlled-worker-loop.ts`, `scripts/e2e-real-worker.ts`, `scripts/e2e-entitlement.ts`. **DO NOT run against production database without explicit isolation.**

---

## 2. Phase Execution Summary

| Phase | Description | Status | Evidence / Reference |
|---|---|---|---|
| Phase 0 | Reconnaissance and Baseline | **PASS** | Verified clean git state, tests 368/368 pass, tsc clean, lint clean, audit clean, build clean. |
| Phase 1 | CodeRabbit PR #14 Finding Triage | **PASS** | All 24 review comments evaluated against current code and categorized into P0/P1/P2/P3. |
| Phase 2 | Correctness and Security Remediation | **PASS** | Completed 6.1 (Account deletion), 6.2 (Idempotency), 6.3 (Paddle webhooks & ledger), 6.4 (AI caps), 6.5 (Prompt injection guards), 6.6 (Sanitization), 6.7 (RLS & auth), 6.8 (Worker recovery), 6.9 (CI Node 24). |
| Phase 3 | Privacy, Data Inventory, Terms & Behavior | **PASS** | Created `app/privacy/page.tsx` and `app/terms/page.tsx` based on factual data flows and verified subprocessors. |
| Phase 4 | Observability, Alerts & Diagnostics | **PASS** | Added `app/api/health/route.ts` liveness/readiness probe; verified `app/api/health/model/route.ts` privacy & cost boundaries. |
| Phase 5 | Test Strategy, CI, Staging & Recovery | **PASS** | 406 total unit/integration tests passing across 52 suites. CI aligned to Node 24. |
| Phase 6 | Database Advisor Triage | **PASS** | Individual triage of `public.loops`, 5 `SECURITY DEFINER` functions, foreign key indexing, and RLS initplans. |
| Phase 7 | Agent Maintainability Audit & Cleanup | **PASS** | Safe consolidation of sanitization, idempotency resolution, and webhook processing without contract drift. |
| Phase 8 | Documentation Reconciliation | **PASS** | Updated `docs/STATE.md`, `docs/INTEGRATIONS.md`, `HANDOFF.md`, and this ledger. |
| Phase 9 | Final Verification and Report | **PASS** | Final complete suite run and report generated per Mandate Section 14. |

---

## 3. PR #14 CodeRabbit Findings Triage Matrix & Disposition

| # | Thread / Scope | Severity | Status | Disposition & Remediation |
|---|---|---|---|---|
| 1 | Input token caps & quota reservation | P1 | RESOLVED | Enforced hard `MAX_PROMPT_INPUT_LENGTH = 120_000` chars limit in `lib/model-provider.ts`. Verified by `tests/model-provider-retry.test.ts`. |
| 2 | PostgreSQL CTE for worker claim | P2 | RESOLVED | Verified `stryde_lease_next_job` uses CTE with `FOR UPDATE SKIP LOCKED`. |
| 3 | Route JSON validation scoping | P2 | RESOLVED | GET/DELETE methods properly omit body parsing; webhooks read raw text for HMAC signature verification. |
| 4 | Prompt injection multi-layer defense | P1 | RESOLVED | Delimiter wrapping (`<<<UNTRUSTED_INPUT_DATA>>>`), internal delimiter escaping, and system prompt security directives in `lib/model-gateway.ts`. Verified by `tests/prompt-injection-guard.test.ts`. |
| 5 | SSRF prevention on server-side fetches | P1 | RESOLVED | Validated URL schemes (`http:`, `https:`, `mailto:`, safe relative paths) and strict blocking of private IP/backslash vectors. Verified by `tests/markdown-sanitization.test.ts`. |
| 6 | Expire non-terminal worker states | P1 | RESOLVED | `lib/worker-dispatch-runner.ts` reconciles expired jobs past `lease_expires_at` via `reconcileExpiredJobsBatch` and `stryde_reconcile_expired_job`. |
| 7 | Atomic webhook replay protection | P0 | RESOLVED | Implemented migration `20261027180000_billing_webhook_atomic_ledger.sql` and `lib/paddle-webhook.ts`. Verified by `tests/paddle-webhook-processing.test.ts`. |
| 8 | Retryable cross-system account deletion | P0 | RESOLVED | Implemented `lib/account-deletion.ts` with cancel-first Paddle sequence, leaf-to-root table deletion, and fail-closed auth retention. Verified by `tests/user-account-deletion.test.ts`. |
| 9 | Database connection pooling check | P2 | RESOLVED | Documented Supabase connection pooler port (6543) and session pooling requirements. |
| 10 | RLS test fidelity | P2 | RESOLVED | Unit tests reflect exact database RLS contracts; mock bounds explicitly labeled. |
| 11 | Provider module path typo | P3 | RESOLVED | Fixed import references to `lib/model-provider.ts`. |
| 12 | Concurrency test with same Idempotency-Key | P1 | RESOLVED | Verified in `tests/turn-idempotency.test.ts` with serialized row locking simulation. |
| 13 | Self-only auth check on account deletion | P0 | RESOLVED | `app/api/v1/user/account/route.ts` derives user identity strictly from verified Bearer token; client-supplied IDs are rejected. |
| 14 | Paddle cancellation during account deletion | P0 | RESOLVED | `cancelPaddleSubscription` in `lib/paddle.ts` invoked via Paddle Billing v2 API prior to database record deletion. |
| 15 | Quota mapping tests for HTTP 429 | P2 | RESOLVED | Verified 429 status code mapping when user quota is exhausted. |
| 16 | Worker-state tests for manual fallback | P2 | RESOLVED | Verified manual fallback on CONTROLLED actions via `stryde_complete_human_action`. |
| 17 | Header Idempotency-Key UUID contract | P1 | RESOLVED | Created `lib/idempotency.ts` with RFC 4122 v5 deterministic UUID namespace mapping so arbitrary client strings never crash Postgres `uuid` RPC arguments. |
| 18 | Preserve HTML in fenced code blocks | P2 | RESOLVED | `stripRawHtmlPreservingCode` in `lib/sanitization.ts` isolates fenced and inline code blocks before HTML tag stripping. Verified by `tests/markdown-sanitization.test.ts`. |
| 19 | Paddle cancellation before DB delete | P0 | RESOLVED | Fully enforced in `cascadeDeleteUserData`: Paddle subscription cancellation is step 1. |
| 20 | Fail account deletion when sub-step fails | P0 | RESOLVED | Fails closed: if any table delete fails, Auth user is NOT deleted, allowing user to retry or support to recover. |
| 21 | Delimiter reproduction in prompt context | P1 | RESOLVED | `escapePromptDelimiters` replaces occurrences of `<<<` and `>>>` within untrusted working context. |
| 22 | URL sanitizer slash-backslash `/\attacker` | P1 | RESOLVED | `sanitizeUrl` in `lib/sanitization.ts` explicitly blocks protocol-relative backslash variations (`/\`, `/\\`, `\\`). |
| 23 | Idempotency test header precedence | P2 | RESOLVED | Precedence contract verified: `body.turn_key` > `Idempotency-Key` > `X-Idempotency-Key`. |
| 24 | Duplicate idempotency test same-key fixture | P1 | RESOLVED | Verified duplicate submission with payload match returns cached result; conflicting payload returns HTTP 409. |

---

## 4. Phase 2 Remediation Details

### 4.1 Turn Idempotency (`lib/idempotency.ts`)
- **Problem:** Database RPC `stryde_record_conversation_user_input` accepts parameter `p_turn_key uuid`. Passing arbitrary client strings (e.g. `idem-1234`) caused PostgreSQL runtime error `invalid input syntax for type uuid` and HTTP 500 crashes.
- **Solution:**
  - `isUuid`: Validates standard RFC 4122 UUID format.
  - `turnKeyToUuid`: Uses RFC 4122 v5 deterministic SHA-1 hashing over fixed UUID namespace (`4f8a9e22-6b3c-4d1e-8f5a-7c9b0e1d2f3a`) to map any non-UUID string deterministically to a valid UUID.
  - `resolveTurnKey`: Enforces clear precedence (`body.turn_key` > `Idempotency-Key` > `X-Idempotency-Key`).
  - `validateTurnPayloadMatch`: Returns HTTP 409 Conflict if the same idempotency key is submitted with a different payload.
- **Verification:** `tests/turn-idempotency.test.ts` (10/10 tests pass).

### 4.2 AI Request Boundaries & Delimiters (`lib/model-gateway.ts`, `lib/model-provider.ts`)
- **Problem:**
  - Unbounded prompt size could cause runaway token costs or provider rate limits.
  - Client disconnections during SSE streaming left model generation streams running orphaned on the server.
  - User context in prompt could escape framing and inject adversarial instructions.
- **Solution:**
  - `MAX_PROMPT_INPUT_LENGTH = 120_000` hard limit enforced in `lib/model-provider.ts`.
  - AbortController coupled to `request.signal` and `ReadableStream.cancel` in `app/api/v1/pursuits/[id]/conversation/route.ts`.
  - Structured prompt framing with `<<<UNTRUSTED_INPUT_DATA>>>` and escaping of delimiters in untrusted context.
- **Verification:** `tests/prompt-injection-guard.test.ts` (2/2 pass), `tests/model-provider-retry.test.ts` (7/7 pass).

### 4.3 Account Deletion (`lib/account-deletion.ts`, `app/api/v1/user/account/route.ts`)
- **Problem:**
  - PR #14 swallowed database deletion errors in a `try/catch` and returned `success: true`.
  - It deleted the Auth user even if table deletes failed, leaving orphaned records without owner access.
  - It never called Paddle to cancel active subscriptions, continuing to bill deleted users.
- **Solution:**
  - `ORDERED_USER_TABLES`: Topological leaf-to-root purge of all 30 user-scoped tables.
  - `cancelPaddleSubscription`: Cancels active subscription via Paddle API before table deletion.
  - Fail-closed: Auth user identity deleted ONLY after all table purges succeed.
  - Self-only caller verification: user ID derived strictly from validated Bearer session.
- **Verification:** `tests/user-account-deletion.test.ts` (6/6 pass).

### 4.4 Paddle Webhook Atomic Deduplication & Ordering (`lib/paddle-webhook.ts`)
- **Problem:**
  - In-application read-then-upsert had a race condition under concurrent duplicate webhook delivery.
  - Out-of-order events could overwrite newer subscription state with stale data.
  - Unknown price IDs could mistakenly elevate users.
- **Solution:**
  - Migration `20261027180000_billing_webhook_atomic_ledger.sql`: Creates `billing_webhook_event_ledger` table and `stryde_process_paddle_billing_event` RPC with row locking (`FOR UPDATE`).
  - Concurrent requests return HTTP 409 with `Retry-After: 5`.
  - Out-of-order events (`occurred_at < last_event_at`) are marked `IGNORED` and do not mutate state.
  - Unknown price IDs are quarantined with plan `free` and status `UNKNOWN`.
  - Zero secrets or sensitive payloads logged.
- **Verification:** `tests/paddle-webhook-processing.test.ts` (8/8 pass).

### 4.5 URL & Markdown Sanitization (`lib/sanitization.ts`)
- **Problem:**
  - Browsers interpret `/\attacker.com` or `/\\attacker.com` as protocol-relative URLs (`//attacker.com`). A simple `.startsWith("/")` check allowed open redirect and SSRF bypass.
  - Raw HTML stripping stripped harmless HTML tags inside fenced code blocks.
- **Solution:**
  - `sanitizeUrl`: Strictly rejects backslash variations (`/\`, `\\`, `/\\`) and non-allowlisted schemes.
  - `stripRawHtmlPreservingCode`: Extracts code spans and fenced blocks into placeholders before stripping HTML, then restores them intact.
- **Verification:** `tests/markdown-sanitization.test.ts` (6/6 pass).

---

## 5. Phase 6: Supabase Advisor Triage

| Advisor Category | Finding | Current State | Risk / Impact | Disposition & Action |
|---|---|---|---|---|
| Security | `public.loops` RLS enabled with no policy | Legacy table | Low (Deny All by default) | **Retained as Deny All**. Intentionally inaccessible to clients. Do not add permissive policy. |
| Security | 5 `SECURITY DEFINER` functions callable by `authenticated` | `stryde_record_conversation_user_input`, `stryde_commit_conversation_turn`, `stryde_commit_intervention`, `stryde_complete_human_action`, `stryde_revise_artifact` | Low / Controlled | **Audited & Verified Safe**. Every function explicitly asserts `v_actor := auth.uid()`, locks rows `where owner_user_id = v_actor`, sets search path, and rejects caller impersonation. |
| Security | Leaked password protection disabled | Auth setting | Medium | **Documented for Admin Dashboard**. Supabase project-level setting; requires Supabase Dashboard toggle (no SQL DDL available). |
| Performance | 56 unindexed foreign keys | Various relations | Low in low-concurrency, Medium under heavy cascade deletes | **Targeted index migration prepared**. Avoided mass-indexing to prevent write amplification on low-volume tables. |
| Performance | 55 RLS initplan warnings | Per-row subplan eval | Low / Informational | Audited. Critical paths use indexed lookups. |
| Performance | 7 unused indexes | Historical indexes | Low | Retained until production traffic telemetry confirms zero query usage. |

---

## 6. Verification Matrix

| Area | Suite | Tests | Result |
|---|---|---|---|
| Turn Idempotency | `tests/turn-idempotency.test.ts` | 10 | **PASS** |
| AI Prompt Delimiters | `tests/prompt-injection-guard.test.ts` | 2 | **PASS** |
| AI Request Boundaries | `tests/model-provider-retry.test.ts` | 7 | **PASS** |
| Account Deletion | `tests/user-account-deletion.test.ts` | 6 | **PASS** |
| Markdown Sanitization | `tests/markdown-sanitization.test.ts` | 6 | **PASS** |
| Webhook Processing | `tests/paddle-webhook-processing.test.ts` | 8 | **PASS** |
| Cross-Tenant Auth | `tests/authorization-cross-tenant.test.ts` | 5 | **PASS** |
| Complete Suite | All 52 test suites (`npm test`) | 406 | **PASS** (406 passed, 0 failed) |
| TypeScript | `npx tsc --noEmit` | - | **PASS** (0 errors) |
| ESLint | `npm run lint` | - | **PASS** (0 errors, 0 warnings) |
| Dependency Audit | `npm audit --omit=dev` | - | **PASS** (0 vulnerabilities) |
| Next.js Build | `npm run build` | 28 routes | **PASS** (Turbopack compile clean) |
