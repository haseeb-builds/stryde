# Stryde Current State

## 2026-10-06 — final truth reconciliation (current snapshot)

This section is the current verified reality. Everything below it is
historical evidence and is preserved as written; where an older section
contradicts this one, this one wins. Labels: CONFIRMED (directly verified on
2026-10-06), INFERRED (evidence-backed conclusion), UNKNOWN, BLOCKED
(externally gated).

### Repository

CONFIRMED:
- `main` at bc8e92e87f36aa539da301c8ab896caa4e80f6eb; working tree clean;
  pushed; this commit is what production serves.
- 37 migration files under `supabase/migrations/`.

CONFIRMED (open defect):
- GitHub Actions CI ("Stryde CI") is RED on every commit of the Issue #6
  pass: runs 210, 211, 212 (commits 3475417, 646db26, bc8e92e) all fail at
  the "Unit tests" step. Last green run: e393140 (2026-10-04). Vercel does
  not execute the test suite, so production was deployed from a commit with
  red CI — deployment success is not test evidence.
- Root cause (CONFIRMED by code analysis; the raw CI log was not retrievable
  without an admin token): `tests/mcp-client.test.ts` derives the repo root
  from `new URL(import.meta.url).pathname.replace(/^\//, "")`, which is
  correct only on Windows. On Linux it resolves to `<cwd>/app`, the echo
  server file does not exist there, and both MCP transport tests fail. The
  suite passes 210/210 locally on Windows (re-run 2026-10-06, 2.3s). The fix
  is a one-line `fileURLToPath` repair plus the explicit-`.ts` convention the
  repo already uses; it is engineering work and is deliberately NOT part of
  this documentation-only commit.

### Production (Vercel)

CONFIRMED:
- https://stryde-topaz.vercel.app serves this application (landing 200); the
  production alias resolves to deployment stryde-dt58xyg2s (Ready,
  2026-10-05), commit bc8e92e.
- `/api/health/model` (2026-10-06): `preferred_provider=openrouter`,
  `canonical_chain=[gemini,openrouter,omniroute]`, `disabled=[omniroute]`,
  `providers=[openrouter/free, gemini-flash-latest]`, `ready=true`.
  This is CONFIGURATION evidence: it proves the chain is resolvable, not
  that generation succeeds. The latest generation proof on production remains
  the 2026-10-05 live conversation recorded in the Issue #6 report.
- RESEND_API_KEY is still present on the Vercel project (Production+Preview,
  created ~2026-08-10). Zero code references remain (the `resend` dependency
  was removed 2026-10-04; verified by repo-wide grep 2026-10-06). It is stale
  configuration; removal is scheduled for the Phase 2 production-closure
  commit.
- No EXA / FIRECRAWL / Stripe keys are configured on the project. BLOCKED on
  human-owned credentials (unchanged).

CONFIRMED (open defect, self-resolving once the migration is applied):
- Production runtime errors include "Could not find the table
  'public.funnel_event' in the schema cache". Cause: the first-party funnel
  instrumentation is fail-open and its table does not exist live (below).

### Database (live Supabase pvijrnwdnolvnoibarrj)

CONFIRMED (2026-10-06, via `supabase migration list` and REST introspection):
- 32 of 37 migrations applied live. Missing versions:
  20261005000000 (register worker.browser tool),
  20261005010000 (user_agent_preference),
  20261005020000 (stryde skills),
  20261005030000 (register worker.mcp tool),
  20261005040000 (funnel events).
- Tables `user_agent_preference`, `skill`, `skill_version`, `funnel_event`
  do NOT exist live (REST 404). Product code fails open without them.
- The live `tool` registry has 4 rows: worker.hermes v1 and worker.opencode
  v1 (2026-09-26), worker.browser v1 (created 2026-10-05T07:24Z) and
  worker.mcp v1 (created 2026-10-05T09:59Z). The browser and MCP rows were
  created by runtime provisioning during the 2026-10-05 live-plane E2E runs;
  their migration files are plain INSERTs with no ON CONFLICT clause, so the
  correct reconciliation for 20261005000000 / 20261005030000 is "verify row
  parity against the migration contract, then mark the migrations applied" —
  NOT a blind re-run, which would collide with the existing rows.

INFERRED:
- Migration parity can be restored to 37/37 with no data changes: apply the
  three table migrations normally; mark the two registration migrations
  applied after the row-parity check.

Live row counts (2026-10-06 snapshot; these include E2E harness data written
into the live project during verification passes):
- pursuit 153; conversation_session 149; conversation_message 234;
  tool 4; capability_grant 6; job 57; attempt 55; observation 121;
  claim 62; action 122; decision 123; run 16; event 941; memory_item 31;
  user_autonomy_policy 0.

### Supabase CLI access

CONFIRMED:
- The Supabase CLI in the current working environment IS linked and
  authenticated (`supabase migration list` succeeds against the live
  project). The 2026-10-05 note that "this environment holds no DDL
  credential by design" no longer describes reality; the operator step it
  deferred can now be performed directly.

### Issue #6

CONFIRMED:
- Issue #6 is OPEN. Its body carries the product mandate and locked
  decisions; two comments exist: the locked product decisions
  (2026-10-05T06:59Z) and the execution report for main e393140..bc8e92e
  (2026-10-05T11:02Z).
- The execution report listed as remaining: apply migrations
  20261005010000 / 20261005020000 / 20261005040000 and the optional
  Stripe / EXA / FIRECRAWL keys. Current reality adds three items the report
  could not have known: the two registration migrations are also unapplied
  (with their effects already provisioned live), CI is red on the whole
  pass, and the missing funnel_event table is producing production runtime
  errors.

### Handoff documents

CONFIRMED:
- The handoff document is `/HANDOFF.md` at the repository root. It has NEVER
  existed at `docs/HANDOFF.md` (no such path in history). Its 2026-10-02
  content (branch-lineage warnings, provider state, zero-jobs database
  snapshot) was stale; it has been rewritten to current truth in this
  reconciliation pass. Historical references to "HANDOFF items 2-5" in the
  2026-10-03 section below refer to that root document as it stood then.

### Not established (unchanged, honestly)

- Production model generation under sustained load; the production worker
  runtime (no publicly reachable worker endpoint exists — every real-agent
  proof to date ran on the local worker plane); browser runtime hosting
  (serverless cannot host one); research legs without keys (every path
  degrades honestly); billing (honest 503 until keys). Distinguish:
  implemented / tested / deployed / production-proven per
  docs/VERIFICATION_MATRIX.md.

---

## 2026-09-30 phase update — two-provider architecture

Provider decision (product authority): the active model chain is now
**Gemini DIRECT PRIMARY → OmniRoute FALLBACK**; OpenRouter is inactive for this
phase. Implemented in commit 4acb6a9 on `codex/model-routing-migration-clean`:

- `STRYDE_PROVIDER_DISABLED` added to the router (lib/model-provider.ts) as the
  single chain-removal mechanism; OpenRouter is disabled in the active
  environment and its env vars removed. Chain resolution, preferred-provider
  skip, and fail-fast are unit-tested; /api/health/model reports the disabled
  list.
