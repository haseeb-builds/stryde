# Stryde Current State

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

CONFIRMED repository:
- 20 migration files.
- Two files share version 20260915000500:
  - 20260915000500_stryde_v1_execution_control_plane.sql
  - 20260915000500_stryde_verification_engine.sql

CONFIRMED live migration history:
- 20260915035349 stryde_pursuit_creation_security_hardening
- 20260917101144 add_run_failure_reason
- 20260917101341 harden_run_failure_transition
- 20260917164751 conversation_sessions_persistence
- 20260926081610 conversation_working_state
- 20260926103302 fix_commit_intervention_digest_schema
- 20260926163219 register_worker_tools
- 20260926163349 worker_queue_lease_audit_fix_v2
- 20260926163606 finalize_controlled_action_on_attempt
- 20260927083712 restore_pursuit_source_citation
- 20260927083847 restore_conversation_turn_rpc

CONCLUSION:
- Repository and live migration history are materially divergent.
- Live-only restore migrations are absent from the repository.
- Several repository migration files are absent from live migration history even though related schema effects are present.
- Repository migration lineage is currently not reproducible from the live migration history.

Do not perform a database reset or assume db push equivalence until migration reconciliation is a separately authorized task.

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
