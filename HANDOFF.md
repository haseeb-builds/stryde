# Stryde Handoff

## 2026-10-18 — `fix/conversation-turn-reliability` engineering completion

### What changed on `fix/conversation-turn-reliability`

1. **Resolved Second-Turn Production Failure & Retry Amplification (`lib/work-controller.ts`, `lib/adaptive-work-controller.ts`, `lib/model-gateway.ts`, `lib/adaptive-model.ts`, `app/api/v1/pursuits/[id]/conversation/route.ts`):**
   - Added `"CREATE_ACTION"` to `AVAILABLE_WORK_MODES` in `lib/work-controller.ts` so `validateWorkingState` no longer rejects Turn 2+ outputs when the model converges to `CREATE_ACTION`.
   - Aligned `validateWorkingState` and `validateWorkingStateShape` to normalize status aliases, normalize `next_move.mode` case/separators, accept `version: 1 | "1"`, accept string/boolean `ready_for_reasoning`, and slice `known`/`unknowns` arrays to `MAX_ITEMS` (8) instead of throwing on verbose model turns.
   - Eliminated outer-loop retry amplification on `ModelProviderError` in `streamConversationTurn`, `runConversationTurn`, and `runAdaptiveWorkController` (rethrows immediately when the provider router has already exhausted retries or when `signal.aborted` is set, retrying only once on schema validation failure).
   - Threaded `signal: turnSignal` into `runAdaptiveWorkController` and updated the route's `catch` fallback to preserve `result.turn.work ?? session.working_state` rather than overwriting Turn 2's work state with Turn 1's stale `session.working_state`.
2. **Resolved Reload `"Conversation archived"` False Positive (`app/pursuits/[id]/page.tsx`):**
   - Kept the initial workspace loading screen active until `session` finishes bootstrapping (`if (loading && (!pursuit || !session))`) and restricted the `"Conversation archived"` composer placeholder strictly to `session?.status === "ARCHIVED"`.
3. **Completed Trigger → Dispatcher Job Enqueueing & Notification Loop (`lib/trigger-engine.ts`, `app/api/v1/triggers/route.ts`, `app/api/cron/continuity/route.ts`):**
   - Implemented `resolveTriggerContext` (evaluating real pursuit inactivity windows, in-flight actions, and recent events for `STATE` and `EVENT` triggers), `planTriggerDispatch`, and `dispatchFiredTrigger` (enqueuing authorized `CONTROLLED` `action` + `job` + `job_authorization` rows with autonomy policy, active capability grant, and `worker_jobs` resource reservation checks, or recording deduplicated notifications).
4. **Added Artifacts UI Surface (`app/pursuits/[id]/artifacts-panel.tsx`, `app/pursuits/[id]/page.tsx`):**
   - Mounted `PursuitArtifactsPanel` in the pursuit workspace contextual disclosure section to view active artifacts, inspect content and provenance, create new artifacts, and record append-only revisions via `PUT /api/v1/artifacts/[id]`.
5. **Audited & Tested Remaining `SECURITY DEFINER` RPCs (`tests/trusted-plane-rpc-grants.test.ts`):**
   - Verified that all user-callable `SECURITY DEFINER` RPCs (`stryde_create_pursuit`, `stryde_internal.commit_intervention`, `stryde_internal.set_objective_claim`, `stryde_internal.complete_human_action`, `stryde_record_conversation_user_input`, `stryde_commit_conversation_turn`, and `stryde_revise_artifact`) bind ownership to `auth.uid()` and pin an explicit `search_path`.
   - Full local verification suite passes: **262/262 unit tests**, `tsc --noEmit`, `eslint`, and `next build`.

## 2026-10-17 — historical engineering handoff

### What just changed

- Live security audit discovered that eight RPCs documented as trusted-plane/service-role-only were executable by `authenticated` users due to default function grants. The fix is merged in `1df79487da20bd4066e7ff492f6851c0960e6141` and deployed in READY production deployment `dpl_HxMc5YPcdgndAT9KnvaEHYNQKm2G`.
- GitHub Actions passed unit tests, typecheck, lint, and production build.
- The live Supabase migration was applied and verified. The eight trusted-plane RPCs now reject authenticated execution and remain executable by `service_role`.
- Artifact revision remains authenticated by design, but now validates the caller against `auth.uid()` and scopes the old artifact lookup to that identity.
- The source migration filename is being aligned to live version `20261017185728` to avoid local/live migration version drift.

### Next actions — priority order

1. **Run a fresh full production conversation journey** on the current deployment: confirmed user → pursuit → structured first turn → adaptive working state → second turn → persisted transcript/state. Do not equate `/api/health/model` or deployment READY with model reliability. Prior notes say free provider quotas blocked this; current availability still needs to be measured by an actual turn.
2. **Review remaining authenticated SECURITY DEFINER functions** flagged by Supabase Advisor. The current advisor lists the guarded artifact-revision function plus user-facing pursuit/conversation RPCs; inspect each owner check and add cross-user regression tests where needed. Enable leaked-password protection in Supabase Auth before broad launch.
3. **Make model/research economics viable:** verify a real model turn with the production provider chain; Exa/Firecrawl keys are absent, and production research is not proven. Do not assume Google AI Pro subscription includes production API credits.
4. Finish the **trigger → dispatcher job enqueueing E2E** and add the missing **artifacts UI** surface where it is in V1 scope.
5. Establish actual production worker runtime and verify resource/entitlement accounting through a representative pursuit.
6. Update this handoff and the verification matrix only when each result has actual evidence.

### Explicit status

