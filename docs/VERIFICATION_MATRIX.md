## Reconciliation update — 2026-10-06 post-GLM

- **CI:** current main `1e3b7d7` has GitHub Actions `verify = SUCCESS`. The old Linux/Node path defect described in the earlier reconciliation was fixed in GLM's execution lineage, and current main includes that repair.
- **Database:** live migration parity is now **37/37**. `user_agent_preference`, `skill`, `skill_version`, and `funnel_event` are live with RLS enabled. The earlier pending-migration statements below are historical.
- **Production model:** current health configuration resolves OpenRouter to `nvidia/nemotron-3-super-120b-a12b:free`, Gemini fallback, OmniRoute disabled. This is configuration evidence only.
- **Production reliability:** a fresh full conversation journey after the streaming malformed-output failover repair is still required. Do not promote this to PRODUCTION VERIFIED until the post-fix journey is observed on current main.
- **Research:** Exa/Firecrawl live credentials remain absent; live research legs remain externally blocked.
- **Billing/resource entitlements:** Free/Pro/Max budgeting and enforcement remain implementation targets, not production-proven capabilities.
- **Issue #7:** capability-composition layer has not yet been implemented. The next engineering phase is governed by `docs/GLM_MASTER_IMPLEMENTATION_BRIEF.md`.

# Stryde Verification Matrix

Status: canonical verification matrix
Reconciliation date: 2026-10-05; reconciliation note added 2026-10-06

IMPLEMENTED = machinery exists.
TESTED = relevant execution evidence exists.
DEPLOYED = deployment evidence exists.
PRODUCTION VERIFIED = demonstrated on the deployed system.
END-TO-END VERIFIED = the complete intended loop was demonstrated.

## Reconciliation note (2026-10-06)

- GitHub Actions CI is RED on bc8e92e and every Issue #6-pass commit since
  e393140: the Unit tests step fails on Linux/Node 22 because
  tests/mcp-client.test.ts computes the repo root with a Windows-only path
  expression (210/210 pass on Windows; root-cause analysis in docs/STATE.md).
  Vercel does not execute the test suite, so DEPLOYED below is not
  CI-backed for those commits. Fixing CI is scheduled engineering work.
- Five migrations are pending live: 20261005000000, 20261005010000,
  20261005020000, 20261005030000, 20261005040000. The browser/MCP
  registration rows already exist on the live project (runtime-provisioned
  2026-10-05), so those two migrations are to be mark-applied after a row
  parity check, not re-run (docs/STATE.md 2026-10-06).
- Production `/api/health/model ready=true` is configuration evidence. The
  production generation proof remains the 2026-10-05 live conversation.
