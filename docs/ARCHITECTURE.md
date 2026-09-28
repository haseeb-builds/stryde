# Stryde Architecture Truth

Status: canonical architecture document
Reconciliation date: 2026-09-28

## Authority order

For current reality:
1. Repository code and migrations define implementation structure.
2. Supabase live schema/data/functions/policies define database runtime truth.
3. Vercel deployment/runtime evidence defines deployed truth where accessible.
4. Tests and verification artifacts are evidence.
5. Conversation context is control-interface context only.

When these disagree, the contradiction is recorded rather than silently resolved.

## Current architectural graph

The implemented design is broadly:

User
→ authenticated Next.js route
→ server-side context assembly
→ model gateway / deterministic reasoning
→ working proposal
→ authorization boundary
→ Action
→ Job
→ Attempt
→ worker/tool gateway
→ mechanical result
→ Observation
→ Verification
→ canonical state update

The cognitive Run lifecycle is intentionally separate from external execution.

Current Run stages represented by code and database constraints are:
INPUT → CONTEXT_ASSEMBLY → UNDERSTAND → REASSESS → optional DIAGNOSE → SELECT_INTERVENTION → PROPOSE → VALIDATE → AUTHORIZE → COMMIT → DONE

WAITING and FAILED are exceptional exits.

## Canonical state

Postgres is the V1 system of record. The live database currently contains domain tables for Thread, Pursuit, Claim, Decision, Action, Tool, CapabilityGrant, Job, JobAuthorization, Attempt, Observation, Claim relations/status history, Run, RunContextReference, Event, conversation session/message, source, source adaptation, source citation, reconciliation support, and the legacy loops prototype.

Conversation transcript and conversation_session.working_state are continuity/working-state mechanisms, not replacements for canonical domain state.

## Conversation

The repository contains:
- server-authenticated conversation routes;
- persistent conversation_session and conversation_message tables;
- turn-key idempotency fields and server-side write RPCs;
- SSE streaming code;
- server-side retrieval of recent conversation messages;
- separate Situation assembly;
- optional adaptive working-state recomputation.

The current route code does stream model deltas and commits a final assistant turn through the database RPC. Production behavior of this route is not currently verified because Vercel runtime access is unavailable.

## Sources and research

The repository contains an Exa search adapter and Firecrawl source extraction adapter.

Source ingestion currently supports pasted content and public HTTP(S) URLs, content hashing, fetch status, provider metadata, source adaptation records, and source citations.

This is not yet a general browser, crawler, arbitrary-file, or saved-content integration layer.

## Execution

The repository and live database contain the control-plane shape:

Action → Job → lease → Attempt → worker/provider → mechanical result → Observation → Verification.

The database has worker-only lease/start/finish functions, lease ownership, fencing tokens, durable dispatch intent, UNKNOWN result state, and tool/version binding.

The live database has two registered worker tools but zero live CapabilityGrant rows, Jobs, Attempts, or Observations at reconciliation time. Therefore the execution control plane is an implemented primitive, not a proven live worker path.

## Verification

Verification primitives include Observation, ClaimObservationLink, ClaimRelation, ClaimStatusEvent, worker observation, and human adjudication.

The live database currently contains zero Claims and zero Observations. Therefore verification machinery exists but no current real evidence→verification cycle is proven.

## Security boundary

Current code/database intend to enforce owner-scoped access, authenticated identity, bounded model output, worker-only execution functions, fencing, immutable/lineage-bearing semantic records, and untrusted external content.

Live security findings and privilege anomalies are documented in docs/RUNTIME.md. They were not remediated during this reconciliation.

## Not currently installed

The current repository does not contain dedicated dependencies/runtime implementations for Playwright, Crawlee, Crawl4AI, an Apify Actor runtime, Browser Use, Stagehand, Skyvern, Steel, yt-dlp, FFmpeg, Whisper/faster-whisper, Docling, MinerU, Apache Tika, a general MCP runtime, a general OAuth integration platform, or a dedicated VM/sandbox runtime.

Those are future capability options, not current features.
