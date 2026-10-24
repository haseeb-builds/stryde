# AI Website Design Anti-Patterns — Stryde Quality Gate

**Status:** Mandatory reference for material UI/UX changes in Stryde
**Scope:** Marketing, auth/intake, pursuit workspace, contextual views, artifacts, mobile, loading/error/empty/permission states
**Owner:** Product authority (founder)

> **Operating principle:** Do not optimize for “looking less AI-generated” through random novelty. Optimize for product specificity, coherent art direction, clear hierarchy, credible content, usable behavior, and deliberate decisions.

This catalog is a heuristic, not an authorship detector. One familiar pattern is not proof of AI authorship. Clusters of unmotivated patterns, generic content, missing states, and inconsistency are stronger warnings. This is not a mechanical ban: a pattern is acceptable when its purpose is specific, articulated, and tested.

## 0. Stryde-specific enforcement contract

- Understand the actual product, user, primary job, inputs, outputs, constraints, and trust barriers before choosing colors, fonts, components, or layouts.
- Stryde's distinct thing is the connected, persistent loop from intention through situation, bottleneck, evidence, next move, authorized action, observation, verification, learning, and continuation. Design must make that behavior legible—not imitate a generic AI chat, dashboard, task manager, or “AI workspace.”
- One universal composer remains the primary control surface. Users should not need to learn internal database/workflow concepts or select technical modes to move forward.
- Real product behavior, state, and content beat visual decoration. Never invent customers, claims, metrics, citations, tool access, execution progress, saved changes, or verification.
- Do not choose an aesthetic by reflex. Derive and justify palette, type, density, layout, surface, imagery, and motion from product evidence and supplied references.
- All earlier Stryde design-lab directions 01–04 are **rejected visual directions**, not design references. Do not borrow their muted-sage palette, centered conversation lane, left pursuit rail, green action strip/card, generic header, or overall composition unless a later review independently justifies a component. Product invariants may remain useful; their art direction is not approved.
- Do not implement visual changes in the real app until the read-only baseline audit, reference analysis, product-specific design brief, route/state inventory, and founder-approved design contract are complete.
- Audit rendered results in a real browser at desktop and mobile sizes. A successful build alone is not design QA.

## 1. Mandatory pre-build brief

Create a concise brief with: (1) product and audience; (2) primary user job; (3) product-specific evidence; (4) trust requirements; (5) supplied-reference analysis; (6) art direction with 2–4 adjectives and tempting defaults to avoid; (7) semantic design system; (8) content and state model; (9) unknowns/assets/capabilities not confirmed; and (10) observable acceptance tests. Preserve an existing system or reference only when it fits the product. Explain every departure.

## 2. Anti-pattern catalog

Severity: **Critical** = misleads, blocks a key task, breaks real use or accessibility; **High** = materially harms specificity, trust or consistency; **Medium** = polish/differentiation issue, especially when clustered; **Conditional** = acceptable when motivated, suspicious when defaulted everywhere.

### A. Visual identity and color

- **A1 — Default violet/indigo/blue gradient as brand** (High/Conditional). A generic “AI startup” palette repeated in hero, buttons and glow says nothing about Stryde. Derive limited semantic colors from product rationale.
- **A2 — Gradient text on the main headline** (Medium/Conditional). Do not use gradient text to manufacture premium feeling; establish hierarchy with type, scale, contrast and composition.
- **A3 — Dark mode as premium/technical shortcut** (High/Conditional). Near-black surfaces, neon accents and glow need a real context rationale.
- **A4 — Decorative glow or blurred blobs** (Medium). Remove effects that do not explain content, establish identity or guide attention.
- **A5 — Glassmorphism everywhere** (High/Conditional). Frosted surfaces and stacked blur belong to genuine overlays/layering, not every card.
- **A6 — Grain/noise as instant sophistication** (Medium). Texture needs a coherent identity rationale; otherwise remove it.
- **A7 — One accent everywhere** (Medium). Separate neutral, primary, success, warning, danger and informational roles.
- **A8 — Low-contrast “subtle” UI** (Critical). Pale text, faint boundaries and active controls that look disabled damage readability and trust. Verify contrast.
- **A9 — Color as the only state signal** (Critical). Pair state color with labels, text, icon/shape or another cue.

### B. Layout and composition

