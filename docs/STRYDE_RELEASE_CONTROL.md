# Stryde Release Control Record

**Last Updated:** 2026-10-24  
**Release Captain:** Antigravity Engineering Lead  
**Current Active Branch:** `fix/conversation-turn-reliability`  
**Target Release Candidate Commit:** Ready for commit  
**Live Production URL:** `https://stryde-topaz.vercel.app`  

---

## 1. Verified System Architecture

- **Framework:** Next.js 16.4.2 (Turbopack, App Router)
- **UI Engine:** React 19.2.4, Tailwind CSS v4
- **Database & Auth:** Supabase Postgres (`pvijrnwdnolvnoibarrj`) with Row-Level Security (RLS) and Security Definer trusted functions
- **Inference Gateway:** Hierarchical router (`lib/model-provider.ts`, `lib/model-gateway.ts`): Gemini primary (`gemini-3.8-flash`), OpenRouter fallback (`nvidia/nemotron-3-ultra-550b-a55b:free` with `allow_fallbacks: true`), Omniroute internal
- **Research Engine:** Exa search with Firecrawl deep scraper fallback; guarded by R-4 ungrounded execution blocker
- **Execution & Autonomy:** Background worker leasing plane (`public.job`), controlled human action fallback (`stryde_internal.complete_human_action`), observation and claim synchronization (`stryde_link_claim_observation`)
- **Hosting Target:** Vercel serverless

---

## 2. Command Reference & Verification Tooling

| Task | Command | Verified Result |
|:---|:---|:---|
| **Unit & Integration Tests** | `npm test` (`node --experimental-strip-types --test tests/**/*.test.ts`) | **PASS** (350/350 tests passing in ~4.4s) |
| **TypeScript Typecheck** | `npx tsc --noEmit` | **PASS** (0 errors) |
| **ESLint Check** | `npm run lint` | **PASS** (0 errors, 0 warnings) |
| **Production Build** | `npm run build` | **PASS** (Turbopack compiled 25 static & dynamic routes cleanly) |
| **Dependency Security Audit** | `npm audit --omit=dev` | **PASS** (0 vulnerabilities) |
| **Model Health Probe** | `curl http://localhost:3155/api/health/model?probe=true` | **PASS** (`VERIFIED_OPERATIONAL`, OpenRouter latency 2686ms) |
| **Browser QA Verification** | `node scripts/browser-qa-audit.mjs` | **PASS** (0 page errors, 0 console errors, 0 overflow, 1440x900 & 390x844 responsive) |

---

## 3. Confirmed Defects & Remediation Status

| ID | Defect Description | Priority | Root Cause & Remediation | Status |
|:---|:---|:---|:---|:---|
| **DEF-01** | **Controlled Action Fallback Missing in DB** | P0 | Database lacked logic to settle CONTROLLED actions when worker runs stall. Migration `20261024143000_repair_controlled_action_fallback.sql` applied to Supabase remote DB `pvijrnwdnolvnoibarrj` via `supabase db push`. All 42 migrations synced. Companion tests in `tests/controlled-action-fallback.test.ts` pass. | **VERIFIED RESOLVED** |
| **DEF-02** | **Claim-Observation Sync RPC Permission Error** | P0 | `stryde_link_claim_observation` was revoked from authenticated users, causing client-side sync to fail. Fixed via trusted server-role RPC invocation in `lib/action-completion.ts` and `complete/route.ts`. Verified in `tests/action-claim-sync.test.ts`. | **VERIFIED RESOLVED** |
| **DEF-03** | **React 19 Lint Errors in New UI Modals** | P1 | `add-context-modal.tsx` and `context-drawer.tsx` called `setTab` and `setObservations` inside effects. Replaced with React 19 recommended transition checks and async effect cleanup. ESLint passes with 0 errors. | **VERIFIED RESOLVED** |
| **DEF-04** | **Model Health False Positive** | P1 | `/api/health/model` returned HTTP 200 "ready" if config was present even if upstream provider failed. Overhauled endpoint to distinguish configured vs probed live reachability, reporting operational statuses (`VERIFIED_OPERATIONAL`, `CONFIGURED_NOT_PROBED`, `UPSTREAM_DEGRADED`) with in-memory probe caching. | **VERIFIED RESOLVED** |
| **DEF-05** | **AI Provider Outage / Configuration** | P1 | Google AI restricted `gemini-2.5-flash` to legacy users with 404; OpenRouter 404 on `openrouter/free` and rejected `require_parameters: true`. Updated Gemini default to `gemini-3.8-flash`; OpenRouter configured with `nvidia/nemotron-3-ultra-550b-a55b:free` and `allow_fallbacks: true`. Live probe tested and verified 100%. | **VERIFIED RESOLVED** |
| **DEF-06** | **Internal Ontology Leaks & Progressive Disclosure** | P1 | Panels (`PursuitMemoryPanel`, `PursuitSkillsPanel`) were exposed as top-level `div` elements instead of `<details>` disclosures, risking ontology leakage and test mismatch. Unified all supporting disclosures into standard `<details>` elements with human-centered summary labels ("What Stryde remembers", "Evidence & claims", "Source material", "What Stryde may do on its own"). | **VERIFIED RESOLVED** |

---

## 4. Architectural & Product Decisions

1. **Working Tree Preservation:** A permanent git branch snapshot (`backup/working-tree-snapshot-20261024`) and full offline filesystem backup (`backups/pre-session-snapshot-20261024`) were captured prior to code edits. Zero data loss.
2. **Progressive Disclosure UI:** Pursuits emphasize Outcome, Situation, and Next Move. Auxiliary panels (Artifacts, Claims, Memories, Workflows, Autonomy) are tucked into clean `<details>` disclosures and the on-demand Context Drawer.
3. **No Decorative Controls:** Every button in the UI is tied to actual API routes and Supabase persistence.
4. **Honest Provider Reporting:** The system distinguishes between configured keys and verified operational status, never claiming unverified capabilities or ungrounded research.

---

## 5. Current Release Gates Status

- **GATE 0 (Preservation & Baseline):** **PASS** (Git snapshot `backup/working-tree-snapshot-20261024` and offline backup verified).
- **GATE 1 (Code & Data Integrity):** **PASS** (Action fallback and claim sync migrations applied to Supabase `pvijrnwdnolvnoibarrj`, 42 migrations active).
- **GATE 2 (Model Availability):** **PASS** (OpenRouter live probe passed; Gemini upgraded to 3.8-flash; health probe live).
- **GATE 3 (Pursuit Product Experience):** **PASS** (Zero console errors, zero page errors, zero overflow, responsive 1440x900 and 390x844).
- **GATE 4 (Full Verification):** **PASS** (350/350 tests, tsc, lint, build, audit all passing).
- **GATE 5 (Release Candidate):** **IN PROGRESS** (Preparing release candidate commit).
- **GATE 6 (Preview & Production):** **PENDING** (Pushing to origin and verifying deployment on `https://stryde-topaz.vercel.app`).

---

## 6. Next Highest-Value Actions

1. Review and stage approved changes into a clean release candidate commit.
2. Push branch `fix/conversation-turn-reliability` to origin.
3. Verify Vercel production deployment and run remote smoke tests.