- Real-provider proof harnesses added: `npm run probe:provider -- gemini|omniroute`
  (named provider vs. the verbatim ConversationTurn + working-state contracts)
  and `npm run e2e:model` (full vertical loop with a real provider, honest skip
  without credentials). Both executed 2026-09-30: honest SKIP — no usable
  provider, because no Gemini or OmniRoute credentials exist in this
  environment. Credentials were then configured by the product authority the same day:

  - `probe:provider -- omniroute` PASSED live (schema-valid ConversationTurn + WorkingState).
  - Gemini live probing exposed and fixed three real schema-conversion defects (type arrays,
    additionalProperties, numeric enums) plus the delisting of gemini-2.5-flash (now
    gemini-flash-latest, thinking budget configurable); requests validate, but the free-tier key
    is 429 rate-limited on the large turn prompt — Gemini direct verification remains partial.
  - Two fallback bypasses fixed: the adaptive /work controller and human report interpretation
    called a single configured leg; both now route through the full chain.
  - `e2e:model` PASSED 11 boundaries with a real provider, with live fallback engaged
    (Gemini 429 → OmniRoute served every turn). e2e:human 14/14 after the changes.
- Full suite green under the new architecture: 56/56 unit tests, typecheck,
  lint (1 pre-existing warning), production build, e2e:human 14/14 boundaries.

Senior-engineering consolidation pass (same day, HEAD after e4a1cab): removed the dead legacy
model transports and helpers from lib/model-gateway.ts (609 -> 258 lines) and lib/adaptive-model.ts
(471 -> 329 lines), the unused getModelProvider single-leg accessor, and unused imports/constants;
zero lint warnings. All verification re-run green: 57/57 unit tests, typecheck, lint, build,
e2e:human 14/14, e2e:model 11 boundaries with a real provider. No behavior or contract changed.

The 2026-09-30 (morning) update and 2026-09-28 reconciliation follow.

Status: canonical current-state document
Reconciliation date: 2026-10-06 (current snapshot at the top of this file;
the dated sections below are preserved historical evidence)

This file describes current verified reality only. It does not describe desired future functionality. Historical implementation notes belong in the STEP documents and earlier commits.

## Repository

CONFIRMED:
- Repository: haseeb-builds/stryde
- Branch: main
- Reconciliation baseline commit: 2420caa605e15ee59ca0472dd1975f7c7d1d8731
- Reconciliation documentation commit: 17a1482f272ed5abc14d57a81feaf9201a0674d8
- Local working tree was not available to this control-room environment; GitHub main was used as repository truth.

The current commit recorded above is the commit used for this reconciliation snapshot. Subsequent documentation-only changes may advance main.

## Deployment

CONFIRMED:
- GitHub reported Vercel deployment completion for baseline commit 2420caa605e15ee59ca0472dd1975f7c7d1d8731.

UNKNOWN:
- Current deployed page behavior.
- Current production runtime logs.
- Current Vercel environment variables.
- Whether the current deployed environment uses Gemini, Groq, or OpenRouter.
- Whether the latest deployed route can complete the full authenticated conversation loop.

Reason: direct Vercel access is currently denied by the connected Vercel integration.

## Database

CONFIRMED:
- Supabase project pvijrnwdnolvnoibarrj.
- Observed region: ap-southeast-1.
- Observed health: ACTIVE_HEALTHY.

Live row counts at reconciliation:
- pursuits: 3
- conversation_session: 6
- conversation_message: 5
- pursuit_source: 0
- pursuit_source_adaptation: 0
- pursuit_source_citation: 0
- tool: 2
- capability_grant: 0
- job: 0
- attempt: 0
- observation: 0
- claim: 0
- action: 1
- decision: 1
- run: 16
- event: 98

Current live Action:
- HUMAN
- IN_PROGRESS

Current live Decision:
- ACTION_APPROVAL
- RESOLVED

## Current Run state

CONFIRMED:
- 7 Runs are FAILED.
- 6 Runs are RUNNING at AUTHORIZE.
- 1 Run is RUNNING at INPUT.
- 2 Runs are RUNNING at REASSESS.
- Several RUNNING records were created more than a week before this reconciliation.

INFERRED:
- Some RUNNING records may represent abandoned/stale workflow instances, but this is not established as a defect without lifecycle-specific investigation.

## Conversation state

CONFIRMED:
- Conversation persistence tables exist.
- Six sessions exist; three ACTIVE and three ARCHIVED.
- Five conversation messages exist.
- The live database contains persisted working_state on at least one active session, including a derived objective, bottleneck, unknowns, and HUMAN CREATE_ACTION next move.
- Current code contains SSE streaming and exactly-once commit logic.

UNKNOWN:
- The deployed conversation route currently works end-to-end.

CONTRADICTED historical documentation:
- Older STATE/EVALS/STEP19 documents described durable transcript storage or active streaming as incomplete. Current repository code and live schema are more advanced than those descriptions.

## Current model state

CONFIRMED:
- Repository adapter supports Gemini, Groq, and OpenRouter.
- Repository source default is Gemini when no provider override is present.
- Historical live Run failures from 2026-09-18 contain OpenRouter-specific 429/404 errors.

UNKNOWN:
- Current deployed provider and model configuration.

CONTRADICTED:
- Existing historical decision documentation says Gemini is current primary while STEP19_MODEL_GATEWAY says OpenRouter/openrouter-free is current.

## Source/research state

CONFIRMED:
- Exa HTTP search adapter exists.
- Firecrawl HTTP source extraction adapter exists.
- Source ingestion handles public URLs and pasted content.
- Source adaptation and citation structures exist in database.
- Source tables currently have zero rows.

UNKNOWN:
- Current deployed Exa/Firecrawl credentials and successful production requests.
- Current end-to-end research/source workflow on Vercel.

## Human execution state

CONFIRMED:
- HUMAN Action path exists in code.
- Live database contains one HUMAN Action currently IN_PROGRESS.
- Live database contains one RESOLVED ACTION_APPROVAL Decision.

UNKNOWN:
- Whether the complete live human Action → report → Observation → reassessment loop has been successfully exercised.

CONFIRMED:
- Observations table currently contains zero rows.

## Controlled execution / workers

CONFIRMED:
- Tool table exists.
- Two tools are registered:
  - worker.hermes v1
  - worker.opencode v1
- Worker gateway, contract validation, dispatcher, lease/start/finish/reconcile routes exist.
- Worker-only database RPC privileges exist for lease/start/finish/reconcile/observation.
- CapabilityGrant count is zero.
- Job count is zero.
- Attempt count is zero.
- Observation count is zero.

CONCLUSION:
- Worker infrastructure: IMPLEMENTED.
- Real worker execution: NOT PROVEN.
- Production end-to-end worker loop: NOT VERIFIED.

## Verification

CONFIRMED:
- Observation, Claim, ClaimObservationLink, ClaimRelation, and ClaimStatusEvent structures exist.
- Human adjudication and worker observation RPCs exist.
- LLM/model output is not the authority for VERIFIED status in the current design.
- Claims count is zero.
- Observations count is zero.