- **B1 — Default centered hero stack** (High/Conditional). Eyebrow + huge slogan + generic subtitle + twin pill buttons + glow, without actual product evidence, is not a design strategy.
- **B2 — Every section same width and centered** (Medium). Vary density and composition where task/content justifies it; avoid random asymmetry.
- **B3 — Repeated SaaS recipe** (High). Do not reflexively use hero → metrics → three features → testimonials → pricing → CTA. Sequence around real user decisions.
- **B4 — Exactly three icon feature cards** (High/Conditional). Let real capability hierarchy determine number and form.
- **B5 — Copy-paste section compositions** (High). A title and background-color swap does not create rhythm; let each section's purpose shape its layout.
- **B6 — Everything is a card** (High). Use whitespace, alignment, typography, rules and tables; surface only things that belong together.
- **B7 — Cards nested inside cards** (High). Remove unnecessary container layers; hierarchy should be visible without stacked boxes.
- **B8 — Same rounded rectangle and shadow everywhere** (Medium/Conditional). Define radius/elevation by role; some areas should be flat, some bordered, few elevated.
- **B9 — Thick colored left border on every callout** (High). Reserve strong edge treatment for semantic callouts, not default emphasis.
- **B10 — Decorative icons larger than the message** (Medium). Icons are subordinate unless they carry real information.
- **B11 — Unmotivated whitespace or asymmetry** (Medium). Empty space must improve focus; asymmetry must connect content and evidence.
- **B12 — Fake product mockup as filler** (High). Show actual UI/credible workflow or clearly label a concept. No impossible data or unrelated widgets.
- **B13 — Decorative charts/sparklines** (High). Every chart must answer a question with readable labels and decision-relevant data; otherwise remove it.

### C. Typography

- **C1 — Default font on every product** (Medium/Conditional). Choose for character, readability, language/script coverage, loading and available assets—not trend alone.
- **C2 — One font family used without role hierarchy** (Medium). One family can work, but weights, scale, line length and line-height must establish hierarchy; a second family is optional.
- **C3 — Random serif/italic contrast word** (Medium). Do not add trendy typographic contrast unless the whole identity supports it.
- **C4 — Monospace as generic tech signal** (Medium/Conditional). Reserve for code, technical values/IDs or deliberate editorial purpose.
- **C5 — Flat hierarchy** (High). Heading, label, title and body need distinct readable roles; inspect realistic wrapping.
- **C6 — Oversized vague slogan** (High). Large type must clarify job, audience or outcome, not conceal a lack of substance.
- **C7 — Long ALL-CAPS body copy** (Medium). Uppercase is for brief labels, not paragraphs.
- **C8 — No language/script/real-length testing** (High). Test long text, script fallback, directionality, wrapping and translated strings where relevant.

### D. Components and interaction design

- **D1 — Every button/chip is a giant pill** (Medium/Conditional). Establish shapes by role and action hierarchy.
- **D2 — Every interaction fades/lifts/scales** (Medium). Feedback should be specific, fast, consistent and restrained; support touch and keyboard.
- **D3 — Decorative scroll reveals** (Medium). Do not hide/slow ordinary content behind reveal animation.
- **D4 — Cursor-following glow/pointer gimmicks** (Medium). Remove unless pointer motion enables meaningful interaction.
- **D5 — Modal by default** (High/Conditional). Use modal dialogs for focused interruption; use pages, drawers or inline disclosures for longer work. Manage focus/dismissal.
- **D6 — Fake controls/dead links** (Critical). Every visible control must work, be clearly disabled, or explicitly marked as a prototype placeholder. Test behavior.
- **D7 — Redundant UX writing** (Medium). Do not repeat an instruction in label, sublabel, helper, placeholder and tooltip; keep helper text that resolves ambiguity.
- **D8 — Status pills everywhere** (Medium). Reserve status chips for real scanning needs, not decoration.
- **D9 — Icon soup/mixed icon styles** (Medium). Use a coherent family, size and stroke; omit icons that add no meaning.
- **D10 — Toast as the whole error UX** (High). Errors must stay near affected content, preserve input and offer recovery; toast is for transient status only.
- **D11 — Same CTA everywhere** (Medium). Make destination and next step clear for the current user state.

### E. Copy, proof and information architecture

