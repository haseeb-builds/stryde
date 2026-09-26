# Stryde Acceptance Evals

Every major implementation slice should add or pass a focused evaluation.

## Reasoning integrity
- Unsupported facts remain UNKNOWN.
- User hypotheses are not promoted to facts.
- Diagnosis is traceable to supplied evidence.
- One useful next move beats generic plans when uncertainty is narrow.

## Work Controller
- Messy input produces a useful interpretation plus exactly one current Next Move.
- Known facts and unknowns remain separated.
- A user correction changes the working projection instead of reinforcing stale assumptions.
- No unsupported external capability is selected.
- A completed working state has no next move.
- The working state survives reload and remains scoped to the owning conversation.

## Conversation
- Vague input is absorbed and usefully framed.
- Questions are asked only when materially useful.
- Corrections supersede the working interpretation immediately.
- Session history survives reload.
- New conversation archives the previous session.
- No client-supplied transcript can become canonical context by itself.
- Streaming displays partial response promptly and persists the final message exactly once (active route still requires implementation).

## Source-grounded pursuit
- A source remains distinct from canonical Situation truth.
- Source extraction records provenance and preserves explicit-vs-inferred distinctions.
- Unsupported/binary source content is not hallucinated into usable text.
- Source methods are adapted against the current Situation rather than copied blindly.
- Goal candidates do not mutate the canonical objective until the user explicitly adopts one.
- Source conflicts remain visible instead of being silently flattened.

## HUMAN feedback loop
- A CREATE_ACTION move cannot start without explicit user approval.
- Starting a HUMAN Action creates a durable Action in IN_PROGRESS.
- A human result creates an Observation before the Action becomes terminal.
- A human-reported result does not directly create VERIFIED Claims.
- After a human result, the next working state is recomputed from updated Situation evidence.

## Authorization / execution
- Model proposals cannot bypass deterministic authorization.
- Authorization is bound to the exact Action/tool/version/arguments.
- Contradictory Claims are checked deterministically.
- Worker calls require valid credentials and fencing.
- Duplicate dispatch cannot create a second nonterminal Job for the same Action.
- Stale workers cannot finish an attempt.
- External-call intent is durable before dispatch.

## Verification
- Mechanical success never directly means VERIFIED.
- VERIFIED requires a valid machine-checkable success predicate and qualifying evidence.
- UNKNOWN remains UNKNOWN until reconciled.
- Corrections preserve Claim lineage.

## Production
- Build/typecheck passes.
- No stale provider configuration.
- No secrets in client bundles or model context.
- RLS/security advisors have been inspected for changed database surfaces; pre-existing findings remain tracked and are not silently treated as clean.
