# Stryde UI/UX Design Contract

**Status:** Candidate for isolated preview — founder approval pending  
**Design hypothesis:** A pursuit should read as a living record of how reality changes.  
**Companion brief:** docs/STRYDE_PRODUCT_SPECIFIC_DESIGN_BRIEF.md  
**Quality gate:** docs/AI_WEBSITE_DESIGN_ANTI_PATTERNS.md  
**No app implementation changes are authorized by this document.**

## 1. Acceptance principle

The interface is successful if a person can tell, without reconstructing a long transcript:
1. What this pursuit is for.
2. What is known about its current situation.
3. What remains uncertain or is blocked.
4. What the next meaningful move is and what would count as completing it.
5. What happened after a move, how that is known, and whether the outcome is verified.

The product is the causal relationship among those states, not a generic chat transcript with an AI sidebar.

## 2. Route/component map

The preview is isolated from application components and may use clearly labelled simulated data. This is not a permission to mutate the real app.

### Landing/intake route (current root)
Existing source: app/page.tsx.
- Retain working auth/intake behavior; do not refactor or copy backend/auth logic into the preview.
- The hero must make the concrete user job obvious, not merely describe an AI agent.
- Remove repetitive explanatory blocks only if the new layout gives the user more useful product-specific evidence and a clearer path to sign-in/create-account.
- The first view must contain the main action and account actions at 390×844 without making content tiny.
- Authentication validation and error messages stay inline, associated with the relevant form; preserve field values on failure.

### Pursuit workspace (existing source)
Existing source: app/pursuits/[id]/page.tsx and panels for work, claims, sources, memory, autonomy, skills and artifacts.
- Header: pursuit selector/history entry point, current pursuit title, truthful state summary, user/account controls. Avoid a permanent, labelled left sidebar as the default composition; prove its value first.
- Record canvas: real chronological interaction and state-change record. Timeline metadata occupies a consistent margin; message/content block has a readable measure; provenance/state appears only where it is material.
- Current move: integrated into the evolving record, visually distinct via structure and one semantic active marker—not an always-floating hero card or repetitive action tile.
- Universal composer: fixed/anchored only if it remains usable at mobile keyboard heights and does not cover content. It accepts natural-language input; it is not a control panel of unrelated icon-only buttons.
- Contextual source/evidence, memory and artifact panels: opened from the relevant object or a compact context trigger when needed. Use a drawer/sheet for supporting detail; do not leave a permanent third pane on standard laptop widths.
- Artifact viewer: focused reading/editing space when an actual artifact exists; revisions can be compared and selected. A generated draft is not described as saved/verified without a real successful operation.

## 3. Candidate layout rules

### Desktop: 1440×900
- Horizontal shell header around 60–68px, with clear pursuit switcher and no multi-row marketing navbar.
- Main record region uses a wide, asymmetric grid. A narrow, consistent gutter carries timestamps/type/provenance; the primary column carries readable conversation, state summaries and move instructions. Use a modest optional context margin only when it has real relevant content; no empty right panel.
- The current reality is a paragraph with a distinct hierarchy, not a card title and multiple repeated sublabels.
- A single next move is prominent within the record. Responsibility, why it matters, the completion condition and action controls sit together.
- At least the current pursuit, current reality, recommended move and composer/action path are visible without scrolling on ordinary laptop heights, subject to actual content length. Earlier context can scroll.
- Context sheet width is about 380–440px and overlays without resizing the record. Focus is trapped while modal and restored on close; Escape closes unless a consequential workflow needs confirmation.

### Laptop: 1280×800
- No permanent third column. Pursuit history is opened via a compact switcher/command search, not by shrinking the record.
- The active move does not push the current reality off-screen; avoid the stacked header + large card + multiple panel chrome that compresses the readable record.
- Sticky composer height remains bounded and does not obscure the last record event. Scroll the content above it, not the whole document behind the input.

### Mobile: 390×844 and 360×800
- A deliberate single-column reading order: pursuit identity → current reality → next move/action state → latest record entries → composer.
- No desktop sidebar squeezed into a 390px viewport. Pursuit navigation opens as a selectable sheet/search list and returns to the same pursuit/scroll position.
- Context opens as a full-width sheet or push-style detail view with an obvious back/close control. A drawer must not become a miniature three-column workspace.
- The composer follows safe-area insets and virtual keyboard resizing, allows multi-line text, keeps input after errors, and never hides the action report controls behind the keyboard.
- Minimum touch target 44×44 CSS px where practical; at least 8px target separation; no interaction depends on hover.

## 4. Information hierarchy and language

Use natural language that matches the person's task:
- “What you're trying to make happen”
- “What appears true right now”
- “What's still uncertain”
- “Next move”
- “What happened”
- “What Stryde could verify”
- “What changed”
Avoid making internal ontology such as Research, Claim, Action, Evidence, Observation, Decision, Worker or Agent primary navigation/buttons. Those concepts may appear as contextual explanations only if there is no clearer phrase.