- **E1 — Interchangeable hero copy** (High). Avoid “Unlock the power…”, “Transform your workflow”, “Work smarter” and similar transplantable text.
- **E2 — AI buzzword density** (High). Replace “seamless”, “cutting-edge”, “next-generation”, “powerful”, “revolutionary” and “unlock” with actual tasks, changes and constraints.
- **E3 — Generic feature trio** (High). “Collaboration / Automation / Insights” is not an operational capability description.
- **E4 — Fabricated testimonials/customers/logos/metrics** (Critical). Use verified proof; otherwise demonstrate workflow or disclose the limitation.
- **E5 — Unsupported outcome claims** (High). Connect time/revenue/productivity claims to mechanism, scope, evidence and caveat—or remove them.
- **E6 — Fake urgency/trust badges** (High). No invented user counts, certifications, enterprise/security claims or shields used as trust theater.
- **E7 — Testimonial carousel without proof** (High). Omit until authentic proof exists.
- **E8 — Repeating promise instead of addressing objections** (Medium/High). Answer relevant questions about setup, access, limits, privacy, cost, compatibility and failure.
- **E9 — Placeholder copy surviving launch** (High). Replace, remove or explicitly label every placeholder/demo item.
- **E10 — Sections added because “websites have them”** (Medium). Keep a section only if it serves a real question, task, proof or next step.
- **E11 — Vague CTA** (Medium). Prefer specific, truthful actions over “Explore”, “Discover” or “Get started” when the outcome can be named.

### F. Product realism, consistency and completeness

- **F1 — Screenshot-perfect happy path only** (Critical/High). Design relevant loading, empty, invalid, offline, unauthorized, error and destructive states.
- **F2 — Fake data collapses when interacted with** (Critical). Labels, totals, dates, filters and charts must agree. Mark demo data unmistakably.
- **F3 — Beautiful first route, inconsistent second route** (High). Review shared design tokens and behaviors across relevant routes.
- **F4 — Desktop merely shrunk to mobile** (Critical/High). Re-plan navigation, density, priority, hit targets, dialogs, content order and overflow for small screens.
- **F5 — Content-length blindness** (High). Test long titles, empty values, large numbers, multi-line content and localization; justify truncation.
- **F6 — Inaccessible focus/keyboard paths** (Critical). Test keyboard-only use, visible focus, semantic labels/headings, focus management, announced states and reduced motion.
- **F7 — Inconsistent interaction contract** (High). Similar controls should have consistent save, confirm, cancel and transition semantics.
- **F8 — Demo behavior masquerading as production** (Critical). A draft is not saved; queued work is not running; a click is not success. Label prototypes and simulate nothing silently.
- **F9 — No useful failure recovery** (High). Explain specific failure, preserve work, and expose a safe retry/alternative.
- **F10 — Blank/generic empty states** (Medium/High). Explain why empty and offer a meaningful first action or transparent sample.

### G. Motion, effects and performance

- **G1 — Animating everything** (Medium/High). Motion communicates state, progress or spatial relation; honor reduced motion.
- **G2 — Animation blocks access or slows tasks** (High). Content must be available without waiting for decorative motion.
- **G3 — Motion-heavy hero hides meaning** (Medium). Value must be clear immediately; provide static fallback.
- **G4 — Expensive effects without a budget** (High). Measure real rendering/loading on representative devices and remove effects without material value.

### H. Design-system and implementation tells

- **H1 — Untouched starter-template identity** (High). A component kit's default navbar, spacing, buttons and section order are not the product's art direction.
- **H2 — Component library treated as finished design** (Medium/Conditional). Keep accessible primitives/behavior, then deliberately adapt layout, tokens, content and hierarchy.
- **H3 — Ad hoc spacing values** (High). Use a considered scale and layout rules; make exceptions intentional.
- **H4 — Inconsistent radius, border and shadow rules** (Medium/High). Tokenize by role instead of applying one treatment everywhere.
- **H5 — Inconsistent iconography/imagery** (Medium). Harmonize family, stroke, crop, aspect and visual weight.
- **H6 — Placeholder tokens/CSS patch pile** (Medium/High). Consolidate verified decisions into a coherent system; do not fix each prompt with unrelated overrides.

## 3. Three mandatory tests

1. **Substitution test:** If brand/name/accent changed, would the same screen fit an unrelated product almost unchanged? If yes, add product-specific workflow, language, evidence or decision structure.
2. **Decoration-off test:** Mentally remove gradients, glow, icons, shadows, badges, texture and animation. If hierarchy collapses, fix structure and content first.
3. **Second-screen + uncomfortable-state test:** Inspect another route and non-happy-path states. Does the product still work with long content, missing data, errors, permission boundaries and narrow screens?

