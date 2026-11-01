# Stryde Integration Truth


## Live integration reconciliation — 2026-10-28 (`ops/agent-maintainability-production-readiness` mandate execution)

- **Vercel:** Production alias `https://stryde-topaz.vercel.app` on `origin/main` commit `f1d2cd0161cfa7f5189f6e363a0e87818145589b`. CI workflow updated to Node 24 (`node-version: 24` in `.github/workflows/ci.yml`) matching Vercel production runtime.
- **Supabase:** Project `pvijrnwdnolvnoibarrj`, status `ACTIVE_HEALTHY`. 42 historical migrations. Prepared migration `20261027180000_billing_webhook_atomic_ledger.sql` providing atomic ledger table `billing_webhook_event_ledger` and `stryde_process_paddle_billing_event` compare-and-update RPC with first-delivery `INSERT ... ON CONFLICT DO NOTHING`, row locking (`FOR UPDATE`), payload SHA-256 conflict detection, canonical outcome preservation (conflicting deliveries do NOT overwrite completed events, preventing re-processing), account deletion in progress check, subtransaction failure persistence (`status = 'FAILED'`), and safe quarantine preserving existing paid entitlements.
- **Billing (Paddle Billing v2):** Paddle Billing v2 is the canonical merchant of record. Integration includes `lib/paddle.ts` and `lib/paddle-webhook.ts`. Supported: checkout transaction creation, webhook HMAC-SHA256 signature verification, replay protection (300s window), atomic duplicate event deduplication, out-of-order event protection, fail-closed price mapping quarantine, idempotent already-cancelled handling, fail-retryable on missing RPC (HTTP 500 awaiting migration), and subscription cancellation across all active/billable states (`ACTIVE`, `TRIALING`, `PAST_DUE`, `PAUSED`, `UNKNOWN`) via Billing v2 API (`POST /subscriptions/{id}/cancel`) during account deletion (`DELETE /api/v1/user/account`). Stripe is not used.
- **Model Providers:** Direct Google AI Studio Gemini API primary (`gemini-3.8-flash`), OpenRouter fallback. Hard prompt length limit (`120_000` chars), stream abort propagation via AbortController, and boundary delimiters (`<<<UNTRUSTED_INPUT_DATA>>>`) protecting against prompt injection. Probe cache in `/api/health/model` has 60s TTL and maxOutputTokens 50.
- **Search & Research:** Exa primary, Firecrawl fallback. Web page fetching uses SSRF defenses rejecting private/loopback IP ranges and URL scheme allowlists.
- **Account Deletion:** `DELETE /api/v1/user/account` establishes an immediate write barrier via `auth.admin.updateUserById(cleanUserId, { app_metadata: { deletion_in_progress: true } })` preventing concurrent API writes, cancels queued/leased background jobs, cancels Paddle subscriptions first, purges user data across all 40 verified user tables in topological leaf-to-root order, and only removes auth identity upon verified database purge success. Fully retryable via `{ allowDeletionInProgress: true }` and fail-closed on any intermediate failure.

## Live integration reconciliation — 2026-10-21 (`fix/conversation-turn-reliability` correctness-closure pass)

- **Vercel:** production deployment `dpl_HxMc5YPcdgndAT9KnvaEHYNQKm2G` is READY on main commit `1df79487da20bd4066e7ff492f6851c0960e6141`; alias `stryde-topaz.vercel.app`.
- **Supabase:** project `pvijrnwdnolvnoibarrj` is ACTIVE_HEALTHY. The live ledger contains 41 migration entries. Security migration version `20261017185728` is applied and live effective privileges are restricted so trusted-plane resource RPCs require service role.
- **Model provider:** direct Google AI Studio Gemini API primary (configured via `GEMINI_API_KEY`, `STRYDE_GEMINI_API_KEY`, or `GOOGLE_AI_STUDIO_API_KEY`), OpenRouter fallback. Model-health success confirms configuration, while conversation turn streaming and structured extraction are proven in local test suites.
- **Research & Resource Reservation:**
  - Full reservation lifecycle: `reserveResources` pre-allocates `research_rounds` before calling providers, releasing on failure/cancellation, reconciling on success, and preventing double-billing on replayed turns (`research:${turnKey}`).
  - Search provider chain configured (`Exa` primary, `Firecrawl` fallback); requires `EXA_API_KEY` or `FIRECRAWL_API_KEY` for live upstream execution. When unconfigured, research degrades honestly to `WAITING_EXTERNAL`/`ASK_USER` without hallucinating citations.
