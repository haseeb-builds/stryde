# 10 — Current Implementation (as-built audit of the Stryde repo)

- Repo root: `C:/Users/DELL/Desktop/Stryde/stryde`
- Remote: `https://github.com/haseeb-builds/stryde.git`
- HEAD: `c3e97b316833f7799f2f0b59ecedb3bb88f022a2
c3e97b3
haseeb-dev-sys <abdhaseeb.tech@proton.me>
Sun Oct 4 01:13:48 2026 +0500
Close the remaining capability gaps: real OpenCode execution, multi-provider evidence, real citation locators, memory-loop proof, product-quality fixes`
- Collected: read-only static inspection. No build/test/live call was executed. Unknowns marked **UNVERIFIED**.

---

## 1. `package.json` (verbatim, complete)

```json
{
  "name": "stryde",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "node --experimental-strip-types --test tests/**/*.test.ts",
    "worker:dispatch": "node --experimental-strip-types scripts/worker-dispatcher.ts",
    "e2e:human": "node --experimental-strip-types scripts/e2e-human-loop.ts",
    "e2e:model": "node --experimental-strip-types scripts/e2e-model-loop.ts",
    "probe:provider": "node --experimental-strip-types scripts/probe-provider.ts",
    "e2e:controlled": "node --experimental-strip-types scripts/e2e-controlled-worker-loop.ts",
    "worker:stub": "node --experimental-strip-types scripts/worker-stub.ts",
    "worker:hermes": "node --experimental-strip-types scripts/hermes-worker.ts",
    "e2e:real-worker": "node --experimental-strip-types scripts/e2e-real-worker.ts",
    "e2e:opencode-worker": "node --experimental-strip-types scripts/e2e-opencode-worker.ts",
    "e2e:ui": "node scripts/e2e-ui-flow.mjs",
    "e2e:verify-web": "node --experimental-strip-types scripts/e2e-verify-web.ts",
    "e2e:memory-loop": "node --experimental-strip-types scripts/e2e-memory-loop.ts",
    "e2e:evidence-loop": "node --experimental-strip-types scripts/e2e-evidence-loop.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.110.0",
    "next": "16.2.9",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "resend": "^6.16.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.9",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

**Observations (package.json):**
- Framework: **Next.js 16.2.9**, React **19.2.4**, App Router (`app/`).
- Only **5 runtime dependencies**: `@supabase/supabase-js`, `next`, `react`, `react-dom`, `resend`.
- **No** AI SDK dependency — model calls are hand-rolled over raw `fetch` (`lib/model-gateway.ts`, `lib/model-gateway-stream.ts`).
- **No** test framework dependency. Tests run on the **Node.js built-in runner**: `node --experimental-strip-types --test tests/**/*.test.ts` (Node 22 type-stripping).
- **No** puppeteer/playwright. Browser verification is a hand-written CDP client (`scripts/cdp-client.mjs`).
- **No** queue / cron / observability / vector-DB / embedding library.
- 17 npm scripts: 3 e2e loops (`e2e:human`, `e2e:model`, `e2e:controlled`), 3 worker entrypoints (`worker:dispatch`, `worker:stub`, `worker:hermes`), 2 real-agent loops (`e2e:real-worker`, `e2e:opencode-worker`), plus `e2e:ui`, `e2e:verify-web`, `e2e:memory-loop`, `e2e:evidence-loop`, `probe:provider`.

---

## 2. Source tree (node_modules / .next / .git excluded)

### 2a. `find app lib scripts supabase -type f | sort` — 141 files

```
app/.gitignore
app/api/cron/continuity/route.ts
app/api/health/model/route.ts
app/api/internal/execution/attempt/finish/route.ts
app/api/internal/execution/attempt/start/route.ts
app/api/internal/execution/lease/route.ts
app/api/internal/execution/reconcile/route.ts
app/api/internal/verification/observe/route.ts
app/api/v1/autonomy-policy/route.ts
app/api/v1/capabilities/worker/route.ts
app/api/v1/claims/[id]/adjudicate/route.ts
app/api/v1/claims/[id]/observations/route.ts
app/api/v1/claims/route.ts
app/api/v1/memory/[id]/route.ts
app/api/v1/memory/route.ts
app/api/v1/pursuits/[id]/actions/[actionId]/complete/route.ts
app/api/v1/pursuits/[id]/actions/delegate-worker/route.ts
app/api/v1/pursuits/[id]/actions/route.ts
app/api/v1/pursuits/[id]/actions/start/route.ts
app/api/v1/pursuits/[id]/commit/route.ts
app/api/v1/pursuits/[id]/conversation/route.ts
app/api/v1/pursuits/[id]/conversations/[sessionId]/route.ts
app/api/v1/pursuits/[id]/conversations/route.ts
app/api/v1/pursuits/[id]/objective/route.ts
app/api/v1/pursuits/[id]/observations/route.ts
app/api/v1/pursuits/[id]/reason/route.ts
app/api/v1/pursuits/[id]/research/route.ts
app/api/v1/pursuits/[id]/situation/route.ts
app/api/v1/pursuits/[id]/sources/route.ts
app/api/v1/pursuits/[id]/work/route.ts
app/api/v1/pursuits/route.ts
app/api/v1/runs/[id]/route.ts
app/api/v1/runs/[id]/transition/route.ts
app/api/v1/runs/route.ts
app/api/v1/threads/route.ts
app/favicon.ico
app/globals.css
app/layout.tsx
app/page.tsx
app/pursuits/[id]/autonomy-row.tsx
app/pursuits/[id]/claims-panel.tsx
app/pursuits/[id]/memory-panel.tsx
app/pursuits/[id]/page.tsx
app/pursuits/[id]/work-panels.tsx
lib/actor.ts
lib/adaptive-model.ts
lib/adaptive-situation.ts
lib/adaptive-work-controller.ts
lib/autonomy-policy.ts
lib/continuity.ts
lib/conversation-client-stream.ts
lib/conversation-commit.ts
lib/conversation-stream.ts
lib/execution-control.ts
lib/file-source-extraction.ts
lib/human-observation.ts
lib/internal-worker-auth.ts
lib/memory.ts
lib/memory-core.ts
lib/model-gateway.ts
lib/model-gateway-stream.ts
lib/model-provider.ts
lib/orchestration.ts
lib/page-fetch.ts
lib/research-execution.ts
lib/run.ts
lib/search-provider.ts
lib/situation.ts
lib/source-citation.ts
lib/source-ingestion.ts
lib/source-provider.ts
lib/supabase.ts
lib/supabase/server.ts
lib/supabase/service.ts
lib/universal-input.ts
lib/verification-check.ts
lib/verification-execution.ts
lib/work-controller.ts
lib/worker-contract.ts
lib/worker-gateway.ts
lib/working-state-normalization.ts
scripts/cdp-client.mjs
scripts/e2e-controlled-worker-loop.ts
scripts/e2e-evidence-loop.ts
scripts/e2e-human-loop.ts
scripts/e2e-memory-loop.ts
scripts/e2e-model-loop.ts
scripts/e2e-opencode-worker.ts
scripts/e2e-real-worker.ts
scripts/e2e-ui-flow.mjs
scripts/e2e-verify-web.ts
scripts/hermes-worker.ts
scripts/opencode-worker.ts
scripts/probe-provider.ts
scripts/worker-dispatcher.ts
scripts/worker-stub.ts
supabase/.temp/cli-latest
supabase/.temp/gotrue-version
supabase/.temp/linked-project.json
supabase/.temp/pooler-url
supabase/.temp/postgres-version
supabase/.temp/project-ref
supabase/.temp/rest-version
supabase/.temp/storage-migration
supabase/.temp/storage-version
supabase/migrations/20260915000100_stryde_v1_persistence.sql
supabase/migrations/20260915000200_stryde_v1_persistence_hardening.sql
supabase/migrations/20260915000300_stryde_control_plane_mutations.sql
supabase/migrations/20260915000400_stryde_authorization_commit.sql
supabase/migrations/20260915000500_stryde_v1_execution_control_plane.sql
supabase/migrations/20260915000550_stryde_verification_engine.sql
supabase/migrations/20260915000600_stryde_verification_engine_hardening.sql
supabase/migrations/20260915035349_stryde_pursuit_creation_security_hardening.sql
supabase/migrations/20260917101144_add_run_failure_reason.sql
supabase/migrations/20260917101341_harden_run_failure_transition.sql
supabase/migrations/20260917164751_conversation_sessions_persistence.sql
supabase/migrations/20260926081610_conversation_working_state.sql
supabase/migrations/20260926103302_fix_commit_intervention_digest_schema.sql
supabase/migrations/20260926120000_adaptive_pursuit_sources_and_human_feedback.sql
supabase/migrations/20260926161200_fix_commit_intervention_terminal_decision_order.sql
supabase/migrations/20260926163219_register_worker_tools.sql
supabase/migrations/20260926163349_worker_queue_lease_audit_fix_v2.sql
supabase/migrations/20260926163606_finalize_controlled_action_on_attempt.sql
supabase/migrations/20260926180000_conversation_server_owned_idempotency.sql
supabase/migrations/20260927083712_restore_pursuit_source_citation.sql
supabase/migrations/20260927083847_restore_conversation_turn_rpc.sql
supabase/migrations/20260927090000_source_citations_lineage.sql
supabase/migrations/20260930000000_rpc_privilege_hardening_and_citation_policy_fix.sql
supabase/migrations/20260930010000_user_claim_observation_link.sql
supabase/migrations/20260930020000_owner_insert_policies_verification_tables.sql
supabase/migrations/20260930030000_claim_owner_update_policy.sql
supabase/migrations/20260930040000_trusted_plane_claim_verification_rpcs.sql
supabase/migrations/20261002143729_personal_memory_foundation.sql
supabase/migrations/20261002180000_controlled_execution_authority_repair.sql
supabase/migrations/20261003115408_repair_commit_intervention_digest_search_path.sql
supabase/migrations/20261003115621_repair_commit_intervention_decision_lifecycle.sql
supabase/migrations/20261003170000_user_autonomy_policy.sql
supabase/tests/step15_execution_control_plane.sql
supabase/tests/step18_run_lifecycle.sql
supabase/tests/step19_model_gateway.sql
supabase/tests/step20_adaptive_pursuit.sql
```

### 2b. `find . -maxdepth 2 -type d ...` — top-level directories

```
.
./.audit-research
./.vercel
./app
./app/api
./app/pursuits
./docs
./lib
./lib/supabase
./public
./scripts
./supabase
./supabase/.temp
./supabase/migrations
./supabase/tests
./tests
```

### 2c. File counts (authoritative)

| Scope | Files |
|---|---|
| **Total source files (`app lib scripts supabase tests`)** | **160** |
| `app` (Next.js routes + UI) | 44 |
| `lib` (domain logic) | 37 |
| `scripts` (workers + e2e loops) | 15 |
| `supabase` (32 migrations + 4 SQL tests + 9 `.temp` CLI files) | 45 |
| `tests` (node:test unit tests) | 19 |
| TypeScript/TSX under `app` + `lib` | 78 |
| **Total LOC (`app` + `lib`, .ts/.tsx)** | **10718** |
| Whole repo, all non-dependency files | 224 |

Note: `supabase/.temp/*` (9 files) is Supabase CLI local cache (`project-ref`, `pooler-url`, `linked-project.json`, version stamps) — machine-local, not source.

### 2d. Tests (`find tests -type f`) — 19 files

```
tests/actor.test.ts
tests/autonomy-policy.test.ts
tests/continuity.test.ts
tests/conversation-stream.test.ts
tests/conversation-turn-contract.test.ts
tests/file-source-extraction.test.ts
tests/human-observation.test.ts
tests/memory-lifecycle.test.ts
tests/model-gateway-budget.test.ts
tests/model-provider-retry.test.ts
tests/opencode-worker.test.ts
tests/page-fetch.test.ts
tests/search-provider.test.ts
tests/source-citation.test.ts
tests/source-provider.test.ts
tests/verification-check.test.ts
tests/worker-contract.test.ts
tests/worker-dispatcher.test.ts
tests/working-state-normalization.test.ts
```

### 2e. Docs / CI

```
.github/workflows/ci.yml
docs/ARCHITECTURE.md
docs/DECISIONS.md
docs/EVALS.md
docs/INTEGRATIONS.md
docs/OPERATING_MODEL.md
docs/PRD.md
docs/PRODUCT.md
docs/PRODUCT_CONSTITUTION.md
docs/ROADMAP.md
docs/RUNTIME.md
docs/STATE.md
docs/STEP10_AUTH_SERVER_BOUNDARY.md
docs/STEP13_REASONING_KERNEL_v1.md
docs/STEP14_AUTHORIZATION_COMMIT_v1.md
docs/STEP15_EXECUTION_CONTROL_PLANE_v1.md
docs/STEP17_VERIFICATION_ENGINE_v1.md
docs/STEP18_RUN_LIFECYCLE_v1.md
docs/STEP19_ADAPTIVE_CONVERSATION_v1.md
docs/STEP19_MODEL_GATEWAY_v1.md
docs/STEP9_IMPLEMENTATION_CONTRACT_v1.md
docs/STEP9_VERIFICATION_v1.md
docs/VERIFICATION_MATRIX.md
```

---

## 3. Git state

### `git log --oneline -30`

```
c3e97b3 Close the remaining capability gaps: real OpenCode execution, multi-provider evidence, real citation locators, memory-loop proof, product-quality fixes
f85b97e Build the six intended-but-missing product capabilities and repair three integration defects
ff1fd00 Verify the user-facing product in a real browser
692f905 Fix three provider-layer defects found by probing the production leg
3cb3681 Prove a real agent executes real work through the CONTROLLED plane
309e93e Record that the Vercel surface returns a uniform /login rewrite and is not this application
22191ca Verify worker failure and unknown outcomes; fix two delegation defects
71b881f Record the CONTROLLED worker verification and the deployment protection blocker in the verification matrix
97f427f Identify the exact deployment URL and record why production is unverified
558d590 Prove the CONTROLLED worker plane end to end and fix three defects that made it unreachable
aa3ee7b Record deployment evidence and the production surface contradiction
eabfcca Record verified live state and correct stale security findings
6d2f449 Repair model-drift handling in the working-state boundary
ee4a1fa Repair two live control-plane defects blocking the core loop
b31d00c Document the Vercel runtime environment contract
127c9c3 Record the 2026-10-02 evening engineering pass in canonical state
986a11e Restore ConversationTurn memory_candidates typing and fix research-move narrowing
292be35 Give each streamed assistant turn a unique placeholder id
180ea80 Let process env override the e2e base URL over .env.local
267d3c9 Reconcile migration lineage with live database
cb5503f Retry retryable provider failures in place before chain failover
9b3c12a Use live timeout controller instead of unref timeout signal
31cc2cc Collapse pursuit UI to a universal control surface
075cb1e Execute and reassess autonomous web research moves
5d37d56 Expose capability availability to Stryde policy
4c8ba11 Allow autonomous targeted web research
0764afc Add autonomous web research execution
cd90e46 Fix conversation turn readiness validation
b5035ec Propagate verification into durable memory
7e42650 Make claim-sourced memory writes idempotent
```

### `git status --short`

```
?? .audit-research/
```
Interpretation: **working tree is CLEAN except one untracked directory** — `.audit-research/` (this audit's own output plus prior raw scrape artifacts). No modified or staged tracked files.

### `git branch -a`

```
  backup/pre-main-merge
+ codex/controlled-execution-repair
  codex/model-routing-migration
  codex/model-routing-migration-clean
* main
  remotes/origin/HEAD -> origin/main
  remotes/origin/codex/model-routing-migration
  remotes/origin/codex/model-routing-migration-clean
  remotes/origin/codex/nemotron-3-ultra-openrouter
  remotes/origin/feature/adaptive-pursuit-source-execution
  remotes/origin/feature/work-controller-v1
  remotes/origin/main
```
- Current branch: **`main`**. In-sync-with-origin is **UNVERIFIED** — no `git fetch` was run, so that is inferred from the absence of ahead/behind markers.
- `codex/controlled-execution-repair` is marked `+` (checked out in another linked worktree).
- 4 stale local branches (`codex/model-routing-migration`, `-clean`, `backup/pre-main-merge`) plus 3 remote-only branches.

### HEAD detail
```
c3e97b316833f7799f2f0b59ecedb3bb88f022a2
c3e97b3
haseeb-dev-sys <abdhaseeb.tech@proton.me>
Sun Oct 4 01:13:48 2026 +0500
Close the remaining capability gaps: real OpenCode execution, multi-provider evidence, real citation locators, memory-loop proof, product-quality fixes
```
Remote: `origin  https://github.com/haseeb-builds/stryde.git`

Commit-narrative reading: the last two commits (`f85b97e`, `c3e97b3`) are explicitly capability-gap closures — "Build the six intended-but-missing product capabilities", "Close the remaining capability gaps". Multiple earlier commits record that **production deployment is UNVERIFIED/blocked** ("Record that the Vercel surface returns a uniform /login rewrite and is not this application").

---

## 4. Config files present

| Config | Present | Path |
|---|---|---|
| Next.js | **YES** | `next.config.ts` |
| TypeScript | **YES** | `tsconfig.json` (+ generated `tsconfig.tsbuildinfo`) |
| ESLint | **YES** | `eslint.config.mjs` (flat config, eslint ^9 + eslint-config-next 16.2.9) |
| PostCSS | **YES** | `postcss.config.mjs` |
| Tailwind | **YES** (v4, PostCSS-plugin form) | `postcss.config.mjs` + devDeps `@tailwindcss/postcss`, `tailwindcss` ^4. **No** `tailwind.config.*` — v4 is CSS-first. |
| Vercel (cron schedule) | **YES** | `vercel.json` |
| Vitest | **NO** | — |
| Jest | **NO** | — |
| Playwright | **NO** | — |
| Puppeteer | **NO** | — (CDP is hand-rolled) |
| GitHub Actions CI | **YES** | `.github/workflows/ci.yml` |
| `.gitignore` | **YES** | `.gitignore` (line 34: `.env*` — all env files ignored) |
| Next types shim | **YES** | `next-env.d.ts` (gitignored) |
| Agent instruction docs | **YES** | `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`, `README.md` |

### `.env*` files — NAMES ONLY (values never read)

```
.env.example
.env.local
```
Two files: `.env.example` (13 declared keys, committed) and `.env.local` (31 keys, untracked/ignored).

### CI (`.github/workflows/ci.yml`) — verbatim

```yaml
name: Stryde CI

on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      NEXT_PUBLIC_SUPABASE_URL: https://ci.example.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-placeholder
      STRYDE_MODEL_PROVIDER: gemini
      STRYDE_MODEL_NAME: gemini-2.5-flash
      STRYDE_MODEL_API_KEY: ci-placeholder
      RESEND_API_KEY: re_ci_placeholder
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Unit tests
        run: npm test

      - name: Typecheck
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build
```
CI runs on Node 22 with **placeholder credentials**: unit tests → `tsc --noEmit` → lint → build. Note the CI env names (`STRYDE_MODEL_NAME`, `STRYDE_MODEL_API_KEY`) **do not match** the vars present in `.env.local` (`STRYDE_GEMINI_MODEL`, `STRYDE_GEMINI_API_KEY`) — a real drift between CI config and runtime config.

---

## 5. Environment variable NAMES only

Command: `grep -rhoE '^[A-Z_][A-Z0-9_]*=' .env* | tr -d '=' | sort -u` → **34 names**:

```
AI_API_KEY
AI_MAX_TOKENS
AI_MODEL
AI_SYSTEM_PROMPT_VERSION
AI_TEMPERATURE
AI_TIMEOUT_MS
CRON_SECRET
EXA_API_KEY
FIRECRAWL_API_KEY
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_URL
RESEND_API_KEY
STRYDE_GEMINI_API_KEY
STRYDE_GEMINI_MODEL
STRYDE_GEMINI_THINKING_BUDGET
STRYDE_HERMES_BIN
STRYDE_HERMES_COMMAND
STRYDE_HERMES_ENV_FILE
STRYDE_HERMES_URL
STRYDE_MODEL_PROVIDER
STRYDE_MODEL_RETRY_BASE_DELAY_MS
STRYDE_MODEL_TIMEOUT_MS
STRYDE_OMNIROUTE_API_KEY
STRYDE_OMNIROUTE_BASE_URL
STRYDE_OMNIROUTE_MODEL
STRYDE_OPENROUTER_API_KEY
STRYDE_PROVIDER_DISABLED
STRYDE_TEST_USER_EMAIL
STRYDE_TEST_USER_PASSWORD
STRYDE_WORKER_SECRET
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
VERCEL_OIDC_TOKEN
```

**Values intentionally not captured.** Grouped by purpose:
- **Supabase/DB:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`
- **Models (multi-provider):** `STRYDE_MODEL_PROVIDER`, `STRYDE_PROVIDER_DISABLED`, `STRYDE_MODEL_TIMEOUT_MS`, `STRYDE_MODEL_RETRY_BASE_DELAY_MS`, `STRYDE_GEMINI_API_KEY`, `STRYDE_GEMINI_MODEL`, `STRYDE_GEMINI_THINKING_BUDGET`, `STRYDE_OPENROUTER_API_KEY`, `STRYDE_OMNIROUTE_API_KEY`, `STRYDE_OMNIROUTE_BASE_URL`, `STRYDE_OMNIROUTE_MODEL`
- **Legacy/generic AI (`AI_*`):** `AI_API_KEY`, `AI_MODEL`, `AI_TEMPERATURE`, `AI_MAX_TOKENS`, `AI_TIMEOUT_MS`, `AI_SYSTEM_PROMPT_VERSION`
- **Tooling/integrations:** `EXA_API_KEY` (web search), `FIRECRAWL_API_KEY` (page scrape), `RESEND_API_KEY` (email), `NEXT_PUBLIC_SITE_URL`
- **Agent workers:** `STRYDE_HERMES_BIN`, `STRYDE_HERMES_COMMAND`, `STRYDE_HERMES_URL`, `STRYDE_HERMES_ENV_FILE`, `STRYDE_WORKER_SECRET`
- **Ops:** `CRON_SECRET`, `VERCEL_OIDC_TOKEN`
- **Tests:** `STRYDE_TEST_USER_EMAIL`, `STRYDE_TEST_USER_PASSWORD`

---

## 6. Capability presence/absence

Method: `grep` over `app lib scripts` + `package.json` + `supabase/migrations`, then manual read of each matched module. PRESENT requires a named file path plus corroborating code, not merely a string match.

| # | Capability | State | Evidence |
|---|---|---|---|
| 1 | **Web search** | **PRESENT** | `lib/search-provider.ts` — `SearchProvider` interface + `createExaSearchProvider()` → real `POST https://api.exa.ai/search` with `x-api-key`, `type:"auto"`, `numResults`, `startPublishedDate` freshness window, 20s abort timeout, `cache:"no-store"`; validates `Array.isArray(payload.results)`. Gated by `EXA_API_KEY` (`lib/adaptive-situation.ts:231` → `web_search: Boolean(...)`). Test: `tests/search-provider.test.ts`. |
| 2 | **Page fetch / extraction** | **PRESENT** | `lib/page-fetch.ts` — two-renderer adapter, `PageRenderer = "DIRECT" \| "FIRECRAWL"`; direct `fetch` first, Firecrawl scrape fallback (`scrapeViaFirecrawl`, markdown extraction), network-level failures re-routed through Firecrawl. `lib/source-provider.ts` — `createFirecrawlSourceProvider()` / `getFirecrawlSourceProvider()`. `lib/source-ingestion.ts` — URL ingest with `assertPublicHttpUrl()` SSRF guard (https-only, no credentials, ports 80/443 only). Tests: `tests/page-fetch.test.ts`, `tests/source-provider.test.ts`. |
| 3 | **Browser automation** | **PRESENT (test/verification only)** | `scripts/cdp-client.mjs` — hand-written minimal Chrome DevTools Protocol client (`--remote-debugging-port`, throwaway profile, `Runtime.enable`, `Page.navigate`), driven by `scripts/e2e-ui-flow.mjs` (`e2e:ui`). **Not a product capability** — there is no browser automation in the shipped request path, and no puppeteer/playwright dependency. |
| 4 | **PDF / document parsing** | **PRESENT (PDF + plain text; DOCX/XLSX absent)** | `lib/file-source-extraction.ts` (268 lines) — **hand-written PDF text extractor**: PDF literal-string parser with `PDF_ESCAPE_CHARS` escape handling (line 29), hex-string `<...>` reader (line 77), content-stream tokenizer pulling `Tj` / `TJ` / `'` / `"` operators (line 147), `extractPdfSourceText()` (line 192). Text-like: `.txt .md .markdown .csv .json .log` plus any `text/*`. Honest 3-state `FileExtractionStatus = "EXACT" \| "PARTIAL" \| "UNSUPPORTED"`, and an explicit user-facing refusal at line 266 for unsupported types (HTTP 415 at `app/api/v1/pursuits/[id]/sources/route.ts:57`). No OCR, no DOCX/XLSX/PPTX. Test: `tests/file-source-extraction.test.ts`. |
| 5 | **Image ingestion** | **ABSENT** | No image MIME/extension handling, no vision/multimodal payload construction anywhere in `app`/`lib`. Strict probe for `.png/.jpg/.gif/.webp`, `image_url`, `image/*` MIME → **zero matches**. Uploads go through the text/PDF extractor only (`sources/route.ts:47`), so an image upload returns 415. |
| 6 | **Audio ingestion** | **ABSENT** | Probe for `audio`, `whisper`, `transcri*`, `.mp3`, `.wav`, `audio/*` MIME → **zero matches** in `app`/`lib`. |
| 7 | **Video ingestion** | **ABSENT** | Probe for `video`, `.mp4/.mov/.avi/.webm`, `video/*` MIME → **zero matches** in `app`/`lib`. The only hit is a *prohibition string* in a model prompt: `lib/work-controller.ts:298` — "Do not claim a web page, YouTube video, email, spreadsheet, API, or other source was fetched unless its contents are actually supplied." |
| 8 | **MCP client** | **ABSENT** | Repo-wide case-insensitive search for `model.context.protocol` across `.ts/.tsx/.json/.mjs/.md` (excluding `node_modules`, `.next`, `.audit-research`) → **zero files**. No `@modelcontextprotocol/*` dependency. **UNVERIFIED**: whether an external MCP server is expected to call *into* Stryde — no MCP server surface exists either way. |
| 9 | **Agent orchestration** | **PRESENT** | Multi-layer. (a) *Reasoning kernel:* `lib/orchestration.ts` — `RUN_STAGES`, `InterventionKind = ANSWER/DECISION/HUMAN_ACTION/CONTROLLED_ACTION/WAIT`, `validateModelProposal()`, `runReasoningKernel()`. (b) *Durable worker plane:* `lib/execution-control.ts` — `leaseNextJob()` via the `stryde_lease_next_job` RPC; `lib/worker-gateway.ts` — `WORKER_TYPES = ["HERMES","OPENCODE"]`, `WorkerProvider`, `getWorkerProvider()`; `lib/worker-contract.ts`. (c) *Real external agents:* `scripts/hermes-worker.ts` — `spawn()`s a real `hermes -z` one-shot agent CLI, parses an env file (`STRYDE_HERMES_ENV_FILE`), sets spawn cwd (with an inline note that the child's tools respect spawn cwd), reports via `hermes-worker://JOBID` raw-result reference; `scripts/opencode-worker.ts` — twin driving `opencode run` (documented as verified against opencode v1.18.31). (d) *Delegation routes:* `app/api/v1/pursuits/[id]/actions/delegate-worker/route.ts`, `.../actions/start`, `.../actions/complete`. DB tables: `job`, `job_authorization`, `attempt`, `capability_grant`, `action`, `reconciliation_task`. |
| 10 | **Background / scheduled jobs** | **PRESENT** | `vercel.json` declares `crons: [{ path: "/api/cron/continuity", schedule: "0 18 * * *" }]` (daily 18:00). Handler `app/api/cron/continuity/route.ts` (220 lines) — `isCronAuthorized()` compares against `process.env.CRON_SECRET` and **fails closed** ("without a configured secret the cron must not exist at all"); reconciles stranded jobs (line 71) and sends proactive nudges (line 197). Plus a long-running local dispatcher `scripts/worker-dispatcher.ts` (`worker:dispatch`) polling the `job` queue. |
| 11 | **Personal memory / state** | **PRESENT** | `lib/memory-core.ts` — *pure* memory semantics with explicit confirmation math: `CONFIRMATION_STEP = 0.15`, `CONFIRMATION_CAP = 0.95`, `PROMOTION_THRESHOLD = 0.8`, `normalizeMemoryKey()` (Unicode punctuation stripping, stopword-filtered token normalization) — deliberately DB-free "so the rules stay testable". `lib/memory.ts` (276 lines) — write path: `recordMemory()`, `confirmMemory()`, `forgetMemory()`, `MemoryProvenance`, `MemoryType`, idempotent claim-sourced writes. DB: `memory_item` + migration `20261002143729_personal_memory_foundation.sql`. API: `app/api/v1/memory/route.ts`, `app/api/v1/memory/[id]/route.ts`. UI: `app/pursuits/[id]/memory-panel.tsx`. Model gate: memory candidates carry `revises_memory_ids` (`lib/model-gateway.ts:248`). Test: `tests/memory-lifecycle.test.ts`. **UNVERIFIED**: no embedding/vector retrieval — ranking is lexical only. |
| 12 | **Verification logic** | **PRESENT** | `lib/verification-check.ts` — `VerificationOutcome = "MATCHED" \| "MISMATCHED" \| "UNREACHABLE"`, `executeVerificationCheck()`, `relationForOutcome()` → `"VERIFIES" \| "CONTRADICTS" \| null` (null on unreachable = never over-claims). `lib/verification-execution.ts` — `executeMechanicalVerification()` for URL/literal-text checks. Policy gate in `lib/adaptive-work-controller.ts`: `VERIFY_WEB` requires a REPORTED/OBSERVED claim and "can never mark a claim VERIFIED". DB: `claim`, `claim_observation_link`, `claim_status_event`, `claim_relation` + 2 verification-engine migrations. API: `app/api/v1/claims/[id]/adjudicate/`, `.../observations/`, `app/api/internal/verification/observe/`. Test: `tests/verification-check.test.ts`. |
| 13 | **Citations / grounding** | **PRESENT** | `lib/source-citation.ts` — `SourceCitation` with a real locator `locator: { type: "CHARACTER_RANGE"; start; end; located }`; `buildSourceCitation({content, contentSha256, statement, basis})` **throws if content hash or excerpt is missing**, and honestly degrades to `located: false` full-range when a statement cannot be located rather than fabricating a span. Every adaptation must remain traceable to `source_id` + `content_sha256` (`lib/adaptive-model.ts:274`). DB: `pursuit_source_citation` (jsonb locator), `pursuit_source`, `pursuit_source_adaptation`; 5 citation-lineage migrations incl. `..._source_citations_lineage.sql` and `..._rpc_privilege_hardening_and_citation_policy_fix.sql`. Consumers: `research/route.ts`, `sources/route.ts`, `lib/universal-input.ts`. Test: `tests/source-citation.test.ts`. |
| 14 | **Observability / tracing** | **ABSENT (as instrumentation); PARTIAL (as domain audit log)** | **No tracing stack**: no OpenTelemetry/Sentry/Datadog/Logtail/pino/winston dependency (only an incidental `@opentelemetry/api` transitive reference in `package-lock.json`), no spans, no metrics. **No `console.*` in `lib/` at all (0 occurrences)**; 5 in `app/`, 73 in `scripts/`. Partial substitute: a domain **event log** table `public.event`, written from `lib/situation.ts:75`, plus `claim_status_event`, `attempt`, `reconciliation_task` — an auditable domain ledger, not operational telemetry. |
| 15 | **Model / provider abstraction** | **PRESENT** | `lib/model-provider.ts` (271 lines) — `ModelProviderName = "gemini" \| "openrouter" \| "omniroute" \| "groq"`, `ModelProviderConfig`, typed `ProviderFailureKind = "configuration/transport/cancellation/http/rate_limit/authentication/malformed_output/streaming"`, `ModelProviderError` with `retryable` classification, `ModelProviderConfigurationIssue`. `lib/model-gateway.ts` (336 lines) — request/response boundary, budget + timeout, proposal validation via `validateModelProposal`. `lib/model-gateway-stream.ts` — SSE streaming reader. `lib/adaptive-model.ts` (329) — model-driven adaptation. In-place retry before chain failover (`cb5503f`). `scripts/probe-provider.ts` + `probe:provider` for live provider probing. Tests: `tests/model-provider-retry.test.ts`, `tests/model-gateway-budget.test.ts`. |

**Scorecard: 10 PRESENT, 4 ABSENT, 1 PARTIAL** (browser automation PRESENT but scoped to test-only; observability PARTIAL-as-ledger).

### Notable absences, consolidated
- **No multimodal input of any kind.** Images, audio and video are all unimplemented; uploads are text + PDF only.
- **No MCP** on either side (client or server).
- **No operational telemetry** — zero logging in `lib/`, no tracing/metrics, no error-reporting service. Failures in the domain layer surface only as DB rows (`reconciliation_task`) or HTTP errors.
- **No vector/embedding retrieval** — memory recall is lexical token-overlap, so "personal memory" will not do semantic recall.

### Notable strengths, consolidated
- **Epistemic discipline is enforced in code, not just prose.** Unlocatable citations return `located: false` instead of a fake span; unreachable verification returns a `null` relation instead of a verdict; `VERIFY_WEB` structurally cannot mark a claim VERIFIED; unsupported file types get an honest 415; `ExtractionStatus` is explicitly 3-state. Unusual and load-bearing for the product's claims.
- **Capability gating is real.** `lib/adaptive-situation.ts` computes `web_search: Boolean(process.env.EXA_API_KEY)` and feeds availability into the policy layer, so the model cannot select a move whose tool is unconfigured.
- **Real external agents, not mocks** — `hermes` and `opencode` CLIs are genuinely spawned.
- Security posture is thorough: SSRF guard on URL ingest, cron fails closed, capability grants, RPC `search_path` hardening migrations, `credential_reference` table (references, not secrets).

---

## 7. Largest source files by line count (`find app lib -name '*.ts*' | sort -rn | head -30`)

```
 10718 total
  1184 app/pursuits/[id]/page.tsx
   386 app/api/v1/pursuits/[id]/actions/[actionId]/complete/route.ts
   336 lib/model-gateway.ts
   329 lib/adaptive-model.ts
   322 app/api/v1/pursuits/[id]/work/route.ts
   316 lib/work-controller.ts
   301 app/api/v1/pursuits/[id]/sources/route.ts
   277 lib/continuity.ts
   276 lib/memory.ts
   271 lib/model-provider.ts
   268 lib/file-source-extraction.ts
   265 app/api/v1/pursuits/[id]/conversation/route.ts
   235 lib/adaptive-situation.ts
   227 lib/universal-input.ts
   225 lib/adaptive-work-controller.ts
   220 app/api/cron/continuity/route.ts
   214 app/pursuits/[id]/claims-panel.tsx
   210 lib/orchestration.ts
   193 app/api/v1/capabilities/worker/route.ts
   175 lib/page-fetch.ts
   167 lib/human-observation.ts
   166 lib/memory-core.ts
   160 lib/verification-execution.ts
   149 app/api/v1/pursuits/[id]/reason/route.ts
   148 app/pursuits/[id]/autonomy-row.tsx
   144 app/api/v1/pursuits/[id]/actions/delegate-worker/route.ts
   143 app/api/v1/claims/route.ts
   141 lib/source-ingestion.ts
   138 app/pursuits/[id]/memory-panel.tsx
```

**Where complexity actually lives (of 10718 total LOC in `app`+`lib`):**

1. **`app/pursuits/[id]/page.tsx` — 1,184 lines, 11% of all app+lib LOC in ONE file.** The single largest concentration of complexity in the repo, and it is a *client component* (React UI). It exceeds the combined size of the two largest domain modules. Commit `31cc2cc` ("Collapse pursuit UI to a universal control surface") suggests active churn here. **Prime audit/refactor target.**
2. **Route handlers dominate the top of the API layer:** `actions/[actionId]/complete` (386), `work` (322), `sources` (301), `conversation` (265) — fat controllers, each mixing auth, validation, orchestration and persistence.
3. **The model/provider tier is the deepest logic:** `model-gateway` (336) + `adaptive-model` (329) + `model-provider` (271) = 936 lines across 3 files, plus `adaptive-situation` (235) and `adaptive-work-controller` (225) for the decision layer.
4. **Evidence/discipline modules are small and tight:** `page-fetch` (175), `verification-execution` (160), `memory-core` (166), `source-citation` (compact), `human-observation` (167). Good sign — the epistemic core is not bloated.
5. **Long tail is healthy:** only 3 files exceed 350 lines; 20 of the top 30 are under 230 lines. No god-file pattern except the one UI page.

---

## 8. Cross-cutting findings worth flagging

1. **Config drift:** `.github/workflows/ci.yml` sets `STRYDE_MODEL_NAME` / `STRYDE_MODEL_API_KEY`, but `.env.local` uses `STRYDE_GEMINI_MODEL` / `STRYDE_GEMINI_API_KEY`. CI therefore exercises a config path that does not match local/dev reality. **UNVERIFIED** whether a legacy alias layer accepts the CI names.
2. **Two parallel env vocabularies:** `AI_*` (6 vars, likely legacy) alongside `STRYDE_*` — possible stale configuration surface.
3. **`supabase/.temp/` appears in the repo** containing `project-ref` and `pooler-url` — real project identifiers. Whether it is actually git-tracked is **UNVERIFIED** (it did not appear in `git status --short`, which suggests it is either tracked-and-unmodified or ignored).
4. **19 tests, all `node:test` unit tests.** There are **no** route/integration tests and **no** DB-integration tests in the TS suite; DB tests are 4 hand-run SQL files in `supabase/tests/`. End-to-end coverage is delegated to 12 hand-run `e2e:*` scripts requiring live credentials — so CI proves almost nothing about runtime behavior.
5. **Deployment is documented as UNVERIFIED** across several commits: the known Vercel surface returns a uniform `/login` rewrite and is recorded as "not this application".
6. **Docs are unusually complete** — 20 files in `docs/` including `ARCHITECTURE.md`, `PRODUCT_CONSTITUTION.md`, `VERIFICATION_MATRIX.md`, `RUNTIME.md`, `EVALS.md`, `ROADMAP.md`, plus per-step design docs (STEP9–STEP19). The gap is doc↔code agreement, not doc volume.

---

## Appendix — audit commands used (all read-only)

```bash
cat package.json
find app lib scripts supabase -type f 2>/dev/null | sort
find . -maxdepth 2 -type d -not -path './node_modules*' -not -path './.next*' -not -path './.git*' | sort
git log --oneline -30 ; git status --short ; git branch -a
find . -maxdepth 3 -type f ( -name '*.config.*' -o -name 'tsconfig*.json' -o -name '*.json' -o -name '*.mjs' ) -not -path './node_modules/*' -not -path './.next/*'
ls -1a | grep -E '^\.env'
grep -rhoE '^[A-Z_][A-Z0-9_]*=' .env* 2>/dev/null | tr -d '=' | sort -u
find app lib -name '*.ts*' -exec wc -l {} + | sort -rn | head -30
# capability probes: grep -rniE '<pattern>' --include='*.ts' lib app scripts
```

**Explicitly NOT done (would require execution and/or secrets):** `npm test`, `npm run build`, `npm run lint`, `tsc --noEmit`, any `e2e:*` script, any live Supabase/Exa/Firecrawl/Vercel call, `git fetch`. All runtime behavior claims above are **static-read claims about what the code is written to do, unverified by execution**.
