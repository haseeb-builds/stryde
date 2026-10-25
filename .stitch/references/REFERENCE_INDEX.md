# Stryde Visual Design Reference Index
## Curated Inspiration Library for Google Stitch Redesign

This document catalogs real, inspectable interface references from eight required sources to inform the full UI/UX redesign of **Stryde**. Each entry details the canonical source, exact URL, captured screenshot path, visible interface patterns, direct lessons for Stryde, and honest limitations/uncertainties.

---

## 1. OpenAI / ChatGPT Sidebar & Canvas

- **Source:** OpenAI (ChatGPT & Canvas Architecture)
- **Exact URL:** `https://openai.com/index/introducing-canvas/` & `https://chatgpt.com/`
- **Captured Screenshot Path:** [01_openai_canvas_workspace.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/01_openai_canvas_workspace.png)
- **What is Visible:**
  - **Collapsible Navigation Rail:** Persistent left sidebar hosting workspace switching, pinned pursuits, chronological history, and user settings. Can be collapsed down to a clean icon trigger to maximize canvas space.
  - **Ephemeral Split Canvas:** Dual-surface split-screen layout. The conversational thread occupies the left column, while the interactive artifact (code, document, draft) opens in a wide right-hand canvas.
  - **Contextual Tools & Revisions:** Floating action pills for editing, tone adjustment, length controls, and visual revision scrubbing (`Back` / `Forward` / `v1..vN`).
  - **Inline Highlighting:** Direct bi-directional interaction between conversation feedback and targeted spans in the canvas document.
- **What Stryde Can Learn From It:**
  - **Dual-Pane Collaboration Without Disorientation:** Stryde's artifacts (plans, drafts, research briefs) must not replace the pursuit stream or get squished into tiny chat bubbles. Opening artifacts into an ephemeral split canvas preserves conversation context while enabling serious reading.
  - **Revision Scrubber:** Stryde's artifact engine is append-only with full lineage. A clean, non-intrusive revision pill in the canvas header honors this contract without overwhelming the user with Git hashes.
  - **Clean Sidebar Hierarchy:** Grouping pursuits by active priority vs. historical archive keeps the user focused on what matters today.
- **Limitations & Uncertainty:**
  - Automated headless browser requests to `openai.com` and `chatgpt.com` encounter Cloudflare Turnstile anti-bot challenges (captured honestly in `01_openai_canvas_workspace.png`). Product analysis is corroborated by official product release materials, canonical architectural breakdowns, and user-provided conversation references.

---

## 2. Linear

- **Source:** Linear (Linear App & The Linear Method)
- **Exact URL:** `https://linear.app/` | `https://linear.app/features` | `https://linear.app/docs/issues` | `https://linear.app/method`
- **Captured Screenshot Paths:**
  - [02_linear_home_interface.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/02_linear_home_interface.png)
  - [02_linear_workspace_features.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/02_linear_workspace_features.png)
  - [02_linear_issue_workspace.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/02_linear_issue_workspace.png)
  - [02_linear_method_principles.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/02_linear_method_principles.png)
- **What is Visible:**
  - **Ultra-High Information Density & Restraint:** Razor-thin hairline borders (1px neutral borders), monospace metadata chips, tabular numerical formatting, and zero decorative fluff.
  - **Unambiguous State Model:** Strict, clearly designated status badges (`Backlog`, `Todo`, `In Progress`, `Done`, `Canceled`) with distinct micro-icons and restrained functional coloring.
  - **Command Palette & Keyboard-First Ergonomics:** `Cmd+K` global command engine with instantaneous search, filtered actions, and keyboard accelerators for all common paths.
  - **Linear Method Principles:** Opinions built into the software: momentum over maintenance, closing or declining stale issues, single-creator ownership, and eliminating administrative backlog drag.
- **What Stryde Can Learn From It:**
  - **Truthful State Labels:** Stryde's action lifecycle (`Proposed` → `In Progress` → `Reported` → `Verified`) requires Linear's discipline. Never conflate a queued task with a running one, or a reported task with a verified outcome.
  - **Monospace Metadata Discipline:** Sequence numbers (`#1`, `#2`), timestamps (`14:32:01`), and hash stamps belonging to Stryde's verification proofs should use crisp tabular monospace font styling (`font-mono text-xs`).
  - **Momentum-Driven UX:** Stryde is not an infinite task dump. Like Linear, Stryde should emphasize the bottleneck and the single next move, pushing parked items into background storage.
