# Stryde Capability-Reuse Audit

Status: complete audit (reconstructed and finished after an interrupted session; the underlying research artifacts are preserved untracked in `.audit-research/`)
Audit date: 2026-10-04
HEAD audited: c3e97b3 (+ the worker-plane hardening implemented as this audit's consequence)
Method: read-only static inspection, license-file and lockfile analysis, live test runs for the engineering consequences. Every finding below is labeled CONFIRMED (directly verified), INFERRED (evidence-backed conclusion), UNKNOWN (not determinable), or BLOCKED (externally gated).

## The question

Can Stryde close any remaining capability by REUSING an external open-source repository — the surveyed reference being a 121-app "awesome LLM apps" collection (Apache-2.0 root) — instead of maintaining its own implementations? Reuse here means: adopt, vendor, wrap, or combine third-party capability code into Stryde's runtime.

Constraints honored: no new heavyweight frameworks (D14); Stryde keeps semantic ownership (D10); every addition must pass the integration rule (ARCHITECTURE.md); no dependency was added merely to prove reuse.

## CONFIRMED findings

### The external repository (potential reuse source)

1. **License posture is mostly clean but not uniformly safe.** Root license is Apache-2.0 with no NOTICE file and an unfilled copyright placeholder; 5 nested MIT licenses exist under `generative_ui_agents/` (third-party attributions); `knowledge_graph_rag_citations` claims MIT in its README but ships **no LICENSE file** — license status AMBIGUOUS.
2. **Quality gates are absent where reuse risk is highest.** The repository's only CI workflows are scoped to `agent_skills/**` and a README; **none of the ~97 dependency-bearing apps have any CI**. The README index is incomplete (multiple on-disk apps are unlisted, and directory counts disagree with the index in at least four sections).
3. **The three most capability-relevant apps were inspected in depth** (verbatim manifests + source):
   - `multimodal_agentic_rag`: React/Vite + FastAPI + google-adk; **in-memory vector store with no persistence** (its own README says to replace it for production); requires `GOOGLE_API_KEY`.
   - `knowledge_graph_rag_citations`: Streamlit + Neo4j + Ollama in a single 20KB file; **license AMBIGUOUS**.
   - `browser_mcp_agent`: Streamlit + mcp-agent + Playwright (Node.js required); 3 dependencies, 7KB main.

### Stryde's current implementation (as built)

4. **Runtime dependency surface: 5 packages, all MIT** (`next`, `react`, `react-dom`, `@supabase/supabase-js`, plus the toolchain). Verified by lockfile (447 entries) and node_modules walk (359 packages, name-scanned): **no** firecrawl/crawlee/scrapy/agent-framework SDK is present, vendored, or imported.
5. **All evidence/adapter modules are self-contained first-party code with zero import statements** (`lib/page-fetch.ts`, `lib/source-provider.ts`, `lib/search-provider.ts`): every outbound call is the platform-native `fetch` (injectable for tests). Firecrawl is reached exclusively as a remote HTTP/JSON service — **no AGPL-encumbered code is linked, vendored, or distributed**; the AGPL boundary is a network socket, not an import.
6. **Honest degradation is structural, not incidental**: renderer provenance (`DIRECT`/`FIRECRAWL`) is recorded in observations and source metadata; an unreachable page is never linked as evidence; a search surface with no configured provider fails loudly (502) rather than returning silent empties.
7. **One dead dependency existed**: `resend`, a leftover of the legacy check-in cron that the continuity cron replaced. Zero code references.

## Verdicts

| Capability area | Verdict | Basis |
|---|---|---|
| Conversation / working state / memory | **KEEP** | Stryde's Postgres-owned lifecycle (provenance, supersession, ranked retrieval) has no equivalent in the source; the closest external apps are in-memory tutorial-grade (CONFIRMED 3). |
| Evidence providers (search, scrape, render) | **KEEP** | Self-contained adapters already implement the contracts with honest provenance (CONFIRMED 5-6); adopting external Python/Streamlit code would add a foreign runtime for worse guarantees. |
| Citation/verification | **KEEP** | Epistemic transitions are SQL-enforced server-side; nothing external offers this. |
| Worker plane | **KEEP + harden** | Plane is proven with two real agents; the hardening (auth enforcement, neutrality) was this audit's own consequence, below. |
| `resend` dependency | **DELETE (executed)** | Dead code after the check-in cron was replaced (CONFIRMED 7). Removed from package.json, lockfile, CI env, and .env.example. |
| External app code (any of the 121) | **REJECT for runtime reuse** | License ambiguity in the most relevant candidate (CONFIRMED 1), zero CI (CONFIRMED 2), tutorial-grade persistence (CONFIRMED 3), Python stack vs Stryde's TypeScript/Next/Postgres product, D10/D14. |
| Model routing | **KEEP (frozen)** | Product decision; outside audit scope. |

**Zero REPLACE decisions.** That outcome is evidence-supported, not a default: in every area, Stryde's own implementation is either equal or strictly stronger on the dimensions the constitution cares about (provenance, authority, honest uncertainty), and the only candidate for adoption fails the integration rule on license and quality gates.

## Engineering consequences (executed)

1. **`resend` removed** from `package.json`, `package-lock.json`, CI env, `.env.example`. Verified: zero references repo-wide (excluding lockfile residue, which is also clean).
2. **Worker-plane bearer authentication enforced, not merely sent.** `lib/worker-gateway.ts` already *sent* `Authorization: Bearer STRYDE_<WORKER>_TOKEN`; nothing on the socket side checked it. New `lib/worker-server-auth.ts`: constant-time, length-checked comparison, **fails closed** (a worker with no configured token accepts nothing), per-worker-type scoped (one worker's token never opens another's). Both `scripts/hermes-worker.ts` and `scripts/opencode-worker.ts` gate every request before any route logic. Pinned by `tests/worker-server-auth.test.ts` (6 tests) and verified live: no token → 401, wrong token → 401, correct token → passes the gate.
3. **Worker neutrality.** `WORKER_TYPES` is now the single source of truth for worker types: tool keys (`worker.<type>`) and env prefixes (`STRYDE_<TYPE>_{URL,TOKEN}`) are *derived*, so adding a third worker type requires no edits to shared modules and no Hermes-specific branch survives in `lib/worker-contract.ts` or `lib/worker-gateway.ts`. The module-resolution defect (extensionless relative import breaking `node --experimental-strip-types` tests) is fixed with the repo's explicit-`.ts` convention.
4. **Worker server env loading.** Neither worker server loaded `.env.local` (the dispatcher did). With fail-closed auth this turned the documented `npm run worker:<type>` flow into a silently misconfigured worker that rejects everything. Both servers now load `.env.local` with the dispatcher's exact pattern (existing process env always wins), and the Windows path normalization was verified against the dispatcher's proven form.
5. **`worker:opencode` npm alias** added, giving both workers the same operator surface; both E2E suites were updated to mint/pass tokens explicitly and to assert authenticated reachability before doing work.

## Verification (2026-10-04, this repo)

- `npm test`: **179/179** (173 prior + 6 new auth-contract tests).
- `npx tsc --noEmit`: clean. `npm run lint`: clean. `npm run build`: clean.
- Live, real agents, authenticated end to end: `e2e:opencode-worker` **12/12** (artifact-judged SUCCEEDED), `e2e:real-worker` **11/11** (artifact-judged SUCCEEDED), plus direct socket evidence of the gate (401/401/pass).

## UNKNOWN / BLOCKED

- **UNKNOWN**: GitHub stars/forks of the surveyed source (API 403 at collection time) — irrelevant to the verdict, recorded for completeness.
- **BLOCKED (external credentials only)**: live requests through Exa/Firecrawl remain unverified (no keys in this environment — every path degrades honestly and is mock- or direct-path-proven); production conversation verification awaits the funded OpenRouter key. These do not affect any KEEP/DELETE/REPLACE verdict above.
- **HUMAN ACTION REQUIRED** (recorded, not engineering): enable leaked-password protection in the Supabase dashboard; fund the runtime model key; optionally add `EXA_API_KEY` / `FIRECRAWL_API_KEY` to the runtime environment.

## Sources

- `.audit-research/01-awesome-llm-apps.md` — full external-repo survey (121 apps, licenses, index completeness).
- `.audit-research/10-current-implementation.md` — as-built Stryde audit at c3e97b3.
- `.audit-research/31-evidence-provider-audit.md` — license-risk verdict and module-by-module provider analysis.
- This repo's verification runs (commands and results above).