Do not repeat instructions through label, sublabel, placeholder, helper and tooltip. Explain a limitation where it affects a decision/action; otherwise reveal detail on demand.

### Status semantics
No status is conveyed only by color.

| Actual state | User-facing language | Visual semantics | Must not imply |
|---|---|---|---|
| Proposed | “Recommended next move” | Normal record entry + clearly named CTA | That work started |
| Started | “In progress” | Active timeline marker, readable text | That it succeeded |
| Queued/waiting | “Queued for a worker” / “Waiting for external confirmation” | Neutral/waiting treatment plus text | That a worker is currently running |
| Blocked | “Blocked” plus reason and an actionable alternative | Error/block state plus explicit label | That the goal failed or was abandoned |
| User-reported | “You reported this result” | Reported treatment + actor/provenance | That Stryde independently observed it |
| Observed | “Stryde observed…” + source/time | Provenance/source link and a distinct state | That observation alone proves causation |
| Verified | “Verified” only when existing verification semantics support it | Positive semantic state + verification basis | That all of the pursuit's result is verified |
| Unknown | “Not verified yet” / “Not known yet” | Neutral/incomplete state, never invisible | That missing data means failure |
| Failed attempt | “This attempt failed” plus what succeeded/failed and recovery | Persistent error near the failed step | That earlier partial work vanished |

Keep the manual “I'm done” and “I'm blocked” paths available for controlled/queued actions.

## 5. Signature component: the Pursuit Record

This is the one candidate signature interaction to evaluate; it is not yet a final approved component.

- A chronological record of meaningful conversation/state events, not a chat-bubble gallery or Kanban board.
- Entries align on one grid. Event type/date/provenance occupy the same small margin, and primary text uses a readable body measure.
- The record uses at most one active/curr­ent signal to identify the move that matters now.
- The current move remains part of the record and contains: proposed action, why it matters, who acts, completion condition, and supported real controls.
- Reporting a result updates the matching move record; it must not falsely mark it verified.
- When verification arrives later, append/represent the verification as a separate event with real source/provenance and update what is known now.
- The visual sequence is driven by canonical app state/events, not an invented timeline or hardcoded progress percentage.
- Do not add decorative charts or a made-up completion score. State progresses by real events, not time/count animation.

## 6. Candidate design tokens (preview-only proposal)

These are candidate preview tokens, not final brand identity. Use them in one place; do not scatter raw hex values across components. Verify contrast once applied.

### Color roles
- Ground: cool, near-white mineral grey; avoid the previous sage/celadon direction.
- Main ink: deep charcoal close to #181a1c.
- Secondary text: dark enough for readable text; do not use pale grey as body copy.
- Accent: a restrained signal-coral used only for the current actionable point in the record, not on every heading/border/icon. Candidate #c84b2f.
- Primary action: ink fill with white text or another proven high-contrast treatment; not a gradient.
- Evidence links: standard accessible link styling, with underline/affordance.
- Verified/positive: separate semantic green; waiting: amber; blocked/error: red; neutral/unknown: ink/grey with explicit label.
- Status foreground/background contrast must meet WCAG AA for text and relevant interactive states. Color never acts as sole status cue.

### Type
- Use a compact set of typographic roles: pursuit title, state/situation statement, move heading, event body, metadata, control label.
- Preview may use the existing local Geist/system stack to avoid a dependency/load regression, but don't treat Geist as the approved brand choice.
- Main body text should be ~15–17px with 1.5–1.7 line height. Supporting record text should remain readable and not be faded to create artificial hierarchy. Labels should use sentence case; only technical IDs/codes can use monospace.
- Avoid random serif italic, oversized slogans, uniformly flat type scale and text under 12px.

### Spacing, surfaces, interaction
- Use a named spacing scale and a consistent grid. Every component must align to the same grid; exceptions need reason.
- Most record entries are unboxed. Use space and typographic weight to group them. A subtle background/surface treatment is reserved for the primary current move or a genuine overlay; do not wrap every paragraph in a card.
- No gradients, glows, glass, grain, fake charts, repeated icon tiles or animated decorative background.
- Motion is for streaming/state change, opening a contextual surface or acknowledging a real action. Honor prefers-reduced-motion; never animate content into existence so that it becomes required for access.
- The preview must feel complete without any motion.

## 7. State space to include in preview and later implementation matrix