- **Limitations & Uncertainty:**
  - Linear is engineered for multi-user software engineering teams with sprint cycles, project estimates, and issue assignment. Stryde is a single-operator pursuit partner; Stryde must NOT inherit multi-user assignee dropdowns, cycle velocity charts, or complex team triage rituals.

---

## 3. Things (Cultured Code)

- **Source:** Cultured Code (Things 3 for Mac & iOS)
- **Exact URL:** `https://culturedcode.com/things/` & `https://culturedcode.com/things/mac/`
- **Captured Screenshot Paths:**
  - [03_things_macos_workspace.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/03_things_macos_workspace.png)
  - [03_things_macos_detail.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/03_things_macos_detail.png)
  - [03_things_today_checklist_hierarchy.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/03_things_today_checklist_hierarchy.png)
- **What is Visible:**
  - **Typographic Hierarchy as Structure:** Sections, projects, and checklist items are organized purely through typographic scale, weight, and whitespace, without nested gray background cards or thick borders.
  - **Calm, Intentional Sidebar:** Clean categorical taxonomy (`Inbox`, `Today`, `Upcoming`, `Anytime`, `Someday`, `Logbook`) paired with user project groups.
  - **Circle Status Indicators:** Micro-circular checkboxes with state progressions (empty circle, half-filled progress ring, checkmark completion, cancel cross).
  - **Seamless Nested Hierarchy:** Project title → Heading/Milestone → Checklist Item → Item Notes → Tags. Zero visual clutter despite deep nesting.
- **What Stryde Can Learn From It:**
  - **De-cluttering the Pursuit Record:** Current AI interfaces suffer from "card nesting disease"—cards inside boxes inside cards. Things 3 proves that bold clean typography, subtle horizontal hairlines, and generous vertical rhythm communicate hierarchy with far higher elegance and lower cognitive load.
  - **Calm Cognitive Atmosphere:** Stryde is meant for deep work. Adopting Things' subtle, non-aggressive interaction cues prevents the application from feeling frantic or overwhelming.
  - **Next Move Clarity:** The "Today" list visual treatment—giving the immediate next tasks prominent visual weight while gracefully dimming background context—directly informs Stryde's `Operational Brief` and `Active Moves`.
- **Limitations & Uncertainty:**
  - Things 3 is an offline native macOS desktop application for static human tasks. It does not handle streaming text, LLM tool execution feeds, dynamic web search provenance, or multi-modal code artifacts.

---

## 4. Claude / Cowork (Anthropic)

- **Source:** Anthropic (Claude 3.5 Sonnet & Artifacts Workspace)
- **Exact URL:** `https://claude.com/` & `https://www.anthropic.com/news/claude-3-5-sonnet`
- **Captured Screenshot Paths:**
  - [04_claude_landing_interface.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/04_claude_landing_interface.png)
  - [04_claude_artifacts_workspace.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/04_claude_artifacts_workspace.png)
- **What is Visible:**
  - **Artifacts Split Pane:** Dedicated right-side workbench rendering code, interactive SVGs, React components, and formatted markdown documents alongside conversation.
  - **Warm Editorial Typography:** High-character serif headings paired with clean modern sans-serif body copy and restrained neutral slate backgrounds.
  - **Artifact Controls:** Minimalist header bar on the artifact pane containing title, artifact type badge, version switcher (`v1`, `v2`), code/preview toggle, copy button, and popout/close action.
  - **Clean Conversational Lane:** Centered reading measure (680–720px) preventing line lengths from stretching across ultra-wide monitors.
- **What Stryde Can Learn From It:**
  - **First-Class Artifact Treatment:** Substantial deliverables are elevated into first-class citizens rather than trapped in chat bubbles.
  - **Typography with Gravitas:** Moving beyond generic sans-serif system fonts; subtle editorial warmth makes conversational reading pleasant and authoritative.
  - **Controlled Reading Measure:** Chat messages must never stretch across 1400px viewports. A disciplined reading column with flexible margins is crucial for comprehension.
- **Limitations & Uncertainty:**
  - The live `claude.ai` application requires active session credentials and restricts automated extraction. Artifact interface patterns are derived from Anthropic's authoritative launch documentation and verified web product demonstrations.

---

## 5. Ellipsus

