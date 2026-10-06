# Stryde Public Extensibility — Draft API Contracts (Phase 18)

Status: DRAFT — NOT a stable API promise. The semantics below are exposed
internally today (RLS-scoped REST) and are documented so future external
APIs can be extracted without redesign. Per the mandate, no stability
guarantee is made before the semantics are proven with real users.

## Conventions

- All endpoints are owner-scoped server-side (authenticated Supabase JWT);
  RLS is the second layer, never the only one.
- Resource-control RPCs are trusted-plane only and are NOT part of any
  public contract.
- Table names stay SINGULAR; RPCs keep the `stryde_` prefix; statuses are
  UPPERCASE text.

## Surfaces

1. **Pursuit API** — `GET/POST /api/v1/pursuits`, pursuit detail, situation,
   conversation, working state. Already the primary internal surface.
2. **Observation API** — observations are trusted-plane written; external
   read exposure is future work behind an explicit opt-in.
3. **Research API** — `POST /api/v1/pursuits/[id]/research` (search,
   MATERIALIZE_RESULT) with per-result novelty classification
   (NOVEL/DUPLICATE/SYNDICATED) and aggregate counts.
4. **Capability API** — `GET /api/v1/capabilities/worker` (authority state);
   registry reads require authentication. Discovery results are
   planner-internal; raw catalogs are not a UX surface.
5. **Skill API** — `GET/POST /api/v1/skills`, lifecycle actions at
   `/api/v1/skills/[id]`; V2 manifests exposed via `listSkillManifests`.
6. **Artifact API** — `GET/POST /api/v1/artifacts`,
   `GET/PUT /api/v1/artifacts/[id]` (append-only revision via
   `stryde_revise_artifact`).
7. **Event/Webhook API** — notifications REST at `/api/v1/notifications`
   with dismiss; a future outbound webhook channel already has the delivery
   abstraction (`deliverPendingNotifications`). Triggers REST at
   `/api/v1/triggers` (create/pause/resume/cancel).

## Non-goals

- No public marketplace (D28); no unauthenticated mutation surface; no
  client-authoritative plan or budget data.
