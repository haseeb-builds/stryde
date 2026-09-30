# Stryde Integration Truth

## Active model architecture (2026-09-30, phase decision)

Active chain: **Gemini DIRECT PRIMARY → OmniRoute FALLBACK**. OpenRouter is an
inactive provider for this phase.

- `STRYDE_PROVIDER_DISABLED=openrouter` is the mechanism: disabled providers are
  excluded from every resolved router chain even when fully configured, a
  disabled preferred provider is skipped, and disabling everything fails fast.
- Active env contract: `STRYDE_GEMINI_API_KEY` (+ optional `STRYDE_GEMINI_BASE_URL`,
  `STRYDE_GEMINI_MODEL`, default `gemini-2.5-flash`), `STRYDE_OMNIROUTE_API_KEY`
  (+ required `STRYDE_OMNIROUTE_BASE_URL` and `STRYDE_OMNIROUTE_MODEL`),
  `STRYDE_MODEL_PROVIDER=gemini` (preferred first leg). The legacy
  `STRYDE_MODEL_*` alias still configures the Gemini leg only; OpenRouter env
  vars were removed from the active environment.
- Verification entry points: `npm run probe:provider -- gemini|omniroute`
  (single named provider against the real ConversationTurn + working-state
  contracts, 2600-token budget) and `npm run e2e:model` (full vertical loop with
  a real provider; skips honestly when none is usable — deterministic fallback
  is never passed off as model success).
- `/api/health/model` reports the effective chain, disabled list, and issues.

Status: canonical integration document
Reconciliation date: 2026-09-28

| Integration | Repository | Live/deployed evidence | Current status |
|---|---|---|---|
| Supabase | Core dependency and server/service clients | Live project pvijrnwdnolvnoibarrj is ACTIVE_HEALTHY; schema inspected | DEPLOYED + PRODUCTION database inspection CONFIRMED |
| Vercel | Deployment target through Git integration | GitHub reports deployment success for commit 2420caa...; direct runtime access is denied | DEPLOYED CONFIRMED; PRODUCTION VERIFIED UNKNOWN |
| Exa | HTTP adapter in lib/search-provider.ts | No current successful live search evidence | IMPLEMENTED; TEST EXECUTION NOT EVIDENCED; LIVE UNKNOWN |
| Firecrawl | HTTP adapter in lib/source-provider.ts | No current successful live source ingestion evidence | IMPLEMENTED; TEST EXECUTION NOT EVIDENCED; LIVE UNKNOWN |
| Gemini | Model adapter | Current deployment env unavailable | IMPLEMENTED; current deployment config UNKNOWN |
| Groq | Model adapter | No live config evidence | IMPLEMENTED; LIVE UNKNOWN |
| OpenRouter | Model adapter | Historical live Run failures show OpenRouter usage on 2026-09-18 | IMPLEMENTED; HISTORICAL PRODUCTION EVIDENCE YES; current config UNKNOWN |
| Resend | Dependency and CI placeholder env | No production mail evidence | PARTIAL; LIVE UNKNOWN |
| Hermes | Tool registry + worker gateway + dispatcher | Tool row exists; no CapabilityGrant/Job/Attempt/Observation | IMPLEMENTED CONTRACT; REAL EXECUTION NOT PROVEN |
| OpenCode | Tool registry + worker gateway + dispatcher | Tool row exists; no CapabilityGrant/Job/Attempt/Observation | IMPLEMENTED CONTRACT; REAL EXECUTION NOT PROVEN |
| Playwright | Not a repo dependency | None | NOT IMPLEMENTED |
| Crawlee/Crawl4AI/Apify-like runtime | Not a repo dependency | None | NOT IMPLEMENTED |
| Browser Use/Stagehand/Skyvern/Steel | Not repo dependencies | None | NOT IMPLEMENTED |
| MCP runtime | Not in package/runtime | None | NOT IMPLEMENTED |
| Social saved-content connectors | None | None | NOT IMPLEMENTED |
| Media ingestion | None | None | NOT IMPLEMENTED |
| Document extraction | None | None | NOT IMPLEMENTED |
| Voice | Browser SpeechRecognition code exists in pursuit UI | No deployed verification | UI ONLY; PRODUCTION UNKNOWN |
| Vercel Cron | /api/checkin schedule in vercel.json | No execution log evidence | CONFIGURED; EXECUTION UNKNOWN |

## Integration policy

No external integration becomes canonical truth merely because it can be called. Each capability requires a registered identity/version, permission scope, credential boundary, side-effect classification, provenance, and verification story.

No current production credential values were inspected or copied into this document.
