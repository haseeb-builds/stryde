---
name: agent-ready-website
description: Build or improve websites to be agent-ready, measured by their Ora score (ora.ai). Use when building a new site that AI agents should be able to use, or when asked to make an existing site work for AI agents, improve an Ora score/grade, or remove agent-hostile patterns (bot walls, JS-only content, missing llms.txt, undocumented APIs). Drives an audit -> fix -> re-audit loop via the ax CLI or Ora's public audit API.
---

# Agent-Ready Website

Websites get two kinds of visitors now: humans and AI agents. This skill makes a
site work for both, measured by its Ora score (https://ora.ai - 0-100, graded A+
to F). This skill is served dynamically: agent-readiness standards evolve, so
always work from a freshly fetched copy rather than a memorized one.

Two ways to use it:

- **Building a new site?** Apply the fix playbook below as build requirements
  from the start - server-rendered content, no bot walls, discovery files,
  semantic HTML, documented APIs. Then verify with a single audit and close any
  remaining gaps.
- **Improving an existing site?** Run the loop: **audit -> read the ranked
  fixes -> apply the smallest fix for the top-ranked check -> re-audit**. Never
  rewrite the site; fix it one check at a time.

## Step 1 - Baseline audit

Prefer the ax CLI when a shell is available (zero install, no account):

```bash
npx ax@0.7 audit https://<your-site> --json > /tmp/ora-audit-1.json
```

The `@0.7` pin matches this playbook to the CLI release line it
documents. If npx reports no matching version, the CLI for this playbook is
not published yet - use the MCP or REST path below instead of an older CLI.

If Ora's MCP server (https://ora.ai/api/mcp) is connected, `scan_domain` is
equivalent - its structured content is the same audit payload. Raw REST works
too: `POST https://ora.ai/api/scan` with `{"url": "<site>"}` and
`?format=audit` for the versioned shape; a `202` means analysis is still
running - poll the `Location` URL (`GET /api/score/{domain}?format=audit`)
every ~20s until `analysisStatus` is `complete`. Never re-POST a partial
scan; polling is the recovery.

**Freshness:** a cached result (up to 6h old by default; `maxAgeSeconds`
tunes the window) is fine while iterating and costs nothing. Force a fresh
scan (`--force` / `"force": true`) only to verify a fix you just deployed.
Budget: 30 scans + 6 force scans per rolling 24h per IP; cache hits are free.
An ora-issued scan API key lifts these limits entirely (set
`ORA_SCAN_API_KEY` or pass `--api-key`; keys are issued manually by ora,
so skip this unless one was provided).

## Step 2 - Local dev sites

Ora audits public URLs. For a site on localhost, the simplest path is to
audit a publicly reachable deployment of the same code (e.g. a preview
deployment). To audit localhost itself, bring your own tunnel:

```bash
npx ax@0.7 audit localhost:3000 --tunnel-cmd 'ngrok http 3000 --log stdout'
```

Any tunnel tool works - pass a command that exposes the local server and
prints its public https URL. The CLI audits that URL, marks the result
**ephemeral** - excluded from rankings and deleted after a few days - and
tears the tunnel down when the audit ends. Doing it by hand: open the tunnel
yourself, then audit the printed URL with `"ephemeral": true`
(`?ephemeral=1` on the stream) so the disposable hostname never pollutes
the leaderboard.

A tunnel makes the local site publicly reachable for its lifetime: do not
tunnel an app holding real credentials, secrets, or an admin surface - audit
a dev instance with test data. If you opened the tunnel by hand, stop it as
soon as you have the result.

On a throwaway tunnel hostname, ignore off-site Discovery checks entirely
(brand search, registry listings, Wikipedia, npm SDKs - they read the tunnel
host, not you). Work only on checks keyed to the page and site itself; those
read truthfully and move honestly as you fix them.

## Step 3 - Read the results

The audit payload ranks the work for you:

- **`topFixes`** is the server-ranked fix list (non-bonus first, then
  estimated 0-100 uplift descending). Work it top to bottom; render it
  verbatim - never re-rank.
- **`estScoreGain`** on each failing check is the estimated score uplift for
  fixing it (an estimate - treat `~+N pts` as a compass, not a promise).
  Do NOT read `maxScore - score` as uplift; layers normalize to weights.
- **`tier`** (required / recommended / emerging) is advisory display
  metadata. **Tier never determines score** - fix order comes from
  `topFixes` / `estScoreGain`.
- `mcpAuthRequired: true` means the scan could not evaluate an auth-gated
  MCP server: score 0 there means "unscored", not "failed everything".

## Step 4 - Fix playbook (generated from Ora's check registry)

Every check below links an id you will see in audit results to its remedy.
Grouped by scoring layer; tier groupings are advisory (see Step 3).

<!-- generated:playbook:start -->
### Discovery (20 pts) - Can agents find and recommend you?

**Required baseline:**