- Live funnel_event/user_agent_preference/skill/skill_version tables do not
  exist yet; every PRODUCTION column entry that depends on them stays NO,
  and production runtime errors currently include the funnel_event
  missing-table message.

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
| Capability registry/worker gateway | YES | YES — bearer auth enforced server-side (fail-closed), verified live | YES | NO | YES local |
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
| Browser capability | YES (BROWSER worker type + scripts/browser-worker.ts: real headless Edge/Chrome render, OBSERVE_PAGE bounded authority, SSRF guard) | YES — e2e:browser-worker 14/14 (real render, content-judged artifacts, nothing auto-verified) | YES | YES (2026-10-05: worker.browser tool registered on the live project; E2E ran against the live DB) | YES local + live-plane |
| Stryde Skills (procedural memory) | YES (skill + skill_version tables, security scan, scan-gated lifecycle, approval gate, usage tracking, rollback-as-new-version, contextual UI panel) | YES — e2e:skills-agent (16-boundary suite covers clean/flagged/blocked lifecycle, revision, rollback, situation surfacing, archive semantics) | YES | NO — live DDL is an operator step (see below); product code fails open | YES local (local Supabase stack, all migrations) |
| Agent selection (global + per-pursuit override + auto) | YES (user_agent_preference, situation-resolved hint; unconnected preference degrades honestly) | YES — e2e:skills-agent | YES | NO — live DDL is an operator step; product code fails open | YES local |
| MCP capability transport | YES (MCP worker type + first-party JSON-RPC 2.0 stdio client; one bounded tool call per job via next_move.tool_call; STRYDE_MCP_SERVERS config) | YES — e2e:mcp-worker 10/10 (real MCP stdio server round-trip, content-judged) | YES | YES (worker.mcp registered on the live project; E2E ran against the live DB) | YES local + live-plane |
| Voice input | YES (SpeechRecognition dictation in the composer feeding the same turn pipeline; graceful unsupported degradation) | YES browser | YES | YES (2026-10-05 production browser pass) | YES |
| Market instrumentation (first-party funnel) | YES (funnel_event table + lib/instrumentation: SIGNUP → PURSUIT_CREATED → FIRST_TURN → ACTION_STARTED → WORKER_EXECUTION → VERIFIED_OUTCOME → RETURN_SESSION → PAID_CTA_CLICK; counters with scope, no content; fail-open) | YES (all write paths exercised by the E2E suites; queryable via GET /api/v1/events) | YES | NO — live DDL is an operator step; product code fails open | YES local |
| Paid access | YES (honest 503 when unconfigured; real Stripe Checkout via platform-native fetch when configured; founding CTA records PAID_CTA_CLICK; activation runbook in docs/PAID_ACCESS.md) | YES (401/503 paths + client flow) | YES | PARTIAL (route live, honestly unconfigured until the operator adds Stripe keys) | YES local |
| Context Compiler | YES (lib/context-compiler.ts: task-specific packet, relevance+recency+importance ranking, budget with value-ordered drops, compression with recoverable originals, supersession filtering, persisted selection report) | YES — 8 unit tests + every turn/E2E exercises it | YES | YES (live turns serve compiled packets; context_selection persisted in turn metadata) | YES |
| Public landing (market UX) | YES ("What are you trying to make happen?" hero, three-step value story, zero internal ontology) | YES — e2e:ui 12/12 incl. no-ontology checks | YES | YES (2026-10-05: e2e:ui against https://stryde-topaz.vercel.app) | YES |
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
- live application of migrations 20261005010000 (agent preference),
  20261005020000 (skills), 20261005040000 (funnel events) — this environment
  deliberately holds no Supabase DDL credentials (RUNTIME.md); the product
  fails open without them and the full behavior is proven on the local
  Supabase stack. Operator step: apply these three migrations (Supabase CLI
  or dashboard SQL editor);
- a production-viable model credential (OpenRouter $0.00 credits — the ONLY
  external dependency left) and search/research provider keys (EXA_API_KEY,
  FIRECRAWL_API_KEY are absent from the build environment; every code path
  degrades honestly without them);
- the browser RUNTIME itself (intentionally deferred: no pre-approved
  provider per INTEGRATIONS policy, and serverless cannot host a browser);
- model quality under sustained production load.

## Verification rule

Stryde should progressively remove verification work from the user when a reliable observation path exists. User reporting is a reality input, not an obligation to manually adjudicate facts that the system can establish itself.


## Evidence (2026-10-05 — Issue #6 product-closure pass)

Baseline: e393140 (verified recovery baseline, untouched; built forward on top).

New product capabilities, all vertical slices (commit range cc3081e..646db26):
- Context Compiler (3a4e5ef): the full Situation is no longer replayed into
  every model call. Packets are task-specific, budgeted, relevance-ranked,
  compressed with recoverable originals, supersession-filtered, and every
  inclusion/drop is persisted in turn metadata (context_selection).
- Pursuit intake (cc3081e): a pursuit can start from a goal, an existing
  roadmap, or a messy dump (120k chars) — ingested as a hash-bound PASTED
  source with PURSUIT_INTAKE provenance and interpreted, never prompt-dumped.
- BROWSER worker (a525857): real headless render through the CONTROLLED
  plane; SSRF-guarded; artifacts content-judged; browser_success_is_not_
  verification declared in the tool's verification capability.
- Agent selection + Skills (f901eca): policy B (global preference, pursuit
  override, Stryde auto; hint not authority) and decision C skills (security
  scan BLOCKED/FLAGGED/PASS, auto-activate clean, approval gate flagged,
  refuse blocked, append-only versions, rollback-as-new-version, usage
  tracking, archive semantics, contextual UI panel).
- MCP transport (9000bd4): first-party JSON-RPC 2.0 stdio client; MCP worker
  type with bounded one-tool-call jobs via next_move.tool_call; reference
  echo server doubles as the worked example.
- Instrumentation + paid + landing (3ed8233): first-party funnel with
  fail-open recording; honest founding-access path (503 until Stripe keys;
  real Checkout when configured; docs/PAID_ACCESS.md runbook); market-ready
  signed-out hero with zero ontology.
- Two latent control-plane defects repaired (3475417): FAILED human actions
  now mechanically always carry blockers (the model could return none —
  earlier passes had only seen the 429 fallback path); fresh worker-capability
  provisioning crashed on a NOT NULL violation (only the renewal path had
  ever been exercised).
- One production defect found and fixed by actually exercising the production
  conversation (646db26): a hallucinated memory candidate type failed the
  whole turn; candidates are proposals and are now dropped individually.

Live/real verification runs (2026-10-05, against the live Supabase project
and the production build):
- npm test 210/210; typecheck, lint, production build clean;
- e2e:human 14/14; e2e:memory-loop 9/9; e2e:evidence-loop 5/5;
  e2e:verify-web 6/6; e2e:controlled 19/19; e2e:opencode-worker 12/12
  (real agent through the authenticated path);
- e2e:browser-worker 14/14 (real headless render of a live page);
- e2e:mcp-worker 10/10 (real MCP stdio round-trip);
- e2e:skills-agent 16/16 (local Supabase stack, all 33 migrations);
- e2e:ui 12/12 against PRODUCTION (https://stryde-topaz.vercel.app):
  hydrate, sign-in, session, pursuit list, pursuit page, contextual panels,
  no-ontology checks;
- production conversation verified live on the deployed product: messy-dump
  intake stored and adapted (warning null), a real model turn served by the
  provider chain (openrouter) with adaptive question + options + working
  state, context_selection persisted.

Deployment: production deployment Ready (Vercel project stryde). The public
surface is https://stryde-topaz.vercel.app (project domain, exempt from Vercel
SSO deployment protection; the direct deployment URLs remain SSO-gated).

HUMAN ACTION REQUIRED (recorded, not engineering):
- apply migrations 20261005010000 / 20261005020000 / 20261005040000 to the
  live project (agent preference, skills, funnel events) — no DDL credential
  in this environment by design; product code fails open meanwhile;
- optional: fund Stripe keys to open founding access (runbook exists);
- optional: EXA/FIRECRAWL keys for live research legs (unchanged from 10-04).
