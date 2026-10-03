# Stryde Verification Matrix

Status: canonical verification matrix
Reconciliation date: 2026-10-03

IMPLEMENTED = machinery exists.
TESTED = relevant execution evidence exists.
DEPLOYED = deployment evidence exists.
PRODUCTION VERIFIED = demonstrated on the deployed system.
END-TO-END VERIFIED = the complete intended loop was demonstrated.

| Capability | Implemented | Tested | Deployed | Production Verified | E2E Verified |
|---|---|---|---|---|---|
| Auth/server boundary | YES | YES local | YES | YES (2026-10-03: real app, 401 without token) | YES local |
| Pursuit creation/listing | YES | YES local | YES | YES (browser, 2026-10-03) | YES local |
| Persistent conversation | YES | YES local | YES | PARTIAL (persistence is live-proven; model turns depend on provider credits) | YES local |
| Conversation SSE | YES | YES local | YES | PARTIAL | YES local |
| Adaptive conversation | YES | YES local | YES | PARTIAL | YES local |
| Situation assembly | YES | YES local | YES | PARTIAL | YES local |
| Model routing/fallback | YES | YES local | YES | NO (env configured 2026-10-03; needs redeploy + funded key) | YES local |
| Real model conversation | YES | YES via OmniRoute locally (2026-09-30); 429-blocked 2026-10-03 | YES | NO | YES local |
| Human action approval/start | YES | YES local E2E | YES | PARTIAL (loop proven live 2026-10-03) | YES local |
| Human action report → Observation | YES | YES local E2E | YES | PARTIAL | YES local |
| Claim + evidence link + adjudication | YES | YES local E2E | YES | PARTIAL | YES local |
| Source ingestion: URL/paste | YES | YES (e2e:evidence-loop: live URL fetch + storage) | YES | PARTIAL (inline URL ingestion proven in browser) | YES local |
| Source ingestion: FILE upload | YES | YES unit + route | YES | NO | YES local (unit + route) |
| Source adaptation/citation | YES | YES (real character-range locators with an honest located flag; e2e:evidence-loop 5/5) | YES | PARTIAL (adaptation itself is model-dependent) | YES local |
| Capability registry/worker gateway | YES | YES | YES | NO | YES local |
| Hermes worker execution (real agent) | YES | YES — SUCCEEDED proof 2026-10-03; failure cycle proven with real agent same day | YES | NO | YES local |
| OpenCode worker execution | YES | YES — real agent, artifact-judged SUCCEEDED proof 2026-10-04 (e2e:opencode-worker 12/12) | YES | NO | YES local |
| Universal composer (one surface) | YES | YES browser | YES | YES (browser 2026-10-03) | YES local |
| Universal composer: file attach | YES | YES unit + browser | YES | NO | YES local |
| Natural-language input classification | YES (input_class on the turn contract) | YES unit | YES | NO | PARTIAL |
| Automatic verification where observable | YES (mechanical URL check: VERIFY_WEB) | YES — e2e:verify-web 6/6 live | YES | NO | YES local |
| Personal memory/reality model | YES (foundation + lifecycle + retrieval + inspectability) | YES unit + live loop | YES | NO | YES local (write paths live) |
| Memory user control (confirm/forget/delete) | YES | YES — e2e:memory-loop 9/9 (confirm/forget/delete + contradiction flip + cross-session retrieval) | YES | NO | YES local |
| User-configurable authority/autonomy policy | YES (tighten-only policy; approval semantics untouched) | YES unit + enforcement + browser | YES | NO | PARTIAL |
| Multi-provider adaptive evidence acquisition | YES (configured-provider search chain: Exa + Firecrawl; JS-rendered page observation via the approved Firecrawl adapter) | YES mock + live DIRECT path; Firecrawl legs mock-only (no key) | YES | NO | YES local |
| Proactive continuity | YES (cron: reconcile + SYSTEM check-in, idempotent) | YES live cron + unit 16 | YES | NO (needs CRON_SECRET on deployed env — set 2026-10-03) | YES local |
| Browser capability | NO (runtime) — the product need (JS-rendered pages) is served by the Firecrawl render fallback 2026-10-04 | mock-proven | NO | NO | NO |
| Document/media ingestion beyond text/PDF | NO (media stack: open decision) | NO | NO | NO | NO |
| General MCP runtime | NO | NO | NO | NO | NO |
| Social/community | NO (out of V1 by decision) | NO | NO | NO | NO |

## Evidence

2026-09-30 (earlier pass):
- npm test 51/51;
- e2e:human 14/14;
- probe:provider -- omniroute PASSED;
- e2e:model PASSED 11 boundaries via Gemini 429 → OmniRoute fallback;
- browser verification showed real model working-state UI locally.

2026-10-03 (live-system pass):
- npm test 64/64 (4 new tests pin the working-state normalization boundary);
- typecheck, lint, and production build all clean;
- e2e:human PASSED 14/14 against the LIVE Supabase project (pvijrnwdnolvnoibarrj)
  — pursuit creation, working-state seeding, action start, exactly-once
  replay, completion, FAILED cycle, claim creation, evidence linking, human
  adjudication to VERIFIED. This is live-database evidence, not local-only;
- probe:provider -- gemini PASSED both live contracts (ConversationTurn and
  WorkingState) against a real provider;
- migration parity 30/30, zero divergence;
- RLS tenant isolation and RPC privilege posture verified empirically.

