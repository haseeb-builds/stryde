# Stryde Integration Truth

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
