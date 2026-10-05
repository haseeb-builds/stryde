# 31 — Evidence Provider Audit: Exa, Firecrawl, and License-Risk Verdict

- Audit date: 2026-10-04
- Repo root: `C:/Users/DELL/Desktop/Stryde/stryde`
- Scope: `lib/page-fetch.ts`, `lib/source-provider.ts`, `lib/search-provider.ts`, their consumers, `package.json`, `package-lock.json`, `node_modules`, git index.
- Constraint: READ-ONLY. No file in the repo was modified. No secret value is reproduced in this document (only env var *names*).

---

## EXECUTIVE VERDICT (license risk)

**NO AGPL-ENCODUMBERED CODE IS LINKED, VENDORED, IMPORTED, OR DISTRIBUTED WITH STRYDE.**

Firecrawl is reached **exclusively as a remote HTTP/JSON service** (`https://api.firecrawl.dev/v1/scrape`, `https://api.firecrawl.dev/v1/search`), using the platform-native global `fetch`. Stryde ships **zero** bytes of Firecrawl source. There is no `@mendable/firecrawl-js` SDK, no `firecrawl`, `crawlee`, or `scrapy` package in `package.json`, `package-lock.json`, or `node_modules` (359 installed packages, verified by exhaustive name scan). All five runtime dependencies are MIT.

Constitutional principle 28 is therefore **satisfied for Firecrawl**: the AGPL boundary is crossed at a network socket, not at an import or a link boundary. AGPL-3.0 §13 triggers on *conveying* / running a *modified* version of the covered work as a network service; a client that transmits a URL and receives JSON/Markdown is an API consumer, not a derivative work. There is no AGPL source to modify, so there is nothing to offer under §13 and no corresponding-source obligation attaches to Stryde.

Two residual risks are **not** licensing risks and are recorded for completeness:
1. **Terms-of-service / data-processing risk**, not license risk: Firecrawl's *hosted* service is a separate commercial contract. If a self-hosted Firecrawl instance were ever operated **by or for** Stryde and modified, AGPL §13 obligations would attach **to that instance**, not to Stryde's TypeScript code (separate processes, no linking). Stryde has no self-hosted Firecrawl deployment in this repo.
2. **API-contract coupling**: `docs/INTEGRATIONS.md:25` records Firecrawl as "mock-proven only — no key in the build environment". The adapter is written to the documented HTTP contract only, so an upstream break is a runtime degradation, not a license event.

---

## 1. Full content analysis of the three modules

All three files are **self-contained TypeScript with ZERO import statements**. Verified mechanically:

```
lib/page-fetch.ts:     0 import/require statements
lib/source-provider.ts:0 import/require statements
lib/search-provider.ts: 0 import/require statements
```

No third-party scraping library is imported or vendored by any of them. Every outbound call is the Node/Next built-in global `fetch` (injectable as `fetchImpl` for tests).

### 1a. `lib/page-fetch.ts` (176 lines)

Purpose: mechanical, honest page-text observation shared by URL source ingestion and `VERIFY_WEB` claim checks.

Key elements:
- L25 `export type PageRenderer = "DIRECT" | "FIRECRAWL";` — the provider switch is a plain string-literal union type.
- L27-40 `PageFetchResult { text, renderer, status, error }`. L28-29 comment: *"Empty string means nothing was observed... This module never throws."* Non-throwing by contract.
- L42-47 limits: `MAX_BODY_CHARS = 500_000`, `TIMEOUT_MS = 15_000`, `SCRAPE_TIMEOUT_MS = 30_000`, `THIN_TEXT_CHARS = 500`.
- L49-52 `DIRECT_HEADERS` — a plain object of two header strings (`user-agent`, `accept`). No SDK, no browser driver.
- L57-70 `htmlToText(body)` — 12 lines of local regexes (strip `<script>`, `<style>`, comments, tags; decode 5 entities; collapse whitespace). **This is Stryde's own code**, not derived from any scraping library. It is used only to judge DIRECT thinness and to extract readable text (L55-56 comment: *"it is never returned as observed content itself"*).
- L74-106 `fetchDirect()` — plain `fetch(url, { method:"GET", redirect:"follow" })` with an `AbortController` timeout. L86-88: a non-2xx status is treated as the origin's definitive answer and is **never** read as content.
- L112-135 `scrapeViaFirecrawl(url, apiKey, baseUrl, fetchImpl)` — the Firecrawl leg. See §2.
- L137-175 `fetchPageText()` — orchestration and the switch. See §6.

