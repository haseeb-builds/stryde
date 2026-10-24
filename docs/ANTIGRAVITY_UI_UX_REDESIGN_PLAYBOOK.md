# Stryde UI/UX Redesign — Antigravity Playbook

**Purpose:** Take Stryde from its real existing UI through an evidence-based audit, reference analysis, approved art direction, an isolated preview, implementation, independent critique and a verified ship decision.

**Current status:** The anti-pattern catalog and Antigravity guidance are installed locally. The baseline audit, Instagram reference analysis, final art direction and application implementation are not complete. The previous .design-lab/01–04 prototypes are rejected visual directions.

## Operating contract

1. Argon 4 in Antigravity is the design strategist and independent judge. Gemini 3.8 Flash is the implementation model only after design approval. If a model isn't available in the active surface, do not claim another model performed the task.
2. No real app UI changes until the baseline audit, supplied-reference analysis, design brief and approved design contract exist.
3. The first visual deliverable after approval is an isolated high-fidelity preview using real Stryde content and states, not a generic standalone UI.
4. No production deployment, production DB modification or changes to stryde-exec-repair without explicit permission.
5. Never present a generated screenshot as a running app, a draft as saved, queued work as running, or a reported outcome as verified.

## Recommended skills

| Phase | Primary skill | Supporting skills | Why |
|---|---|---|---|
| Read-only baseline | /stryde-uiux-audit | explore-codebase, agent-browser | Current repository plus real rendered behavior |
| Reference analysis | /stryde-uiux-audit | agent-browser, web-design-guidelines | Inspect actual post and distinguish observation from interpretation |
| Art direction | design-taste-frontend | frontend-design, ui-ux-pro-max | Grounded direction and product-specific hierarchy; Pro Max is targeted UX/accessibility guidance, not the art director |
| Design tokens | design-system | ui-ux-pro-max | Tokenize only after direction approval |
| Implementation | frontend-design | tdd, current Next.js docs, React/Vercel best practices | Implement a fixed contract in small slices |
| Independent review | Argon 4 | design-taste-frontend, web-design-guidelines | Critique actual rendered output against reference and contract |
| Browser verification | /stryde-visual-qa | agent-browser, existing UI E2E tests | Prove states and routes, not just compilation |

These focused skills are already installed under the local Stryde workspace. Three Stryde-specific skills were added to that catalogue, and a repository quality rule was added at .agents/rules/ui-ux-quality-gate.md. Do not install a duplicate skill simply because the name looks useful. Do not use the Product Design plugin. Stitch is optional only if its MCP integration is demonstrably available and the user chooses it.

## Prompt 1 — Read-only audit (Argon 4)

Select Argon 4 in Antigravity's model selector and invoke /stryde-uiux-audit. This phase is READ-ONLY.

Act as Stryde's principal product designer, UX researcher and skeptical reviewer. Inspect the actual workspace, branch and worktree, current routes and real rendered product. Read the project instructions and relevant product, architecture, state, verification, runtime, integration and decision docs. Read docs/AI_WEBSITE_DESIGN_ANTI_PATTERNS.md. Reconcile docs/REDESIGN_STRATEGY.md and docs/STITCH_DESIGN_BRIEF.md with the 26 agreed decisions; regard them as historical hypotheses, not approved art direction.

Capture actual routes and reachable states through agent-browser using a private named session. Do not infer user behavior from code alone. Classify findings as FACT, DERIVED, HYPOTHESIS or UNKNOWN. For each, give specific route/component/screenshot evidence, user impact, severity and a concrete fix. Apply substitution, decoration-off and second-screen/uncomfortable-state tests.

The prior .design-lab/01–04 concepts are rejected. Do not copy them, improve their palette or use them as the baseline. Do not create a prototype or alter application code, CSS, tests, package files, DB schema, API contracts or environment files during this phase.

Produce docs/UI_UX_BASELINE_AUDIT.md with:
- verified branch, HEAD, worktrees and dirty/untracked inventory;
- implemented route/state map and component/data ownership;
- routes/states actually tested vs. untested;
- findings with evidence and anti-pattern IDs;
- trust, accessibility, responsive, long-content and failure gaps;
- invariants that must not regress;
- settled decisions, open decisions and prioritized acceptance tests.