- **Source retrieval paths & Locators:**
  - Public web pages: direct fetch with DNS SSRF assertion + Firecrawl JS-render fallback when configured; top research hits are ingested as canonical `pursuit_source` items.
  - Locator classification: `FULL_TEXT` (with `#sha256:` content locators), `PARTIAL_CONTENT`, `PAYWALLED` (detected via domain/content paywall patterns), `SNIPPET`, `INACCESSIBLE`, and `TRANSCRIPT_UNAVAILABLE` (with `#media` locators). `primary_source_traced` is strictly `true` only for `FULL_TEXT`.
  - Pasted roadmaps & text: ingested directly with SHA-256 hash (up to 120k chars); methods default to `UNVERIFIED` until research is acquired. Post-research adaptation creates v2 with citations or falls back to `INCOMPLETE` on model failure.
- **Billing:** Stripe keys are absent. Billing/payment and the customer-facing paid subscription path remain intentionally unconfigured.
- **Security:** authenticated execution was removed from eight resource/trigger RPCs designed for the trusted plane. Artifact revision now verifies the actual authenticated actor. Leaked-password protection remains disabled in Supabase Auth.

## Live integration reconciliation — 2026-10-18 (`fix/conversation-turn-reliability` historical)

- **Vercel:** production deployment `dpl_HxMc5YPcdgndAT9KnvaEHYNQKm2G` is READY on main commit `1df79487da20bd4066e7ff492f6851c0960e6141`; alias `stryde-topaz.vercel.app`.
- **Supabase:** project `pvijrnwdnolvnoibarrj` is ACTIVE_HEALTHY. The live ledger contains 41 migration entries. Security migration version `20261017185728` is applied and live effective privileges were queried afterward.
- **Model provider:** direct Google AI Studio Gemini API primary (configured via `GEMINI_API_KEY`, `STRYDE_GEMINI_API_KEY`, or `GOOGLE_AI_STUDIO_API_KEY`), OpenRouter fallback. Model-health success confirms configuration, while conversation turn streaming and structured extraction are proven in local test suites.
- **Research:** Search provider chain configured (`Exa` primary, `Firecrawl` fallback); requires `EXA_API_KEY` or `FIRECRAWL_API_KEY` for live upstream execution. When keys are unconfigured, research degrades honestly to WAITING_EXTERNAL/ASK_USER without hallucinating citations.
- **Source retrieval paths:**
  - Public web pages: direct fetch with DNS SSRF assertion + Firecrawl JS-render fallback when configured; top research hits are ingested as canonical `pursuit_source` items with `#sha256:` content locators.
  - Pasted roadmaps & text: ingested directly with SHA-256 hash (up to 120k chars); methods default to `UNVERIFIED` until research is acquired.
  - Uploaded files: Text, Markdown, CSV, JSON, Log, and PDF supported.
  - YouTube, audio & video transcripts: No dedicated transcript provider (e.g. Supadata or YouTube Data API) is currently configured in production environment. Stryde fails honestly (`TRANSCRIPT_UNAVAILABLE` with `#media` locator) rather than pretending access.
- **Billing:** Stripe keys are absent. Billing/payment and the customer-facing paid subscription path remain intentionally unconfigured.
- **Security:** authenticated execution was removed from eight resource/trigger RPCs designed for the trusted plane. Artifact revision now verifies the actual authenticated actor. Leaked-password protection remains disabled in Supabase Auth.

Status: canonical integration document
Reconciliation date: 2026-10-06

## Active product path

Model (CONFIRMED against production configuration and /api/health/model,
2026-10-06):
- OpenRouter PREFERRED PRIMARY (funded; serving production)
- Gemini FALLBACK (free tier, 20 req/day, gemini-flash-latest)
- OmniRoute DISABLED in production (tailnet-only, unreachable from Vercel);
  its local real proof of 2026-09-30 is historical evidence