CONCLUSION:
- Verification primitives: IMPLEMENTED.
- Real evidence/verification cycle: NOT PROVEN END-TO-END.

## CI/test state

CONFIRMED:
- Latest successful GitHub Actions run for baseline commit 2420caa... ran npm ci, TypeScript typecheck, ESLint, and production build.
- Repository has node:test tests for actor, conversation stream/commit, Human Observation, Exa, Firecrawl/source handling, and worker contracts.
- Supabase SQL verification scripts exist for execution control, Run lifecycle, model boundary, and adaptive pursuit.

UNKNOWN:
- Whether npm test was executed for this reconciliation.
- Whether the Supabase SQL verification scripts were executed against the current live database during this reconciliation.

Important:
- CI does not run npm test. Therefore the existence of tests is not equivalent to a passing latest CI test suite.

## Migration state

RECONCILED 2026-10-02 (verified via `supabase migration list`):
- Repository and live migration history match one-to-one: 28 migrations, zero divergent.
- The duplicate version 20260915000500 was resolved by renaming 20260915000500_stryde_verification_engine.sql to 20260915000550_stryde_verification_engine.sql.
- The formerly live-only restore migrations (20260927083712_restore_pursuit_source_citation, 20260927083847_restore_conversation_turn_rpc) and 20261002143729_personal_memory_foundation were fetched into the repository.
- The formerly repository-only versions were marked applied on live via `supabase migration repair` after schema verification confirmed their effects exist live (pursuit_source_citation table and policies, conversation_message turn_key indexes and RPCs). Repair writes only to supabase_migrations history; no live data was modified.
- `db push` and fresh-environment reproduction from the repository lineage are now unblocked; the reset prohibition below remains in force as general policy.

## RLS / privilege state

CONFIRMED:
- RLS is enabled on core tables.
- Security advisor reports one INFO finding for legacy public.loops having RLS enabled with no policies.
- Security advisor reports WARN findings for four SECURITY DEFINER RPCs callable by authenticated users.
- Live privileges show anon/PUBLIC EXECUTE on some mutation RPCs including stryde_commit_intervention, stryde_create_claim, and stryde_create_thread, although their function bodies check auth.uid().
- pursuit_source_citation INSERT policy contains a tautological source.pursuit_id = source.pursuit_id predicate.

UNKNOWN:
- Exact exploitability/security impact of the citation-policy anomaly and broader function privilege surface.

## Missing capabilities

NOT IMPLEMENTED IN CURRENT REPOSITORY:
- Playwright/browser automation runtime.
- Crawlee/Crawl4AI/Apify-style actor runtime.
- Browser Use/Stagehand/Skyvern/Steel.
- General MCP runtime.
- Social saved-content connectors.
- Media ingestion/transcription stack.
- Dedicated document extraction stack.
- Proactive continuity engine.
- General connector/OAuth subsystem.
- Dedicated sandbox/VM execution substrate.

These are future capabilities, not current defects in the existing verified slice.

## Biggest current bottleneck

The single biggest bottleneck is lack of current production end-to-end evidence for the core loop, caused primarily by unavailable Vercel runtime access.

Migration drift is the biggest engineering-risk contradiction, but it is secondary to first establishing observable production behavior.

## Smallest high-leverage next action

Restore Vercel project/runtime access and run a read/verify-only production test of the existing flow:

sign in → create/open Pursuit → create/open Conversation → send message → receive model response → verify final response persisted once → reload → verify history/working state → inspect corresponding Supabase records and runtime evidence.

Do not change code or schema until the failure is classified.

## 2026-10-02 evening engineering pass (this branch, HEAD 986a11e)

Proven live (all on 2026-10-02):

- Provider reliability repair: the router now retries a retryable failure in place
  (3 attempts, exponential backoff, `STRYDE_MODEL_RETRY_BASE_DELAY_MS` tunable)
  before failing over to the next provider leg. Motivated by server-confirmed
  Gemini behavior: identical structured requests return 200 / 503 "high demand"
  / 429 intermittently. 60/60 unit tests including new retry semantics.
- Gemini free-tier reality (server-confirmed quota body): the current key's
  `gemini-flash-latest` free tier allows 20 requests/day. Quota exhausted
  2026-10-02 ("retry in 8h30m"). Free tier is structurally non-viable for a
  public product; this is a product-authority billing decision, not an
  engineering defect.
- OmniRoute local server had stopped (502 through the tailnet proxy); restarted
  via `omniroute restart`. `probe:provider -- omniroute` PASSED both live
  contracts (ConversationTurn 8.3s, WorkingState 3.1s, auto/smart).
- `e2e:model` PASSED 11 boundaries with the real provider (OmniRoute serving).
  `e2e:human` PASSED 14 boundaries (BASE_URL now honors process env over
  .env.local; port 3000 is occupied by an unrelated local app).
- Branch Vercel previews were FAILING for the whole parallel-session lineage
  (verified back to commit 075cb1e) because of two latent type defects in the
  memory/research work: `ConversationMemoryCandidate` was referenced but never
  defined, `ConversationTurn` lacked `memory_candidates`, and the /work route
  lost `next_move` narrowing across the research try/catch. Fixed at 986a11e;
  Vercel preview build status for 986a11e: SUCCESS (GitHub commit status).
- Authenticated browser E2E on the local dev server: signed in through the
  universal surface, created a real pursuit from one sentence, and held a
  3-turn real-model conversation (OmniRoute serving). Quick-reply options,
  "What matters now" next-move evolution, and post-reload history/persistence
  all verified; persisted conversation_message rows have correct turn_key
  pairing and no duplicates. Fixed in the process: the streamed assistant
  placeholder reused a constant id, so the next turn overwrote the previous
  assistant bubble in optimistic state (persistence was always correct).

Human-owned blockers (unchanged in kind, now precisely scoped):

1. Vercel access (`vercel login` or a VERCEL_TOKEN with the stryde project) —
   required to set runtime env vars on preview/production and to promote the
   verified branch to production. Without it, production remains the stale
   old-main deployment.
2. A production-viable model credential. The tailnet OmniRoute cannot be the
   production path. Smallest viable options: enable billing on the Gemini key
   (removes the 20/day cap) or fund OpenRouter (~$5) for `z-ai/glm-5.3-flash`
   (evidence-backed candidate, see benchmark docs).

## 2026-10-03 engineering pass (live-system verification and repair)

This section records verified reality established by running the system against
the live Supabase project and a real model provider. It supersedes the
reconciliation snapshot above wherever they disagree.

### Repository

CONFIRMED (verified this session):
- Active branch: `codex/model-routing-migration-clean`, now merged with
  `origin/main`; `main` carried two commits (527b4bf, 6cbfcfe) that are an
  earlier iteration of provider routing which this branch supersedes.
- Working tree is the source of truth for the first time; the earlier
  "local working tree was not available" caveat no longer applies.

### Migration lineage