Leave the application code exactly as found. Report what could not be verified.

## Prompt 2 — Analyze the actual Instagram reference (Argon 4)

Replace the placeholder below with the exact Instagram URL or attach screenshots/media:

PASTE_THE_EXACT_INSTAGRAM_POST_URL_HERE

Use Argon 4 and a real browser to inspect this exact reference. Open the rendered post and every accessible slide/frame, caption and relevant on-page context. Capture screenshots if possible. If it is private, blocked, login-gated, missing or only partly accessible, state exactly what was visible; do not guess unseen slides or claim you watched a video that did not load.

Write docs/UI_UX_REFERENCE_ANALYSIS.md including:
1. Exact URL, observed post type and access limitations.
2. Observable composition, focal point, hierarchy, spacing/density, color roles, typography, imagery/material treatment, rhythm, motion and signature detail.
3. What the author seems to optimize for, clearly separating observations from interpretations.
4. What can transfer to Stryde, why it transfers, and what should not transfer.
5. Any visible anti-patterns and why the pattern may or may not work in that reference's context.
6. A concrete bridge from the post to Stryde's own art direction without mechanically copying it.

Do not generate or modify app code/visuals yet. Do not substitute another post if the supplied URL fails.

## Prompt 3 — Reconcile audit and reference into a design brief (Argon 4)

Using the real baseline audit, actual reference analysis, docs/PRODUCT_CONSTITUTION.md, docs/PRODUCT.md and docs/AI_WEBSITE_DESIGN_ANTI_PATTERNS.md, act as Stryde's principal design lead.

Do not code. Reconcile contradictions, reject stale instructions explicitly and classify FACT / DERIVED / HYPOTHESIS / UNKNOWN. Create docs/STRYDE_PRODUCT_SPECIFIC_DESIGN_BRIEF.md.

Describe the real audience and usage context, primary task, strongest product-specific proof object, trust barrier, capability boundaries and states the product must support. Extract principles from the reference with evidence. Define 2–4 art-direction adjectives, a signature concept tied to Stryde's actual pursuit/action/verification loop, what to avoid, responsive behavior, information density, typographic character, semantic color roles, surface/material rules and motion budget.

Use design-taste-frontend as a grounded decision aid only after the brief is understood. Develop 2–3 materially different compositions, not palette-only variants. For each, state the thesis, product-specific signature, use case, trade-offs, anti-pattern risks and what evidence would falsify it. Challenge your favorite with the strongest competitor. Recommend one with rationale, confidence and falsifiers. No generic chat mockup, no arbitrary anti-AI novelty, no default SaaS dashboard.

## Prompt 4 — Isolated preview before touching the app (Argon 4; implementation help only if needed)

Do not change the real app.

Based on the design brief and supplied reference, create one isolated, high-fidelity preview under .design-lab/review-candidate/. Use actual Stryde-specific content and realistic states. Label sample data and simulated controls clearly. Do not reuse .design-lab/01–04.

Demonstrate:
- the primary pursuit path and current situation;
- a signature interaction that belongs specifically to Stryde;
- action reporting and honest completed/partial/blocked/queued/failed/verified distinctions;
- contextual evidence, memory and artifact access only when useful;
- a new/empty pursuit and one error or permission boundary;
- intentional layouts at 1440×900, 1280×800 and 390×844.

Use the approved composition, hierarchy and content logic rather than a familiar SaaS recipe with a different accent. Before presenting it, use a real browser at required sizes, capture screenshots, exercise all visible controls, inspect console errors, overflow, keyboard/focus and contrast. Apply named anti-pattern IDs. Do not claim backend behavior.

Report exact preview and screenshot paths. No app code changes. Wait for explicit founder approval before implementation.

## Prompt 5 — Founder approval gate (manual)

Review the actual preview in your browser. Do not answer only “looks nice.” Ask:
1. Does this composition contain something specific to Stryde, not any AI product?
2. Does the Instagram reference inform the direction without turning into a copy?
3. Can a new user understand the pursuit's current reality and next meaningful move?
4. Does hierarchy/product evidence work with decoration mentally removed?
5. Does it work at laptop and mobile widths with an uncomfortable state visible?