- **PROVEN:** CI pipeline for the security fix; production deployment READY; security migration applied; live RPC privilege changes queried; production model configuration resolves.
- **NOT PROVEN:** full current-production conversational journey, sustained provider reliability, live Exa/Firecrawl research, public worker runtime, customer-paid billing path, trigger-to-dispatcher complete loop.
- **Do not begin marketing yet.** LinkedIn launch and user acquisition come after the critical production journey and security checks are done. That is launch work, not a substitute for verification.

Current as of 2026-10-06 post-GLM checkpoint.

## Current truth

- main = `1e3b7d7dd886d2f8e7a0e70b0e84e06e6b06bfec`.
- GLM's streaming malformed-output failover fix = `a67e36d23e1d7528af71277d8e627be5732216e7`, and it is an ancestor of current main.
- Current GitHub Actions `verify` check is SUCCESS on current main.
- Current Vercel production deployment = `dpl_2w7iPjCcKAWZmQ8VdaJ8CeLb5XcP`, READY, serving `1e3b7d7`.
- Current production model configuration: OpenRouter preferred with `nvidia/nemotron-3-super-120b-a12b:free`; Gemini fallback `gemini-flash-latest`; OmniRoute disabled.
- Vercel project plan is Hobby.
- Supabase migration parity is 37/37.
- Live `user_agent_preference`, `skill`, `skill_version`, and `funnel_event` tables now exist with RLS enabled.
- RESEND_API_KEY is no longer present in the Vercel environment.
- Exa / Firecrawl credentials are still absent, so live research legs remain blocked.
- Production worker runtime is still not established.
- A historical 55-second conversation timeout error group remains in Vercel telemetry, last seen on 2026-10-06T15:59:52Z on an older deployment. Fresh current-main conversation proof is still required before calling the production conversation path stable.

## What the interrupted GLM run accomplished

It was useful and should not be discarded.

It:
- reconciled documentation;
- fixed the CI/Linux path defect;
- reconciled/applied the five live migrations;
- removed stale RESEND_API_KEY;
- discovered the production model problem;
- contract-tested free OpenRouter model candidates;
- selected `nvidia/nemotron-3-super-120b-a12b:free`;
- fixed streaming malformed-output retry/failover in `a67e36d`.

The run stopped before completing the final post-fix production conversation journey and before implementing Issue #7's capability-composition layer.

## Read first

1. docs/PRODUCT_CONSTITUTION.md
2. docs/ARCHITECTURE.md
3. docs/STATE.md
4. docs/RUNTIME.md
5. docs/VERIFICATION_MATRIX.md
6. docs/DECISIONS.md
7. docs/INTEGRATIONS.md
8. docs/RESEARCH_REALITY_ENGINE.md
9. docs/SUBSCRIPTION_AND_RESOURCE_MODEL.md
10. docs/RESEARCH_COST_CONTROL.md
11. docs/BILLING_PROVIDER_ARCHITECTURE.md
12. docs/AI_CAPABILITY_LANDSCAPE_AND_GAPS.md
13. docs/GLM_MASTER_IMPLEMENTATION_BRIEF.md
14. docs/GLM_RESUME_MANDATE.md
15. docs/GLM_WORLD_CLASS_SINGLE_SESSION_BUILD_MANDATE.md

## Next action

Use `docs/GLM_WORLD_CLASS_SINGLE_SESSION_BUILD_MANDATE.md` for the new GLM session. Do not restart the old documentation-reconciliation/migration work.

First run the fresh production conversation proof described in `docs/GLM_RESUME_MANDATE.md`.

If that passes, proceed directly into Issue #7 / `docs/GLM_MASTER_IMPLEMENTATION_BRIEF.md`, beginning with Phase 1: Unified Capability Registry.

## Non-negotiables

- Do not reset the live Supabase database.
- Do not revert `a67e36d` unless a verified regression requires it.
- Do not treat `/api/health/model` as proof of generation quality.
- Do not claim production stability without the current-main conversation proof.
- Do not duplicate existing skills, memory, worker, MCP, research, or job primitives.
- Capability discovery is not authority.
- External content is untrusted.
- Tool success is not outcome success.
- Keep provider interfaces replaceable.
- Keep Free genuinely useful but economically bounded.
- Do not add heavyweight agent frameworks without a demonstrated need.
- Record implemented/tested/deployed/production-proven status separately.

## 2026-10-06 (latest) — capability platform shipped; next engineer starts here

The Issue #8 capability-composition platform pass is IMPLEMENTED, TESTED
(251/251 unit), and DEPLOYED. Registry/discovery/entitlements, resource
reservation, Skills V2, plugin manifest, MCP normalization, research
planner + evidence-graph novelty, triggers, artifacts, notifications,
task-aware routing, sub-agent spec, policy hooks, and draft API contracts
are all in. Migration parity 40/40. Production cron runs the platform
maintenance surface (verified live). Four real streamed conversation turns
proven on production after the 55s-timeout repair.

### Remaining work, in priority order

1. Re-run the complete production journey (`.prod-journey.mjs` from the
   workspace root, with STRYDE_JOURNEY_EMAIL/PASSWORD of a confirmed user)
   once OpenRouter free-models-per-day quota resets — the last unobserved
   boundary is convergence-to-action on the deployed build. Then observe
   whether the adaptive controller's convergence/answer rules hold.
2. Funded provider credential (OpenRouter credits or billed Gemini) —
   structural; free tiers are non-viable for a public product.
3. EXA / FIRECRAWL keys to move research from honest degradation to live;
   the planner, novelty classification, and reservation wiring are ready.
4. Trigger → dispatcher job enqueueing E2E (the firing window and cron
   evaluation are proven; the enqueue leg needs a scheduled-run harness).
5. Artifacts UI surface (API + RPC + migration are done).
6. Substrate decisions for sandboxed code, connectors (OAuth), transcripts —
   registered BLOCKED/UNAVAILABLE in the live capability catalog.
