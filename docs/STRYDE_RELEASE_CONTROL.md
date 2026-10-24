# Stryde Release Control Record

**Last Updated:** 2026-10-24  
**Release Captain:** Antigravity Engineering Lead  
**Current Active Branch:** `fix/conversation-turn-reliability`  
**GitHub Pull Request:** [PR #13](https://github.com/haseeb-builds/stryde/pull/13) (Kept OPEN per founder direction)  
**Target Release Candidate Commit:** Ready for staging  
**Live Production URL:** `https://stryde-topaz.vercel.app` (Untouched, awaiting explicit founder authorization)  

---

## 1. Verified System Architecture

- **Framework:** Next.js 16.4.2 (Turbopack, App Router)
- **UI Engine:** React 19.2.4, Tailwind CSS v4
- **Database & Auth:** Supabase Postgres (`pvijrnwdnolvnoibarrj`) with Row-Level Security (RLS) and Security Definer trusted functions (42/42 migrations synchronized)
- **Commercial Billing Engine:** Paddle Billing v2 (`lib/paddle.ts`, `app/api/v1/billing/checkout`, `app/api/v1/billing/webhook`, `app/api/v1/billing/portal`). Merchant of Record (MoR) supporting Pakistan-based operations, global automated tax remittance, subscription lifecycle, fail-closed plan resolution, and SWIFT/Payoneer payouts.
- **Inference Gateway:** Hierarchical router (`lib/model-provider.ts`, `lib/model-gateway.ts`): Gemini primary (`gemini-3.8-flash`), OpenRouter fallback (`nvidia/nemotron-3-ultra-550b-a55b:free` with `allow_fallbacks: true`), Omniroute internal
- **Research Engine:** Exa search with Firecrawl deep scraper fallback; guarded by R-4 ungrounded execution blocker
- **Execution & Autonomy:** Background worker leasing plane (`public.job`), controlled human action fallback (`stryde_internal.complete_human_action`), observation and claim synchronization (`stryde_link_claim_observation`)
- **Hosting Target:** Vercel serverless (Web application & API routes) + Dedicated Worker Container (Fly.io / Docker Compose) for continuous background execution

---

## 2. Command Reference & Verification Tooling

| Task | Command | Verified Result |
|:---|:---|:---|
| **Unit & Integration Tests** | `npm test` (`node --experimental-strip-types --test tests/**/*.test.ts`) | **PASS** (368/368 tests passing across 50 suites) |
| **TypeScript Typecheck** | `npx tsc --noEmit` | **PASS** (0 errors) |
| **ESLint Check** | `npm run lint` | **PASS** (0 errors, 0 warnings) |
| **Production Build** | `npm run build` | **PASS** (Turbopack compiled 28 static & dynamic routes cleanly) |
| **Dependency Security Audit** | `npm audit --omit=dev` | **PASS** (0 vulnerabilities) |
| **Model Health Probe** | `curl http://localhost:3155/api/health/model?probe=true` | **PASS** (`VERIFIED_OPERATIONAL`, OpenRouter latency 2686ms) |
| **Browser QA Verification** | `node scripts/browser-qa-audit.mjs` | **PASS** (0 page errors, 0 console errors, 0 overflow, 1440x900 & 390x844 responsive) |
| **Paddle Billing E2E Tests** | `node --experimental-strip-types --test tests/paddle-sandbox-e2e.test.ts` | **PASS** (5/5 tests passing: signature HMAC, replay window, fail-closed quarantine, aliases, checkout creation) |
| **Paddle Diagnostic Probe** | `npm run probe:paddle` | **BLOCKED (Code 2)** when credentials absent; **PASS (Code 0)** when live |
| **Research Diagnostic Probe** | `npm run probe:research` | **BLOCKED (Code 2)** when keys absent; **PASS (Code 0)** when live |

---

## 3. Confirmed Defects & Remediation Status

| ID | Defect Description | Priority | Root Cause & Remediation | Status |
|:---|:---|:---|:---|:---|
| **DEF-01** | **Controlled Action Fallback Missing in DB** | P0 | Database lacked logic to settle CONTROLLED actions when worker runs stall. Migration `20261024143000_repair_controlled_action_fallback.sql` applied to Supabase remote DB `pvijrnwdnolvnoibarrj`. Companion tests pass. | **VERIFIED RESOLVED** |
| **DEF-02** | **Claim-Observation Sync RPC Permission Error** | P0 | `stryde_link_claim_observation` was revoked from authenticated users. Fixed via trusted server-role RPC invocation in `lib/action-completion.ts`. Verified in `tests/action-claim-sync.test.ts`. | **VERIFIED RESOLVED** |
| **DEF-03** | **React 19 Lint Errors in New UI Modals** | P1 | `add-context-modal.tsx` and `context-drawer.tsx` called state setters in effects. Replaced with React 19 transition patterns. ESLint passes cleanly. | **VERIFIED RESOLVED** |
| **DEF-04** | **Model Health False Positive** | P1 | `/api/health/model` returned HTTP 200 "ready" even if upstream provider failed. Overhauled endpoint to distinguish configured vs probed live reachability. | **VERIFIED RESOLVED** |
| **DEF-05** | **AI Provider Outage / Configuration** | P1 | Upgraded Gemini to `gemini-3.8-flash`; OpenRouter configured with `nvidia/nemotron-3-ultra-550b-a55b:free` and `allow_fallbacks: true`. Live probe verified 100%. | **VERIFIED RESOLVED** |
| **DEF-06** | **Internal Ontology Leaks & Progressive Disclosure** | P1 | Unified auxiliary panels into standard `<details>` disclosures with human-centered summary labels. | **VERIFIED RESOLVED** |
| **DEF-07** | **Incompatible Payment Provider for Pakistan Operations** | P0 | Replaced broken Stripe stub with **Paddle Billing v2** (Merchant of Record). Added checkout transaction creation, webhook verification, customer portal, tier badges, and test suites. | **VERIFIED RESOLVED** |
| **DEF-08** | **Vercel Hobby Minute-Cron Deployment Failure** | P0 | Vercel deployment `dpl_BaEwu1vcKUoGkWRRZUcSha4KCrk3` failed because Hobby plan rejects `* * * * *` minute crons. Removed invalid minute cron from `vercel.json`. Background execution decoupled to dedicated container worker. | **VERIFIED RESOLVED** |
| **DEF-09** | **Paddle Webhook Secret & Price ID Inconsistency** | P1 | Webhook route only checked `PADDLE_WEBHOOK_SECRET` while config helper checked `PADDLE_WEBHOOK_SECRET_KEY`. Unified into canonical resolvers `resolvePaddleWebhookSecret` and `resolvePaddlePricePlanMap`. | **VERIFIED RESOLVED** |
| **DEF-10** | **Unsafe Pro Assignment on Unrecognized Price** | P0 | Webhook normalization previously defaulted to Pro on unmapped prices. Hardened with fail-closed quarantine: unknown prices map to `planId: "free"`, `status: "UNKNOWN"`, and `quarantined: true`. | **VERIFIED RESOLVED** |
| **DEF-11** | **Insecure Defaults in Worker Supervisor** | P1 | `run-production-worker.mjs` contained hardcoded placeholder token `"prod-browser-token"`. Replaced with cryptographically secure ephemeral 256-bit token generation for internal IPC. | **VERIFIED RESOLVED** |
| **DEF-12** | **Blind Worker Health Check** | P1 | Supervisor `/health` returned 200 even when child processes failed. Overhauled to actively check `browserWorkerProcess` and `dispatcherProcess` readiness, returning HTTP 503 if unavailable. | **VERIFIED RESOLVED** |

---

## 4. Current Release Gates Status

- **GATE 0 (Preservation & Baseline):** **PASS**
- **GATE 1 (Code & Data Integrity):** **PASS** (All 42 remote migrations synchronized).
- **GATE 2 (Model Availability):** **PASS** (OpenRouter live probe passed; Gemini upgraded to 3.8-flash; health probe live).
- **GATE 3 (Pursuit Product Experience):** **PASS** (Zero console errors, zero page errors, zero overflow, responsive 1440x900 and 390x844).
- **GATE 4 (Full Mechanical & E2E Verification):** **PASS** (368/368 tests passing, `npx tsc --noEmit` 0 errors, `npm run lint` 0 errors, `npm run build` 28 routes compiled, `npm run e2e:entitlement` 8 boundaries passing on live DB).
- **GATE 5 (Vercel Deployment Compatibility):** **PASS** (Hobby plan compliant `vercel.json` without invalid minute cron; Turbopack build clean).
- **GATE 6 (Commercial Engine Hardening):** **PASS** (Canonical config resolution, fail-closed quarantine, idempotency, out-of-order protection, 11/11 tests pass).
- **GATE 7 (Worker Execution Plane):** **PASS** (Node 22 container, auto-stop disabled in Fly, honest health checks, zero hardcoded secrets).
- **GATE 8 (Release Candidate Packaging):** **PASS** (PR #13 kept OPEN per founder instruction; code ready for commit and push).
