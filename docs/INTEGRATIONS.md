# Stryde Integration Truth

Status: canonical integration document
Reconciliation date: 2026-10-02

## Active product path

Model:
- Gemini DIRECT PRIMARY
- OmniRoute FALLBACK
- OpenRouter inactive for this phase
- Groq excluded from the intended product path

Current branch source still contains compatibility for older providers. This is a source-level compatibility surface, not a product requirement.

## Current live integrations

| Integration | State | Evidence |
|---|---|---|
| Supabase | LIVE | ACTIVE_HEALTHY; schema/data inspected 2026-10-02 |
| Vercel | LIVE | current production is old main; current build branch has READY preview |
| Gemini | IMPLEMENTED | live local schema validation; full-turn path rate-limited on free key |
| OmniRoute | IMPLEMENTED + REAL LOCAL PROOF | direct provider probe passed 2026-09-30 |
| Exa | ADAPTER | code exists; production live request not verified |
| Firecrawl | ADAPTER | code exists; production live request not verified |
| Hermes | CONTRACT | tool registered; no live grant/job/attempt proof |
| OpenCode | CONTRACT | tool registered; no live grant/job/attempt proof |
| Voice | UI | browser SpeechRecognition path exists; production unverified |

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
