# Stryde Engineering Control Plane

**Record date:** 2026-10-21  
**Purpose:** Persistent handoff for the user, Antigravity/Argon, and ChatGPT. This is a working control record, not a claim that reported defects have already been independently reproduced.

## 1. Operating agreement

- **User owns product intent and consequential risk decisions.** Do not make the user invent the next engineering task or repeatedly restate the project context.
- **Antigravity/Argon is the execution agent.** It owns local-repository inspection, implementation, tests, code review, commits, pushes, pull requests, preview deployment, and deployment verification when supported by its tools.
- **ChatGPT is the independent reconciliation/technical-lead layer.** It compares Argon's claims with available repository, GitHub, CI, deployment, and runtime evidence; challenges unsupported claims; identifies gaps; chooses the next bounded task; and supplies the exact next prompt.
- **Default loop:** inspect actual state → select the highest-risk verified blocker → write/confirm failing regression test → implement the smallest safe fix → run focused and full checks → inspect diff → commit/push/PR → verify hosted CI and preview → reconcile evidence → update this record and canonical docs → select the next task.
- **Do not treat a report, green unit-test suite, successful build, READY deployment, or successful command as proof of end-to-end product correctness.** Verify the actual behavior and identity of the tested/deployed commit.
- **Skills/tools:** use installed Superpowers and relevant repository skills when they improve execution; do not install a pile of overlapping tools. Read `AGENTS.md` and the canonical docs before behavior changes. Follow the repository's TDD and verification requirements.
- **Secrets:** never print or commit secret values. Report only whether a required variable is present, absent, or unverified.
- **Production authority:** Argon should carry out implementation and deployment workflows rather than merely report how to do them. Under the currently confirmed release rule, do not merge to `main`, promote/deploy production, run production migrations, mutate production data, or incur unapproved spend without explicit user approval. Preview deploys and non-production verification may proceed within existing permissions.

## 2. Current repository snapshot — evidence and limits

### Independently checked through GitHub connector on 2026-10-21

