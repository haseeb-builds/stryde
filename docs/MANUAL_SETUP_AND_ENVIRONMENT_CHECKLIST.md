# Stryde Manual Setup & Environment Configuration Checklist

**Status:** Founder Setup Guide & Environment Truth  
**Author:** Chief of Staff / Release Coordinator  
**Repository:** `haseeb-builds/stryde`  
**Base Ref:** `fix/conversation-turn-reliability`  

> [!CAUTION]
> **Security Guardrail:** Never commit API keys, database secrets, service role keys, or tokens to the repository or paste them into chat. Only input secrets into your secure `.env.local` (local development) or the Vercel Project Settings → Environment Variables console (Preview & Production).

---

## 1. Discovered Environment Variables Inventory

Every variable below was verified directly against active code in `stryde/` (`lib/`, `app/`, `scripts/`):

### Category A: Core Web App & Persistence (Server-Side V1 & Client)

| Variable Name | Scope & Consumer | Required? | Capability Impact if Absent | Safe Verification Probe |
| :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public (Client + Server): `lib/supabase.ts`, `lib/supabase/server.ts` | **Required** | All database queries, auth sessions, and workspace views fail | Check format (non-secret HTTPS URL) in `.env.local` or Vercel console |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (Client + Server): `lib/supabase.ts`, `lib/supabase/server.ts` | **Required** | User login, session renewal, and RLS queries fail | Verify presence: `test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" && echo "Present"` |
| `SUPABASE_SECRET_KEY` | Server-only: `lib/supabase/service.ts` | **Required** | Server-side trusted plane RPCs (quota reservations, citations) fail | Check presence in Vercel/server env; never expose in client bundles |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only: fallback in `lib/supabase/service.ts` | **Required** (or `SUPABASE_SECRET_KEY`) | Worker job dispatching and admin queries fail | Ensured present if `SUPABASE_SECRET_KEY` is not set |
| `NEXT_PUBLIC_SITE_URL` | Client + Server: `app/api/v1/billing/checkout/route.ts` | **Required** | Canonical redirects, link generation, and callback URLs break | Check format (e.g. `https://stryde-topaz.vercel.app`) |
| `CRON_SECRET` | Server-only: `app/api/cron/continuity/route.ts` | **Required** (Hosted) | Continuity cron sweeps fail closed with HTTP 401 | Probe with `curl -I -H "Authorization: Bearer <secret>" <url>/api/cron/continuity` |

### Category B: Model Providers (LLM Generation)

| Variable Name | Scope & Consumer | Required? | Capability Impact if Absent | Safe Verification Probe |
| :--- | :--- | :--- | :--- | :--- |
| `STRYDE_GEMINI_API_KEY` | Server-only: `lib/model-provider.ts` | **Required** (Primary) | Google Gemini model inference fails (HTTP 401). *Fallbacks in code: `GEMINI_API_KEY`, `GOOGLE_AI_STUDIO_API_KEY`* | Probe `GET /api/health/model` → returns provider status |
| `STRYDE_OPENROUTER_API_KEY` | Server-only: `lib/model-provider.ts` | **Optional** (Fallback) | OpenRouter model fallback unavailable if Gemini hits rate limits (429) | Probe `GET /api/health/model` → reports OpenRouter availability |
| `STRYDE_PROVIDER_DISABLED` | Server-only: `lib/model-provider.ts` | **Required** (Prod) | If `omniroute` not disabled, production router may attempt unreachable tailnet host | Set `STRYDE_PROVIDER_DISABLED=omniroute` in Vercel settings |
| `STRYDE_MODEL_PROVIDER` | Server-only: `lib/model-provider.ts` | **Optional** | Controls first leg of canonical router chain (`gemini` default) | Check value in env (`gemini` or `openrouter`) |
| `STRYDE_MODEL_TIMEOUT_MS` | Server-only: `lib/model-provider.ts` | **Optional** | Defaults to `45000` (45s per LLM call) | Numeric override if using slower models |
| `STRYDE_MODEL_RETRY_BASE_DELAY_MS` | Server-only: `lib/model-provider.ts` | **Optional** | Defaults to `750` ms exponential backoff base delay | Numeric override (set to `0` during automated test runs) |
| `STRYDE_GEMINI_THINKING_BUDGET` | Server-only: `lib/model-provider.ts` | **Optional** | Defaults to provider standard | Numeric override for reasoning token budget |
| `STRYDE_TURN_DEADLINE_MS` | Server-only: `conversation/route.ts` | **Optional** | Defaults to `55000` ms max conversation turn duration | Numeric override |

### Category C: Autonomous Search & Web Extraction (Optional Fallbacks)

| Variable Name | Scope & Consumer | Required? | Capability Impact if Absent | Safe Verification Probe |
| :--- | :--- | :--- | :--- | :--- |
| `EXA_API_KEY` | Server-only: `lib/search-provider.ts`, `lib/adaptive-situation.ts` | **Optional** | Live web search via Exa unavailable. R-4 guard gracefully explains research is unavailable | Check presence in Vercel console; probe search route |
| `FIRECRAWL_API_KEY` | Server-only: `lib/search-provider.ts`, `lib/source-provider.ts`, `lib/page-fetch.ts` | **Optional** | Deep web extraction / JS-rendered page scrape fallback unavailable | Check presence in Vercel console; probe URL scraper |
| `STRYDE_SEARCH_PROVIDER` | Server-only: `lib/search-provider.ts` | **Optional** | Defaults to `auto` (Exa primary → Firecrawl fallback). Options: `auto`, `exa`, `firecrawl` | Check value is `auto`, `exa`, or `firecrawl` |
| `FIRECRAWL_API_VERSION` | Server-only: `lib/source-provider.ts` | **Optional** | Defaults to Firecrawl standard API version | Optional string |