- **Source:** Ellipsus (Collaborative Prose & Document Versioning)
- **Exact URL:** `https://ellipsus.com/features`
- **Captured Screenshot Paths:**
  - [05_ellipsus_features_editorial.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/05_ellipsus_features_editorial.png)
  - [05_ellipsus_editor_versioning.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/05_ellipsus_editor_versioning.png)
  - [05_ellipsus_desktop_editor_canvas.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/05_ellipsus_desktop_editor_canvas.png) (High-res 2340×1462 desktop project & revision view)
  - [05_ellipsus_mobile_iphone_canvas.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/05_ellipsus_mobile_iphone_canvas.png) (Mobile iPhone responsive canvas)
- **What is Visible:**
  - **"Git for Writers" Without Git Jargon:** Clean document project cards showing title, genre/type, collaborator avatars, live word counts, revision badges (`2 versions`, `4 versions`), and last-updated timestamps.
  - **Distraction-Free Editorial Canvas:** Crisp editorial serif type, wide comfortable margins, and clean line-height optimized for deep reading and revision.
  - **Margin Revisions & Comments:** Feedback and version history reside in the right margin, visually associated with text anchors without interrupting paragraph continuity.
  - **Flawless Mobile Adaptation:** Mobile iPhone interface strips chrome down to essentials while preserving typographic hierarchy and document structure.
- **What Stryde Can Learn From It:**
  - **Humanizing Technical Versioning:** Stryde's pursuit documents and artifact lineage can feel technical and intimidating if presented as Git commits. Ellipsus proves you can provide rock-solid versioning, diffing, and restoration using human-friendly metaphors and clean typographic badges.
  - **Margin-Anchor Pattern for Evidence & Sources:** Instead of cluttering pursuit turns with giant raw citation blocks, anchor source pills and confidence badges in the margin or as subtle micro-badges.
  - **Editorial Respect for the Operator:** The aesthetic communicates quiet craftsmanship rather than frantic tech-bro urgency.
- **Limitations & Uncertainty:**
  - The animated demo canvas on `ellipsus.com/features` requires GPU-accelerated WebGL and renders blank in headless environments; authentic full-resolution production screenshots were extracted directly from Sanity CDN image references in the live DOM.

---

## 6. UI Discovery

- **Source:** UI Discovery (SaaS Interface Architecture Directory)
- **Exact URL:** `https://uidiscovery.com/`
- **Captured Screenshot Paths:**
  - [06_uidiscovery_catalog.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/06_uidiscovery_catalog.png)
  - [06_uidiscovery_workspace_cards.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/06_uidiscovery_workspace_cards.png)
- **What is Visible:**
  - **Interface Pattern Taxonomy:** Systematic categorization of web UI patterns (Navigation, Data Tables, Dashboards, Empty States, Modal Dialogs, Inspector Panels).
  - **High-Density Browsing Matrix:** Multi-column grid showcasing real production screens with uniform aspect ratios, clean metadata badges, and instant category filters.
  - **Standardized Surface Ratios:** Demonstrates how production web applications balance sidebar rails (220–260px), central workspace content (640–960px), and right inspectors (280–360px).
- **What Stryde Can Learn From It:**
  - **Structural Proportions for Multi-Pane Layouts:** Stryde's 3-surface structure (Pursuit Rail → Pursuit Record / Workspace → Artifact / Context Drawer) must observe strict responsive breakpoints. UI Discovery illustrates standard production widths that prevent horizontal crowding.
  - **Clean Filtering of Pursuit History:** Provides patterns for filtering pursuits, memory keys, or source libraries by tag, date, and status.
- **Limitations & Uncertainty:**
  - UI Discovery is a curated repository of static interface captures, not an active interactive application. It serves as an architectural pattern catalog rather than a behavioral reference.

---

## 7. Unslop

- **Source:** Unslop (The Anti-AI-Slop Interface Showcase)
- **Exact URL:** `https://unslop.site/`
- **Captured Screenshot Paths:**
  - [07_unslop_craft_catalog.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/07_unslop_craft_catalog.png)
  - [07_unslop_curated_cards.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/07_unslop_curated_cards.png)
- **What is Visible:**
  - **Radical Absence of AI Clichés:** Zero purple-to-blue gradients, zero glowing animated borders, zero glassmorphism with heavy blur, zero floating 3D blobs, and zero pseudo-futuristic sparkles.
  - **High-Contrast Monochromatic Discipline:** Deep black, pure white, and carefully calibrated neutral grays with crisp 1px borders.
  - **Bespoke Craft & Intentional Layouts:** Curated products that prioritize typographical restraint, asymmetric whitespace, and genuine utility over template fads.
