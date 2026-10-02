# Stryde Runtime Truth

Status: canonical runtime record
Reconciliation date: 2026-10-02

## Current deployed reality

Preview:
- Branch: codex/model-routing-migration-clean
- Deployment: dpl_43tq7ZHVLzhkDdtdjNwHGGdJvbYP
- State: READY
- Preview health: HTTP 200, but no usable model provider configured.

Production:
- Deployment: dpl_3cPciN3GnkHuV6CeP5CtHWSo4nBd
- State: READY
- Branch: main
- Commit: 6cbfcfe70515bd51b832de60109c4d7a49ad491b
- Production health: HTTP 200, provider=gemini, model=gemini-2.5-flash, configured=false, ready=false.
- Production is therefore not running the current validated two-provider branch.

No runtime errors were reported by the current seven-day grouped Vercel runtime-error query. This does not prove absence of all production issues because runtime log retention/coverage is limited.

## Current branch model intent

Active intended chain:
Gemini DIRECT PRIMARY → OmniRoute FALLBACK

OpenRouter is inactive for this phase.
Groq is not part of the intended product path.

The current source layer still contains broader provider types/defaults for compatibility, so source architecture is temporarily broader than the active product chain. Do not re-enable Groq or OpenRouter just to reduce this textual mismatch.

## Local model proof

2026-09-30:
- OmniRoute direct provider probe passed.
- Gemini request/schema conversion defects were fixed, but full-turn proof on the free key remained rate-limited.
- Full model E2E passed using OmniRoute after Gemini rate limiting.

This is strong evidence for provider abstraction/fallback locally, not production verification.

## Local product-loop proof

2026-09-30:
- Human E2E 14/14.
- Model E2E 11 boundaries.
- Real loop reached action report → observation → claim → evidence link → verification → new working state.

## Production proof status

NOT PROVEN:
- authenticated conversation E2E on production;
- real production model turn;
- production source ingestion/research;
- production external worker execution;
- production automatic verification.

## Database runtime

Supabase is healthy and currently contains 33 pursuits, 37 conversation sessions, 127 conversation messages, 13 claims, 36 observations, 37 actions, 37 decisions, 16 runs, and 264 events.

This confirms the live database is materially more advanced than the stale September snapshots in older docs.

## Migration runtime risk

Live migration history currently contains 16 entries. The repository contains materially more migration files and a duplicate version 20260915000500. Live-only migrations include the restore migrations from 20260927. Schema effects exist whose corresponding migration history is not one-to-one with the repo.

Do not reset, db push, or rewrite migration history casually.

## Security runtime

Current security advisor:
- public.loops RLS without policy (INFO);
- four authenticated-callable SECURITY DEFINER functions (WARN);
- leaked-password protection disabled (WARN).

The citation policy tautology and several mutation privilege issues from earlier reconciliation were fixed on 2026-09-30 and are no longer listed as those same findings.

