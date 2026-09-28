# Stryde Runtime Truth

Status: canonical runtime document
Reconciliation date: 2026-09-28

## Repository checkpoint

The local working tree was not available in the current execution environment. Repository truth was inspected from GitHub main.

Baseline repository commit:
2420caa605e15ee59ca0472dd1975f7c7d1d8731
Message: Fix worker capability type narrowing in adaptive controller
Timestamp: 2026-09-26T16:36:39Z

This is the reconciliation baseline. The documentation-only reconciliation commit is recorded in docs/STATE.md.

## CI

GitHub Actions run 132 for the baseline commit completed successfully.

The CI job executed:
- npm ci;
- TypeScript typecheck;
- ESLint;
- Next.js production build.

The CI workflow does not run npm test. The node:test suite exists in the repository but its execution is not evidenced by the latest CI run.

## Deployment

GitHub reports a successful Vercel deployment for the baseline commit.

Direct access to the deployment is currently denied by the connected Vercel integration, and team discovery returned zero teams. Therefore:
- deployment existence: CONFIRMED;
- current production page behavior: UNKNOWN;
- current production runtime logs: UNKNOWN;
- current production environment variables: UNKNOWN;
- current production end-to-end flow: UNKNOWN.

## Live Supabase

Project: pvijrnwdnolvnoibarrj
Region observed: ap-southeast-1
Health: ACTIVE_HEALTHY

Live migration history contains:
20260915035349 stryde_pursuit_creation_security_hardening
20260917101144 add_run_failure_reason
20260917101341 harden_run_failure_transition
20260917164751 conversation_sessions_persistence
20260926081610 conversation_working_state
20260926103302 fix_commit_intervention_digest_schema
20260926163219 register_worker_tools
20260926163349 worker_queue_lease_audit_fix_v2
20260926163606 finalize_controlled_action_on_attempt
20260927083712 restore_pursuit_source_citation
20260927083847 restore_conversation_turn_rpc

## Migration drift

The repository contains 20 migration files, while live migration history contains 11 entries.

Confirmed contradictions:
1. The repository contains two migration files with version 20260915000500:
   - 20260915000500_stryde_v1_execution_control_plane.sql
   - 20260915000500_stryde_verification_engine.sql
2. Nine repository versions are present in live history; eleven repository migration files are absent from live history.
3. Live history contains two versions absent from the repository:
   - 20260927083712_restore_pursuit_source_citation
   - 20260927083847_restore_conversation_turn_rpc
4. The live schema contains effects associated with repository migrations that are absent from live migration history, including conversation turn_key, source/adaptation tables, and source citations.

Conclusion: repository migration lineage is not currently a reproducible one-to-one representation of live migration history. Do not assume a future reset/db push will reproduce the live schema without a dedicated migration reconciliation.

## Live data snapshot

At reconciliation time:
- Pursuits: 3
- Conversation sessions: 6
- Conversation messages: 5
- Sources: 0
- Source adaptations: 0
- Source citations: 0
- Tools: 2
- Capability grants: 0
- Jobs: 0
- Attempts: 0
- Observations: 0
- Claims: 0
- Actions: 1
- Decisions: 1
- Runs: 16
- Events: 98

The single current Action row is HUMAN / IN_PROGRESS.
The single current Decision row is ACTION_APPROVAL / RESOLVED.

Run state at reconciliation time:
- 7 FAILED;
- 6 RUNNING at AUTHORIZE;
- 1 RUNNING at INPUT;
- 2 RUNNING at REASSESS.

Several RUNNING records are older than a week. This is a current-state concern, not proof of corruption, because AUTHORIZE can represent an unresolved authority stage.

Conversation state:
- 6 sessions total;
- 3 ACTIVE and 3 ARCHIVED;
- persisted conversation messages exist;
- at least one live session contains a persisted working_state with an objective, bottleneck, unknowns, and a HUMAN CREATE_ACTION next move.

## Model evidence

Live failed Runs dated 2026-09-18 contain OpenRouter-specific 429/404 failures. This is direct evidence that OpenRouter was used by a live runtime at that time.

Current provider configuration is UNKNOWN because Vercel environment variables are inaccessible.

Current source code supports Gemini, Groq, and OpenRouter and defaults to Gemini when no provider is specified.

## Worker evidence

Live tool registry contains:
- worker.hermes v1;
- worker.opencode v1.

There are zero CapabilityGrant rows, zero Jobs, zero Attempts, and zero Observations. There is no live worker-result record.

Therefore:
- worker infrastructure: IMPLEMENTED;
- real worker execution: NOT PROVEN.

## Verification evidence

Verification functions and tables exist, but live Claims and Observations both equal zero.

Therefore:
- verification primitives: IMPLEMENTED;
- verification E2E: NOT PROVEN.

## Security findings

Supabase security advisor observed:
- INFO: public.loops has RLS enabled with no policies;
- WARN: four SECURITY DEFINER functions in public are executable by authenticated users: stryde_commit_conversation_turn, stryde_create_conversation_session, stryde_create_pursuit, stryde_record_conversation_user_input;
- WARN: leaked-password protection is disabled.

Live privileges additionally show anon/PUBLIC EXECUTE for some mutation RPCs, including stryde_commit_intervention, stryde_create_claim, and stryde_create_thread. Their bodies check auth.uid(), but the privilege surface is broader than the intended authenticated mutation posture.

These are documented, not remediated.

## Live RLS anomaly

The live insert policy for pursuit_source_citation contains a tautological predicate equivalent to s.pursuit_id = s.pursuit_id.

The exact security impact is UNKNOWN because no adversarial policy test was performed.

## Performance

Supabase performance advisor reports 42 unindexed foreign-key findings, 9 unused-index findings, and multiple auth.uid()-per-row policy optimization findings. These are recorded as observations, not refactoring targets for this reconciliation.
