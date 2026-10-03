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
| Vercel | LIVE | 2026-10-03: owner access restored; production surface verified as this application (stryde-topaz.vercel.app); env contract set (SUPABASE_SECRET_KEY, CRON_SECRET, provider chain); production promotion of the verified tree is the remaining step |
| Gemini | IMPLEMENTED | live local schema validation; full-turn path rate-limited on free key |
| OmniRoute | IMPLEMENTED + REAL LOCAL PROOF | direct provider probe passed 2026-09-30 |
| Exa | ADAPTER + CHAIN | search-provider chain added 2026-10-04 (Exa preferred when configured; Firecrawl search second); observation recording on the trusted plane; no Exa key in the build environment, so the live request remains unverified |
| Firecrawl | ADAPTER + RENDER FALLBACK | 2026-10-04: search provider and JS-rendering scrape fallback for page observation and URL ingestion (direct fetch first; scrape when the direct body is a thin JS shell); mock-proven only — no key in the build environment |
| Hermes | IMPLEMENTED + REAL PROOF | real agent executed a real unit of work through the full CONTROLLED plane 2026-10-03 (e2e:real-worker 11/11, artifact-judged); failure cycle honestly reported the same day |
| OpenCode | IMPLEMENTED + REAL PROOF | real agent executed a real unit of work through the full CONTROLLED plane 2026-10-04 (e2e:opencode-worker 12/12, artifact-judged); sandboxed per-job directories; timeout-UNKNOWN and empty-artifact-FAILED epistemics identical to Hermes |
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