- `ard-catalog` - Publish an Agentic Resource Discovery catalog at /.well-known/ard.json (the ARD v0.91 canonical path), or point to one from your homepage with a <link rel="ard"> tag (an HTTP Link header with rel="ard" also counts); the legacy /.well-known/ai-catalog.json remains a valid alias. List your agentic resources (MCP servers, agents, skills, APIs), each entry with a urn:air identifier, a media type, and exactly one of url or data. See https://agenticresourcediscovery.org/
- `brand-search-accuracy` - Make sure your own domain ranks in the top results when people search your brand together with your main product (for example "Acme payments API"). If it does not, your brand may be too generic, conflict with a more established term, or not yet indexed. Strengthen it by describing your main product clearly in your homepage title and headings, earning press mentions that link to your domain, and avoiding redirect chains that mask your main domain in search results.
- `robots-ai-policy-quality` - In robots.txt, allow the AI search crawlers (OAI-SearchBot, Claude-SearchBot, PerplexityBot) to read your public pages, so AI search can find and cite them. The result shows which pages and which robots.txt lines block them. Keep private and account pages blocked. Blocking AI training crawlers such as GPTBot and ClaudeBot is your choice and never lowers this score. Visits that people ask an AI to make are covered by a separate check.

**Recommended:**

- `ai-catalog-published` - Serve a valid catalog at /.well-known/ai-catalog.json - the AI Catalog Standard's own discovery path - so consumers following that spec (see https://ai-catalog.io/) also find you. The entries can be the same as in /.well-known/ard.json, but this standard's document also needs "specVersion": "1.0" at the top level.
- `ard-entries-valid` - Make every catalog entry fully valid: a domain-anchored urn:air identifier, a displayName, a media type, and exactly one of url or data. Applies to the catalog at /.well-known/ard.json, behind a rel="ard" link, or at the legacy /.well-known/ai-catalog.json.
- `ard-trust-manifest` - Add a trustManifest (verifiable identity, compliance attestations, or signature) to your catalog entries (ard.json, a rel="ard" source, or the legacy ai-catalog.json) so clients can verify your resources with progressive trust.
- `agentic-search-usecase` - Build topical authority for your category. Publish comparison pages, 'best X for Y' content, tutorials, and integration guides that rank for generic use-case queries - not just your brand name - so agents surface you when users describe a need.
- `agentic-search-specific` - Check whether your developer resources (API docs, OpenAPI spec, auth docs, developer portal, MCP server, SDK documentation) surface in name-based searches. If they do not, use predictable URLs, link them in llms.txt, and include your product name in page titles and headings. This result reflects one search sample.
- `wikipedia-presence` - Establish a Wikipedia article and a Wikidata entity for your brand, with the domain set as the official website (Wikidata property P856) and a corresponding external link on Wikipedia. Wikipedia is the largest single source of citations in ChatGPT and a primary input to Knowledge Graphs across Google, Bing, and LLM training data. Earn third-party press coverage first to satisfy notability, then draft the article with cited references rather than self-promotion.
- `mcp-registry-listed` - Register your MCP server on Smithery (smithery.ai) or mcp.so so agent platforms can discover your tools. Link the registry entry from your homepage or docs for bi-directional verification.
- `npm-sdk-package` - Publish a JavaScript/TypeScript SDK package on npm so developers can integrate your API programmatically. In package.json set `repository` to your source repo and `homepage` to your product domain - these links are how agents confirm the package is your official SDK rather than a third-party tool with a similar name.
- `chatgpt-app-listed` - Submit your app to the ChatGPT apps / connectors directory (the apps-in-ChatGPT surface) so ChatGPT users can discover and use your product.
- `noindex-directives` - Remove the noindex directive from your homepage: the robots, googlebot or bingbot meta tag in the page head, or an X-Robots-Tag response header. Common causes are a staging setting left on after launch (in WordPress, Settings > Reading > Discourage search engines), an SEO plugin setting, or a host adding the header, as preview builds often do. Verify with `curl -sI https://yourdomain.com | grep -i x-robots-tag` and by searching the page source for name="robots".

**Emerging (excluded from the score):**

- `agent-rules-repo` - Add an AGENTS.md or .cursorrules file to your public GitHub repo with instructions for how AI coding agents should interact with your codebase. Then make sure the repo is documented in the entry-point pages agents read - homepage, docs, and llms.txt - so it can be discovered without guessing.
- `agent-plugins-repo` - Bundle your agent skills and MCP servers as an Agent Plugin: a plugin.json manifest with the agent-plugins.org $schema and a name in your public repo. See https://agent-plugins.org/specification
- `registry-branding` - Give your MCP server-card (at /.well-known/mcp/server-card.json) a display name, an icon or logo, and a description - all three together are what reads as a complete, branded listing agents can present.

### Access (30 pts) - Can agents access your data and understand you?

**Required baseline:**

