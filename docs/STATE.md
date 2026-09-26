# Stryde Implementation State

Updated: 2026-09-26

## Current repository
- GitHub: haseeb-builds/stryde
- Branch: main
- Baseline audited at: 5125b1ae84a6abfe4f0591c8d820a5b5878df34d4
- Control-plane docs and model-health wiring were added after that baseline; those changes still require runtime/build verification.
- Next.js 16.2.9 / React 19.2.4
- Supabase project: Stryde (pvijrnwdnolvnoibarrj), healthy

## Proven implemented areas
- Authenticated Pursuit creation/listing
- Persistent conversation_session + conversation_message
- New conversation archives the active session
- Adaptive conversation turn contract
- Canonical Situation assembly
- Run lifecycle persistence and failure recovery
- Intervention authorization/commit database path
- Action / Job / Attempt execution control-plane database path
- Worker lease/start/finish endpoints
- UNKNOWN reconciliation endpoint
- Observation recording and claim adjudication paths
- Gemini primary model-gateway code
- Anti-hallucination reasoning guardrails

## Control layer
- Canonical repo docs now exist under docs/: PRD, ARCHITECTURE, ROADMAP, STATE, DECISIONS, EVALS.
- AGENTS.md now contains the Stryde integration and evidence rules.
- Model health defaults now match the Gemini-primary gateway.
- Work Controller is implemented as a derived conversation_session.working_state projection; it is not canonical domain truth.

## Newly implemented on main
- Durable Pursuit source records for public URLs and pasted material, including content hashes, fetch status, and provenance metadata.
- Source adaptation records that preserve extracted claims, methods, assumptions, prerequisites, fit, conflicts, gaps, adapted strategy, and goal candidates.
- Explicit goal adoption creates/refines the Pursuit OBJECTIVE Claim and binds it to the Pursuit with lineage.
- HUMAN Action path: CREATE_ACTION Next Move → explicit approval → Action terminal state → USER_REPORTED Observation → adaptive re-planning.
- Workspace controls now expose source ingestion, goal adoption, human Action start, and result recording.
- URL ingestion validates public HTTP(S) hosts and every redirect before following them; binary sources are saved as unsupported rather than fabricated into text.

## Verified adaptive pursuit slice
- Merged as commit `f35bef7b34c17a18fb686a1226c23dddadd48a46` after CI run 78 passed TypeScript, ESLint, and production build.
- Live Supabase migration `adaptive_pursuit_sources_and_human_feedback` is applied; new source/adaptation RLS policies and public INVOKER wrappers were verified from the live catalog.
- The Vercel status for the source-grounded merge commit `f35bef7b34c17a18fb686a1226c23dddadd48a46` was `success`; subsequent documentation-only commits may trigger their own deployment checks.

## Known incomplete / next
- Production Gemini configuration still requires live environment verification.
- Conversation transport is currently non-streaming in the active route.
- Conversation and reasoning now load persisted session context server-side; no arbitrary client transcript is accepted as the reasoning source.
- The Work Controller projection is persisted and shown as one current move. HUMAN CREATE_ACTION is wired through deterministic approval; autonomous research, controlled tools, and arbitrary file extraction remain capability-gated/unavailable.
- The Work Controller baseline and adaptive pursuit slice have both passed the repository CI gate.
- The workspace now drives the real HUMAN Action lifecycle; model reasoning still does not directly authorize side effects.
- Tool registry and capability grants are currently empty in the connected database, so no genuine controlled external action exists yet.
- Controlled verification remains unproven end-to-end; the HUMAN path records an Observation after user-reported results, but user reports are not automatically VERIFIED.
- Final UX is still a functional shell.
- Eval coverage needs to become the acceptance gate for further expansion.

## Evidence note
- The adaptive source/human-feedback migration has been applied to the connected Supabase project and its tables, functions, and RLS policies were verified by live catalog queries.
- The end-to-end adaptive loop is implemented, but real production behavior still requires exercising authenticated source ingestion, human execution, and result/replan flows on the deployed app.

## Working rule
Never report an item as complete because a file, endpoint, database table, or agent claim exists. Accept only test/runtime evidence.