External services called: the **target URL itself** (arbitrary public origin, already SSRF-validated by the caller) and **Firecrawl's hosted API** (conditional).

### 1b. `lib/source-provider.ts` (58 lines)

Purpose: a narrow, typed provider *interface* for URL extraction.

- L1-16 `SourceProviderResult` / `SourceProvider` (`{ name, extractPublicUrl({url, signal}) }`). Note L6 status enum `"FETCHED" | "PARTIAL" | "FAILED" | "UNSUPPORTED"`.
- L18-22 `FirecrawlResponse` — a hand-written structural type for the JSON response. **No SDK types imported.**
- L24-51 `createFirecrawlSourceProvider()` — factory. L26 base URL default `https://api.firecrawl.dev/v1`. One `fetchImpl` POST to `${baseUrl}/scrape` (L30-36) with body `{ url, formats:["markdown"], onlyMainContent:true }`. L32 auth: header `Authorization` set to a `Bearer`-prefixed template of the injected `input.apiKey`. L37 captures a provider request id from `x-request-id` / `x-firecrawl-request-id`. L38-48 normalizes the JSON into the typed result.
- L53-57 `getFirecrawlSourceProvider()` — **throws** `Missing source configuration: FIRECRAWL_API_KEY` when the key is absent (L55). No silent degradation in this entry point.

**Important finding: this module is DEAD CODE in the product path.** Repo-wide reference scan finds `createFirecrawlSourceProvider` only at its own definition (L24) and its own use inside `getFirecrawlSourceProvider` (L56), plus `tests/source-provider.test.ts`. `getFirecrawlSourceProvider` has exactly **one** occurrence repo-wide — its own definition at `lib/source-provider.ts:53`. No `app/` or `lib/` module imports it. The live path uses `page-fetch.ts` instead. Same for the `SourceProvider` type: 11 occurrences, all in `lib/source-provider.ts` and `tests/source-provider.test.ts`.

External services called: Firecrawl hosted API only.

### 1c. `lib/search-provider.ts` (110 lines)

Purpose: search providers + a failover chain.

- L1-13 `SearchResult` / `SearchProvider` (`{ name, search({query, maxResults, freshnessDays?, signal?}) }`).
- L17-42 `createExaSearchProvider()`. See §3.
- L54-85 `createFirecrawlSearchProvider()`. L56 base default `https://api.firecrawl.dev`; L63 POST `${baseUrl}/v1/search` with `{ query, limit }`; L65 same `Bearer`-prefixed `Authorization` header. L60-62 comment notes Firecrawl's `/v1/search` has **no freshness window**, so `freshnessDays` is mechanically unsupported on that leg.
- L87-103 `getSearchProviderChain()` — builds the ordered chain (see §4/§6).
- L105-109 `getSearchProvider()` — returns `chain[0]`, or throws.

External services called: Exa hosted API and Firecrawl hosted API, both conditionally.

---

## 2. What the FIRECRAWL integration actually is

**It is a plain HTTP POST to Firecrawl's hosted API, using the global `fetch`. It is not an SDK, not a library, not a vendored copy.**

Three independent call sites, all HTTP:

| # | File:line | Request | Purpose |
|---|---|---|---|
| 1 | `lib/page-fetch.ts:115-121` | `POST {baseUrl}/scrape`, body `{url, formats:["markdown"]}` | JS-render fallback for page observation |
| 2 | `lib/source-provider.ts:30-36` | `POST {baseUrl}/scrape`, body `{url, formats:["markdown"], onlyMainContent:true}` | (dead code — see §1b) |
| 3 | `lib/search-provider.ts:63-69` | `POST {baseUrl}/v1/search`, body `{query, limit}` | Firecrawl as an alternate search leg |

- **Hosted, not self-hosted.** Default base URLs are hardcoded to `https://api.firecrawl.dev/v1` (`page-fetch.ts:143`, `source-provider.ts:26`) and `https://api.firecrawl.dev` (`search-provider.ts:56`). Overridable via the `firecrawlBaseUrl` option (tests/self-host escape hatch) — no self-hosted Firecrawl is deployed in this repo (see §5 file inventory).
- **Auth:** `Authorization: ` + `Bearer ` + the `FIRECRAWL_API_KEY` value, in all three call sites. (Header name and scheme stated; **no key value is printed**.)
- **Key source:** `process.env.FIRECRAWL_API_KEY` (`page-fetch.ts:142`, `source-provider.ts:54`, `search-provider.ts:98`), plus optional `FIRECRAWL_API_VERSION` for provenance (`source-provider.ts:56`). `.env.example:49` declares `FIRECRAWL_API_KEY`; **`.env.local` does not set it** (verified by key-name scan — confirmed absent), which is why `docs/INTEGRATIONS.md:25` says "mock-proven only".