RECONCILED (verified via `supabase migration list` and `supabase db push`):
- 30 migrations, local and remote identical, zero divergence.
- Drift found: `20261002180000_controlled_execution_authority_repair` existed
  only on live. Fetched into the repository, then repaired (see below).
- Three migrations added this session, all applied to live.

### Two live defects that blocked the core loop

Both were in the controlled-execution authority path and both broke the loop
before it reached human action. Found by running e2e against live Supabase, not
by reading code.

1. `function digest(text, unknown) does not exist` (500 on every action start).
   The 20261002180000 body set `search_path = public, pg_temp` while calling
   `digest()` unqualified; pgcrypto's `digest()` lives in `extensions`, which is
   not on that path. Repaired by 20261003115408.

2. `Terminal Decision is immutable` (400 on every action start).
   The same body inserted the ACTION_APPROVAL Decision already `RESOLVED`, then
   issued a separate UPDATE to attach `chosen_option_id`. The
   `decision_immutable_guard` trigger correctly refuses any update to a RESOLVED
   Decision, so the second statement always raised. This reverted the lifecycle
   that 20260926161200 had established. Repaired by 20261003115621, which
   inserts as `OPEN` and transitions `OPEN -> RESOLVED` in the same statement.

Authority semantics are unchanged by either repair: a commit still requires the
caller's authenticated approval and still records the user's rationale.

### Model-boundary repair

A third failure surfaced once the database was repaired:

- `500 {"error":"Working state version must be 1"}` from `/work`.
  Cause: model output is a proposal, but a provider that cannot express
  `enum: [1]` (the Gemini REST API rejects non-string enums, so `geminiSchema()`
  strips them) intermittently emitted an out-of-contract `status`. The
  validator threw, and as a 500 the user's request looked lost.
  Repaired in two parts: recoverable status synonyms now normalize to canonical
  values (`normalizeWorkStatus`, unit-tested), and a provider failure now
  degrades to `503` carrying the previously persisted `working_state` with
  `degraded: true` instead of failing the request. Stryde never fabricates a
  replacement next move and never upgrades authority on degradation.

### Verification performed (all live, this session)

CONFIRMED:
- `npm test` 64/64 (60 pre-existing + 4 new for the normalization boundary).
- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run build` clean.
- `npm run e2e:human` PASSED 14/14 boundaries against live Supabase. This is
  the first time the human loop has been proven end to end against live data.
  It covers pursuit creation, working-state seeding, action start, exactly-once
  replay, completion, the FAILED cycle, claim creation (REPORTED), evidence
  linking (REPORTED -> OBSERVED), and human adjudication (OBSERVED -> VERIFIED).
- `npm run probe:provider -- gemini` PASSED both live contracts
  (ConversationTurn and WorkingState) served by a real provider.
- Dev server root route 200; `/api/v1/pursuits` correctly 401 without a token.
- Live row counts contradict the earlier snapshot in this file, which is stale:
  observation 40, claim 15, action 41, decision 41, conversation_session 42,
  pursuit 38, run 16. Claims: 10 VERIFIED, 5 REPORTED.

Verified-correct behavior worth recording: the 10 VERIFIED claims are not model
assertions. Each has a `claim_status_event` with `actor_type = USER` and a
human-written reason, and the epistemic transition runs in SQL
(`stryde_adjudicate_claim`), not in application code. The model is instructed
never to assign VERIFIED and never can.

### Blockers (human-owned, both billing/access)

1. No production-viable model credential.
   - Gemini free tier: 20 requests/day. Verified working today (both contracts
     PASSED live), then quota exhausted during this session.
   - OpenRouter key present in this environment returns HTTP 402 Payment
     Required on every paid model (`is_free_tier: true`, usage 0.19, no
     credits). The `:free` slugs are deprecated/404. Not a code problem.
   - OmniRoute is reachable locally but is a tailnet-only address and cannot be
     a production dependency.
   Smallest unblocking action: add credits to an OpenRouter key, or enable
   billing on the Gemini key to lift the 20/day cap.

2. Vercel: pushed and deployed, but the production surface cannot be verified
   as this application.
   CONFIRMED this session:
   - No Vercel token exists anywhere in this environment (`~/.vercel` absent,
     CLI config has no auth.json, no VERCEL_TOKEN in the process environment),
     so env vars cannot be set and the deployment cannot be inspected directly.
   - `main` was fast-forwarded to the verified commit eabfcca and pushed.
     GitHub CI ran the full gate on that commit and passed: npm test, typecheck,
     lint, and production build. (CI does run `npm test`, contrary to the older
     note in this file that it does not.)
   - Vercel reported "Deployment has completed" (success) for eabfcca.
   CONTRADICTED — the deployed surface is not this codebase:
   - The deployment reachable at
     `stryde-git-main-abdhaseebtech-5772s-projects.vercel.app` returns
     `X-Matched-Path: /login` for every path, including `/api/health/model`.
     This repository has no `/login` route; its root route IS the sign-in page.
   - `https://stryde.vercel.app` is an unrelated Vite SPA with no
     `/api/health/model`.
   - The reachable deployment is behind Vercel Authentication
     (`Protected deployment`, 401), so its runtime env vars are unknown.
   - Deployments for the verified commits were identified precisely via the
     GitHub deployments API. Each commit produces both a Preview and a
     Production deployment, and Vercel reports success for both:
       22191ca  Preview      stryde-5yt5jpjjs-...vercel.app
       22191ca  Production   stryde-qjn7mj01m-...vercel.app
       558d590  Preview      stryde-oafog1qrx-...vercel.app
   - NONE of them can be exercised. Every route on every one of them returns the
     identical response for every path:
       HTTP 200, X-Matched-Path: /login, dpl_DB5Vj6UenKGBpJDW536tMzpmvAvw
     including /api/health/model and /api/v1/pursuits. The deployment id is the
     SAME across different commits, which means this response is not produced by
     the built application at all; it is an edge-level rewrite or interception
     applied uniformly in front of it. This repository has no /login route: its
     root route IS the sign-in page.
   - Separately, stryde.vercel.app is an unrelated Vite SPA.
   CONCLUSION: Vercel builds succeed and deploy, but the surface behind those
   URLs is not this application, so nothing about production runtime behavior,
   environment variables, or user flow can be verified or even observed from
   here. Production is BUILT but NOT VERIFIED, and the blocker is broader than
   credentials: it is the Vercel project's configuration.

   This is a single human-owned configuration issue with two parts, both in the
   Vercel project settings for `stryde` under the `abdhaseebtech-5772s` scope:
     1. remove or scope the deployment-protection / rewrite rule that returns
        dpl_DB5Vj6Uen... at /login (it is masking every route);
     2. disable Vercel Authentication, or supply a VERCEL_TOKEN so
        `vercel curl <deployment-url>` can fetch the real app.
   Until (1) is resolved, even an authenticated fetch would return the wrong
   application, so the "just add a token" fix alone is not sufficient.

## 2026-10-03 (later): the CONTROLLED worker plane is now proven

The "contract only" note that previously appeared here is superseded. Driving the
worker path end to end surfaced three defects that had made it unreachable, all
now fixed.

### Three worker-plane defects, each fatal on its own

