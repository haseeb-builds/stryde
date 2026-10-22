# Stryde Manual Setup & Environment Configuration Checklist

**Status:** Founder Setup Guide & Environment Truth  
**Author:** Chief of Staff / Release Coordinator  
**Repository:** `haseeb-builds/stryde`  
**Base Commit / Ref:** `fix/conversation-turn-reliability`  

> [!CAUTION]
> **Security Guardrail:** Never commit API keys, database secrets, service role keys, or tokens to the repository or paste them into chat. Only input secrets into your secure `.env.local` (local development) or the Vercel Project Settings → Environment Variables console (Preview & Production).

---

## 1. Discovered Environment Variables Inventory

Every variable below was extracted directly from active code in `stryde/`:

| Variable Name | Required / Optional | Target Environments | Capability Impact if Absent | Safe Probe / Verification Method |
| :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Required** | Local, Preview, Prod | All app data and authentication fails | Inspect `GET /` rendered HTML or console: `echo $NEXT_PUBLIC_SUPABASE_URL` (non-secret URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Required** | Local, Preview, Prod | User sign-in, session recovery, and client queries fail | Check presence: `test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" && echo "Present"` |
| `SUPABASE_SECRET_KEY` | **Required** | Local, Preview, Prod | Server-side trusted plane RPCs (resource reservations, citations) fail | Check presence in server env; probe `GET /api/v1/pursuits` with auth token |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required** | Local, Preview, Prod | Background worker execution and admin functions fail | Check presence; ensure value matches `SUPABASE_SECRET_KEY` |
| `NEXT_PUBLIC_SITE_URL` | **Required** | Local, Preview, Prod | Canonical redirects, link generation, and check-in emails fail | Check non-secret URL format (e.g. `https://stryde-topaz.vercel.app`) |
| `CRON_SECRET` | **Required** | Preview, Prod | `/api/cron/continuity` fails closed (HTTP 401); no automated job sweeps | Probe `curl -I -H "Authorization: Bearer <secret>" <url>/api/cron/continuity` |
| `STRYDE_GEMINI_API_KEY` | **Required** (if primary) | Local, Preview, Prod | Google AI Studio model generation fails (HTTP 401) | Probe `GET /api/health/model` → returns `ready: true` and provider status |
| `STRYDE_OPENROUTER_API_KEY` | **Optional** (fallback) | Local, Preview, Prod | OpenRouter model fallback unavailable if Gemini throttles | Probe `GET /api/health/model` → reports OpenRouter availability |
| `STRYDE_PROVIDER_DISABLED` | **Required** (Prod) | Preview, Prod | If `omniroute` not disabled, production may try unreachable tailnet host | Set `STRYDE_PROVIDER_DISABLED=omniroute` in Vercel settings |
| `EXA_API_KEY` | **Optional** | Preview, Prod | Web search research degrades honestly to user question (R-4 blocker) | Check presence in Vercel console; probe search route |
| `FIRECRAWL_API_KEY` | **Optional** | Preview, Prod | Deep web extraction / JS rendering fallback unavailable | Check presence in Vercel console; probe URL scraper |
| `STRYDE_SEARCH_PROVIDER` | **Optional** | Local, Preview, Prod | Defaults to `auto` (Exa primary → Firecrawl fallback) | Check variable value is `auto`, `exa`, or `firecrawl` |
| `STRYDE_MODEL_TIMEOUT_MS` | **Optional** | Local, Preview, Prod | Defaults to `45000` (45s timeout per LLM request) | Numeric override if needed for slower models |
| `STRYDE_MODEL_RETRY_BASE_DELAY_MS` | **Optional** | Local, Preview, Prod | Defaults to `750` ms exponential backoff base delay | Numeric override (set to `0` during test runs) |
| `STRYDE_BROWSER_TOKEN` | **Optional** | Worker Daemon | Browser worker rejects job leasing without matching bearer token | Configured on worker host (`scripts/browser-worker.ts`) |

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
   - Add to Vercel as `EXA_API_KEY`.
2. **Firecrawl.dev:**
   - Retrieve API key from [Firecrawl Dashboard](https://www.firecrawl.dev/).
   - Add to Vercel as `FIRECRAWL_API_KEY`.

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