- `sitemap` - Add a valid XML sitemap at /sitemap.xml listing all indexable URLs. Include lastmod dates and keep it under 50MB.
- `content-no-js` - Serve at least 500 characters of meaningful homepage content in raw HTML. Add a clear H1, keep deeper heading levels sequential, and remove excessive non-content markup.
- `bot-detection` - Let the agents that act for users and search (ChatGPT-User, OAI-SearchBot, Claude-User, PerplexityBot) through your WAF and bot rules. On Cloudflare, allow verified bots rather than matching User-Agent strings, which anyone can fake.
- `agent-discovery-file` - Publish an Agent Skills index at /.well-known/agent-skills/index.json that lists your capabilities, with each skill carrying a name and a description so agents can find and parse what you offer.
- `link-headers-discovery` - Add HTTP Link: response headers (RFC 8288) advertising your sitemap, markdown alternates, API service descriptions, and API catalog. Example: Link: </sitemap.xml>; rel="sitemap", </index.md>; rel="alternate"; type="text/markdown".
- `robots-agent-user-policy` - Review the matched homepage rules for ChatGPT-User, Claude-User, and Perplexity-User. If you intend to permit these requests, remove or narrow the reported restriction while keeping private paths protected. Review applicable ai-input=no declarations if answer-time use is intended. This check reports declared permission; a robots.txt change alone does not establish live access.
- `llms-txt-exists` - Create an llms.txt file at your domain root (/llms.txt) - the AI equivalent of robots.txt. Write at least 100 characters of real content: what your product is, what it does, and links to your key docs. Then verify it with `curl https://yourdomain.com/llms.txt` - you should see your text, not HTML. If your app returns its homepage for every URL (common with single-page apps), add a static file route so the raw text is served. A placeholder with just a heading earns no credit.
- `json-ld` - Add JSON-LD structured data to your homepage using the identity type that matches your site - SoftwareApplication for products, Organization or LocalBusiness for companies, Person for personal sites, Article for blogs - with name, description, url, and type-appropriate fields (offers, sameAs, author) so AI can parse your identity programmatically.
- `pricing-info` - Make pricing discoverable - add a /pricing page or include pricing as schema.org/Offer structured data, so agents can find it without scraping a marketing page.
- `public-api-docs` - Publish API documentation at a discoverable URL (/docs, /api, /developers). Include authentication, endpoints, and example requests.
- `agent-instruction` - Tell agents when to reach for you: add a 'when to use this' section to your llms.txt (or a dedicated agent-instructions file) that names your best-fit use cases and how an agent should call you. Be specific about the jobs you are right for - generic marketing copy does not read as guidance.
- `metadata-completeness` - Add all four signals to your homepage: <link rel="canonical">, <html lang="...">, <meta property="og:image">, and <meta property="og:type">. Agents use these for entity resolution and attribution.
- `trust-anchors` - Publish real /about, /contact, and /privacy pages with at least 500 characters of content each. These are the pages AI agents check to verify your business is legitimate before recommending you.
- `openapi-spec` - Publish an OpenAPI (Swagger) specification at /openapi.json or /api/openapi.yaml. This is how agents understand your API surface automatically.
- `api-catalog-rfc9727` - Publish an API catalog at /.well-known/api-catalog per RFC 9727. Serve it with Content-Type: application/linkset+json;profile="https://www.rfc-editor.org/info/rfc9727" and include a 'linkset' array with item entries pointing to your OpenAPI specs and service descriptions.

**Recommended:**

- `a2a-agent-card` - Publish an Agent-to-Agent (A2A) agent card at /.well-known/agent-card.json describing your agent's capabilities, skills, and contact endpoint.
- `mcp-well-known-discovery` - List each MCP server's card, hosted on your own domain, in /.well-known/ai-catalog.json, the document MCP clients fetch for discovery (ARD crawlers read the same catalog at /.well-known/ard.json), and serve the card at <server URL>/server-card, or name the server URL in llms.txt, so agents can find the server without anyone typing its URL in.
- `sitemap-lastmod` - Add <lastmod> dates (W3C datetime, e.g. 2026-08-01) to your sitemap entries and update them when content actually changes. Aim for lastmod on at least half your entries with the newest within the last year. Verify with `curl https://yourdomain.com/sitemap.xml | grep lastmod`.
- `llms-txt-formatting` - Format your llms.txt as a navigation index: start with a markdown heading, include markdown links to deeper resources, and keep it under 30,000 characters. If you have more to say, move long-form content into /llms-full.txt or per-section files (e.g. /docs/llms.txt, /api/llms.txt) and link to them from the main index.
- `json-ld-entity-linking` - Add sameAs links in your JSON-LD structured data pointing to your Wikipedia page, Wikidata entry, GitHub org, and social profiles. This helps AI disambiguate your brand from similarly named entities.
- `org-schema-completeness` - Add Organization JSON-LD that includes both contactPoint (with email/phone and contactType) and address (PostalAddress). This lets AI verify your business legitimacy and answer contact queries.
- `schema-type-breadth` - Expand your JSON-LD beyond Organization/WebSite with more schema.org types that match what your homepage shows. Only add a type where the page shows that content.
- `llms-txt-links-resolve` - Make every link your llms.txt declares resolve to real content. Verify each one with `curl -L <url>` - you should see the linked document, not your homepage. If your app returns the homepage shell for unknown paths (common with single-page apps), a 200 status is not proof: check the body. Fix or remove any dead link; agents that follow the index treat a broken link as a dead end.
- `redirect-hygiene` - Replace meta-refresh and JavaScript-only redirects with real HTTP 301/302 redirects. Non-JS agents never execute `location.href` or wait for a meta refresh - they see only the stub page. Verify with `curl -sI <url>` - you should see a Location header, not a 200 with a near-empty body.
- `page-token-budget` - Keep each page's extracted text under ~100K characters (~25K tokens) so it fits an agent's context window without truncation. Split oversized reference pages into focused per-topic documents and link them from an index. Check a page with `curl -s <url> | wc -c` and remember agents read the extracted text, not the raw HTML.
- `docs-auth-gate` - Serve your content pages without a login wall. Agents cannot complete auth flows while browsing - a 401/403 or a login-form page is invisible content. Keep public documentation public; if some content must stay gated, publish an ungated summary so agents can still represent it.
- `developer-portal` - Create a developer portal at /developers with API keys, documentation, quickstart guides, and a sandbox environment.
- `markdown-negotiation-vary` - Enable Markdown negotiation on the scanned homepage. Supporting it only on /docs or a separate .md URL does not satisfy this check. Requests with Accept: text/markdown must receive a nonempty Markdown body with Content-Type: text/markdown and Vary: Accept. Keep serving HTML for Accept: text/html. Adding Vary alone does not create a Markdown response. Verify both with `curl -sS -L -i -H 'Accept: text/markdown' https://yourdomain.com/` and `curl -sS -L -i -H 'Accept: text/html' https://yourdomain.com/`. Check the final response headers and body: Markdown with Vary: Accept for the first request, HTML for the second.
- `agent-crawler-reachability` - Let ChatGPT-User, OAI-SearchBot, Claude-User, PerplexityBot reach your homepage through your WAF, bot rules, and robots.txt.

