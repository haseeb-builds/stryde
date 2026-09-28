# Stryde Acceptance Evals

Status: canonical evaluation contract, not a record of executed results
Current runtime status is in docs/VERIFICATION_MATRIX.md and docs/STATE.md.

Every implementation slice should have focused evidence. A test definition is not a passing test result.

## Reasoning integrity
- Unsupported facts remain UNKNOWN.
- User hypotheses are not promoted to facts.
- Diagnosis is traceable to supplied evidence.
- A narrow uncertainty should produce a useful next move rather than a generic plan.

## Work Controller
- Messy input produces useful interpretation plus one current Next Move.
- Known facts and unknowns remain separated.
- User correction changes working interpretation.
- Unavailable capabilities are not selected.
- Completed working state has no next move.
- Working state remains scoped to the owning conversation.

## Conversation
- Vague input is usefully framed.
- Questions appear only when materially useful.
- Corrections supersede the working interpretation.
- Session history survives reload.
- New conversation archives the previous active session.
- Client transcript is not authoritative context.
- Streaming displays progressive deltas and the final response is persisted exactly once.

Current-state note: the active repository route now contains SSE streaming and server-side persisted history logic. Production behavior remains UNKNOWN because Vercel runtime access is currently unavailable.

## Source-grounded pursuit
- Sources remain distinct from canonical Situation.
- Extraction retains provenance and explicit/inferred distinctions.
- Unsupported sources are not hallucinated into text.
- Methods are adapted against current Situation.
- Goal candidates remain provisional until user adoption.
- Source conflicts remain visible.

## Human feedback
- CREATE_ACTION requires explicit approval.
- HUMAN Action enters IN_PROGRESS.
- User result creates an Observation before terminal completion semantics where applicable.
- User-reported evidence is not automatically VERIFIED.
- Updated evidence triggers reassessment.

## Controlled execution
- Model proposals cannot bypass deterministic authorization.
- Authorization binds to Action/tool/version/arguments.
- Worker calls require authenticated credentials and fencing.
- Duplicate dispatch does not silently create a second nonterminal execution.
- External-call intent is durable before dispatch.

## Verification
- Mechanical success is not VERIFIED.
- VERIFIED requires applicable evidence/policy.
- UNKNOWN remains UNKNOWN until reconciled.
- Corrections preserve lineage.

## Execution evidence requirement

A future report must include the exact tests actually executed, the runtime environment, the deployment/commit tested, and any database/runtime artifacts used as evidence.
