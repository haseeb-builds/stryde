# Stryde Operating Model

Status: canonical project operating model
Reconciliation date: 2026-09-28

## Authority

Conversation is the control interface only.

Durable project memory and truth are:
- repository code, migrations, and canonical documents;
- live Supabase schema/data/functions/policies;
- deployed/runtime evidence from Vercel;
- tests, traces, and verification artifacts.

Conversation memory must not override available repository/runtime evidence.

## Control-room protocol

Future control-room sessions read, in order:
1. docs/PRODUCT.md
2. docs/ARCHITECTURE.md
3. docs/STATE.md
4. docs/DECISIONS.md
5. docs/INTEGRATIONS.md
6. docs/RUNTIME.md
7. docs/VERIFICATION_MATRIX.md
8. docs/OPERATING_MODEL.md
9. HANDOFF.md

Only then inspect relevant code/migrations/tests for the active task.

## Change discipline

Every task states:
- task type;
- files/tables in scope;
- acceptance evidence;
- invariants that must remain true.

Reconciliation does not become implementation, refactoring, or cleanup.

## Status rules

IMPLEMENTED = code/schema machinery exists.
TESTED = relevant test was actually executed and recorded.
DEPLOYED = deployment evidence exists.
PRODUCTION VERIFIED = behavior was demonstrated against deployed/runtime systems.
END-TO-END VERIFIED = the complete intended path was demonstrated.

Never upgrade status by inference.

## Evidence labels

CONFIRMED = directly observed in repository, live database, deployment metadata, or executed tests.
INFERRED = interpretation from confirmed evidence.
UNKNOWN = relevant evidence is unavailable.
CONTRADICTED = authoritative evidence sources disagree.

## Worker rule

Workers are subordinate executors. They receive bounded authorized work and return mechanical results. They do not create authority, redefine canonical state, or self-verify consequential outcomes.

## Integration rule

Every external capability must have an identity/version, permission scope, credential boundary, side-effect classification, provenance, and verification story.

## Migration rule

Never assume repository migrations equal the live database. Before schema-changing work, inspect live migration history, repository migration files, duplicate versions, schema, constraints, functions, policies, and grants.

## Incident rule

When runtime disagrees with repository assumptions:
- preserve the observed runtime behavior;
- capture exact evidence;
- classify the failure as code/config/schema/deployment/provider/external;
- do not conceal the discrepancy;
- update current-state docs only after verification.
