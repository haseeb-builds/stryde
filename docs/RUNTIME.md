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

RESOLVED 2026-10-02: repository and live migration history now match one-to-one (28 migrations, verified via `supabase migration list`).

What was done:
1. The duplicate version 20260915000500 was resolved by renaming 20260915000500_stryde_verification_engine.sql to 20260915000550_stryde_verification_engine.sql.
2. The live-only migrations (20260927083712_restore_pursuit_source_citation, 20260927083847_restore_conversation_turn_rpc, 20261002143729_personal_memory_foundation) were fetched into the repository.
3. The repository-only versions were marked applied on live via `supabase migration repair` after schema verification confirmed their effects exist live (pursuit_source_citation table and policies, conversation_message turn_key indexes and RPCs). Repair writes only to supabase_migrations history; no live data was modified.

The repository migration lineage is now a reproducible representation of the live schema.

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

## Security findings (current)

Re-verified empirically 2026-10-03 (see docs/STATE.md that date): no
unauthenticated mutation path succeeded; tenant isolation held under a
user-scoped token; the authority boundary (the adjudication RPC returns 403
even to the owner's direct client call) holds end to end.

Remaining advisory items, none exploitable data-access paths:
- INFO: public.loops (legacy check-in table, quarantined and now fully
  unreferenced in code since the continuity cron replaced /api/checkin) has
  RLS enabled with no policies — deny-all for non-service roles. Its data is
  intentionally retained; dropping it would be a destructive repair with no
  product benefit.
- WARN: four SECURITY DEFINER functions callable by authenticated users
  (stryde_commit_conversation_turn, stryde_create_conversation_session,
  stryde_create_pursuit, stryde_record_conversation_user_input) — their
  bodies are the server-owned conversation write paths that check
  auth.uid(); this is the designed shape of the persistence contract.
- WARN: leaked-password protection is disabled — a Supabase dashboard toggle
  (Authentication → Policies). Enabling it requires a personal access token
  with account-level scope, which the automation environment deliberately
  does not hold. Recorded for the product owner.

## Live RLS anomaly — RESOLVED

The tautological pursuit_source_citation INSERT predicate was repaired by
migration 20260930000000_rpc_privilege_hardening_and_citation_policy_fix.sql,
which recreates the policy with real ownership predicates on both the pursuit
and the source. The earlier UNKNOWN-impact note is historical.

## Performance

Supabase performance advisor reports 42 unindexed foreign-key findings, 9 unused-index findings, and multiple auth.uid()-per-row policy optimization findings. These are recorded as observations, not refactoring targets for this reconciliation.