- Groq excluded from the intended product path

The router chain is `[preferred if resolvable] + remaining canonical
providers in Gemini → OpenRouter → OmniRoute order` (lib/model-provider.ts).
`/api/health/model ready=true` is configuration evidence, not generation
proof; the latest production generation proof is the 2026-10-05 live
conversation (Issue #6 report).

## Current live integrations

| Integration | State | Evidence |
|---|---|---|
| Supabase | LIVE | pvijrnwdnolvnoibarrj; 32/37 migrations applied (5 pending, see docs/STATE.md 2026-10-06); introspected 2026-10-06 |
| Vercel | LIVE | production = bc8e92e on stryde-topaz.vercel.app (Ready 2026-10-05); env contract set; RESEND_API_KEY present but stale (zero code references; removal scheduled) |
| OpenRouter | LIVE | preferred provider; key configured on Vercel; one real production conversation turn 2026-10-05 (Issue #6 report) |
| Gemini | CONFIGURED | fallback leg on Vercel (gemini-flash-latest); free tier 20 req/day; not yet observed serving a production turn |
| OmniRoute | DISABLED IN PRODUCTION | tailnet-only; local probe proof 2026-09-30 is historical |
| Exa | ADAPTER, NO KEY (BLOCKED) | search-provider chain added 2026-10-04; no EXA_API_KEY on Vercel, so the live request remains unverified |
| Firecrawl | ADAPTER + RENDER FALLBACK, NO KEY (BLOCKED) | search + JS-render fallback added 2026-10-04; mock-proven only |
| Hermes | IMPLEMENTED + REAL LOCAL PROOF | real agent through the CONTROLLED plane 2026-10-03; local plane only |
| OpenCode | IMPLEMENTED + REAL LOCAL PROOF | real agent, artifact-judged, 2026-10-04; local plane only |
| Browser worker | IMPLEMENTED + REAL LOCAL PROOF; tool row LIVE | e2e:browser-worker 14/14; worker.browser registered on the live project (runtime-provisioned 2026-10-05); production worker runtime not established |
| MCP transport | IMPLEMENTED; tool row LIVE | first-party JSON-RPC 2.0 stdio client; e2e:mcp-worker 10/10; worker.mcp registered on the live project (2026-10-05) |
| Stripe (founding access) | IMPLEMENTED, UNCONFIGURED | honest 503 until keys; runbook docs/PAID_ACCESS.md; PAID_CTA_CLICK funnel wired |
| Voice | UI | browser SpeechRecognition path; production browser pass 2026-10-05 |

## Capability strategy

Stryde should not be bound to a single search provider.

Potential evidence/capability sources include:
- multiple search systems;
- authoritative APIs/databases;
- public documents and papers;
- transcript extraction;
- browser observation;
- user-supplied files;
- crawling/extraction infrastructure;
- specialized workers;
- human input when necessary.

Potential future infrastructure to evaluate, not pre-approved:
- Stagehand / Browser Use and other browser systems;
- Apify actors;
- Crawl4AI / other extractors;
- MCP;
- Composio or direct service adapters;
- document/media processing;
- memory libraries.

Every addition must pass the open-source/integration policy: license, security, maintenance, data boundary, API stability, replaceability, and actual product value.

## Third-party boundary

Third-party systems should be subordinate capabilities.

They must not become:
- Stryde's canonical truth;
- Stryde's authority system;
- the only representation of personal memory;
- the user's workflow interface.

Stryde owns the contract between reality, evidence, decision, action, observation, verification, and continuation.


## 2026-10-06 post-GLM runtime checkpoint

CONFIRMED:
- Vercel project plan is Hobby.
- Current production deployment is built from main commit 1e3b7d7 and is READY.
- Current production model configuration resolves OpenRouter → nvidia/nemotron-3-super-120b-a12b:free, Gemini fallback → gemini-flash-latest, OmniRoute disabled.
- Exa and Firecrawl remain adapter-level capabilities with no live runtime keys configured.
- RESEND_API_KEY is no longer present in the project environment.
- Supabase is now 37/37 migration-parity and the four previously missing tables are live.
- The current production conversation path still needs a fresh post-fix end-to-end proof after the malformed-stream failover repair.