1. The dispatcher could not start at all. `lib/worker-gateway.ts` used
   TypeScript parameter properties (`constructor(private readonly x: T)`). The
   dispatcher runs under `node --experimental-strip-types`, which strips types
   but does not transform syntax, so it died immediately with
   `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. Nothing in the worker plane could run
   before this. Now explicit field assignment.

2. The dispatcher never loaded `.env.local`. Every other repository script loads
   it; the dispatcher did not, so it aborted with a missing-credential error
   even when the local environment was fully configured, making a configured
   plane look unconfigured.

3. An empty queue was read as a leased job. `stryde_lease_next_job` is declared
   `returns public.job`, so Postgres always returns exactly one row; when
   nothing is queued that row is a NULL composite, arriving as a non-null
   JavaScript object whose fields are all null. The dispatcher treated it as a
   job and called `stryde_start_attempt` with a null id, failing every poll with
   `22P02 invalid input syntax for type uuid: "null"`. This was the most
   consequential: the plane appeared to fail continuously and every queued job
   stalled. Now recognized as "no work", covered by 3 new unit tests in
   tests/worker-dispatcher.test.ts.

The dispatcher loop is also hardened: a failed lease or dispatch is reported and
the loop continues rather than killing the process and stopping all remaining
work. Recovery belongs to the reconcile path, not to a crashed worker.

### CONTROLLED loop verified live

`npm run e2e:controlled` PASSED 18/18 boundaries against live Supabase:

- unapproved delegation is refused (human authority is real);
- approved delegation commits a CONTROLLED action;
- the trusted plane provisions a live capability grant that is tool-scoped,
  time-bounded, and traceable to the user's approval decision;
- job authorization is EXPLICIT_USER_APPROVAL, attributed to the approving user,
  and bound to the argument hash, so authorization cannot outlive the arguments
  it was granted for;
- the job freezes a validated worker contract, not free text;
- the dispatcher leases, starts an attempt, submits to the worker, polls, and
  finishes SUCCEEDED with the worker's external correlation id;
- the trusted plane finalizes the CONTROLLED action COMPLETED;
- the worker result becomes a MECHANICAL_ATTEMPT_RESULT Observation attributed
  to CONTROLLED_EXECUTION;
- no worker-only claim reached VERIFIED without human adjudication.

Scope of that claim, stated honestly: it proves the CONTROLLED plane executes,
records, and closes the loop. It does NOT prove any specific worker
implementation performs real work. `scripts/worker-stub.ts` implements the
`lib/worker-gateway.ts` HTTP contract for this purpose; a real Hermes/OpenCode
worker endpoint can be targeted by setting `STRYDE_HERMES_URL` /
`STRYDE_OPENCODE_URL`. Running a genuine worker agent remains open.

## 2026-10-03 (later still): adversarial worker verification, and two more real defects

An unexamined sibling working tree (`stryde-exec-repair`, branch
`codex/controlled-execution-repair`) held uncommitted work that had never been
reconciled. Its migration is byte-identical to the live-fetched copy apart from
trailing blank lines, so it contained no schema work. Its E2E harness, however,
was materially better than the one written earlier today: it drove three
outcomes instead of one. It was ported and the earlier single-cycle harness
replaced.

Porting it immediately exposed two further defects, both now fixed.

1. Delegation did not persist working state. `actions/delegate-worker` read the
   conversation session but never updated it, so after delegating, the pursuit
   still advertised a next move it could act on even though the work was in
   flight. Unlike `actions/start`, it never set WAITING_EXTERNAL. The user would
   be offered a move that was already running, and a second delegation could be
   attempted against it. Now persists WAITING_EXTERNAL, matching the human
   action path.

2. Double-delegation was possible. A second approved delegation for a pursuit
   with an in-flight CONTROLLED Action committed an entirely new Action and Job,
   so the same work could be executed twice by two independent worker runs. A
   double tap, a retried request, or a user simply approving again while waiting
   was enough to trigger it. Delegation now refuses with 409 while CONTROLLED
   work is in flight. Waiting on external reality is not a second decision.

Both are authority and lifecycle defects, found only by asserting on behavior
rather than on the happy path.

### Worker verification now covers all three outcomes

`npm run e2e:controlled` PASSED 19/19 boundaries across three cycles against
live Supabase, and manages its own dispatcher and stub worker so a run is
self-contained:

- Cycle 1, worker SUCCEEDS: authority provisioning or renewal by the user, a
  WORKER move rejected by the human action path with 409, delegation committed
  with working state WAITING_EXTERNAL, authorization bound to the argument hash,
  the existing grant reused rather than duplicated, second delegation refused,
  attempt SUCCEEDED with an external correlation id, job SUCCEEDED and action
  COMPLETED, result recorded as a MECHANICAL_ATTEMPT_RESULT observation, and no
  claim auto-verified by mechanical execution.
- Cycle 2, worker FAILS: job FAILED, action FAILED with a terminal timestamp,
  ACTION_FAILED_BY_WORKER event recorded, and the failure preserved as an
  observation. A failed worker run is evidence, not discarded output.
- Cycle 3, worker hangs: attempt and job UNKNOWN, `resolved_at` NOT set, and
  the action deliberately left IN_PROGRESS. An unresolved external result must
  not be resolved into a false conclusion.

Cycle 3 is the one that matters most for the product's defining claim: UNKNOWN
stays UNKNOWN. Nothing in the control plane converts an unanswered worker into a
finished action.

Three harness defects were also fixed so failures are attributed correctly
rather than masking the product: an assertion thrown inside the stub's HTTP
handler (it escaped the request callback and produced an opaque transport
error), validating `worker_type` when the gateway actually sends camelCase
`workerType`, and assuming a freshly provisioned grant when the correct
behavior is to reuse a live one.

## 2026-10-03 (UI layer): the product was never exercised in a browser

Every previous verification in this repository was at the API, SQL, or provider
layer. The user-facing surface - including a 1094-line pursuit page - had never
been run in a real browser. That blind spot mattered: a build can compile, pass
every server test, deploy successfully, and still ship a UI that never hydrates.

### What the browser found

Driving the served app over the Chrome DevTools Protocol surfaced an
investigation that no amount of API testing could have:

- A valid, correctly-filled sign-in form produced NO submit event and NO auth
  request. The visible symptom was a button that silently did nothing.
- The cause was React never attaching to the DOM: zero `__react` fibers on the
  form and no `__NEXT_DATA__`. `window.next` existed, so the Next.js runtime booted
  while hydration did not complete.
- Chasing it further would have been the wrong conclusion. The same app served by
  the PRODUCTION build hydrates correctly (React fibers present) and signs in
  successfully. The unhydrated behavior was specific to the dev server. Recorded
  here because the diagnostic path is the reusable part: the difference between
  "the product is broken" and "this server mode is broken" is only visible by
  testing the artifact that actually ships.

### What is now verified

`npm run e2e:ui` drives a real headless Chrome against a real served build and
PASSED 8/8, including from a cold start with a fresh browser profile:

- the page hydrates on a real build;
- the landing surface exposes no internal ontology;
- sign-in works through the actual form and establishes a Supabase session;
- the signed-in surface lists real pursuits loaded from the database;
- navigation to a real pursuit works and the page is not stuck on a loader;
- the pursuit surface exposes no internal ontology as primary UI.

One harness detail worth keeping: React controlled inputs ignore plain DOM
assignment. The harness assigns through the prototype value setter and dispatches
the event React listens for, and then asserts the field actually retained the
value. Without that check a harness can "fill" a form that never received input
and then conclude the product is broken.

Scope, stated honestly: this verifies hydration, authentication, navigation, and
the no-ontology invariant on the landing and pursuit surfaces. It does not verify
streaming conversation rendering in the browser, because the only provider that
reliably serves the real contracts in this environment is not configured as the
runtime default (see the provider-layer section above).

## 2026-10-03 (provider layer): three real defects found by probing the production leg

The probe harness only accepted `gemini | omniroute`, so whichever provider was
actually configured as primary could never be probed directly. With the
production chain pointed at OpenRouter, three defects surfaced. All are fixed.

1. The non-streaming conversation turn under-requested output. `runConversationTurn`
   called the model with the generic 1,000-token default while the streaming
   path used 2,800. The ConversationTurn contract has seven required fields, so
   providers truncated the reply and validation failed. Both paths now request
   `MAX_CONVERSATION_TURN_OUTPUT_TOKENS`. Pinned by
   tests/model-gateway-budget.test.ts, which fails if the two paths diverge again.
2. An empty provider completion was fatal. A routed model returning no content
   is transient, but the error was marked non-retryable, so one empty reply ended
   the user's entire turn. Now retryable.
3. Unparseable JSON was fatal. `generateStructured` called `JSON.parse` bare, so a
   truncated reply threw a raw SyntaxError that escaped the provider abstraction
   and could not be retried or classified. It now raises a retryable
   `malformed_output` provider error.

Effect measured through the real gateway: `probe:provider -- openrouter` went
from 0/3 full passes before the fixes to 2/5 after.

### Provider reliability, measured not assumed

The production-viable question was answered by measurement rather than hope:

- `openrouter/free` (the model the repository defaults to) routes each call to a
  DIFFERENT free model - nemotron, gemma, dots, apodex, lfm were all observed. Its
  shape conformance was acceptable (0/5 violations) but it intermittently returns
  malformed or non-JSON output, and during this session it moved to HTTP 429.
  Full-gateway reliability: 2/5. NOT production-viable.
- `response-healing` is load-bearing, not decoration. Measured on the identical
  contract: 3/3 with it, 1-2/3 without, across two different models. It stays.
- The only model that reliably served the real contracts in this environment was
  `stealth/space-bunny-alpha` (3/3 at the real budget). It is deliberately NOT
  configured as the runtime default: the product must not depend on the
  build-time engineering agent.

CONCLUSION, stated plainly: the provider layer is now correct and provider-neutral,
and the failures that were code defects are fixed. The remaining production gap
is a funded provider credential, not architecture. `openrouter/free` must not be
relied on for production; it is suitable for local experimentation only.

## 2026-10-03 (final): a REAL agent now executes REAL work

The last capability claimed as unproven is now proven. A real Hermes agent
performs a real unit of work through the real CONTROLLED plane, and the result is
judged only by an artifact read back off disk.

### New: a real worker endpoint

`scripts/hermes-worker.ts` implements the exact contract `lib/worker-gateway.ts`
speaks, backed by `hermes -z` one-shot runs instead of canned answers. Each unit
of work executes in its own per-job directory, and the artifacts it leaves behind
are the observable result.

Its epistemic rules are the same ones Stryde applies to itself:
- exit 0 with NO artifacts is FAILED, not success. A worker that did nothing is
  not a success. This is not theoretical: an early real run produced correct
  output while writing it outside the sandbox, and the endpoint correctly
  reported FAILED instead of claiming the agent's own "VERIFIED" summary.
- killed by timeout is UNKNOWN, never FAILED and never SUCCEEDED;
- non-zero exit is FAILED, with the tail of stderr retained as evidence.

### Two environment findings, established by measurement

1. `spawn`'s `cwd`, and Hermes' own `--in` flag, do NOT control where the
   agent's file and terminal tools operate. Verified directly: with both set to
   a sandbox, the agent still reported and wrote inside
   `C:\Users\DELL\Desktop\Stryde`. `TERMINAL_CWD` is the variable the agent
   actually honors for tool execution, so it is pinned per job. Without this the
   agent's real work lands outside the sandbox and every run looks like an empty
   failure.
2. Hermes' default model rejected a 16384-token request against this key with
   HTTP 402 while a small request succeeded, i.e. the account holds only a very
   small credit balance. `stealth/space-bunny-alpha` serves that request. This
   is a build-time worker cost, independent of Stryde's own runtime model
   configuration, which remains provider-neutral and separately configured.

### e2e:real-worker PASSED 11/11 against a real agent

`npm run e2e:real-worker` delegates through the real authenticated API, runs the
real dispatcher, and lets a real agent work. It asserts:
- a real SUCCEEDED job with a real worker correlation id;
- the CONTROLLED action finalized COMPLETED by the trusted plane;
- the observation carries a NON-EMPTY artifact list, and the artifact content
  satisfies the stated completion condition. An empty artifact list fails the
  suite, so "the agent said it was done" cannot pass as proof;
- the result is attributed to CONTROLLED_EXECUTION, never to the user;
- no claim is auto-verified from worker output.

Live evidence from the passing run: job SUCCEEDED, action COMPLETED, observation
carrying artifact `proof.md` (78 bytes) whose content was read back from disk.

Scope, stated honestly: this proves one real agent performing one bounded unit of
real work through the full CONTROLLED plane, including authority, lease,
attempt, artifact capture, and observation. It does not prove long-running,
multi-step, or production-hardened worker execution.

### Not addressed
- Security: the two findings recorded in docs/RUNTIME.md were re-checked
  empirically this session and are STALE, not open.
  - The tautological `pursuit_source_citation` INSERT policy was already
    repaired by 20260930000000_rpc_privilege_hardening_and_citation_policy_fix.sql,
    which drops and recreates it with real ownership predicates on both the
    pursuit and the source.
  - The "anon/PUBLIC EXECUTE on mutation RPCs" concern was tested, not just
    read. Unauthenticated calls to `stryde_create_claim` and
    `stryde_adjudicate_claim` return 401 from the in-function auth guard;
    `stryde_create_thread` and `stryde_commit_intervention` return 404 because
    execute has been revoked from anon. No unauthenticated mutation succeeded.
  - Tenant isolation verified: a user-scoped token sees 16 claims belonging to
    exactly 1 owner, so RLS is not leaking across owners.
  - The authority boundary holds end to end: `stryde_adjudicate_claim` returns
    403 to a direct client call even for the owner's own claim. Epistemic
    transitions therefore cannot bypass the server route, which is what keeps
    user authority real.
  Remaining known security debt is limited to the informational items: the
  legacy `public.loops` table has RLS with no policies, leaked-password
  protection is disabled, and the Supabase performance advisor reports
  unindexed foreign keys. None are exploitable data-access paths.

## 2026-10-03 (capability completion pass): the six intended-but-missing capabilities

This pass implemented the capabilities the canonical docs marked as build
intent (HANDOFF items 2-5, PRODUCT.md user contract, DECISIONS D7/D8/D9) that
the verification matrix marked NO. All are verified; see VERIFICATION_MATRIX.md
for the evidence and scripts/e2e-*.ts for the harnesses.

### What was built (all provider-neutral, no migration beyond one new table)

1. PERSONAL MEMORY LIFECYCLE, RETRIEVAL, AND INSPECTABILITY (D7, constitution
   17-19). On top of the memory_item foundation: content-aware dedupe and
   confirmation (a repeated independent appearance raises confidence and
   promotes a candidate at >= 0.8), model-proposed supersession (a confident
   candidate may replace specific memories it was shown; lineage links
   supersedes/superseded_by stay inspectable; below 0.7 confidence a
   replacement proposal never retires anything), provenance-aware defaults
   (MODEL_INFERENCE starts CANDIDATE; USER_REPORTED/VERIFIED start ACTIVE — the
   user's own reports are reality statements from the authority), ranked
   retrieval into the canonical situation (importance, confidence, recency,
   and relevance to the current objective; EXPERIENCE decays after 90 days;
   STALE/CONTRADICTED/SUPERSEDED never reach the model), and user control:
   GET /api/v1/memory plus confirm/forget/delete at /api/v1/memory/[id],
   surfaced as a contextual "What Stryde remembers" disclosure on the pursuit
   page. Progress reports and settled decisions recorded in conversation are
   additionally preserved VERBATIM as USER_REPORTED memories (turn-key
   idempotent), distinct from model paraphrases.

2. INPUT CLASSIFICATION (HANDOFF item 2). The ConversationTurn contract now
   carries input_class (MESSAGE | QUESTION | CORRECTION | PROGRESS | DECISION).
   A CORRECTION records the overridden working state in the turn metadata
   (superseded_working_state) instead of silently discarding it; PROGRESS and
   DECISION write verbatim USER_REPORTED memories. Absence or drift degrades
   to MESSAGE — an unclassified input can never fail a turn.

3. FILE INGESTION (constitution principle 6). The universal composer gained an
   attach affordance: POST sources accepts multipart/form-data, a dependency-
   free extractor handles text-like files (txt/md/csv/json/log, BOM, 200k cap)
   and PDFs (node:zlib stream inflation, Tj/TJ extraction; encrypted or
   image-only PDFs are UNSUPPORTED with an honest note), and extracted text
   flows through the same ingestion/adaptation/citation path as pasted
   content. Postgres stays the only store (D13); no blob storage, no new
   dependencies (D14).

4. USER-CONFIGURABLE AUTONOMY POLICY (D9). One new table
   (user_autonomy_policy, applied to live as 20261003170000; migration parity
   now 31/31). Semantics: no row = unconfigured = existing behavior; a row can
   only TIGHTEN (delegation off, worker-type allowlist, research off). The
   delegate route enforces it ahead of the unchanged explicit per-action
   approval — the policy can refuse, never approve. Surfaced as "What Stryde
   may do on its own" contextual disclosure.

5. MECHANICAL AUTO-VERIFICATION (D8). A new VERIFY_WEB work mode: the
   controller proposes checking one REPORTED claim against one public URL
   whose content contains (or lacks) specific literal text; the trusted plane
   executes the fetch (SSRF-guarded, reusing assertPublicHttpUrl), records a
   URL_VERIFICATION observation, and links it VERIFIES/CONTRADICTS. The link
   RPC can only move REPORTED -> OBSERVED; VERIFIED remains human-only.
   UNREACHABLE (including SSRF refusals) is recorded as unknown evidence with
   no link. The check also runs from the PERSISTED move when the model is
   unavailable — a provider outage no longer disables the capabilities Stryde
   can observe directly. An already-observed claim is never re-checked, so
   repeated /work calls cannot accumulate duplicate evidence.

6. PROACTIVE CONTINUITY (D3 "wait or continue"). The legacy /api/checkin cron
   (queried a `loops` table that exists in no migration — it 500'd daily — and
   emailed a hardcoded address) is deleted, with its quarantine page. New
   GET /api/cron/continuity, Bearer CRON_SECRET, fail-closed: reconciles
   expired worker leases (safety net for a dead dispatcher) and posts one
   SYSTEM-authored check-in message per idle pursuit per day (deterministic
   UUIDv5 turn_key from pursuit + UTC day; 23505 is treated as already
   nudged). It never touches working_state and never grants authority.
   vercel.json cron repointed; exercised live (11 nudges, 1 reconcile,
   idempotent re-run, visible in the browser conversation).

### Integration-boundary defects found while wiring (the pass's real finds)

1. The claims/evidence panel and the source-material panel were never
   imported by ANY page. The ONLY human adjudication surface — the path to
   VERIFIED — and the source surface were unreachable in the browser while
   their APIs worked. Both are now mounted as contextual disclosure on the
   pursuit page (with the memory and autonomy panels), and the browser E2E
   asserts their reachability and the no-ontology-as-primary-UI rule.
2. The adaptive controller's ADAPTIVE_WORK_MODES excluded RESEARCH_WEB (and
   had no VERIFY_WEB), so the model could never emit the moves the /work
   route knows how to execute — both autonomous blocks were dead code in the
   live path. Both modes are enabled, with verify-payload passthrough, and
   the prompt documents when each is legitimate.
3. WEB_SEARCH_RESULT observations have been silently DROPPED since the
   2026-09-30 RLS hardening: research wrote observations through the user's
   RLS client, but that migration removed owner INSERT on observation (the
   human path works because stryde_complete_human_action writes on the
   trusted plane). The unchecked error meant observation_id was always null
   and research evidence never reached the situation. Research and mechanical
   verification now record through the trusted plane, and a failed
   observation insert fails loudly instead of silently losing evidence.

### Verification performed (all live or real-browser, 2026-10-03)

- npm test 127/127; typecheck clean; lint clean; production build clean.
- e2e:human 14/14; e2e:controlled 19/19; e2e:verify-web 6/6 (NEW);
  e2e:ui 12/12 (NEW panel boundaries) — all against live Supabase / a real
  served build.
- e2e:real-worker: dispatch proven against the real agent; the agent's own
  build-time model hit its daily free quota (429) and the plane reported
  FAILED honestly with the error preserved as evidence. The SUCCEEDED proof
  from earlier the same day stands.
- e2e:model honestly failed on 429 — no provider had available quota at run
  time (see blockers below). The 2026-09-30 real-provider proof stands.
- Continuity cron: fail-closed, 11 nudges + 1 reconcile, idempotent re-run.

### Production (Vercel) — access restored, configuration repaired, redeploy pending

- Vercel access was restored this pass (device-flow login as the project
  owner). The previously recorded "edge /login rewrite masking every route"
  no longer reproduces: https://stryde-topaz.vercel.app serves this
  application (the root route is the sign-in surface; /api/health/model
  responds; /api/v1/pursuits correctly 401s without a token).
- The project environment was missing the variables the verified product
  needs. Set on both Production and Preview (values from the local
  environment, never printed): SUPABASE_SECRET_KEY (the trusted plane could
  not run in production without it — adjudication and internal routes), 
  CRON_SECRET (the continuity cron fail-closes without it), and the provider
  path), STRYDE_PROVIDER_DISABLED=omniroute (tailnet-only, unreachable from
  Vercel), STRYDE_GEMINI_MODEL=gemini-flash-latest. Gemini stays enabled as
  the middle leg (free tier: 20 requests/day).
- The stale production deployment predates the model-delist repair (its
  health endpoint still reported gemini-2.5-flash). Promoting the current
  verified tree to production is the remaining step.

### Blockers (human-owned, billing only)

1. OpenRouter holds $0.00 credits (verified twice this pass; the key is
   valid and authenticated). Funding it (~$5) makes the production chain
   fully viable: OpenRouter primary, Gemini free tier as fallback. This is
   the only remaining gap between the verified local system and a fully
   functional production conversation loop.
2. Build-time agent models (Hermes stealth free tier, Gemini free tier) were
   quota-exhausted by this pass's proofs — build-time cost, independent of
   the Stryde runtime.

## 2026-10-04 (final closure pass): the remaining capability gaps are closed

This pass closed every capability the verification matrix still marked
CONTRACT ONLY or as a closable PARTIAL. It did not touch the model/provider
routing layer. All evidence is in docs/VERIFICATION_MATRIX.md; the new
harnesses are scripts/e2e-opencode-worker.ts, scripts/e2e-memory-loop.ts,
and scripts/e2e-evidence-loop.ts.

### What was closed

1. REAL OPENCODE EXECUTION (was CONTRACT ONLY). scripts/opencode-worker.ts
   implements the same gateway contract and epistemics as the Hermes worker
   (no artifacts + exit 0 = FAILED; timeout = UNKNOWN; non-zero = FAILED),
   with per-job sandbox directories. Empirical Windows findings fixed on the
   way: bare-name spawn ENOENT (npm shim resolution), piped-stdin deadlock,
   and opencode state-DB locking (jobs serialized). e2e:opencode-worker
   PASSED 12/12 against a REAL agent with an artifact-judged SUCCEEDED
   proof; both worker tools of the CONTROLLED plane are now really proven.

2. EVIDENCE ACQUISITION BEYOND ONE PROVIDER. lib/search-provider.ts now
   exposes a configured-provider chain (Exa + Firecrawl search, preferred
   order via STRYDE_SEARCH_PROVIDER); the research route and
   executeWebResearch walk it, first success serves, last failure surfaces.
   lib/page-fetch.ts adds JS-rendered page observation: direct fetch first,
   approved Firecrawl scrape fallback for thin JS shells when a key is
   configured, renderer recorded in observations and source metadata. This
   is the product answer to browser observation without an un-approved
   browser runtime (and without a browser on serverless).

3. REAL CITATION LOCATORS (was a full-range stub). buildSourceCitation now
   locates the statement in the stored content through normalized search
   with offset mapping and returns the actual character range plus a
   located flag; unlocatable statements fall back honestly. No migration
   needed (locator is unconstrained jsonb — verified against the lineage
   migrations).

4. MEMORY/CONTRADICTION/CONTINUATION PROOF. A read-only adaptive-situation
   endpoint (?adaptive=1, owner-scoped) makes what the model sees
   inspectable, and e2e:memory-loop (9/9, live) proves the loop: report ->
   USER_REPORTED ACTIVE memory; user confirm/forget/delete; verified
   outcome -> durable memory; contradicted claim -> memory flip with
   history; a NEW session reconstructs from live memories + episodic
   history while dead memories stay out of the situation.

5. PRODUCT QUALITY. The duplicated execution surface was removed (the
   work-panels Execution section repeated the pursuit page primary card and
   action banner — every action was offered twice); pursuit lists are
   capped (API limit param, UI shows 30 with an honest hint) — an unbounded
   wall of records is not a calm surface; RUNTIME.md security findings were
   reconciled with the empirical state (the citation-policy anomaly is
   resolved; leaked-password protection is a dashboard toggle the product
   owner must flip; the legacy loops table is deny-all and retained).

### Verification (2026-10-04)

- 173/173 unit tests (ranking tests now deterministic; three consecutive
  clean full-suite runs), typecheck clean, lint clean, build clean.
- Live/real: e2e:human 14/14; e2e:memory-loop 9/9; e2e:evidence-loop 5/5;
  e2e:opencode-worker 12/12 (real agent); e2e:ui 12/12 (real browser).
- Honest degrades recorded rather than faked: research search (no provider
  key in the build environment), source adaptation (model 429), Firecrawl
  legs (mock-proven only).

The remaining gap is exactly the funded runtime: OpenRouter credits for the
production conversation, plus optional EXA/FIRECRAWL keys for live research
and rendered-page observation. Everything else is implemented and verified.

## 2026-10-04 (later): worker-plane credential contract enforced; capability-reuse audit closed

- **Worker auth is now real.** The gateway always SENT bearer tokens, but no
  worker server checked them: any process that could reach a worker port
  could submit and read work. New lib/worker-server-auth.ts enforces the
  credential the tool contract declares — constant-time comparison,
  per-worker-type scoped, FAILS CLOSED when no token is configured. Both
  worker servers gate every request. Verified live (no token 401, wrong
  token 401, correct token passes) and by both real-agent E2E suites
  running through the authenticated path.
- **Worker neutrality.** WORKER_TYPES is the single source of truth; tool
  keys and env prefixes are derived, so a third worker type needs no edits
  to shared modules. The extensionless-import module-resolution defect in
  lib/worker-contract.ts is fixed with the repo explicit-.ts convention.
- **Worker servers now load .env.local** (dispatcher pattern; existing env
  wins). Without this, the documented npm run worker:<type> flow produced a
  fail-closed worker that rejected everything — a silently misconfigured
  worker is exactly what the auth contract must not hide. A Windows pathname
  normalization bug in the first attempt of this loader was caught because
  the live gate test still returned 401 for the correct token, and fixed.
- **Dead dependency removed:** resend (legacy of the replaced check-in cron),
  from package.json, lockfile, CI env, and .env.example. Zero references
  remain. worker:opencode npm alias added for operator parity.
- **docs/STRYDE_CAPABILITY_REUSE_AUDIT.md** closes the capability-reuse
  question: zero REPLACE decisions; the only DELETE was resend; external
  app code rejected for runtime reuse on license-ambiguity, no-CI, and
  tutorial-grade-persistence grounds (D10/D14). Evidence labels
  CONFIRMED/INFERRED/UNKNOWN/BLOCKED throughout.
- Verification: 179/179 unit tests; typecheck, lint, build clean; both
  real-agent E2E suites green through the authenticated path (OpenCode 12/12,
  Hermes 11/11).
