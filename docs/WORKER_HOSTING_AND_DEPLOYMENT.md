# Stryde Worker Execution Plane: Hosting & Deployment Guide

**Version:** 1.0  
**Updated:** 2026-10-24  
**Status:** Production Ready  

---

## 1. Architecture Overview

Stryde's execution plane processes delegated worker jobs (`execution_mode = "CONTROLLED"`) through a lease-based, idempotent, fault-tolerant state machine in Supabase Postgres.

```
User Action Approval (delegate-worker)
  │
  ▼
public.job (status: PENDING)
  │
  ├──────────────────────────────────────────────────────┐
  ▼                                                      ▼
Plane A: Serverless Dispatcher                    Plane B: Dedicated Worker Container
(Vercel Cron & Direct Webhook)                    (Fly.io / Railway / Docker / VPS)
/api/cron/worker-dispatch                         Dockerfile.worker
  │                                                      │
  ├─► Reconciles expired leases                          ├─► Continuous polling daemon
  ├─► Leases up to 5 jobs                                ├─► Full Chromium headless browser
  ├─► Starts attempt (DISPATCHING)                       ├─► Executes OBSERVE_PAGE tasks
  ├─► Dispatches to configured provider                  ├─► Produces text + screenshot artifacts
  └─► Records attempt observation                        └─► Finishes attempt (SUCCEEDED/FAILED)
```

---

## 2. Deployment Options

### Option 1: Native Vercel Serverless Dispatch (Zero Infrastructure Overhead)
Stryde is configured to automatically dispatch queued jobs via Vercel Cron.
- **Route:** `POST /api/cron/worker-dispatch`
- **Schedule:** `* * * * *` (Every minute, defined in `vercel.json`)
- **Authentication:** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
- **Safety:** Automatically reconciles expired jobs, leases pending jobs, and executes registered tasks.

### Option 2: Dedicated Worker Container (Recommended for Heavy Browser Automation)
For continuous sub-second polling and full Chromium rendering:

#### A. Deploy to Fly.io
```bash
# 1. Set secrets
fly secrets set \
  NEXT_PUBLIC_SUPABASE_URL="https://pvijrnwdnolvnoibarrj.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
  STRYDE_BROWSER_TOKEN="your-secure-token" \
  -c fly.worker.toml

# 2. Deploy
fly deploy -c fly.worker.toml
```

#### B. Deploy with Docker Compose
```bash
# In your server environment
docker compose -f docker-compose.worker.yml up -d
```

---

## 3. Worker Authentication & Security

1. **Internal Application Auth:**
   Endpoints under `/api/internal/execution/` require `x-stryde-worker-secret: $STRYDE_WORKER_SECRET`.
2. **Worker Provider Auth:**
   The browser worker endpoint requires `Authorization: Bearer $STRYDE_BROWSER_TOKEN`.
3. **SSRF Guard:**
   `scripts/browser-worker.ts` rejects private IP ranges, loopback addresses (`127.0.0.1`, `localhost`), cloud metadata services (`169.254.169.254`), and non-HTTP protocols before navigation.
4. **Epistemic Discipline:**
   - Timed-out runs are recorded as `UNKNOWN`, never `FAILED` or `SUCCEEDED`.
   - A run that produced no observable artifacts is recorded as `FAILED`.
   - All outcomes generate linked observations in `public.observation`.