> [!NOTE]
> Note that the active codebase reads `EXA_API_KEY` and `FIRECRAWL_API_KEY` directly (without a `STRYDE_` prefix), while provider selection is controlled via `STRYDE_SEARCH_PROVIDER`.

### Category D: Background Worker Plane (Required ONLY if Hosting Worker Daemons)

| Variable Name | Scope & Consumer | Required? | Capability Impact if Absent | Safe Verification Probe |
| :--- | :--- | :--- | :--- | :--- |
| `STRYDE_WORKER_SECRET` | Server-only: `lib/internal-worker-auth.ts` | Optional (Workers) | `/api/internal/execution/lease` rejects unauthenticated worker requests | Check matching secret on worker container |
| `STRYDE_BROWSER_TOKEN` | Worker-only: `lib/worker-server-auth.ts`, `scripts/browser-worker.ts` | Optional (Workers) | Browser worker rejects job leasing without matching bearer token | Configured on worker host |
| `STRYDE_BROWSER_URL` | Server-only: `lib/worker-gateway.ts` | Optional (Workers) | Stryde cannot dispatch jobs to the HTTP browser worker | Configured in server env if worker is hosted |
| `STRYDE_HERMES_TOKEN` / `STRYDE_HERMES_URL` | Worker-only: `lib/worker-server-auth.ts`, `lib/worker-gateway.ts` | Optional (Hermes) | Hermes agent worker cannot be dispatched | Configured if Hermes daemon is running |
| `STRYDE_OPENCODE_TOKEN` / `STRYDE_OPENCODE_URL` | Worker-only: `lib/worker-server-auth.ts`, `lib/worker-gateway.ts` | Optional (OpenCode) | OpenCode agent worker cannot be dispatched | Configured if OpenCode daemon is running |
| `STRYDE_MCP_TOKEN` / `STRYDE_MCP_URL` | Worker-only: `lib/worker-server-auth.ts`, `lib/worker-gateway.ts` | Optional (MCP) | MCP tool worker cannot be dispatched | Configured if MCP worker daemon is running |

---

## 2. Founder Action Checklist: What You Must Supply

### A. Model Provider Keys (Production)
1. **Google AI Studio (Gemini):**
   - Ensure a funded or standard tier key is generated from [Google AI Studio](https://aistudio.google.com/).
   - Add to Vercel Environment Variables as `STRYDE_GEMINI_API_KEY`.
2. **OpenRouter (Fallback):**
   - Generate an API key with active balance from [OpenRouter](https://openrouter.ai/).
   - Add to Vercel Environment Variables as `STRYDE_OPENROUTER_API_KEY`.
3. **Provider Exclusion:**
   - Confirm `STRYDE_PROVIDER_DISABLED=omniroute` is set in Vercel Production and Preview environments.

### B. Autonomous Research Keys (Production)
1. **Exa.ai:**
   - Retrieve API key from [Exa Dashboard](https://dashboard.exa.ai/).
   - Add to Vercel Environment Variables as `EXA_API_KEY`.
2. **Firecrawl.dev:**
   - Retrieve API key from [Firecrawl Dashboard](https://www.firecrawl.dev/).
   - Add to Vercel Environment Variables as `FIRECRAWL_API_KEY`.

---

## 3. Infrastructure & Staging Isolation Requirements

### A. Dedicated Supabase Staging Project (Critical Requirement for E2E)
- **Current Live Reality:** Vercel Preview and Production currently share the same live Supabase database (`pvijrnwdnolvnoibarrj`).
- **Risk:** Running destructive or write-heavy end-to-end tests against Preview writes test records to the production database.
- **Action Required:**
  1. Create a second, isolated Supabase project (e.g. `stryde-staging`).
  2. Run Supabase CLI migrations against the staging project: `supabase db push`.
  3. Set Vercel **Preview** environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`) to point to the staging project, keeping Production pointing to `pvijrnwdnolvnoibarrj`.

### B. Hosted Worker Daemon Setup (Required for Autonomous Work)
- **Current Live Reality:** Vercel serverless runs HTTP request lifecycles and shuts down; it does not host long-lived background processes.
- **Action Required:**
  1. Deploy `scripts/browser-worker.ts` to a persistent container service (e.g., [Fly.io](https://fly.io), [Railway](https://railway.app), or AWS ECS).
  2. Configure the worker host with:
     - `BASE_URL=https://stryde-topaz.vercel.app`
     - `STRYDE_WORKER_SECRET=<shared-cron-or-worker-secret>`
     - `STRYDE_BROWSER_TOKEN=<secure-random-worker-token>`
  3. Start the process: `node --experimental-strip-types scripts/browser-worker.ts`.
  4. Once running, the daemon continuously polls `/api/internal/execution/lease` and executes browser tasks automatically. *(Note: The web UI already provides manual completion fallback if the daemon is not running).*

### C. Supabase Auth Email Confirmation
- **Status:** Standard Supabase `signUp` is implemented. If "Confirm email" is toggled ON in the Supabase Dashboard, users receive confirmation emails.
- **Requirement:**
  - Verify SMTP credentials in the Supabase Auth Settings.
  - Verify Site URL is set to `https://stryde-topaz.vercel.app` with Redirect URLs including `https://stryde-topaz.vercel.app/**` and Preview URLs.
