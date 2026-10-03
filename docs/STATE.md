# Stryde Current State

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
Reconciliation date: 2026-09-28

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

### Not addressed

- A real worker agent has still never executed a job. The plane around it is
  proven across success, failure, and unknown; the executor behind it is a
  contract stub implementing the lib/worker-gateway.ts HTTP contract. A real
  Hermes/OpenCode endpoint can be targeted via STRYDE_HERMES_URL /
  STRYDE_OPENCODE_URL.
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