**Emerging (excluded from the score):**

- `agent-skills-index-v2` - Upgrade /.well-known/agent-skills/index.json to the v0.2.0 schema: add "$schema": "https://schemas.agentskills.io/discovery/0.2.0/schema.json", and give every entry a type (skill-md or archive), url, and digest. Use "digest": "sha256:<64 lowercase hex chars>" (e.g. "digest": "sha256:a3f1...") - a bare "sha256": "<hex>" field is also accepted. Compute the value from the artifact's raw bytes. For archives, hash the ZIP or tar.gz download itself; a separate skill-md entry is not required.
- `skills-sh-listed` - Publish agent skills on skills.sh so AI agents can discover your product's capabilities. Create a SKILL.md in your GitHub repo and register it with 'npx skills add'. See skills.sh/docs.
- `pricing-md` - Create a /pricing.md file with your pricing tiers, features, and limits in plain markdown. This lets AI agents compare costs and recommend plans without scraping HTML pricing pages.
- `nlweb-schema-feeds` - Add a schemamap: directive to robots.txt pointing to a Schema Map XML file listing your structured data feeds (JSONL/RSS). See the NLWeb Schema Feeds spec.
- `agent-mode-view` - Add a ?mode=agent query parameter to your homepage that returns a structured, machine-readable view with API endpoints, authentication info, and key capabilities instead of marketing HTML.
- `markdown-url-fallback` - Let agents fetch markdown by appending .md to page URLs. Required for any credit: serve a markdown homepage at /index.md. For full credit (2/2): also serve a .md twin for each content page (e.g. /docs/auth -> /docs/auth.md). Content-Type should be text/markdown and the body should start with a top-level heading (not HTML).
- `modular-llms-txt` - Add an llms.txt file for each main section of your site (for example /docs/llms.txt or /blog/llms.txt) and link each one from your root llms.txt, so an agent working in one area can fetch a focused index instead of the whole site.
- `skills-sh-quality` - Expand your skills.sh presence with multiple skill repos covering different use cases. Add descriptive skill names, clear SKILL.md files, and organize by capability area.
- `markdown-link-alternate` - Advertise a markdown twin of each page with <link rel="alternate" type="text/markdown" href="..."> in the HTML head (or an equivalent Link response header), and make sure the advertised URL actually serves markdown - an advertisement pointing at HTML is worse than none. Verify the target with `curl -s <href>` and check the body starts with a heading, not <!doctype html>.
- `markdown-frontmatter` - Open your served markdown docs with a --- frontmatter block carrying title plus at least one of description, canonical, or last-updated. Agents read frontmatter as document metadata without scraping. A Link: rel="canonical" response header also satisfies the canonical slot.
- `code-fence-validity` - Close every fenced code block (``` or ~~~) in your served markdown. CommonMark treats everything after an unclosed fence as code, so an agent parsing the document silently loses the rest of it. Count fence lines per file - the total must be even.
- `markdown-negotiation` - Pick one: (a) return Content-Type: text/markdown on GET <homepage> when the request sends Accept: text/markdown, or (b) publish a static /llms.md, /auth.md, or /agents.md file at your root with real markdown content. Option (b) is usually a single static file. This is the cold-discovery path for agents that land at your homepage from web search without reading llms.txt first.
- `agent-ua-markdown` - Optionally detect AI-bot User-Agents (GPTBot, ClaudeBot, PerplexityBot) server-side and serve them a markdown representation of the page directly, even when they send Accept: text/html. Verify with `curl -A "ClaudeBot/1.0" https://yourdomain.com/` - a markdown body earns this bonus. Accept-header negotiation is scored separately.

### Usability (40 pts) - Can agents use you?

**Required baseline:**

- `public-api` - Expose a public REST or GraphQL API. AI agents need programmatic access  - not just a web UI  - to integrate with your product.
- `oauth-support` - Implement OAuth 2.0 for API authentication. Publish your authorization server metadata at /.well-known/oauth-authorization-server.
- `oauth-protected-resource` - Publish RFC 9728 protected-resource metadata at /.well-known/oauth-protected-resource. Include the resource field plus enough supporting metadata - your authorization servers, supported scopes, accepted bearer methods - that an agent can work out how to authenticate without first triggering a 401.
- `auth-md-exists` - Publish /auth.md as a markdown prose walkthrough of how agents should obtain credentials. Serve it with Content-Type: text/markdown, lead with a top-level heading, and write at least ~200 chars of real content (not just a placeholder). See the WorkOS auth.md spec at https://github.com/workos/auth.md.
- `mcp-server` - Build an MCP (Model Context Protocol) server exposing your API as tools. Use Streamable HTTP transport for full score. This lets Claude, ChatGPT, and other AI agents call your product natively.
- `webmcp` - Expose in-page tools through WebMCP, a proposed web standard for browser agents. Register tools with document.modelContext.registerTool() and use navigator.modelContext only as a trailing compatibility fallback. Declarative toolname forms do not count: the WebMCP specification does not define them, so register the same actions with registerTool(). Chrome's origin trial covers versions 149-156, with shipping currently targeted for 157. ChatGPT can discover and call WebMCP site tools in the desktop app's built-in browser when the feature is available.
- `json-error-responses` - Return structured JSON error responses with error codes, messages, and resolution hints. Agents can't parse HTML error pages.

**Recommended:**

- `mcp-tool-descriptions` - Add detailed descriptions (>= 20 chars) to every MCP tool. Agents use these to decide which tool to call - vague descriptions lead to wrong tool selection.
- `mcp-param-schemas` - Define inputSchema with typed properties and required arrays for each tool. Agents need schema info to construct valid tool calls without guessing.
- `mcp-server-identity` - Set server name, version, and instructions in your MCP server's initialize response. Instructions help agents understand your server's purpose and constraints.
- `mcp-tool-listing` - Expose your tools via your MCP server's tools/list endpoint. A product MCP server scores on breadth: 3 or more tools that cover read, write, and search. A docs MCP server scores on focus: 3 tools or fewer, such as one search tool and one fetch tool. Keep every outputSchema valid and self-contained: a $ref that points outside the schema, such as #/components/schemas/... copied from an OpenAPI file, makes clients built on the official TypeScript SDK 1.x reject your whole tool list.
- `mcp-tool-naming` - Use consistent naming conventions (snake_case or camelCase) for all MCP tools. Names should be descriptive (>= 4 chars) and not generic (avoid 'run', 'get', 'do').
- `scoped-permissions` - Declare scoped API permissions where machines can read them: named OAuth scopes in your OpenAPI security schemes, or scopes_supported in RFC 9728 protected-resource metadata. Prose descriptions of roles help humans, but agents need the machine-readable declaration to request least-privilege access.
- `mcp-auth-mechanism` - Protect your MCP server with OAuth 2.0 authentication. Publish authorization server metadata at /.well-known/oauth-authorization-server for automatic agent auth flows.
- `mcp-oauth-metadata` - Publish RFC 8414 authorization server metadata with issuer, authorization_endpoint, and token_endpoint so agents can authenticate without hardcoded URLs. For client registration, advertise client_id_metadata_document_supported (CIMD) - Dynamic Client Registration is deprecated and worth keeping only as a compatibility path.
- `mcp-pkce-s256` - Support PKCE with S256 code challenge method in your OAuth server. Add 'S256' to code_challenge_methods_supported in your authorization server metadata.
- `onboarding-friction` - Offer a free tier or trial, self-serve API key generation, and a sandbox environment. Agents can't fill out 'contact sales' forms.
- `auth-md-structure` - Structure /auth.md as the WorkOS spec prescribes: sections for Discover, Pick a method, Register, Claim, Exchange, Use the access_token, Errors, and Revocation, with spec anchor keywords (agent_auth, identity_endpoint, identity_assertion, service_auth, id-jag, WWW-Authenticate). Reference https://github.com/workos/auth.md.
- `auth-md-walkthrough-simulation` - Make your published auth-discovery chain traversable end to end: an agent starting at /auth.md (or your protected-resource metadata) should be able to follow the links to your authorization-server metadata and registration endpoint without hitting a dead link. Test the whole path, not just each file in isolation.
- `agent-auth-discovery-metadata` - Publish RFC 9728 protected-resource metadata at /.well-known/oauth-protected-resource on your resource server (the host that actually serves the API, e.g. api.<apex>) with `resource` and `authorization_servers`. Publish RFC 8414 authorization-server metadata at /.well-known/oauth-authorization-server on the AS origin, and include the WorkOS auth.md `agent_auth` block with `identity_endpoint`, `identity_types_supported` drawn from the spec enum (`anonymous`, `identity_assertion`, `service_auth` - the assertion variant, the ID-JAG URN `urn:ietf:params:oauth:token-type:id-jag`, belongs inside `identity_assertion.assertion_types_supported`, not at the top level), and the `identity_assertion.assertion_types_supported` block when you advertise that type, so agents can check their assertion shape is accepted before minting. Cross-link by listing the AS origin in PRM `authorization_servers`, and point `agent_auth.skill` back at your published /auth.md. Spec: https://github.com/workos/auth.md.
- `agent-auth-www-authenticate` - Return a 401 carrying a spec-shaped `WWW-Authenticate: Bearer resource_metadata="<your protected-resource metadata URL>"` header on your API's primary entry points, so an agent learns your auth requirements from one request instead of hunting for the well-known document. Point the metadata URL at /.well-known/oauth-protected-resource on the host that serves the API. Spec: https://github.com/workos/auth.md.
- `agent-auth-endpoints-reachable` - Make sure the URIs you advertise (in the AS metadata agent_auth block OR in your /auth.md prose) for identity_endpoint, claim_endpoint, and events_endpoint actually resolve. An OPTIONS preflight should return any HTTP status (2xx/3xx/4xx that isn't 404). DNS-level failure or a 404 means the discovery block / prose is stale - either remove the URI or stand up the endpoint.
- `mcp-error-handling` - Return structured JSON-RPC errors (with code and message) when agents call invalid tools or pass bad arguments. Don't crash or return empty responses.
- `mcp-transport-modern` - Upgrade your MCP server from legacy SSE to Streamable HTTP transport. HTTP+SSE is formally deprecated with a year-long offramp; Streamable HTTP is the current standard and supports bidirectional communication.
- `rate-limit-headers` - Return standard rate-limit headers on your API responses (the RFC RateLimit headers, plus Retry-After on a 429) so agents can self-throttle in real time, and document the conventions alongside your API.
- `idempotency-key-support` - Support an idempotency key on your write operations and declare it where agents can read it: an Idempotency-Key header parameter on your POST/PUT/PATCH operations in your OpenAPI spec for REST, or a client-supplied id argument on your GraphQL mutations. Agents retry on network failures, and without this a retry can double-charge or duplicate a record.
- `api-error-model` - Document your error responses in your OpenAPI spec: give 4xx and 5xx responses a typed error schema (or use RFC 9457 application/problem+json). A consistent error object with a machine-readable code and a human-readable message lets agents handle failures without guessing.
- `api-versioning-policy` - Declare a versioning policy agents can rely on: version your API (in the URL path or a version header) and publish how you signal deprecation (a Sunset/Deprecation header or a documented timeline). Agents avoid integrating against a surface that can change without warning.
- `pagination-shape` - Use a consistent, documented pagination shape on your list endpoints (cursor-based preferred) and define the pagination fields in your OpenAPI response schemas, so agents can page through results without guessing the shape.
- `async-job-pattern` - For long-running operations, return 202 Accepted and point agents at where to poll for the result (a status/location reference plus a job identifier in the body), documented in your OpenAPI spec, so work that does not finish in one request is still followable.
- `cli-tool` - Publish an official CLI tool on npm, PyPI, or Homebrew. A CLI lets agents and developers script interactions with your product without building API integrations from scratch.
- `rest-sdk-packages` - Publish official SDK packages across multiple language ecosystems (npm, PyPI, Go modules, RubyGems). Auto-generate them from your OpenAPI spec using tools like openapi-generator. For each package set the project URL or homepage to your product domain (package.json `repository`/`homepage`, PyPI `Home-Page` or `project_urls`, RubyGems `homepage_uri`) - this is how agents verify the package is your official SDK.
- `response-schema-coverage` - Define typed JSON response schemas for every endpoint in your OpenAPI spec. Agents rely on these to know what fields they will get back; missing or partial schemas force trial-and-error.
- `mcp-tool-annotations` - Add behavioral annotations (readOnlyHint, destructiveHint) to your MCP tools. Agents use these to avoid destructive actions without user confirmation.
- `mcp-server-card` - Publish a server card for each MCP server (draft MCP server-card extension). List each card in /.well-known/ai-catalog.json, or serve it at <server URL>/server-card. /.well-known/mcp/server-card.json is still read for a site with one server, but the extension does not recommend it. Include name, description, and version, and put the server's exact address in remotes[].url (serverUrl is also read) so agents match each card to the right server before connecting. Follow the extension schema for full credit: $schema set to https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json, a reverse-DNS name such as com.example/mcp, and no tools[] (agents always trust the live tools/list). Keep the description to 100 characters or fewer, as the schema requires. A card without that $schema is still read, and then an optional tools[] list completes it.
- `mcp-multi-surface-coverage` - Beyond your product MCP server, expose a documentation MCP surface so agents can pull your docs and reference material over the same protocol they use to act. Covering both the 'do' and the 'learn' surfaces over MCP earns this.
- `sandbox-environment` - Provide a sandbox or test mode so agents can exercise your API without touching production data, and document how to reach it - this lowers the risk of a destructive call against live data.
- `batch-endpoints` - Offer a batch endpoint that accepts an array of operations in one request, documented in your spec, so an agent acting on many items can do it in bulk instead of looping one call at a time.
- `mcp-resource-listing` - If your MCP server advertises the resources capability in its initialize handshake, make sure resources/list returns at least one resource. If you don't intend to expose resources, omit the capability - the check returns na with no penalty for tool-only servers. Quality of the resources you do return is scored separately by mcp-resource-quality.
- `graphql-error-type-definition` - Model your GraphQL errors in the schema: define an error type and surface it through your mutation payloads (or a result union) instead of relying only on the top-level errors array, so agents can handle failures by type.
- `graphql-versioning-policy` - Adopt a GraphQL evolution policy: mark retiring fields with @deprecated (with a reason) and document how you sunset schema elements. @deprecated is the standard signal agents read.
- `graphql-pagination-pattern` - Paginate GraphQL lists with the standard Relay connection pattern (Connection and PageInfo types with cursors), a shape agents recognize and can traverse without custom handling.
- `graphql-async-job-pattern` - For long-running GraphQL work, model it as an async job: return a job/task type the agent can query for status, and consider a subscription for progress, so a mutation does not block on slow work.
- `graphql-schema-completeness` - Document your GraphQL schema thoroughly - descriptions on your types, fields, and arguments - so agents can decide how to call your API from the schema alone.
- `graphql-batch-mutations` - Offer batch or bulk mutations (a mutation that accepts many inputs at once) so agents can apply changes to many records in a single round trip instead of one mutation per item.
- `agent-friendly-404` - This check awards partial credit for a real HTTP 404/410 status and full credit when a Markdown error body is also available. If the status is already correct, keep it and add the Markdown body. Include at least 20 characters explaining the error and point agents to your docs, sitemap, or llms.txt. Verify with `curl -sS -L -i -H 'Accept: text/markdown' https://yourdomain.com/some-path-that-does-not-exist`. Check both the final 404/410 status and the Markdown body, served with Content-Type: text/markdown. A correct status with an HTML error page still earns only partial credit.
- `mcp-app-registry` - Add MCP Apps support to your MCP server using @modelcontextprotocol/ext-apps. Expose ui:// resources and add _meta.ui.resourceUri to tools so agents can render interactive UIs directly in conversation.
- `mcp-apps-ui-quality` - Ensure your MCP Apps resources use MIME type text/html;profile=mcp-app, include <!DOCTYPE html>, and add <meta name="color-scheme" content="light dark"> for dark mode. Never hardcode secrets in resource HTML.
- `mcp-view-domain` - Make sure your MCP App view is reachable and public. For inline ui:// resources: return HTML with <!DOCTYPE html> and no login form. For external HTTP origins (referenced via <base href> or <meta refresh>): return 200 OK + text/html without requiring auth (no 401/403, no password input in the body).
- `mcp-view-csp` - Declare your view's CSP in _meta.ui.csp on the ui:// resource's resources/read content item, using the camelCase origin lists: connectDomains (fetch and WebSocket targets), resourceDomains (scripts, styles, images, fonts, media), frameDomains (nested iframes), and baseUriDomains. List specific origins such as https://api.example.com or https://*.example.com, never * or a bare scheme like https:. If the view makes no network calls and loads no external assets, leave csp out and hosts apply their restrictive default. Hosts build the iframe's CSP from this declaration, so a CSP in the view's own HTML does not replace it, and browsers ignore frame-ancestors in a <meta> tag.
- `api-schema-analysis` - Make your API spec self-describing: a unique operationId and a description on every operation, typed parameters, and response schemas. For GraphQL, a fully typed schema with a documented cost or rate limit reads best.
- `function-calling-compat` - Ensure API endpoints have unique operation IDs, typed schemas, and descriptions compatible with LLM function-calling formats.
- `mcp-resource-quality` - Ensure every resource returned by resources/list reads cleanly via resources/read: declare a valid mimeType, return non-empty content, and make sure any URIs in the content resolve. Broken or empty resources break agent UX silently.

**Emerging (excluded from the score):**

- `web-bot-auth-directory` - Publish a Web Bot Auth directory at /.well-known/http-message-signatures-directory. Serve a JSON document with a 'keys' array of Ed25519 JWKs (kty=OKP, crv=Ed25519, kid, nbf, exp). This lets agents sign their requests per RFC 9421 so you can distinguish legitimate bots from spoofers.
- `pap-discovery` - Publish a Personal Agent Protocol discovery file at /.well-known/poppy.json on the exact host agents request, served over HTTPS as a JSON object. Set protocol_version to "0.2" (the current draft, still in progress), set organization.domain to the host that serves the file (after any redirect, with www. if that host has it), describe at least one interface (agent, apis, or web), and name your OAuth issuer in auth.issuer whenever you list agent or apis entries, a feedback endpoint, or a web.browser_session_endpoint. Every URL in the file must be https://. Spec: https://personalagentprotocol.org/docs/spec
- `pap-issuer-binding` - Serve RFC 8414 authorization-server metadata for the issuer named in poppy.json at /.well-known/oauth-authorization-server (inserted before the issuer's path when it has one). The metadata `issuer` must match auth.issuer exactly, `poppy_domains` must list this domain, and it must advertise token_endpoint and revocation_endpoint, plus authorization_endpoint when you offer direct sign-in and device_authorization_endpoint when you offer device sign-in. If you list dpop_signing_alg_values_supported, include ES256. Give every domain whose poppy.json names this issuer the same auth block. Send cache headers, and list only S256 in code_challenge_methods_supported. Spec: https://personalagentprotocol.org/docs/spec
- `pap-auth-config` - Request only scopes PAP defines: poppy:read, poppy:write, and the keys you declare in auth.custom_scopes (custom scope names must not start with poppy:). Give mediated sign-in an https:// endpoint, its fields (each with name, label, and secret), and its scopes, name protocol extensions such as operations by their plain name and your own extensions with a prefix from your domain, give each one a version, and advertise the operations extension at version 1 with an https:// endpoint. Spec: https://personalagentprotocol.org/docs/spec
- `pap-interfaces` - Complete every interface entry in poppy.json: each agent.protocols entry needs a type and an https:// endpoint, and each apis entry needs a type (openapi or mcp), a url, and a description. Point OpenAPI entries at a document that parses as OpenAPI 3.0 or 3.1, and have each MCP server publish RFC 9728 protected-resource metadata whose authorization_servers includes your auth.issuer (and, if it lists dpop_signing_alg_values_supported, ES256). Spec: https://personalagentprotocol.org/docs/spec
- `pap-endpoint-enforcement` - Reject unauthenticated agents in the shape PAP defines. Your token endpoint should answer a session request (the RFC 7523 JWT grant) it cannot verify with one of the codes the spec lists: invalid_client (401), invalid_grant (400), or invalid_dpop_proof (400) when the DPoP proof is missing. The conversation endpoint should return 401 with a `WWW-Authenticate: DPoP` challenge when no token is sent, and an MCP server that needs a token should answer a request without one with 401 and `WWW-Authenticate: Bearer resource_metadata="<your /.well-known/oauth-protected-resource URL>"`, plus a DPoP challenge with the same resource_metadata when the server supports DPoP. The browser_session_endpoint should answer an invalid assertion with 400 and set no cookie, the operations endpoint should return 401 without a token, and a feedback endpoint should refuse a report sent with no token with 401 and a `WWW-Authenticate: DPoP` challenge. Answer the token, API, conversation, feedback and operations endpoints at the address you publish, without redirects, and require a DPoP proof with every token endpoint request and every request that carries a Session Token. The exception is an MCP server that does not support DPoP: requesting its Bearer token, and using it, needs no proof. Revocation and device authorization requests are neither, so they need no proof. Spec: https://personalagentprotocol.org/docs/spec
- `pap-cross-protocol` - Keep poppy.json consistent with your other agent surfaces: list the same MCP server and organization as your ARD catalog (/.well-known/ard.json), name the same OAuth issuer that your protected-resource metadata lists in authorization_servers, and, when one issuer serves both PAP and auth.md, list every grant both protocols send to its token endpoint in grant_types_supported. Publish a poppy.json naming the same issuer on every domain listed in poppy_domains, and point every 401 at the same resource_metadata URL. Spec: https://personalagentprotocol.org/docs/spec
- `nlweb-ask` - Implement the NLWeb protocol (v0.55) with a POST /ask endpoint that accepts a JSON body with the question in query.text and returns JSON with _meta (response_type, version) plus a results array, or a failure with an error code. See github.com/nlweb-ai/website/blob/main/NLWEBSPEC.md.
- `nlweb-streaming` - Add SSE streaming to your NLWeb /ask endpoint. Accept prefer.streaming: true and respond with Content-Type: text/event-stream using the NLWeb v0.55 events (start, result, error, complete).
- `a2ui-support` - Support Agent-to-UI rendering via MCP Apps (ui:// resources), OpenAI Apps SDK, or generative UI patterns that let agents render interactive UIs in conversation.

### Payments (10 pts) - Can agents pay you?

**Required baseline:**

- `mpp-support` - Implement the Machine Payments Protocol so agents can pay for premium resources over HTTP 402. Return a complete WWW-Authenticate: Payment challenge - the full set of standard MPP parameters, not just the bare scheme - and advertise x-payment-info in your OpenAPI spec so agents can discover it.
- `x402-support` - Implement x402 payment protocol so AI agents can pay for API access via HTTP 402. x402 uses PAYMENT-REQUIRED/PAYMENT-SIGNATURE/PAYMENT-RESPONSE headers with Base64-encoded JSON. Add a /discovery/resources endpoint for agent discovery.
- `ucp-support` - Publish a UCP discovery profile at /.well-known/ucp with a required `version` (YYYY-MM-DD) and advertised `services`/`capabilities` per ucp.dev. Also expose the REST checkout surface (`POST /checkout-sessions` with `UCP-Agent` and `Idempotency-Key` headers) so agents can transact without per-vendor integrations.
- `acp-support` - Implement the Agentic Commerce Protocol checkout REST API: `POST /checkout_sessions` (create), update/get/complete/cancel variants, with `API-Version: YYYY-MM-DD` and `Idempotency-Key` required headers. Preflight OPTIONS should allow POST or return an ACP-shaped error with `supported_versions` so agents can negotiate.

**Recommended:**

- `acp-delegate-payment` - Expose the ACP Delegate Payment endpoint at `POST /agentic_commerce/delegate_payment`. The request takes `payment_method`, `allowance` (max amount, currency, expiry, merchant scope), and `risk_signals`; the response returns a vault token. This lets agents pay on behalf of users with scoped, revocable credentials.
- `ap2-support` - Adopt Google's AP2 (Agent Payments Protocol) authorization layer: advertise an AP2 mandate capability (e.g. `dev.ucp.shopping.ap2_mandate`) in your UCP discovery profile, and verify the three signed mandates (Intent, Cart, Payment - SD-JWT verifiable digital credentials) server-side before routing to a settlement rail. Note: one agentic payment protocol is sufficient - AP2 is only needed if you are not already covered by x402 / MPP / ACP / UCP.
<!-- generated:playbook:end -->

## Step 5 - Re-audit and gate

After each fix batch, re-audit (`--force` if you just deployed the fix) and
compare against the previous JSON. Report progress as:

```
## Ora score: {score}/100 (grade {grade})  [was {prev}/100, {prev_grade}]
Fixed since last audit: {check ids}
Still failing (in scope): {check ids}
Next up: {topFixes[0].id} - {one-line plan}
```

When the target is reached, pin it in CI so it never regresses:

```yaml
- name: Agent-readiness gate
  run: npx ax@0.7 audit https://<your-site> --min-score 70
```

Exit codes: 0 pass, 1 below threshold, 2 usage error, 3 API error. The
cached-result default keeps a per-push gate well inside the daily budget.
Full report anytime at `https://ora.ai/{domain}`.

## Step 6 - Agent feedback (optional)

Read what other agents experienced with any product/domain:

```bash
curl -s https://ora.ai/api/feedback/{domain}
```

Submitting first-person feedback requires agent verification (HATCHA) and is
only available through Ora's own MCP server at `https://ora.ai/api/mcp`
(`get_verification_challenge` then `submit_feedback`) - use it if that
server is connected; otherwise skip.