| State | Expected response |
|---|---|
| New pursuit / empty record | Show what the composer accepts, clarify the desired outcome naturally, offer a concrete first step without mandatory intake forms |
| Active record | Current reality, next move, relevant prior record and composer are legible |
| Streaming turn | Clear progress within the relevant answer; user knows Stryde is working; preserve order of deltas |
| Recoverable error / retry | Error near failed turn, prior content and composer input preserved, real retry action |
| Permission/approval required | State what needs approval and scope; clearly distinguish proposal from committed action |
| Human action active | Instructions, responsibility and completion condition grouped together; “I'm done” / “I'm blocked” available |
| Worker queued/waiting | Honest queued disclosure; no fabricated activity; manual outcome fallback remains |
| Partial result | Preserve completed portion, record obstacle and next safe recovery |
| User-reported result | Persist/report through existing handler; marked as user-reported, not verified |
| Observation received | Source/actor/time visible where relevant |
| Verified outcome | Only use current verification semantics; expose basis/source and what exactly was verified |
| Context source opened | Source identity/excerpt/provenance legible; safe return to same conversation position |
| Memory correction/forget | Clear scope and confirmation where needed; show successful result only after actual persistence |
| Artifact and revisions | Identify active version; actual revisions can be opened; no fake saved status |
| Session expired | Explain sign-in state, preserve recoverable input and redirect safely |
| Long response/large input | Robust wrap, scroll, no fixed-height clipping or controls obscured |
| Mobile keyboard open | Composer and submit control remain usable; scroll/focus does not lose typed input |

## 8. Immutable engineering boundaries

The visual redesign may restyle/restructure JSX and CSS, but must preserve:
- Supabase auth, session and user scoping/multi-tenancy.
- Existing API requests/responses/payload field names.
- Conversation SSE parsing and event ordering, including message_delta / complete / error.
- WorkingState/NextMove semantics and their current state owners.
- Action start/delegate/complete lifecycle and idempotency/authorization requirements.
- Manual completion/blocker fallback for controlled/queued actions.
- Source ingestion, citations and provenance mappings; do not invent turn-level citations unavailable to the client.
- Claim/observation adjudication and difference between user report, mechanical event and verified truth.
- Memory retrieval/confirm/edit/forget semantics and pursuit/personal boundaries.
- Artifact storage, revisions and version selection.
- Auth redirect and error recovery.

No database migration, API contract change, second memory store, new model/provider abstraction or worker behavior change as part of visual styling. Raise any required behavior/API change as a separate proposal with tests.

## 9. Component and dependency rules

- Use existing React/Next/Tailwind primitives where they suffice. shadcn MCP/SmoothUI is a source registry, not an instruction to install a library.
- Before copying any third-party source, review exact component source, license, required dependencies, framework/React version, reduced-motion behavior, keyboard/focus, touch, long content and mobile layout.
- Do not add more than the components needed for an approved preview/vertical implementation slice.
- Bencho blocks are MIT-licensed per the official licence, but retain copyright/license notice for substantial copies and replace site-specific photographs/fonts/brand assets where separately licensed.
- DesignMD reference files are examples, not Stryde's identity. Produce a Stryde-specific DESIGN.md only after the art direction is accepted.

## 10. Acceptance matrix for the isolated preview

| Check | Pass criterion |
|---|---|
| Product specificity | Replacing name/accent does not leave an unchanged generic AI-chat page; the Pursuit Record signature reflects causal state changes |
| Decoration-off | The reading order and current move remain clear without accent colour, icons or animation |
| Truthfulness | Every state/content datum is labelled illustrative preview data and no UI implies actual app persistence/execution |
| State comprehension | A tester can distinguish queued, active, blocked, user-reported, observed, verified and unknown without relying on colour |
| Primary task | Within five seconds, tester can identify the pursuit objective, current reality and next move |
| Action reporting | In the local preview, completing/reporting a move attaches to the right move and remains “reported” until verification is deliberately selected |
| Context | Context opens on demand and closes with keyboard/mouse; the reading position returns correctly |
| Desktop 1440×900 | Current reality, active move, a recent record slice and composer visible without empty large areas |
| Laptop 1280×800 | No permanent third pane; active move not squeezed below the reading path |
| Mobile 390×844 and 360×800 | Purposeful single-column order, no horizontal overflow, adequate touch targets, visible close/back, safe-area and keyboard behavior |
| Accessibility | Visible focus, keyboard navigation, semantic controls, contrast checks, no hover-only function, reduced-motion mode |
| Failure states | At least one blocked/waiting state and one verified-result state, with explicit distinction |
| Real-browser evidence | Screenshots and interaction checks at all widths; console/error report; automated a11y scan + manual keyboard review |
| No scope leakage | No changes to app source, APIs, schema, production data, or stryde-exec-repair before founder approval |

## 11. Approval and implementation gate

The contract is not approved until the founder reviews the isolated preview and explicitly chooses a direction or requests revisions. After approval, implement in small vertical slices, preserving the immutable boundaries, run focused tests, then the current unit test suite, TypeScript, lint, production build and the real browser acceptance matrix.

A mockup passing visual checks is not proof of the actual workspace working. The authenticated workspace remains an explicit audit gap and needs separate real-browser verification before release.
