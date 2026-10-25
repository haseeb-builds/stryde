# Stryde Deferred Work & Launch Blockers Decision Ledger

**Status:** Canonical Decision Ledger for V1 Release  
**Author:** Chief of Staff / Release Coordinator  
**Repository:** `haseeb-builds/stryde`  
**Base Commit / Ref:** `fix/conversation-turn-reliability`  

---

## 1. Executive Summary

This ledger explicitly catalogues every capability, task, or architectural layer intentionally deferred during the engineering hardening mission. It defines the exact reason, interim behavior, responsible owner, measurable acceptance test, and whether the item constitutes a **V1 Launch Blocker**.

---

## 2. Decision Ledger

### Ledger Item 1: Visual Design & Styling Overhaul (Google Stitch Pass)
- **Category:** Manual Stitch Work
- **Why Deferred:** The founder requested an engineering-complete, verified core logic release candidate first, and will manually lead the visual/UX exploration in Google Stitch.
- **Can V1 Launch Without It:** **NO (Launch Blocker).** Launching requires the founder-approved visual design and cohesive brand styling.
- **What Product Does Meanwhile:** Retains clean, responsive, fully functional default UI with honest status messaging and no trapping states.
- **Owner:** Founder (design pass in Stitch) → Engineering Agent (post-Stitch integration).
- **Exact Prerequisite & Acceptance Test:** Complete visual mockups in Google Stitch adhering to `docs/STITCH_DESIGN_BRIEF.md`, exported and integrated per `docs/STITCH_INTEGRATION_CONTRACT.md`. All 342+ tests must remain green.
- **Severity:** High (Brand & UX).

### Ledger Item 2: Dedicated Supabase Staging Project
- **Category:** Infrastructure / Isolation
- **Why Deferred:** Creating external cloud database projects requires founder credentials and cloud account permissions not held by the agent.
- **Can V1 Launch Without It:** **YES (Not a blocker for production launch, but blocks destructive automated E2E testing).**
- **What Product Does Meanwhile:** Uses strictly scoped, isolated test fixtures for local testing. Prevents destructive E2E scripts from executing against the shared database.
- **Owner:** Founder.
- **Exact Prerequisite & Acceptance Test:** A separate Supabase project provisioned and linked to Vercel Preview environment variables. `supabase db push` succeeds.
- **Severity:** Medium (Operational Risk).

### Ledger Item 3: Hosted Background Worker Service
- **Category:** Infrastructure / Autonomous Execution
- **Why Deferred:** Vercel serverless runtimes terminate after HTTP requests. A persistent runner daemon (`scripts/browser-worker.ts`) requires dedicated container hosting (Fly.io, Railway, or ECS) which cannot be provisioned without paid billing authorization.
- **Can V1 Launch Without It:** **YES (with honest degraded capability).**
- **What Product Does Meanwhile:** The web UI honestly discloses: *"Stryde queued this step for an automated worker. If a worker daemon is not running in this environment or you complete it yourself, you can report the outcome directly."* Users are provided "I'm done" and "I'm blocked" buttons to manually advance actions without being trapped.
- **Owner:** Founder (provision compute) → Agent (configure daemon).
- **Exact Prerequisite & Acceptance Test:** Container deployed running `scripts/browser-worker.ts` with valid bearer token; leased job transitions from `LEASED` to `SUCCEEDED` with browser screenshot observation recorded.
- **Severity:** High for Autonomous V1; Low for Guided Human-in-the-Loop V1.

### Ledger Item 4: External Search Provider API Keys (Exa / Firecrawl)
- **Category:** Credentials / Configuration
- **Why Deferred:** Paid commercial API keys cannot be generated or funded autonomously.
- **Can V1 Launch Without It:** **NO for autonomous research; YES for guided research.**
- **What Product Does Meanwhile:** The R-4 pre-stream research blocker intercepts turns when search is required but unconfigured. It streams an honest blocker message explaining that web research is unavailable and asks the user to provide the context directly, avoiding hallucinations.
- **Owner:** Founder.
- **Exact Prerequisite & Acceptance Test:** `EXA_API_KEY` and/or `FIRECRAWL_API_KEY` added to Vercel environment variables. `GET /api/v1/pursuits/[id]/sources` successfully scrapes and ingests public URLs.
- **Severity:** High (Core Feature).

### Ledger Item 5: Supabase RLS `UPDATE` Policy on `pursuit_source_adaptation`
- **Category:** Database Migration (DDL) / Defense-in-Depth
- **Why Deferred:** Executing DDL migrations against the shared production Supabase database (`pvijrnwdnolvnoibarrj`) is strictly forbidden by non-negotiable mission safety boundaries.
- **Can V1 Launch Without It:** **YES.** Inspection of all reachable write paths in `stryde` confirms that adaptations are either created via `INSERT` (which is fully covered by the active `"source adaptations owned insert"` RLS policy) or updated server-side via `trustedPlane` (`service_role`), which is strictly scoped to `owner_user_id` and `pursuit_id`. The client frontend never issues direct client-plane `UPDATE` queries against `pursuit_source_adaptation`. Therefore, the missing policy does NOT block any current, reachable V1 product flow.
- **What Product Does Meanwhile:** Server-side routes continue managing adaptation updates via `trustedPlane` scoped by `owner_user_id` and `pursuit_id`.
- **Owner:** Founder (authorize migration during a dedicated maintenance window on staging).
- **Exact Prerequisite & Acceptance Test:** Apply SQL migration `CREATE POLICY "Users can update their own adaptations" ON public.pursuit_source_adaptation FOR UPDATE USING (auth.uid() = owner_user_id)`. Test direct client-side update via authenticated user JWT.
- **Severity:** Low / Architectural Defense-in-Depth (Non-blocking for V1).

### Ledger Item 6: Token-Level Incremental Streaming of Structured Output
- **Category:** Product Scope / Architecture Tradeoff
- **Why Deferred:** Stryde requires validated structured JSON (`situation`, `next_move`, `claims`, `actions`, `recommendation`) before committing state to the database. Streaming unvalidated raw tokens risks emitting hallucinatory citations or illegal moves that are subsequently rejected.
- **Can V1 Launch Without It:** **YES.** Buffering structured JSON and streaming validated deltas is a deliberate, robust integrity decision.
- **What Product Does Meanwhile:** Displays *"Stryde is working through it…"* status in the UI while structured validation completes, then flushes completed chunks over SSE.
- **Owner:** Core Architecture Team.
- **Exact Prerequisite & Acceptance Test:** Implementation of an incremental JSON parser with rollback semantics if validation fails mid-stream.
- **Severity:** Low (UX Optimization).

### Ledger Item 7: Customer Billing & Stripe Subscription Enforcement
- **Category:** Commercial / External
- **Why Deferred:** Stripe credentials and live billing accounts are not yet provisioned; founding access is currently active.
- **Can V1 Launch Without It:** **YES for initial invite-only / beta; NO for public commercial SaaS.**
- **What Product Does Meanwhile:** Routes return honest HTTP 503 ("Billing integration is currently unconfigured") or grant default Free/Founding plan limits.
- **Owner:** Founder.
- **Exact Prerequisite & Acceptance Test:** `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` configured; checkout session redirects to Stripe hosted payment page.
- **Severity:** High for Commercial Launch; Low for Beta / Design Review.
