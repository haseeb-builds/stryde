# Stryde Product Scope & Full Reconciliation Traceability Matrix

**Version:** 2.0  
**Updated:** 2026-10-24  
**Author:** Stryde Principal Software Engineer & Tech Lead  
**Status:** Living Canonical Full-Product Traceability Matrix  

---

## 1. Scope Definition & Philosophy

Stryde is a persistent pursuit, execution, and accountability product. It guides a person toward a meaningful outcome through an active, reality-grounded loop:
`OUTCOME -> SITUATION -> NEXT MOVE -> APPROVAL -> EXECUTION -> RESULT -> LEARNING -> NEXT MOVE`

Scope status definitions:
- **CONFIRMED**: Established by explicit product requirements or founder direction.
- **INFERRED**: Strongly implied by existing architecture, routes, or contracts.
- **UNKNOWN**: Materially unclear, requiring repository investigation or targeted decision.
- **IMPLEMENTED**: Code exists and is bound to domain contracts.
- **VERIFIED**: Acceptance criteria checked against real automated or manual tests.
- **BLOCKED**: Prevented from completion by an explicit external dependency.

---

## 2. Full-Product Capabilities & Audit Reconciliation

| ID | Capability & Intended Outcome | Architecture & Dependencies | Current Implementation State | Verification Evidence | Status |
|:---|:---|:---|:---|:---|:---|
| **CAP-01** | **User Authentication & Multi-Tenancy**<br>Sign up, sign in, session refresh, and multi-tenant RLS data isolation. | Supabase Auth (`@supabase/supabase-js`, `lib/supabase/`), RLS on all tables. | IMPLEMENTED (`app/page.tsx`, `lib/supabase/`). | RLS verifies zero cross-user leakage. Real Chrome browser authentication verified in QA audit. | **VERIFIED** |
| **CAP-02** | **Pursuit Lifecycle & Management**<br>Create, view, update, switch, and persist pursuits across operational sessions. | `app/api/v1/pursuits`, `app/pursuits/[id]`, `public.pursuit` table. | IMPLEMENTED (`app/pursuits/[id]/page.tsx`, switcher modal). | 31 real pursuits rendered, route transitions verified, 350 test suite passing. | **VERIFIED** |
| **CAP-03** | **Conversation Turn & Adaptive Guidance**<br>Structured AI reasoning guiding user through next moves with model failover. | `app/api/v1/pursuits/[id]/conversation`, `lib/model-gateway.ts`, `lib/model-provider.ts`. | IMPLEMENTED (`gemini-3.8-flash` primary, `nvidia/nemotron-3-ultra-550b-a55b:free` fallback). | OpenRouter live probe PASSED 100% in 2.68s. Test suite passes. | **VERIFIED** |
| **CAP-04** | **Action Approval & Lifecycle**<br>Explicit approval for consequential moves; PROPOSED → IN_PROGRESS → COMPLETED/FAILED. | `app/api/v1/pursuits/[id]/actions`, `public.action`, `lib/action-completion.ts`. | IMPLEMENTED (`app/pursuits/[id]/work-panels.tsx`, `lib/action-completion.ts`). | Action transition tests passing in `tests/controlled-action-fallback.test.ts`. | **VERIFIED** |
| **CAP-05** | **Controlled-Action Manual Fallback**<br>Prevent trapping users when automated runners stall; manual "I'm done" / "I'm blocked". | `stryde_internal.complete_human_action`, `lib/action-completion.ts`. | IMPLEMENTED (`supabase/migrations/20261024143000_repair_controlled_action_fallback.sql`). | Migration applied to remote Supabase DB `pvijrnwdnolvnoibarrj`. All 42 migrations synced. | **VERIFIED** |
| **CAP-06** | **Evidence & Observation Synchronization**<br>Link user outcomes and worker outputs to epistemic observations and claims. | `public.observation`, `public.claim`, `lib/action-completion.ts`, `stryde_link_claim_observation`. | IMPLEMENTED (`complete/route.ts`, `lib/action-completion.ts`). | Trusted service-role RPC linking verified in `tests/action-claim-sync.test.ts`. | **VERIFIED** |
| **CAP-07** | **Source Ingestion & Citation Integrity**<br>Ingest pasted text or verified URLs; extract content; trace defensible citations. | `lib/source-provider.ts`, `lib/page-fetch.ts`, `public.pursuit_source`. | IMPLEMENTED (`add-context-modal.tsx`, `app/api/v1/pursuits/[id]/sources`). | SSRF checked, HTML sanitized, citations verified in `tests/source-citation.test.ts`. | **VERIFIED** |
| **CAP-08** | **Autonomous Web Research Engine**<br>Search the web for methods and real-world citations; fail-closed without keys. | `lib/search-provider.ts`, `lib/deep-scrape.ts`. | IMPLEMENTED (Supports Exa & Firecrawl; R-4 guard prevents ungrounded execution). | R-4 guard verified in `tests/research-blocked-ungrounded-guard.test.ts`. Live search requires `EXA_API_KEY` / `FIRECRAWL_API_KEY`. | **IMPLEMENTED (R-4 Guard Verified)** |
| **CAP-09** | **Persistent Semantic Memory & Procedures**<br>Retain user preferences, constraints, learnings, and reusable routines across turns. | `app/api/v1/memory`, `public.memory`, `lib/memory.ts`. | IMPLEMENTED (`app/pursuits/[id]/memory-panel.tsx`, "What Stryde remembers"). | CRUD, pursuit scoping, and progressive disclosure verified in Chrome browser QA. | **VERIFIED** |
| **CAP-10** | **Artifacts & Versioned Outputs**<br>Generate, display, compare, and edit structured project deliverables. | `app/api/v1/artifacts`, `public.artifact`, `public.artifact_revision`. | IMPLEMENTED (`app/pursuits/[id]/artifacts-panel.tsx`). | Revision tracking and rendering verified in Chrome browser QA. | **VERIFIED** |
| **CAP-11** | **Autonomy Governance & Resource Quotas**<br>User policy limits worker types, auto-research, and spending budgets. | `app/api/v1/autonomy-policy`, `public.user_autonomy_policy`, `lib/resource-control.ts`. | IMPLEMENTED (`app/pursuits/[id]/autonomy-row.tsx`). | Policy restricts execution; quota reservations atomic. Verified in `tests/autonomy-policy.test.ts`. | **VERIFIED** |
| **CAP-12** | **Progressive-Disclosure Pursuit Workspace (UI/UX)**<br>Single-composer interface focused on Outcome, Situation, Next Move without internal ontology leaks. | `app/pursuits/[id]/page.tsx`, `context-drawer.tsx`, `add-context-modal.tsx`. | IMPLEMENTED (`<details>` disclosures for memory, claims, sources, workflows, autonomy). | Real Chrome browser QA: 0 page errors, 0 console errors, 0 horizontal overflow (1440x900 & 390x844). | **VERIFIED** |
| **CAP-13** | **Model Health & Diagnostics**<br>Accurate real-time reporting of provider configuration and reachability. | `app/api/health/model/route.ts`, `lib/model-provider.ts`. | IMPLEMENTED (Distinguishes configured vs probed; in-memory caching). | Probe returns `VERIFIED_OPERATIONAL` on real OpenRouter API. | **VERIFIED** |
| **CAP-14** | **Commercial Billing & Access (Paddle-First)**<br>Subscription tiers, checkout, webhook synchronization, and entitlement enforcement for Pakistani & global operations. | `lib/paddle.ts`, `app/api/v1/billing/checkout`, `app/api/v1/billing/webhook`, `public.subscription_state`. | **IN IMPLEMENTATION** (Paddle Billing v2 selected for Pakistan seller eligibility, MoR compliance, and direct SWIFT/Payoneer payouts). | Comprehensive integration & signature tests in `tests/paddle-billing.test.ts`. | **ACTIVE EXECUTION** |
| **CAP-15** | **Controlled Worker Execution Plane**<br>Background job leasing, dispatcher daemon, and worker runtimes (`BROWSER`, `OPENCODE`, `HERMES`, `MCP`). | `scripts/worker-dispatcher.ts`, `scripts/browser-worker.ts`, `app/api/internal/execution/`. | IMPLEMENTED (Dispatcher and workers exist in `scripts/`; leasing contracts verified in tests). | `tests/worker-dispatcher.test.ts`, `tests/worker-contract.test.ts` pass. Local worker daemon execution test ready. | **IMPLEMENTED** |

---

## 3. Active Implementation Roadmap

1. **Paddle Billing Integration (CAP-14):**
   - Implement `lib/paddle.ts` supporting Paddle Billing v2 REST transactions, HMAC-SHA256 signature verification (`Paddle-Signature`), and webhook payload normalization.
   - Refactor `app/api/v1/billing/checkout/route.ts` to generate Paddle transactions.
   - Create `app/api/v1/billing/webhook/route.ts` to securely handle subscription events (`subscription.created`, `subscription.updated`, `subscription.canceled`, `subscription.paused`) and update `subscription_state` via trusted service client.
   - Create customer subscription management endpoint `app/api/v1/billing/portal/route.ts`.
   - Implement comprehensive automated test suite `tests/paddle-billing.test.ts`.
   - Author Paddle merchant onboarding guide with exact manual verification steps for Pakistan-based founders.
2. **Worker Execution Loop (CAP-15):**
   - Run end-to-end controlled worker dispatch test with local worker daemon.
3. **Research Key Verification (CAP-08):**
   - Document explicit manual gate for Exa / Firecrawl live API key provisioning.
