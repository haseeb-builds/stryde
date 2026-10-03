# Stryde Handoff

Reconciliation date: 2026-10-02

## Current canonical direction

Read docs/PRODUCT_CONSTITUTION.md first.

Stryde is a persistent personal pursuit system with one universal control surface. The user brings something meaningful; Stryde determines what it is, reconstructs the situation, gets appropriate evidence, adapts knowledge to the person, challenges assumptions, recommends a next move, executes or delegates within authority, observes/ verifies results, learns, and continues.

## Current repository

- Branch: codex/model-routing-migration-clean
- HEAD: f92aa8a37bffd56ce53b968484acfc3efcbcc6e0
- Main: 6cbfcfe70515bd51b832de60109c4d7a49ad491b
- Branch is intentionally ahead and diverged; do not blindly merge the old main provider lineage.

## Current runtime

- Preview deployment exists and is READY.
- Preview currently has no usable model provider configuration.
- Production remains on the old main/Nemotron-era deployment and its health endpoint reports model configuration not ready.
- No production authenticated E2E has been proven.

## Current database

- Supabase pvijrnwdnolvnoibarrj is healthy.
- 33 pursuits, 37 conversation sessions, 127 conversation messages, 13 claims, 36 observations, 37 actions, 37 decisions, 16 runs, 264 events, 2 tools.
- 7 failed runs and 9 running runs.
- 0 capability grants, 0 jobs, 0 attempts: real worker execution remains unproven.

## What is already proven locally

- 51/51 unit tests.
- human E2E 14/14.
- real OmniRoute provider contract probe passed.
- model E2E 11 boundaries with Gemini rate-limited and OmniRoute serving the actual turns.
- action report → observation → claim → evidence → verification → updated next move works locally.

## What must now be built

Status 2026-10-03 (verified evidence in docs/STATE.md and docs/VERIFICATION_MATRIX.md):

1. DONE — Universal/simple user surface: one composer; contextual source,
   claims, memory, and autonomy disclosures mounted on the pursuit page.
2. DONE in V1 form — input classification on the turn contract
   (correction/progress/decision semantics), inline URL ingestion, file
   attach with text/PDF extraction.
3. DONE in V1 form — mechanical VERIFY_WEB verification (REPORTED → OBSERVED
   via trusted-plane evidence; VERIFIED stays human-only).
4. DONE in V1 form — memory lifecycle (confirmation, supersession, ranked
   retrieval, user inspectability and control).
5. DONE in V1 form — tighten-only autonomy policy; per-action approval
   unchanged. "Take it from here" beyond this is still open.
6. PARTIAL — Exa wired and its observation recording repaired
   (trusted-plane); no live search proof yet; multi-provider acquisition
   still open.
7. DONE for Hermes — a real agent executed real work through the CONTROLLED
   plane (artifact-judged). OpenCode execution remains contract-only.
8. IN PROGRESS — production env contract set 2026-10-03; the production
   conversation loop additionally needs a funded model credential
   (OpenRouter holds $0.00 credits) and the verified tree promoted.
9. NOT STARTED — final visual design pass.

## Non-negotiables

- Do not turn Stryde into a generic AI workspace.
- Do not expose internal ontology in normal UX.
- Do not let third-party infrastructure redefine Stryde.
- Do not add dependencies just because they are popular.
- Do not use model output as authority or proof of outcome.
- Do not make the user verify what Stryde can reliably verify itself.
- Do not reset the live database to make migrations look clean.
- Do not declare completion without matching evidence.

