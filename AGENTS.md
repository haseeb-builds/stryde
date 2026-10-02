<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know
This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in node_modules/next/dist/docs/ before writing code.
<!-- END:nextjs-agent-rules -->

# Stryde Engineering Rules

## First read

Before changing behavior:
1. docs/PRODUCT_CONSTITUTION.md
2. docs/PRODUCT.md
3. docs/ARCHITECTURE.md
4. docs/STATE.md
5. docs/DECISIONS.md
6. docs/INTEGRATIONS.md
7. docs/RUNTIME.md
8. docs/VERIFICATION_MATRIX.md
9. docs/OPERATING_MODEL.md
10. HANDOFF.md

Historical STEP/PRD/EVAL/ROADMAP documents are not current authority unless explicitly cited as historical evidence.

## Product invariants

- Stryde is a pursuit system, not a generic AI assistant or AI workspace.
- One universal composer is the primary interaction surface.
- Do not expose Research / Claim / Action / Evidence / Pursuit / Decision as primary workflow buttons.
- The user should not have to understand Stryde's internal ontology.
- Stryde chooses modes/capabilities intelligently from context.
- Models propose; policy and authorization decide.
- Never confuse action completion with real-world verification.
- UNKNOWN remains UNKNOWN until resolved.
- User-reported claims, source claims, observations, and verified outcomes remain distinct.
- User cognition is a scarce resource. Prefer system work over asking the user to perform avoidable verification or data entry.
- A recommendation must account for feasibility, constraints, prior results, risk, and timing, not only theoretical correctness.
- Better external models should improve Stryde rather than redefine Stryde.
- Third-party infrastructure is replaceable capability, not semantic authority.

## Build behavior

Start from current evidence, not assumptions.

For every change:
1. inspect the relevant current code and live state;
2. identify the smallest change that advances the product outcome;
3. use existing primitives before adding abstractions;
4. make the change;
5. run focused tests;
6. run typecheck/lint/build when relevant;
7. verify runtime behavior when materially possible;
8. record only verified facts.

Do not return after fixing the first error if other clearly blocking subproblems are discoverable. Continue until the declared outcome is true or a human-only blocker remains.

## Open-source rule

Use, wrap, adapt, combine, reconstruct, or reject third-party technology case-by-case.

Before embedding code or adding a dependency, evaluate:
- actual license;
- redistribution and derivative-work obligations;
- security/supply-chain posture;
- maintenance/activity;
- runtime/cloud dependency;
- telemetry/data handling;
- API stability;
- migration/replacement cost;
- whether the capability is actually differentiating.

Prefer permissive embedded dependencies when appropriate, but do not treat permissive licensing as proof of architectural fit.

## Autonomy and capability rule

When a capability is needed, determine:
- whether Stryde can do it internally;
- whether an external tool is safer/reliable;
- whether a worker should do it;
- whether the user must authorize it;
- how the result will become an Observation;
- how the outcome can be verified.

Do not add an external side effect without a bounded authority path.

## Data/memory rule

Do not add a second "memory database" without a demonstrated retrieval or scale problem.

Memory is semantic, provenance-aware, owned, and editable. A vector store is an implementation detail, not canonical truth.

## Verification rule

Code exists ≠ implemented behavior.
Tests pass ≠ production works.
Production works ≠ outcome verified.

The final proof must match the outcome being claimed.

## Release rule

Do not call Stryde production-ready while:
- production points to materially stale architecture;
- required provider/runtime configuration is absent;
- migrations cannot be reconciled safely;
- required end-to-end user behavior is not proven.

## Worker role

Workers are subordinate executors. They do not grant authority, redefine canonical state, or self-verify consequential outcomes.

## User role

The user is product authority and acceptance tester. Do not make the user debug implementation details unless the required action is genuinely human-owned.

## Optimization

Optimize scarce model tokens for actual uncertainty and implementation work. Do not spend expensive reasoning on already-proven cleanup, decorative abstractions, or giant repeated repository reads.

