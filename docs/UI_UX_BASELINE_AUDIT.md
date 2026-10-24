# Stryde UI/UX Baseline Audit

**Date:** 2026-10-22  
**Status:** Partial baseline; reference and authenticated workspace gates remain blocked  
**Scope:** Actual local production-build server, unauthenticated landing/intake route, source-level workspace review  
**Branch/HEAD:** `fix/conversation-turn-reliability` / `273847c`  
**Target:** Local application only; no production deployment or data mutation

## 1. What was actually inspected

### Runtime and repository
- A local Next.js production-build server was started on `http://localhost:3101` using the existing `.next/BUILD_ID` (timestamp 2026-10-22 09:22 local time).
- This was the currently available local build, not a production deployment; the output path and date are recorded so later audits do not confuse the screenshot with the final redesigned branch.
- Main worktree remained on `fix/conversation-turn-reliability`, HEAD `273847c`.
- Separate worktree `stryde-exec-repair` remained on `codex/controlled-execution-repair`, HEAD `e56425c`; untouched.
- No application TSX/CSS code was edited during this audit. Design process docs/rules and snapshots were added/updated. Current tree contains the pre-existing untracked `docs/REDESIGN_STRATEGY.md` and `docs/UX_RESEARCH.md`, plus the new process documents and a modified historical Stitch brief.
- An earlier dev log records a Turbopack panic resolving `stryde\nul`; the audit used an existing production build and a distinct port instead of the dev server.

### Browser routes/states
| Route/state | Result | Evidence |
|---|---|---|
| `/` unauthenticated, desktop 1440×900 | Loaded; page title “Stryde”; visible headline, three explanatory statements and sign-in/create-account form | `.design-lab/baseline-landing-1440.png` |
| `/` unauthenticated, mobile 390×844 | Loaded, no horizontal overflow; total document height 986px. Form bottom at y=922, so the bottom portion requires scroll | `.design-lab/baseline-landing-390.png` |
| Empty “Create account” submission | Client validation displayed “Enter your email address.”; no values entered and no signup request was triggered by this test | Dedicated browser session `stryde-baseline-audit` |
| Automated accessibility scan on `/`, desktop and mobile | One serious color-contrast violation in both sizes, selector `.text-xs`; zero other automated violations reported in this route/state | agent-browser axe-core 4.12.1; 35 passes, 1 violation |
| `/pursuits/[id]` with a fresh unauthenticated browser session | Redirected to `/`; authenticated workspace cannot be viewed in this session | Local browser route test |
| Console/runtime errors after tested landing states | No errors printed by agent-browser during this limited run | agent-browser console/errors |

The workspace source was read, but it was **not** empirically inspected in an authenticated browser. Findings inferred from the source are labelled accordingly.

## 2. Findings

| ID / category | Evidence | Impact | Recommended correction | Priority / confidence |
|---|---|---|---|---|
| **A8 — Low contrast** | Automated axe identified `.text-xs`; source maps the Stryde eyebrow label to `text-xs ... text-zinc-400` on a near-white surface | Brand label is too faint for required contrast. The issue is concrete even though it is a small element | Choose a darker semantic secondary text token, verify contrast in rendered state, then validate all variants rather than patching only this class | **High** for accessibility / High confidence |
| **B6 / B5 — Repeated cards and composition (candidate)** | Landing route uses three identically composed rounded/bordered rows for “Say the goal,” “Stryde works it,” and “Reality, verified” | Adds repeated surfaces before the user can interact with the actual product. This may be unnecessary UI chrome; whether it is wrong requires reference/design-direction comparison | Test a product-specific composition that makes the actual pursuit input and product behavior the evidence. Don't remove them merely to avoid “three cards”; first confirm what new users need to know | **Medium hypothesis** / Medium confidence |
| **E5 / trust claim — Verification promise may overstate current capability** | Landing copy says “Reality, verified” and “Stryde checks outcomes itself.” Product documents emphasize that mechanical execution success, reported outcomes and verified outcomes are distinct; real-world verification can remain unknown | If the UI reads as a blanket guarantee, a user may overestimate which outcomes Stryde can independently observe. This needs reconciliation against live capability, not just copy taste | Qualify the promise to match the actual supported flows. Keep “reported,” “observed,” and “verified” distinct, and describe capability boundaries when direct observation is unavailable | **High if not supported** / Medium confidence pending full runtime validation |
| **Responsive fold — secondary account path below fold** | At 390×844, landing document height is 986px; form bottom is y=922. Screenshot shows the main sign-in button near the viewport bottom and the create-account path below it | First-time account creation is not visible immediately on small screens. Not a blocked task—the page scrolls—but a discovery/accessibility cost | Rebalance above-the-fold content and account controls after approved art direction; test keyboard, zoom and narrow widths | **Medium** / High confidence |
| **Workspace mobile navigation — must verify** | Source shows the pursuit sidebar as `hidden ... lg:flex`; unauthenticated route prevents a direct browser test of the workspace. Source excerpt does not show an obvious corresponding mobile pursuit switcher near the header | Users on small screens may lack equivalent pursuit navigation; the claim needs complete source/runtime confirmation before it is called a defect | During authenticated browser pass, test selecting another pursuit, creating a pursuit, and returning to the pursuit list at 390px and 768px. If no compact switcher exists, design one around the current pursuit rather than shrinking the desktop sidebar | **High-priority hypothesis** / Medium confidence |
| **Workspace response formatting — verify** | Source at `app/pursuits/[id]/page.tsx` renders assistant content in a `whitespace-pre-wrap` div; the baseline UX research claims Markdown structure is not interpreted | Multi-step guidance/code/checklists may be less scannable than the product needs | Confirm actual data/rendering behavior, then use semantically safe Markdown rendering if supported and test lists, headings, links and code. Avoid blindly adding citations to turns: current UX research says turn-level citation anchors aren't part of the SSE payload | **Medium** / High confidence for source rendering; behavior tests pending |
| **Loading/error/empty states — polish gap to inspect** | Source has a plain “Loading…” return for the pursuit route and “Not found” fallback; actual workspace states could not be reached via this fresh unauthenticated session | The initial state may be visually disconnected from the eventual workspace; recovery behavior needs a rendered test, not assumption | Capture loading, no pursuit, expired session, provider failure and network retry states in the real app. Keep typed input on recoverable failures | **Medium** / High confidence for source-level loading implementation |
| **Art direction not finalized** | Previous .design-lab directions 01–04 were rejected by the product owner | A new palette or smaller cards would not solve the underlying missing art direction | Treat the supplied Instagram reference as blocked until an exact URL/media is available. Have Argon 4 create a product-specific brief with competing directions, then a tested preview for approval; only then implement in Gemini 3.8 Flash | **Gate** / Certain |

