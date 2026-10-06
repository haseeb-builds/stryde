-- Skills V2 (Phase 4): extend the existing procedural-memory skill into a
-- reusable capability package while preserving the established lifecycle
-- (proposed → scanned → approved → active → stale → archived, versioned,
-- rollback by new version) and full backwards compatibility with existing
-- JSON procedures. A skill packages guidance; it NEVER grants authority —
-- execution still flows through the autonomy policy and approval gates.
--
-- Progressive disclosure: the manifest columns below are cheap to list;
-- the procedure body is loaded only when a skill is actually activated.

alter table public.skill
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists required_capabilities jsonb not null default '[]'::jsonb,
  add column if not exists allowed_capabilities jsonb not null default '[]'::jsonb,
  add column if not exists expected_outputs jsonb not null default '{}'::jsonb,
  add column if not exists verification_rules jsonb not null default '[]'::jsonb,
  add column if not exists cost_profile jsonb not null default '{}'::jsonb;