If the direction fails, return to Prompt 3 with specific evidence. Do not let Flash start implementing until the direction is explicitly approved.

## Prompt 6 — Implement approved direction in vertical slices (Gemini 3.8 Flash)

Switch to Gemini 3.8 Flash High. Use /stryde-uiux-redesign and /stryde-visual-qa as appropriate.

The user has approved the design contract and preview. Implement the approved direction in the real Stryde app as small vertical slices. Read current project instructions and the applicable Next.js docs in node_modules/next/dist/docs/ before editing. Inspect actual components before changing them.

Do not improvise the design. The anti-pattern catalog is mandatory and the approved brief is visual authority. Start by proposing the slice order and identifying public interaction/API seams and behavior tests. Implement one slice, verify it, then continue.

Reuse existing code/dependencies. Define semantic tokens before repeated component styling. No new component library, database schema, API payload, data model or provider abstraction without explicit approval. Preserve auth and multi-tenancy, SSE/event handling, pursuit creation, persistence, action start/delegation/completion, truthful queue status/manual fallback, sources/citations, observation/verification semantics, memory controls, artifact revisions and mobile navigation.

Use TDD for changed behavior. Never replace real persistence/action behavior with local fake state. Keep user input on errors. After each slice, run focused tests and browser checks; report exact files, commands and results. If the approved design conflicts with architecture, stop and report the conflict instead of making an unapproved backend change.

## Prompt 7 — Independent design critique (Argon 4)

Switch to Argon 4. Review the actual implemented branch and rendered app, not just the source.

Capture screenshots at 1440×900, 1280×800 and 390×844, including another route and uncomfortable states. Compare to the approved preview, docs/STRYDE_PRODUCT_SPECIFIC_DESIGN_BRIEF.md, docs/UI_UX_BASELINE_AUDIT.md, docs/UI_UX_REFERENCE_ANALYSIS.md and docs/AI_WEBSITE_DESIGN_ANTI_PATTERNS.md.

Run substitution, decoration-off and second-screen/uncomfortable-state tests. For every defect report exact evidence, anti-pattern ID, user impact, specific correction and priority. Review product specificity, hierarchy, behavior, content truth, mobile, accessibility, edge states, token consistency and fidelity to the approved reference. Do not alter files in this pass. Be adversarial, name the strongest remaining flaw and return a go/no-go verdict.

## Prompt 8 — Targeted remediation and final ship gate (Gemini 3.8 Flash)

Switch back to Gemini 3.8 Flash High. Fix Argon's concrete evidence-backed findings one at a time. Do not reinterpret the art direction. Reject subjective changes that lack a testable reason, but explain why.

Run /stryde-visual-qa and the relevant repository gates. When applicable, start with npm test, npx tsc --noEmit, npm run lint, npm run build and npm run e2e:ui. Read the actual project instructions and test harness before running commands. Capture after-fix screenshots. Do not fake credentials, provider success or production behavior. If a gate is blocked by access/configuration, report it as blocked.

Finish with a ship/no-ship report listing exact files changed, commands/pass counts, routes/viewports/interactions checked, accessibility scan and manual review results, known defects and screenshots. No production deploy, schema migration, production data mutation, merge or touching stryde-exec-repair without explicit authorization.

## Required artifacts and completion rule

Required artifacts:
- docs/UI_UX_BASELINE_AUDIT.md
- docs/UI_UX_REFERENCE_ANALYSIS.md
- docs/STRYDE_PRODUCT_SPECIFIC_DESIGN_BRIEF.md
- .design-lab/review-candidate/ preview and screenshots
- docs/STRYDE_DESIGN_CONTRACT.md and acceptance matrix after direction is agreed
- final visual QA/release report

Do not create every artifact before gathering evidence. Each output must be grounded in its prior phase. The next meaningful step after setup is Prompt 1 with Argon 4, followed by Prompt 2 once the exact Instagram URL/media is available.