## 3. Product constraints that must remain intact

The code and product documents establish the following constraints for design work:
- Universal natural-language composer; don't force users to select internal research/action/mode concepts.
- Keep pursuit history/state separate while preserving a coherent assistant across pursuits.
- Clear status boundaries: proposed, started, queued/waiting, in progress, blocked, failed, user-reported, observed, verified.
- A queued worker is not necessarily running; keep manual completion/blocker fallback for controlled actions.
- Preserve authentication, multi-tenancy, SSE streaming, API payloads, persistence, evidence/source lineage, memory controls, artifact revisions and action lifecycle.
- Do not introduce API/schema/DB changes solely to make the visual redesign easier.

## 4. Anti-pattern test, applied to what was observed

- **Substitution test:** The unauthenticated landing's three promise rows and central form could be transplanted to many generic AI products with little change. A product-specific solution should demonstrate Stryde's real input-to-action-to-observation loop, not only describe it. This is a design risk, not proof of AI authorship.
- **Decoration-off test:** Removing borders and rounded rectangles would expose the repeated copy structure; the real interaction—the user communicating an outcome—must form the composition's focal point. More evidence is needed before deciding the replacement layout.
- **Second-screen/uncomfortable-state test:** The workspace could not be inspected because the fresh browser is unauthenticated. This gate is **not passed**. The old preview files do not substitute for the real workspace.

## 5. Not verified yet

- Complete in-page visual navigation through every original Instagram carousel slide. The exact original URL was inspected; its logged-out modal blocks the full carousel. An original post-linked SmoothUI slide was opened directly, and the cover/tool slide were inspected from a matching public repost. The full five-item list was cross-checked against the repost caption; slides 3–7 were not all visually verified in the original.
- Authenticated new-pursuit creation and a normal conversation turn.
- Streaming, network/provider failure, retry and composer input preservation in an authenticated browser.
- Start/delegate/report action, partial/blocker paths, and verified-vs-reported state transitions.
- Evidence/source surfaces, memory correction/forget and artifact revisions.
- Workspace/mobile pursuit switcher and full responsive behavior.
- Session expiry, keyboard-only traversal of the complete workspace, focus management in contextual surfaces.
- Typecheck/lint/build/E2E were not run as part of this visual baseline snapshot pass.
- Antigravity's workspace-scoped shadcn MCP configuration has been written. It must be checked in Antigravity's MCP panel after reloading the project; the CLI's `agy mcp list` currently lists global servers only and is not proof of workspace MCP activation.

## 6. Public alias and Ora audit (read-only, 2026-10-23)

- Browser inspection of `https://stryde-topaz.vercel.app/` showed the same Stryde sign-in/landing composition as the local production build. This confirms the public root screen matches the local screen in this check; it does **not** confirm the authenticated workspace or all deployment settings.
- Ran `npx --yes ax audit https://stryde-topaz.vercel.app --json` via Ora's published CLI. Ora reported **24/100, grade F**; discovery 3/11, access 10/54, usability 17/62. Scan timestamp: `2026-10-23T06:45:40.616Z`.
- Ora reports 307 characters of raw HTML content on the homepage, no sitemap, and no agent discovery files such as `/.well-known/ard.json` or `/.well-known/agent-skills/index.json`. It found agent-user-agent reachability, while describing the API as not publicly reachable or auth-gated and detecting no public MCP surface.
- **Interpretation boundary:** this is a public-site agent-readiness/discoverability scan, not a visual-design score, WCAG score, or authenticated-workspace usability test. Several suggested checks (public SDK/API, OAuth for external autonomous clients, MCP endpoint, catalog files) may not suit a private pursuit product. Do not expose private user data or unauthenticated APIs just to raise this generic score. Decide separately which public documentation, sitemap, and machine-readable discovery surfaces Stryde actually needs.
- Saved the full resource/tool interpretation and exact commands in `docs/UI_UX_RESOURCE_TOOLKIT.md`; reference analysis is in `docs/UI_UX_REFERENCE_ANALYSIS.md`.

## 7. Next steps

1. Supply the exact Instagram post URL (or upload screenshots/video frames if the post cannot be publicly viewed).
2. Run the Argon 4 read-only UX audit skill and reconcile its work against the source/rendered findings above.
3. Inspect the current authenticated workspace in an authorized session; update this audit with those observations instead of guessing.
4. Have Argon produce 2–3 genuinely different, product-specific art directions, then build a new isolated preview. Founder approval is required before touching UI code.
5. Implement in vertical slices with Gemini 3.8 Flash; use Argon for independent rendered review and the Stryde visual-QA skill for release verification.
