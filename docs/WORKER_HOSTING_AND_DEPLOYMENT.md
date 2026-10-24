# Stryde Worker Execution Plane: Hosting & Deployment Guide

**Version:** 2.0  
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
Plane A: Dedicated Worker Container (Primary)      Plane B: On-Demand Dispatch Endpoint
(Fly.io / Docker / Railway / VPS)                  (Next.js App Route)
Dockerfile.worker (Node 22 + Chromium)             /api/cron/worker-dispatch
  │                                                      │
  ├─► Continuous queue polling daemon                    ├─► Triggered on-demand or via external scheduler
  ├─► Leases jobs via stryde_lease_next_job              ├─► Secured by CRON_SECRET / x-stryde-worker-secret
  ├─► Runs headless Chromium browser automation          ├─► Reconciles expired leases & leases up to 5 jobs
  ├─► Enforces 200KB bounded result payloads             ├─► Dispatches to configured worker providers
  └─► Epistemic recording in public.observation          └─► Bounded payload enforcement
```

---

## 2. Production Worker Architecture & Vercel Plan Boundary

### Why the Dedicated Container is the Canonical Production Architecture:
1. **Execution Longevity & Tooling:** Background jobs (e.g., browser automation, deep research scraping, multi-step code execution) require continuous polling, persistent Chromium binaries, and can exceed standard serverless timeout windows (10–60 seconds).
2. **Vercel Hobby Plan Constraints:** Vercel Hobby strictly limits cron jobs to running at most **once per day**. Minute-level crons (`* * * * *`) are rejected during deployment.
3. **Clean Decoupling:** Removing the sub-daily cron schedule from `vercel.json` allows Stryde's main web application to deploy cleanly to Vercel Hobby, while `/api/cron/worker-dispatch` remains available for on-demand or webhook invocations.

---

## 3. Dedicated Container Deployment Runbook

### A. Deploy to Fly.io (Recommended)

1. **Prerequisites:**
   - Install Fly CLI: `curl -L https://fly.io/install.sh | sh` (or `brew install flyctl`)
   - Authenticate: `fly auth login`

2. **Configure Secrets:**
   ```bash
   fly secrets set \
     NEXT_PUBLIC_SUPABASE_URL="https://pvijrnwdnolvnoibarrj.supabase.co" \
     SUPABASE_SERVICE_ROLE_KEY="<your-supabase-service-role-key>" \
     STRYDE_BROWSER_TOKEN="<your-secure-32-byte-token>" \
     -c fly.worker.toml
   ```

3. **Deploy the Worker:**
   ```bash
   fly deploy -c fly.worker.toml
   ```

4. **Fly Configuration Guarantees (`fly.worker.toml`):**
   - `auto_stop_machines = false`: Prevents Fly from suspending idle machines when HTTP traffic is low, ensuring the Postgres queue polling loop runs continuously without interruption.
   - `internal_port = 8080`: Exposes the HTTP health check endpoint (`/health`).
   - `min_machines_running = 1`: Keeps at least one active worker instance running.

---

### B. Deploy with Docker Compose (VPS / Self-Hosted)

1. **Set Environment Variables in Server `.env`:**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL="https://pvijrnwdnolvnoibarrj.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="<your-supabase-service-role-key>"
   STRYDE_BROWSER_TOKEN="<generate-with-openssl-rand-hex-32>"
   ```

2. **Launch the Container:**
   ```bash
   docker compose -f docker-compose.worker.yml up -d
   ```

3. **Check Status and Logs:**
   ```bash
   docker compose -f docker-compose.worker.yml logs -f
   curl http://localhost:8080/health
   ```

---

## 4. Worker Security & Process Integrity

1. **Zero Hardcoded Secrets:**
   In `scripts/run-production-worker.mjs`, if `STRYDE_BROWSER_TOKEN` is not explicitly configured, a cryptographically secure 256-bit ephemeral token (`crypto.randomBytes(32).toString("hex")`) is generated at runtime for intra-container communication. Insecure placeholder tokens have been completely eliminated.
2. **Honest Health Checks:**
   The supervisor's `/health` endpoint actively monitors both child processes (`browserWorkerProcess` and `dispatcherProcess`). If either process exits or fails to start, the health server responds with `HTTP 503 Service Unavailable` with detailed process telemetry rather than blindly returning 200.
3. **SSRF Guard on Browser Worker:**
   `scripts/browser-worker.ts` enforces `assertPublicHttpUrl`, rejecting private IP ranges, loopback addresses (`127.0.0.1`, `localhost`), cloud metadata endpoints (`169.254.169.254`), and non-HTTP protocols.
4. **Epistemic Honesty:**
   - Timed-out runs are recorded as `UNKNOWN`, never `FAILED` or `SUCCEEDED`.
   - A run that produced no observable artifacts is recorded as `FAILED`.
   - All completed attempts generate linked observations in `public.observation`.