- Repository: [haseeb-builds/stryde](https://github.com/haseeb-builds/stryde), default branch `main`; connector reports the account has push/admin permissions.
- PR #9, [Release baseline: harden dependencies and verify clean build](https://github.com/haseeb-builds/stryde/pull/9), is open and unmerged.
- PR #9 head is `5cb0ba90c2523fdd60f0517f6e4acd85e73b6c19`; its recorded base SHA is `319ae0fd2faba19e59db3424a513e4f4ca11cce5`, which is stale relative to the reported current main head. GitHub reports the PR as mergeable at the time checked; this does not establish that it is current, safe, or release-ready.
- The feature branch's commit `ecb38379fe15abc8d8c6901844af26074d316daf` has a Vercel status context marked success with a preview URL. This connector status result alone does not independently prove the full GitHub Actions run or the live user journey.
- The current `main` version of `docs/STATE.md` still records production as commit `1df79487da20bd4066e7ff492f6851c0960e6141` and deployment `dpl_HxMc5YPcdgndAT9KnvaEHYNQKm2G`. The user-provided Argon report says actual production is `b3680469703369fa8f27123fc0eb04f171700f49` / `dpl_2LtLW5PZGgEh1EBVWpbX4X5GPvQn`. **This discrepancy needs direct Vercel reconciliation before canonical deployment records are changed.**
- The repository's `AGENTS.md` requires reading `docs/PRODUCT_CONSTITUTION.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/STATE.md`, `docs/DECISIONS.md`, `docs/INTEGRATIONS.md`, `docs/RUNTIME.md`, `docs/VERIFICATION_MATRIX.md`, `docs/OPERATING_MODEL.md`, and `HANDOFF.md` before behavior changes.

### Reported by Argon — not yet independently reproduced here

Argon reported local branch `fix/conversation-turn-reliability` at `ecb38379fe15abc8d8c6901844af26074d316daf`, clean working tree, eight commits ahead of `origin/main` at `b3680469703369fa8f27123fc0eb04f171700f49`, and no PR for the feature branch. It also reported a production dependency audit failure on that branch and on main, plus risks R-1 through R-8 below. Recheck the branch, audit output, schema, policies, runtime behavior, and hosted checks before treating these as facts.

## 3. Priority queue

### Priority 0 — security baseline and research correctness

1. **Reconcile PR #9 against the current `main`.** Verify current security advisories and exact lockfile resolution; update/rebase the PR onto the real current main; resolve documentation conflicts without overwriting newer evidence; run clean install, `npm audit --omit=dev`, tests, typecheck, lint, build, hosted CI, and preview checks. Do not merge until gates pass and the user approves the production-affecting step.
2. **Fix research-first/roadmap-audit defects on `fix/conversation-turn-reliability` after rebasing onto the accepted security baseline:**
   - **R-1 — Citation persistence/schema:** reported wrong `pursuit_source_citation` columns, missing NOT NULL fields, incorrect source linkage, and ignored insert errors. Confirm migration/schema and use the canonical citation builder/real retrieved source rows.
   - **R-2 — Adaptation supersession/RLS:** reported v1 `SUPERSEDED` update silently blocked by RLS. Use the approved trusted-plane boundary scoped to owner and row, or an appropriately secured policy/RPC; assert affected-row/error behavior.
   - **R-3 — Search observations dropped:** reported `WEB_SEARCH_RESULT` observations excluded during situation assembly. Preserve pursuit-scoped observations and test the compiled prompt packet.
   - **R-4 — Blocked research streams ungrounded advice:** when required research is blocked, make the blocker the actual response before streaming; keep streamed deltas, persisted message, and work state consistent.
   - **R-7 — Context compiler omits roadmap audit data:** preserve `methods` including `audit_status`, assumptions, prerequisites, unknowns, and provenance.
3. **Use schema- and policy-aware tests.** Untyped mocks that accept arbitrary database columns or ignore RLS behavior are not sufficient. Prefer a narrow integration test against a disposable/test database when available; never run destructive tests against production data.
4. **Acceptance checks:** citation rows conform to the actual schema and link to retrieved sources; v1 supersession is proven; search observations and audit statuses reach model context; blocked research emits no ungrounded model text in JSON or SSE; all failure paths preserve message/work consistency.

### Priority 1 — policy and quota enforcement

5. **R-6 — resource/autonomy bypasses:** audit `/conversation`, `/work`, `/sources`, `/pursuits`, and `/research`. Reserve `model_turns`, `research_rounds`, and `source_extractions` before any billable/external work; reconcile or release reservations on every success/failure path; enforce `checkAutoResearch` consistently. Make retries idempotent and reservation behavior atomic.
6. **R-8 — provider configuration mismatch:** `.env.example` reportedly documents `STRYDE_SEARCH_PROVIDER=auto` while runtime rejects it. Either support `auto` with tests or correct the example and documented contract.
7. Audit initial pursuit/source intake so preliminary roadmap steps remain `UNVERIFIED` until research-backed audit is complete.

### Priority 2 — release truth and operability

8. Reconcile `docs/STATE.md`, `docs/RUNTIME.md`, `docs/INTEGRATIONS.md`, `docs/VERIFICATION_MATRIX.md`, and `HANDOFF.md` against current GitHub, Vercel, Supabase migration/policy state, and real E2E evidence. Preserve historical checkpoints; mark superseded facts rather than silently rewriting history.
9. Verify a dedicated test-account journey: sign-in → create pursuit → persistent conversation → second turn/reload persistence → approved action → outcome verification. Confirm the tested SHA equals the preview SHA. Production journey must be explicitly authorized and safely executed.
10. After release gates are met, continue the larger Stryde mission: reliable retrieval/provenance, evidence-led roadmap adaptation, bounded authorized execution, outcome verification, state learning, and measurable evaluation/observability.

## 4. Security and release gate

A proposed dependency/security change is not automatically safe because it claims to remove vulnerabilities. Validate:
- current advisory applicability and fixed versions against trustworthy current sources;
- exact resolved production dependency tree and lockfile;
- clean install and `npm audit --omit=dev`;
- full tests, typecheck, lint, production build, and hosted CI;
- browser/auth/persistence/action journey on a preview deployed from the exact candidate SHA;
- rollback and migration implications, if any.

Never use `npm audit fix --force` without analyzing breaking changes. Do not confuse a successful Vercel preview check with successful end-to-end runtime behavior.

## 5. Required format for every Argon handoff

Every implementation report must include:

1. **Identity:** repo root, branch, base/head SHA, clean/dirty status, and whether remote matches local.
2. **Change:** files changed, behavior changed, and explicit non-goals.
3. **Tests:** exact commands and actual outcomes; distinguish not run, failed, blocked, and passed.
4. **Evidence:** relevant test names/output, schema/migration/policy proof, CI run URL, preview URL, deployed commit SHA, and runtime test evidence.
5. **Risks/unknowns:** anything inferred, mocked, not reproducible, inaccessible, or dependent on missing credentials.
6. **GitHub:** commit SHA, push confirmation, PR URL/state, required checks, and review findings.
7. **Next action:** one recommended next task with rationale and acceptance criteria. Do not ask the user to choose between engineering steps when the evidence supports a clear recommendation.
8. **Production:** explicitly state whether production was touched. Never claim production is fixed or launch-ready without direct verification.

## 6. Current immediate instruction to Argon

Start with the **security baseline reconciliation**, not a broad redesign. Inspect the current remote state and PR #9, verify the vulnerability claim and the candidate fix on a branch rebased onto current main, and report whether the PR can safely proceed. Do not merge to main or deploy/promote production without the user's explicit approval. Once the security baseline is accepted, rebase the feature branch and implement R-1/R-2/R-3/R-4/R-7 using test-first, schema-aware regressions. Keep each change bounded and preserve a clean handoff.

## 7. Evidence status legend

- **VERIFIED:** directly supported by reproducible output or an authoritative connected source checked for the stated SHA/time.
- **REPORTED:** stated by Argon or another report but not independently reproduced.
- **DERIVED:** conclusion follows from explicitly listed evidence but was not directly observed.
- **UNKNOWN/BLOCKED:** required evidence is not available or the check could not be performed.

Update this record when new evidence changes the queue. This file is a handoff/control record; canonical runtime/deployment truth belongs in the repository's designated state/runtime documents after direct verification.
