# Stryde Verification Matrix

Status: canonical verification matrix
Reconciliation date: 2026-09-28

IMPLEMENTED means the machinery exists. TESTED means relevant execution evidence exists. DEPLOYED means deployment evidence exists. PRODUCTION VERIFIED means behavior was demonstrated on the deployed/runtime system. END-TO-END VERIFIED means the whole intended loop was demonstrated. No stronger state is inferred from a weaker one.

| Capability | Implemented | Tested | Deployed | Production Verified | E2E Verified |
|---|---|---|---|---|---|
| Authenticated server boundary | YES | PARTIAL | YES | UNKNOWN | NO |
| Pursuit creation/listing | YES | PARTIAL | YES | UNKNOWN | NO |
| Conversation persistence | YES | PARTIAL | YES | PARTIAL | NO |
| Conversation SSE streaming | YES | PARTIAL | YES | UNKNOWN | NO |
| Adaptive conversation | YES | PARTIAL | YES | UNKNOWN | NO |
| Situation assembly | YES | PARTIAL | YES | UNKNOWN | NO |
| Reasoning Run lifecycle | YES | PARTIAL | YES | PARTIAL | NO |
| Model gateway | YES | PARTIAL | YES | HISTORICAL YES | NO |
| Exa search adapter | YES | TESTS PRESENT, execution not evidenced | YES | UNKNOWN | NO |
| Firecrawl source adapter | YES | TESTS PRESENT, execution not evidenced | YES | UNKNOWN | NO |
| Source persistence/adaptation | YES | PARTIAL | YES | UNKNOWN | NO |
| Source citation lineage | YES | PARTIAL | YES | UNKNOWN | NO |
| Human Action approval/start | YES | PARTIAL | YES | PARTIAL | NO |
| Human Action report to Observation | YES | TESTS PRESENT, live execution not evidenced | YES | UNKNOWN | NO |
| Controlled Action path | YES | PARTIAL | YES | NO EVIDENCE | NO |
| Worker lease/start/finish | YES | PARTIAL | YES | NO EVIDENCE | NO |
| Hermes execution | YES | CONTRACT ONLY | YES | NO | NO |
| OpenCode execution | YES | CONTRACT ONLY | YES | NO | NO |
| Verification observation | YES | PARTIAL | YES | NO | NO |
| Human adjudication | YES | PARTIAL | YES | NO | NO |
| UNKNOWN reconciliation | YES | PARTIAL | YES | NO | NO |
| Browser voice input | UI ONLY | UNVERIFIED | YES | UNKNOWN | NO |
| Vercel cron | CONFIGURED | UNVERIFIED | YES | UNKNOWN | NO |
| Playwright/browser capability | NO | NO | NO | NO | NO |
| Crawlee/Crawl4AI/Apify-like capability | NO | NO | NO | NO | NO |
| Saved social-content connectors | NO | NO | NO | NO | NO |
| Media/document ingestion stack | NO | NO | NO | NO | NO |
| General MCP runtime | NO | NO | NO | NO | NO |
| Proactive continuity | NO | NO | NO | NO | NO |

## Test evidence

Repository contains tests for actor normalization, conversation stream/parsing/commit behavior, human observation parsing, Exa adapter behavior, Firecrawl/source handling, and worker contracts.

Latest CI does not run npm test.

Supabase SQL verification scripts exist for execution control, Run lifecycle, model boundary, and adaptive pursuit. Their presence is not execution evidence.

