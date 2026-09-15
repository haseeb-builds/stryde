# STRYDE — Step 10 Authenticated Server Boundary

## Status
Implemented and limited to the canonical server boundary. No orchestration or legacy UI migration is included.

## Decision
The canonical V1 application path is:

`Client / external caller → authenticated Next.js route → verified Supabase user → owner-scoped PostgreSQL access`

The caller must present a Supabase access token in the `Authorization: Bearer <token>` header.

The server verifies the token with `supabase.auth.getUser(accessToken)` and derives ownership from the verified `user.id`.

`owner_user_id` is never accepted as an authority-bearing request field.

## Files

- `lib/supabase/server.ts` — request authentication and verified-user helper.
- `app/api/v1/threads/route.ts` — canonical authenticated Thread read/write example.

## Endpoint contract

### `GET /api/v1/threads`

Requires a valid bearer token. Returns only Threads owned by the authenticated user.

### `POST /api/v1/threads`

Requires a valid bearer token.

Accepted request body:

```json
{ "content": "..." }
```

The server trims and validates `content`, derives `owner_user_id` from the verified Supabase user, and creates the Thread through Supabase RLS.

The endpoint rejects missing/invalid authentication and invalid request bodies.

## Explicit non-goals

- No replacement of the legacy `lib/supabase.ts` path yet.
- No browser session UX yet.
- No orchestration engine.
- No direct client writes to canonical domain tables.
- No service-role client exposed to request handlers.
- No autonomous execution.

## Validation basis

The persistence layer is already live in Supabase with user ownership/RLS. The new server helper preserves that boundary by attaching the verified bearer token to the Supabase client and never trusting caller-provided ownership.

The repository uses TypeScript strict mode and the `@/*` path alias, so the new server modules are consistent with the existing compiler configuration.