## 4. Mandatory pre-ship checklist

### Product specificity and evidence
- [ ] Screen states what user needs to do/understand, not just an abstract promise.
- [ ] At least one visible product-specific object, workflow, output, status, constraint or result is real or explicitly marked as demo.
- [ ] Claims, metrics, quotes, sources and logos are verified and traceable or omitted.
- [ ] Every content region serves a user question, task, capability demonstration, or necessary next step.
- [ ] UI distinguishes proposed, started, queued/waiting, blocked, failed, reported, observed and verified states as applicable.

### Art direction and layout
- [ ] Art direction has a written rationale linked to audience, product and supplied references.
- [ ] No unmotivated defaults: gradient brand, glow, blur, texture, three feature cards, every-block-a-card, trendy font contrast.
- [ ] Hierarchy and rhythm come from content/layout/type before decoration.
- [ ] Component shapes, borders, elevation, color and icons vary only when role warrants it.
- [ ] Palette roles and type hierarchy are consolidated in semantic tokens after direction approval.
- [ ] Real text fits; contrast and keyboard focus remain clear.

### Behavior and responsive completeness
- [ ] Every visible control works, is clearly disabled, or states the prototype boundary.
- [ ] Forms have validation, submission feedback, error recovery and preserved input.
- [ ] Loading, empty, success, failure, permission, offline/no-results, long-content and destructive states are covered as appropriate.
- [ ] Mobile is intentionally composed, not merely stacked; test at 390px and at least one desktop viewport.
- [ ] Keyboard navigation, focus handling/dismissal, screen-reader semantics, touch targets and reduced motion are tested.
- [ ] At least two relevant routes/screens use a coherent design system.
- [ ] No console errors, accidental overflow, broken assets, dead links, placeholder copy or CSS patch pile remains.

### Engineering and truth boundaries
- [ ] Existing authentication, multi-tenancy, SSE/event contracts, persistence, action lifecycle, source/citation flows, memory and artifact revisions are preserved unless separately approved.
- [ ] Manual completion/blocker fallback remains available for queued/controlled work.
- [ ] No action is described as running because it is merely queued; no outcome is verified without corresponding evidence.
- [ ] Required tests, typecheck, lint, production build and relevant browser tests pass; failures are reported honestly.
- [ ] No production deployment, production database change, or changes to the separate execution-repair worktree without explicit authorization.

## 5. How findings must be reported

For each issue include: **pattern ID → exact element/evidence → user impact → concrete product-specific fix → severity → exception rationale (if retained)**. Separate **FACT**, **DERIVED**, **HYPOTHESIS**, and **UNKNOWN**. Flag clusters of three or more unmotivated warning patterns, but any critical truth/function/accessibility issue is sufficient to require a fix. This count is a practical heuristic, not scientifically validated.

Required audit output: (1) product-specific brief; (2) art direction and rationale; (3) observed anti-patterns with IDs and screenshots/locations; (4) state, behavior, content and responsive gaps; (5) routes/viewports/browser actions actually tested; (6) open questions/known limits; (7) acceptance tests and go/no-go recommendation.

## 6. References for future updates

- Impeccable — “Slop: The visible tells of AI design”: https://subclaude.com/slop/
- InterfaceKit — “What makes a website look AI-generated?”: https://blog.interfacekit.io/what-makes-a-website-look-ai-generated
- SCALR — “20 Signs a Website Was Made by AI”: https://scalr.sg/blog/20-signs-a-website-was-made-by-ai/
- Borghei / Claude-Skills — AI slop patterns: https://github.com/borghei/Claude-Skills/blob/main/engineering/design-auditor/references/ai_slop_patterns.md
- OJO Design Skills — UI design anti-patterns: https://github.com/touchine-ojo/OJO-Design-Skills/blob/main/skills/app-ui-ux-best-practices/references/anti-patterns.md
- Wikipedia — “Signs of AI writing” (format inspiration, not design authority): https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing

Maintenance: treat this as a living, evidence-backed reference. Add patterns when observed repeatedly, describe failure modes, and record exceptions. Do not turn it into a rigid checklist that punishes useful patterns.
