# Stryde Acceptance Evals

Every major implementation slice should add or pass a focused evaluation.

## Reasoning integrity
- Unsupported facts remain UNKNOWN.
- User hypotheses are not promoted to facts.
- Diagnosis is traceable to supplied evidence.
- One useful next move beats generic plans when uncertainty is narrow.

## Conversation
- Vague input is absorbed and usefully framed.
- Questions are asked only when materially useful.
- Corrections supersede the working interpretation immediately.
- Session history survives reload.
- New conversation archives the previous session.
- No client-supplied transcript can become canonical context by itself.
- Streaming displays partial response promptly and persists the final message exactly once.

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
- RLS/security advisors are clean for changed database surfaces.