### Is any Firecrawl source code or npm package installed? — NO. Evidence:

1. **`package.json`** (all of `dependencies`): `@supabase/supabase-js ^2.110.0`, `next 16.2.9`, `react 19.2.4`, `react-dom 19.2.4`, `resend ^6.16.0`. `devDependencies`: tailwind v4, @types/*, eslint v9, eslint-config-next, typescript. **No firecrawl, no crawlee, no scraping/HTTP client library at all.**
2. **`package-lock.json`**: 447 package entries scanned. `LOCKFILE matches` for `/firecrawl|crawlee|scrapy/i` = **`[]`**. Literal string `firecrawl` occurrences in the lockfile = **0**.
3. **`node_modules`**: 359 installed packages enumerated (top-level + all `@scopes`). Regex scan for `firecrawl|crawlee|scrapy|playwright|puppeteer|cheerio|jsdom|axios|node-fetch|undici` returned only **`undici-types`** — which is *types only* (`@types/node` companion, zero runtime code), matched solely because "undici" is a substring of its own name. Two `playwright` directories exist but are **part of the `next` package itself** (`node_modules/next/dist/experimental/testmode/playwright` and `node_modules/next/experimental/testmode/playwright`) — Next.js's own experimental test-mode shims, not a scraper Stryde uses or calls.
4. **Deep `os.walk` of the entire `node_modules` tree** for any directory name containing firecrawl/crawlee/scrapy/playwright/puppeteer/cheerio/jsdom/axios/node-fetch/undici: only `undici-types` and the two Next.js-owned `playwright` dirs. **No firecrawl directory exists anywhere on disk.**
5. **Git index**: 192 tracked files; **0 files under `node_modules`** (`/node_modules` is in `.gitignore`). No `.gitmodules` (no submodules/subtrees). No tracked filename containing "firecrawl".
6. **No vendored-code directory exists**: `vendor/`, `vendored/`, `third_party/`, `third-party/`, `external/`, `deps/` — all `False`.
7. **No AGPL/copyleft text anywhere in first-party source**: repo-wide scan (excluding `node_modules`/`.next`/`.git`) for `AGPL|GPL-3|GPLv3|GNU AFFERO|copyleft|SSPL|BUSL|source-available` returned **zero matches** across all `.ts/.tsx/.md/.json/.mjs/.sql`. Stryde's own code contains no copyleft notice and does not wrap one.
8. `supabase/` contains **only** `.sql` migrations and tests — no `functions/` edge-function directory, so no AGPL-licensed code running as part of Stryde's own backend.

---

## 3. Search provider: is Exa called over HTTP? — YES

`lib/search-provider.ts:17-42`. There is no Exa SDK; the endpoint is a hand-written `fetch` POST.

- **Endpoint:** `POST {baseUrl}/search`, base default `https://api.exa.ai` (`search-provider.ts:19`, trailing slash stripped at L19). Exa is the **hosted** api.exa.ai service.
- **Auth approach:** a **custom header**, not Bearer. `search-provider.ts:25` sets header `"x-api-key"` to the injected `input.apiKey`, alongside `Content-Type: application/json`. (Header name and scheme stated; **no key value is printed.**)
- **Key source:** `process.env.EXA_API_KEY` (`search-provider.ts:47`, and `:97` for chain construction); `.env.example:48` declares it. Absent from `.env.local` — consistent with `docs/INTEGRATIONS.md:24` ("no Exa key in the build environment, so the live request remains unverified").
- **Request body** (L26): `{ query, type:"auto", numResults: maxResults, [startPublishedDate: ISO when freshnessDays], contents: { highlights: { maxCharacters: 800 } } }`.
- **Transport:** `fetchImpl` (injectable), `cache:"no-store"`, `AbortSignal.timeout(20_000)` (L27). Every `!response.ok` **throws** `Search provider failed (<status>)` (L30) — the Exa leg has no silent degradation; it fails loudly and the caller may fall through to the next chain leg.
- **Response handling:** structural type `ExaPayload` (L15) written by hand; results mapped at L34-38 with rank = index+1, ≤5 highlights, `providerMetadata {id, score}`; `providerMetadata` returned carries `{provider:"exa", request_id}` (L39).
- Also referenced: `lib/adaptive-situation.ts:231` reads `EXA_API_KEY` (presence-check only).

---

## 4. EVERY external third-party service Stryde currently calls

| Service | Transport | Endpoint / base URL | file:line evidence |
|---|---|---|---|
| **Firecrawl** (hosted) | HTTP POST `fetch` | `https://api.firecrawl.dev/v1/scrape` | `lib/page-fetch.ts:115`; `lib/source-provider.ts:30` |
| **Firecrawl** (hosted) | HTTP POST `fetch` | `https://api.firecrawl.dev/v1/search` | `lib/search-provider.ts:63` |
| **Exa** (hosted) | HTTP POST `fetch` | `https://api.exa.ai/search` | `lib/search-provider.ts:19,23,25` |
| **Gemini / Google** | HTTP POST `fetch`, `x-goog-api-key` | `https://generativelanguage.googleapis.com/v1beta` | `lib/model-provider.ts:27,191` |
| **OpenRouter** | HTTP POST `fetch`, `Authorization: Bearer` | `https://openrouter.ai/api/v1` | `lib/model-provider.ts:28,191` |
| **Groq** | HTTP POST `fetch`, `Authorization: Bearer` | `https://api.groq.com/openai/v1` | `lib/model-provider.ts:30,191` |
| **OmniRoute** | HTTP POST `fetch` | base URL from env (`STRYDE_OMNIROUTE_BASE_URL`); empty default at `model-provider.ts:29` | `lib/model-provider.ts:29,191`; `.env.local` key `STRYDE_OMNIROUTE_BASE_URL` |
| **Supabase** (PostgREST/Auth/Realtime) | `@supabase/supabase-js` SDK over HTTPS | `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts:1-6`; `lib/supabase/server.ts:1,32-43`; `lib/supabase/service.ts:1,16` |
| **Arbitrary public web origins** | HTTP GET `fetch` | any public URL, post-SSRF-check | `lib/page-fetch.ts:78` (guarded at `lib/source-ingestion.ts:40-57,80`) |

Notes:
- **Resend is declared but NOT called.** `resend ^6.16.0` is in `package.json:30` and installed (`node_modules/resend`, MIT), and `RESEND_API_KEY` is declared at `.env.example:50` and set in `.env.local`. But a repo-wide scan for `resend`/`Resend` across all `.ts/.tsx/.mjs` found **zero** code references — only `package.json` and `package-lock.json`. No email is sent. Not a license issue (MIT), but it is dead weight and an unused credential in `.env.local`.
- **Supabase CLI** is installed (`@supabase/cli-windows-x64` under `@supabase/`) for migrations only; it is a dev/migration tool, not a runtime service call.
- All model providers are also reached by plain `fetch` (`model-provider.ts:191`) — no vendor SDK, one uniform transport.

---

## 5. License-risk verdict (explicit)

**VERDICT: NO AGPL-ENCODUMBERED CODE IS LINKED OR VENDORED INTO STRYDE'S PROPRIETARY CORE. EVERY THIRD-PARTY SERVICE — INCLUDING FIRECRAWL — IS REACHED PURELY OVER HTTP AS A SEPARATE PROCESS. Constitution principle 28 is satisfied at the Firecrawl boundary.**

Evidence, restated as a chain of proof:

1. **Firecrawl's own license is AGPL-3.0** (server) with MIT SDKs — this is the risk being evaluated, and it is accepted as a real upstream fact, not waved away.
2. **The boundary crossed is a network socket.** `lib/page-fetch.ts:115`, `lib/source-provider.ts:30`, `lib/search-provider.ts:63` all call `fetchImpl(...)`. A JSON request body goes out; a JSON/markdown response comes back. No Firecrawl module is loaded into Stryde's address space.
3. **Nothing is vendored or imported.** 0 import statements in the three provider files; 0 firecrawl/crawlee/scrapy packages in `package.json`, `package-lock.json` (0 literal occurrences), or `node_modules` (359 packages scanned by name, plus an exhaustive directory-name walk); 0 vendored-code directories; 0 tracked files under `node_modules`; no submodules.
4. **All shipped runtime dependencies are permissive (MIT).** `@supabase/supabase-js` MIT, `next` MIT, `react` MIT, `react-dom` MIT, `resend` MIT (read from each installed `package.json` `license` field).
5. **No copyleft notice or wrapped AGPL code in first-party source.** Repo-wide scan for AGPL/GPL/copyleft/SSPL/BUSL/source-available strings returned zero hits in all first-party source.
6. **No Stryde-operated AGPL deployment.** `supabase/` holds only SQL migrations/tests; there is no `functions/` edge-function dir and no Firecrawl Docker/Compose deployment in the repo. The Firecrawl instance Stryde calls is a third party's hosted service (`api.firecrawl.dev`).
7. **The design is deliberately replaceable**, which is the point of the HTTP boundary: Firecrawl appears behind an injectable `fetchImpl` and a `firecrawlBaseUrl` option (`page-fetch.ts:139,143`; `source-provider.ts:24,26`; `search-provider.ts:17,19,54,56`), and Stryde's own search path can run Exa-only or Firecrawl-only (`search-provider.ts:94-103`). Deleting Firecrawl support requires zero dependency surgery — only a config change.

What AGPL §13 does and does not reach here: §13 attaches to a user who *modifies the covered work* and *conveys it* / makes it available as a network service. Stryde modifies nothing and conveys nothing of Firecrawl's covered work; it sends a URL string and receives data. There is therefore no AGPL-covered derivative and no §13 source-offer obligation on Stryde. The one scenario that would change the analysis is operating a *modified self-hosted* Firecrawl as part of Stryde's own offering — that obligation would attach to the Firecrawl instance, and Stryde's code would remain uninvolved (separate processes, no linking). No such deployment exists here.

---

## 6. The DIRECT vs FIRECRAWL switch, and no-key degradation

### What the switch does functionally

`lib/page-fetch.ts:137-175`. DIRECT is **always attempted first** (L145) — Firecrawl is a conditional *second* observation of the same URL, never a replacement.

Firecrawl is attempted **only when all three conditions hold** (`page-fetch.ts:155`: `if (apiKey && (wantsRender || thin || networkFailed))`):
1. `apiKey` — `FIRECRAWL_API_KEY` resolved (explicit option → env, trimmed; `page-fetch.ts:142`); **and**
2. `wantsRender` (`options.render === true`, L151) **or**
3. `thin` — the DIRECT body exists but `htmlToText(body).length < 500` (`THIN_TEXT_CHARS`, L47/L152): a script-heavy JS shell, interstitial, or consent wall whose visible text is near-empty; **or**
4. `networkFailed` — DIRECT got no body *and* no status at all (`body === null && status === null`, L153): a timeout/DNS/transport failure where the origin never answered.

Deliberate exclusions:
- **No `render: true` caller exists.** `render === true` is read only at `page-fetch.ts:151`; `lib/source-ingestion.ts:86` and `lib/verification-check.ts:68` both call `fetchPageText` without it. So in the live path, only the thin-body and network-failure triggers are reachable.
- **A definitive origin error is NOT retried through Firecrawl.** A 404/500 sets a non-null `status` (L86-88), so `networkFailed` is false and Firecrawl is skipped — the module's own comment (L21-23) calls this out: *"the origin answered, and that answer is the honest observation."*

Functional difference between the two renderers:
- **DIRECT** returns **raw HTML** (`response.text()`, L91) capped at 500k. For JS-rendered pages this is typically a script shell with almost no visible text.
- **FIRECRAWL** returns **rendered Markdown** (`payload.data.markdown`, L132) — JS executed server-side at Firecrawl.

The two are reconciled honestly at the consumer (`lib/source-ingestion.ts:105-108`):
```ts
// Content stays extracted text: Firecrawl markdown as served, or — for a
// direct fetch — the page's visible text (tags/scripts stripped), so a
// raw HTML dump never becomes source material.
let contentText = page.renderer === "FIRECRAWL" ? page.text : htmlToText(page.text);
```
- FIRECRAWL leg → markdown stored as-is; `contentType: "text/markdown"` (`source-ingestion.ts:115`).
- DIRECT leg → passed through Stryde's own `htmlToText`; `contentType: null`.
Either way a raw HTML dump never becomes source material.

Provenance is always recorded, never hidden: `renderer: page.renderer` is written into `sourceMetadata` (`source-ingestion.ts:99,122`) and onto every verification outcome (`verification-check.ts:85,87`, type at `:27`), so evidence records *how* it was observed.

Firecrawl failure is never fatal if DIRECT already produced a body (`page-fetch.ts:160-163`): the thin-but-real DIRECT text is kept and the Firecrawl error is attached as `error`/`note` — "the better renderer was tried and failed" is stated rather than hidden.

### Degradation when no API key is configured

`page-fetch.ts:155` — with no key, the whole Firecrawl block is skipped. Behavior:

- **URL ingestion (`ingestUrlSource`)**: pure DIRECT-only. Still fully functional for static HTML. For a JS-rendered SPA the body is a thin shell, `htmlToText` yields near-empty text, and the ingest is still recorded as `FETCHED` with the thin text (it is real observed content). On genuine failure → `fetchStatus: "FAILED"` with `renderer: "DIRECT"` and the error in metadata (`source-ingestion.ts:87-103`). Truncation still degrades to `"PARTIAL"` at 120k chars (`:110`). **No throw, no 500.**
- **Verification (`executeVerificationCheck`)**: `outcome` is `MATCHED` / `MISMATCHED` / `UNREACHABLE` — never a claim verdict. An unreachable page yields `UNREACHABLE`, and `relationForOutcome` maps that to `null` (`verification-check.ts:97-101`), so an unreachable page is never linked as either contradiction or confirmation. A JS-rendered page with no key simply reads as `MISMATCHED` against what was fetched — honest, mechanically limited evidence, not a false contradiction.
- **Search (`getSearchProviderChain`, `search-provider.ts:94-103`)**: chain membership is *key-presence-driven*. No `EXA_API_KEY` and no `FIRECRAWL_API_KEY` → chain is `[]`. `getSearchProvider()` throws `Missing research configuration: EXA_API_KEY or FIRECRAWL_API_KEY` (`:107`); `lib/research-execution.ts:36` throws the same; the research route falls through to `Missing research configuration: no search provider is configured` (`app/api/v1/pursuits/[id]/research/route.ts:82`) and returns **HTTP 502** with the message (`:87`). This is the one **hard fail** in the provider surface — deliberate: a search feature with no configured provider must not silently return empty results.
- **Partial keys degrade gracefully**: exactly one key present → a one-entry chain → prior single-provider behavior, unchanged (`search-provider.ts:90-93`). Both keys present → ordered chain, `STRYDE_SEARCH_PROVIDER` (`exa`|`firecrawl`, default `exa`) choosing *order, not exclusivity* (`:95,101-102`); the first leg that succeeds at call time serves the request (`research-execution.ts:41-49`, research route `:73-80`), and only when **every** configured leg fails does the last error surface.
- **`getFirecrawlSourceProvider()`** (`source-provider.ts:55`) throws on a missing key — but this module is unreachable from the product path (§1b), so it cannot affect runtime behavior.

Current environment reality (keys checked by **name only**, no values printed): `.env.local` sets neither `FIRECRAWL_API_KEY` nor `EXA_API_KEY`. So in this working copy both evidence providers are dark — matching `docs/INTEGRATIONS.md:24-25` ("mock-proven only", "no key in the build environment") and the guard asserted at `scripts/e2e-evidence-loop.ts:106`.

---

## Appendix — files read (read-only; nothing modified)

First-party source read in full: `lib/page-fetch.ts` (176 L), `lib/source-provider.ts` (58 L), `lib/search-provider.ts` (110 L), `lib/source-ingestion.ts` (142 L), `lib/verification-check.ts` (102 L), `lib/research-execution.ts` (96 L), `lib/supabase.ts` (6 L), `lib/supabase/server.ts` (60 L), `lib/supabase/service.ts` (25 L); targeted inspection of `lib/model-provider.ts` (L20-42, L185-200), `app/api/v1/pursuits/[id]/research/route.ts` (L60-90); `docs/INTEGRATIONS.md` (67 L); `package.json`; env **key names** from `.env.example` and `.env.local` (values never read or printed).

Metadata examined: `package-lock.json` (447 entries), `node_modules` (359 packages, name scan + full directory walk), git index (`git ls-files`, 192 tracked, 0 under `node_modules`), `.gitignore`, `.gitmodules` (absent), `supabase/` tree (SQL only).

Not present anywhere: firecrawl / crawlee / scrapy packages; vendored third-party source; `supabase/functions/`; any Firecrawl self-host deployment config.
