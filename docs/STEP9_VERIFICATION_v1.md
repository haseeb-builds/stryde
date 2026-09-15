# STRYDE — Step 9 Persistence Verification v1

## Status
IMPLEMENTED AND LIVE-VALIDATED

## Scope
Step 9 establishes the canonical V1 persistence foundation from the Step 8 contract. The legacy `loops/checkin` prototype remains present but is no longer treated as canonical.

## Repository checkpoint
- Step 9 implementation contract: `docs/STEP9_IMPLEMENTATION_CONTRACT_v1.md`
- Canonical migration source files: `supabase/migrations/20260915000100_stryde_v1_persistence.sql` and `supabase/migrations/20260915000200_stryde_v1_persistence_hardening.sql`
- Additional live hardening was applied through the Supabase migration API and should be reconciled into the repository migration naming/history before the next schema reset.

## Live Supabase verification
Project: Stryde (`pvijrnwdnolvnoibarrj`)
Status at verification: ACTIVE_HEALTHY

Applied migrations:
- `20260915024406` — `stryde_v1_persistence`
- `20260915024414` — `stryde_v1_persistence_hardening`
- `20260915024429` — `stryde_v1_persistence_delete_hardening`
- `20260915024503` — `stryde_v1_security_hardening`

Database checks:
- 24 canonical V1 tables exist.
- 60 foreign-key constraints exist across the persistence model.
- 36 indexes exist across the core/query paths audited.
- RLS is enabled on the canonical user-owned tables.
- Legacy `public.loops` now has RLS enabled and no client policies.
- Append-only semantic/support records have no direct client INSERT/UPDATE/DELETE policies.
- Core trusted-control-plane state tables no longer expose direct client UPDATE policies where guarded server mutation is required.
- Claim epistemic status changes require the trusted control-plane role.
- Objective Claim pointers are validated for ownership, Pursuit membership, current lineage, and objective kind.
- Job tool/version binding is validated.
- Action originating decision-option binding is validated.
- Decision chosen-option binding is validated.
- Owner identity is guarded as immutable on user-owned records.
- Terminal Thread/Pursuit/Decision/Action mutation guards are present.

## Security advisor result
The previous ERROR for `public.loops` having RLS disabled was resolved.
The remaining security advisory is informational: RLS is enabled on `public.loops` without client policies, intentionally isolating the legacy prototype from direct client access.

## Performance advisor result
Current performance advisories are expected for a newly created schema with no production query workload:
- foreign-key indexes are flagged where no covering index has yet been justified by an observed query pattern;
- auth RLS policies use `auth.uid()` and can be optimized to `(select auth.uid())` before scale requires it;
- several newly created query indexes are currently unused because the canonical application query paths are not yet implemented.
These are not blockers for Step 9 and should be addressed alongside the query layer rather than by speculative indexing.

## Important open reconciliation item
The live Supabase migration version IDs were generated at application time (`20260915024406`, etc.), while the repository contains timestamped source filenames. Before any future database reset, branching, or `supabase db push` workflow, reconcile repository migration filenames/content with the recorded live migration history so Git and Supabase have one unambiguous migration lineage.

## Next step
Step 10: establish the authenticated server/data-access and control-plane mutation boundary, replace the current browser/anon-key Supabase usage for canonical state, and keep the legacy check-in prototype isolated until migration of real product behavior is intentional.
