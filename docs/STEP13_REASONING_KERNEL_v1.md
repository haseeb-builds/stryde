# STRYDE — Step 13 Reasoning Kernel v1

## Status
IMPLEMENTED

## Objective
Establish the canonical cognitive Run boundary over the bounded Situation projection without coupling Stryde to a specific model vendor.

## Canonical flow
`INPUT → CONTEXT_ASSEMBLY → UNDERSTAND → REASSESS`

Conditional when the path is unclear:
`DIAGNOSE`

Then, when an intervention is warranted:
`SELECT_INTERVENTION → PROPOSE → VALIDATE → AUTHORIZE → COMMIT`

Execution and verification do not occur inside this Run. An authorized Job is the handoff point to the control/execution plane; later external results create new Runs.

## Implementation
- `lib/orchestration.ts` defines the Run stages, model proposal contract, proposal validation, prompt construction, and deterministic Run-state projection.
- `app/api/v1/pursuits/[id]/reason/route.ts` assembles owner-scoped Situation context and exposes the model-provider-neutral reasoning seam.
- `lib/situation.ts` remains the derived context assembler; Situation is not a persisted domain entity.

## Safety boundaries
- Model output is treated as a proposal, not authority.
- `CONTROLLED_ACTION` is only a proposed intervention kind at this layer.
- `side_effect_authorized` is always `false` in the reasoning result.
- No Job or Attempt is created by the reasoning kernel.
- No Claim can be upgraded to `VERIFIED` from model output.
- Strategic decisions, approvals, permissions, budgets, and side effects remain deterministic/control-plane responsibilities.
- The reasoning kernel does not persist a Run yet; Run persistence is a subsequent implementation step and must preserve the canonical Run boundary.

## Provider seam
The current route intentionally supports two phases:
1. Generate a bounded provider prompt when no model proposal is supplied.
2. Validate and reconcile a provider-returned JSON proposal when supplied.

This keeps vendor selection out of the orchestration kernel. A future model gateway must call the same proposal contract rather than bypassing validation.

## Required validation cases
- Clear path without a response/intervention is rejected.
- Unclear path without diagnosis/intervention is rejected.
- Unknown intervention kinds are rejected.
- Oversized model text is rejected.
- A proposed controlled action never becomes authorization merely by being returned by the model.
- Route ownership remains enforced through the authenticated Supabase boundary and pursuit-scoped Situation assembly.

## Next step
Step 14: implement the deterministic control-plane authorization/commit path for proposed Decisions and Actions, including immutable authorization snapshots and Job creation, while preserving the Run boundary.