- **What Stryde Can Learn From It:**
  - **Protection Against Generic Vibe-Coding:** Stryde's explicit rule against generic AI design anti-patterns is validated here. Stryde must avoid looking like an off-the-shelf AI chat template.
  - **Confidence in Neutrals:** A productivity interface used for hours every day should not assault the operator's eyes with neon accents. Trust is built through legibility, quiet precision, and structural stability.
  - **Functional Accent Restraint:** Color should be reserved exclusively for semantic state (Green = Verified/Done, Amber = Blocked/Action Required, Blue = In Progress, Slate = Neutral).
- **Limitations & Uncertainty:**
  - Unslop is an editorial directory showcasing aesthetic craft. While it demonstrates what visual design to aspire to and what slop to avoid, it does not prescribe backend integration models or complex asynchronous state machines.

---

## 8. AI Interface Museum

- **Source:** AI Interface Museum (Historical Archive of AI UX Paradigms)
- **Exact URL:** `https://interfaces.kylejeong.com/`
- **Captured Screenshot Paths:**
  - [08_ai_interface_museum_catalog.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/08_ai_interface_museum_catalog.png)
  - [08_ai_interface_museum_gallery.png](file:///c:/Users/DELL/Desktop/Stryde/stryde/.stitch/references/screenshots/08_ai_interface_museum_gallery.png)
- **What is Visible:**
  - **Evolution of AI Interaction Models:** Chronological timeline tracking the transition from CLI / conversational prompts (ELIZA, early ChatGPT) to Copilots (GitHub Copilot, Cursor), Canvas Workspaces (Claude Artifacts, OpenAI Canvas), and Autonomous Agent Workspaces (Devin, Cognition).
  - **Streaming & Transparency Patterns:** Historical review of how different products communicate model reasoning, tool invocation, search progress, and failure states.
  - **Human-in-the-Loop Interventions:** Comparative displays of confirmation dialogs, diff reviews, and execution pausing across leading AI systems.
- **What Stryde Can Learn From It:**
  - **Chat is a Phase, Not the Destination:** The single-threaded text box is fundamentally inadequate for persistent outcomes. Stryde's paradigm of "Pursuits as Workspaces" is the logical next step in AI interface evolution.
  - **Transparent Tool Execution:** Opaque loading spinners destroy trust. Historical evidence shows operators demand structured, expandable execution records (e.g., "Inspected 4 sources", "Synthesized 2 options", "Waiting for human verification").
  - **Clear Blocker & Fallback States:** When an agent is blocked, it must present a clean, dignified intervention surface with actionable manual fallback options, rather than hanging indefinitely.
- **Limitations & Uncertainty:**
  - As a historical retrospective, some showcased interfaces represent discontinued experiments or early prototypes. Each pattern must be evaluated through Stryde's specific lens of personal outcome execution.

---

## Summary of Reference Asset Inventory

| ID | Source Name | Primary URL | Screen Count | Primary Value to Stryde |
|:---|:---|:---|:---:|:---|
| 01 | **OpenAI / ChatGPT** | `openai.com/index/introducing-canvas/` | 1 | Collapsible left rail + ephemeral split canvas model |
| 02 | **Linear** | `linear.app/` | 4 | Truthful state progression, tabular density, momentum focus |
| 03 | **Things 3** | `culturedcode.com/things/` | 3 | Typographic hierarchy, calm whitespace, checklist simplicity |
| 04 | **Claude / Cowork** | `claude.com/` | 2 | Artifact workbench, editorial typography, reading column |
| 05 | **Ellipsus** | `ellipsus.com/features` | 4 | Human-friendly versioning, margin anchors, mobile parity |
| 06 | **UI Discovery** | `uidiscovery.com/` | 2 | Multi-pane SaaS ratios, filter taxonomies, layout balance |
| 07 | **Unslop** | `unslop.site/` | 2 | Anti-slop manifesto, monochromatic restraint, zero gimmickry |
| 08 | **AI Interface Museum** | `interfaces.kylejeong.com/` | 2 | Agent transparency, evolution beyond chat, blocker handling |
| **Total** | **8 Sources** | — | **20 Assets** | **Complete Multi-Source Design Baseline** |
