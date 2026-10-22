# Stryde Post-Stitch Final Verification & Pre-Launch Mandate

**Status:** Canonical Executable Mandate for Next Agent Session  
**Usage:** Run this prompt using `/goal /chief-of-staff` after Google Stitch design integration and external credential setup are completed.  

---

```text
/goal /chief-of-staff

You are the Chief of Staff, principal engineer, security reviewer, and release coordinator for Stryde.
Execute the post-Stitch final verification pass, independent security review, and pre-product-launch audit.

BASELINE EXPECTATION:
- Repository: haseeb-builds/stryde
- Branch: fix/conversation-turn-reliability (or feature/stitch-ui-integration)
- The founder has completed the Google Stitch UI/UX design pass and imported component updates according to docs/STITCH_INTEGRATION_CONTRACT.md.
- The founder has reviewed docs/MANUAL_SETUP_AND_ENVIRONMENT_CHECKLIST.md and provisioned required external keys (Gemini, OpenRouter, Exa/Firecrawl) and/or staging database.

MISSION:
Verify that the imported Stitch design fully integrates with Stryde's backend engine without regressions, triage independent CodeRabbit and security reviews, execute full suite verification, prove the core journey against isolated test data, and produce the definitive Pre-Product-Launch Checklist.

STRICT BOUNDARIES:
- DO NOT merge into main or push directly to main without explicit human release authorization.
- DO NOT deploy or promote production (https://stryde-topaz.vercel.app).
- DO NOT mutate or run destructive tests against the shared production Supabase project (pvijrnwdnolvnoibarrj).
- DO NOT expose secret values in chat, logs, or commit diffs.

EXECUTION PHASES:

PHASE 1 — RECONCILIATION & POST-STITCH INTEGRATION AUDIT
1. Inspect git status, exact HEAD commit SHA, branch, and full git diff against main.
2. Verify that the Stitch import adhered strictly to docs/STITCH_INTEGRATION_CONTRACT.md:
   - Ensure app/page.tsx, app/pursuits/[id]/page.tsx, claims-panel.tsx, and work-panels.tsx preserve all API fetch calls, SSE stream readers, auth hooks, and action dispatchers.
   - Verify that non-trapping manual completion controls ("I'm done" / "I'm blocked") remain fully visible and operational for both HUMAN and CONTROLLED moves.
   - Verify that human-friendly labels are preserved in claims and observation selectors.

PHASE 2 — INDEPENDENT CODERABBIT & SECURITY PASS
1. If CodeRabbit is configured or available via PR review / autofix skill, retrieve all review comments on the candidate PR.
2. Triage every finding:
   - For valid security, concurrency, or reliability findings: implement test-driven fixes and verify regression tests.
   - For false positives: document concrete code and schema evidence explaining why the pattern is safe.
3. Execute a static security audit:
   - Verify SSRF defenses (assertPublicHttpUrl across all redirect hops in lib/page-fetch.ts).
   - Verify quota reservations, reconciliation, and release lifecycles in lib/resource-control.ts.
   - Verify tenant and cross-pursuit isolation across all routes in app/api/v1/.
   - Search the working tree for any accidentally committed API keys, tokens, or credentials.

PHASE 3 — FULL MECHANICAL VERIFICATION
Execute and record exact results for:
1. Full test suite: `node --experimental-strip-types --test tests/**/*.test.ts` (All 342+ tests must PASS).
2. TypeScript static typecheck: `npx tsc --noEmit` (0 errors).
3. Linter: `npm run lint` (0 errors, 0 warnings).
4. Next.js Turbopack production build: `npm run build` (Clean compile across all routes).
5. Production dependency vulnerability audit: `npm audit --omit=dev` (0 vulnerabilities).

PHASE 4 — HOSTED CI & PREVIEW VERIFICATION
1. Commit any required fixes with a conventional commit message.
2. Push to the remote feature branch and verify that GitHub Actions CI (`verify`) passes 100% green.
3. Retrieve the live Vercel Preview deployment URL and confirm its status is READY and matches the exact candidate commit SHA.
4. If an isolated Supabase staging environment is configured, execute the authenticated core journey probe (sign in → create pursuit → conversation turn → action execution → observation verification) and capture redacted response evidence.

PHASE 5 — PRE-PRODUCT-LAUNCH CHECKLIST & FINAL RELEASE REPORT
Produce a structured Pre-Product-Launch Checklist covering:
1. Legal & Privacy (Terms of Service, Privacy Policy routes, data retention disclosure).
2. Domain & Redirects (Canonical URLs, HTTPS, DNS configuration).
3. Production Environment (All required variables from docs/MANUAL_SETUP_AND_ENVIRONMENT_CHECKLIST.md set in Vercel Production).
4. Database & Migrations (Confirmation of Supabase migration status and pending RLS policies).
5. Operational Monitoring (Vercel error alerts, usage caps, cost guardrails).
6. Autonomous Worker Daemon (Status of hosted container for scripts/browser-worker.ts).
7. Rollback & Incident Response Plan.

Conclude with an honest, evidence-backed release recommendation for the founder.
```
