# Stryde Integration Truth

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