2026-10-03 (later): CONTROLLED worker plane
- three defects that made the worker plane unreachable were found and fixed:
  the dispatcher crashed on start (TypeScript parameter properties are not
  supported by `node --experimental-strip-types`), never loaded .env.local, and
  read an empty queue as a leased job (a NULL composite row is a non-null JS
  object), failing every poll with 22P02 and stalling the whole queue;
- npm run e2e:controlled PASSED 18/18 boundaries against live Supabase;
- live job/attempt counts moved from 0 to 12 SUCCEEDED, and
  MECHANICAL_ATTEMPT_RESULT observations from 0 to 15.

2026-10-03 (capability completion pass — see STATE.md for the full narrative):
- 127/127 unit tests, typecheck, lint, production build clean;
- e2e:human PASSED 14/14 again after the capability work;
- e2e:verify-web NEW — PASSED 6/6 against live Supabase (mechanical
  verification: MATCHED → VERIFIES link → OBSERVED; MISMATCHED → CONTRADICTS
  link → OBSERVED; SSRF-guarded loopback → honest UNREACHABLE observation,
  claim stays REPORTED; nothing reaches VERIFIED mechanically);
- e2e:controlled PASSED 19/19 again (SUCCEED / FAIL / UNKNOWN honesty);
- e2e:real-worker: dispatch plane proven against the real agent; the agent's
  own build-time model returned 429 (daily free quota), and the plane reported
  FAILED honestly with the error preserved. The SUCCEEDED proof from earlier
  the same day stands (artifact-based);
- continuity cron exercised live: fail-closed 404 without the secret; with it,
  11 idle pursuits nudged, 1 expired lease reconciled; immediate re-run nudged
  0 (idempotent); nudge visible in the browser conversation;
- e2e:ui PASSED 12/12 in a real browser against a production build,
  including NEW boundaries: claims/evidence panel, memory panel, source
  material panel, and autonomy control are reachable as contextual disclosure,
  and internal ontology is still absent from primary UI (headings/buttons);
- e2e:model honestly FAILED on 429: no provider with available quota existed
  at run time (OpenRouter unfunded, Gemini daily quota exhausted, OmniRoute
  tailnet). The real-provider proof from 2026-09-30 (11 boundaries) stands;
- a latent live defect was found and fixed: research and URL-verification
  observations were written through the user's RLS client, but migration
  20260915000200 had removed owner INSERT on observation, so WEB_SEARCH_RESULT
  observations were silently dropped (unchecked error, observation_id null)
  since 2026-09-30. Both paths now record through the trusted plane;
- an integration gap was found and fixed: claims-panel.tsx and work-panels.tsx
  were never imported by any page — the only human adjudication surface and
  the source-material surface were unreachable in the browser despite working
  APIs. Both are now mounted as contextual disclosure on the pursuit page.

2026-10-04 (final closure pass):
- 173/173 unit tests (deterministic clock in the ranking tests — three
  consecutive clean full-suite runs), typecheck, lint, production build clean;
- e2e:opencode-worker NEW — PASSED 12/12 against a REAL OpenCode agent:
  job SUCCEEDED, CONTROLLED action COMPLETED, observation attributed to
  OPENCODE with the attempt correlation id, one real artifact proof.md
  judged by content, nothing auto-verified. The first run was an honest
  FAILED cycle that exposed (and fixed) a Windows spawn defect;
- e2e:memory-loop NEW — PASSED 9/9 against live Supabase: reality report to
  USER_REPORTED ACTIVE memory; user confirm/forget/delete; outcome learning
  (VERIFIED claim to durable memory); contradiction (CONTRADICTED claim to
  memory flip with history kept); cross-session continuation (a NEW
  session adaptive situation carries live memories and prior episodic
  history and excludes contradicted/forgotten memories);
- e2e:evidence-loop NEW — PASSED 5/5: unauthenticated ingestion refused;
  file upload extracted and stored with FILE provenance; live URL ingestion;
  materialization with a source-bound citation; search and adaptation legs
  degrade honestly where credentials/quota are absent;
- citation locators are real now: normalized-search with offset mapping
  yields actual character ranges plus a located flag; unlocatable
  statements fall back to full-range honestly (8 new tests);
- research gained a configured-provider chain (Exa + Firecrawl search,
  STRYDE_SEARCH_PROVIDER chooses order) wired into the research route and
  executeWebResearch; page observation (VERIFY_WEB and URL ingestion) now
  records its renderer and falls back to the approved Firecrawl scrape for
  JS-rendered pages when a key is configured (mock-proven; the live DIRECT
  path was proven against the real web);
- UX closure: the duplicated execution surface (work-panels Execution vs the
  pursuit page primary card) is fixed; pursuit lists are capped at 30 with
  an honest hint; e2e:ui 12/12 in a real browser;
Still NOT established by any of the above:
- production verification of the CURRENT tree (the closure pass is deployed
  in this delivery; each capability row's Production column reflects the
  runtime that was live when it was proven);
- a production-viable model credential (OpenRouter $0.00 credits — the ONLY
  external dependency left) and search/research provider keys (EXA_API_KEY,
  FIRECRAWL_API_KEY are absent from the build environment; every code path
  degrades honestly without them);
- the browser RUNTIME itself (intentionally deferred: no pre-approved
  provider per INTEGRATIONS policy, and serverless cannot host a browser);
- model quality under sustained production load.

## Verification rule

Stryde should progressively remove verification work from the user when a reliable observation path exists. User reporting is a reality input, not an obligation to manually adjudicate facts that the system can establish itself.

