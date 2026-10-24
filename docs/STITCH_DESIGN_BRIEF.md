# Stryde Google Stitch Design Brief

> **STATUS RECONCILIATION (2026-10-22):** This is a historical content/interaction inventory, not a final styling prompt. The requested “working card,” fixed color system, prescribed card composition, “Sources/Claims” labels and 12-state mockup list must be re-evaluated against the 26 product decisions and the actual running implementation. No final art direction has been approved. The earlier .design-lab/01–04 directions are rejected. Use docs/ANTIGRAVITY_UI_UX_REDESIGN_PLAYBOOK.md and docs/AI_WEBSITE_DESIGN_ANTI_PATTERNS.md before any further visual work.

**Status:** Historical Content/Interaction Inventory — visual direction not approved  
**Author:** Chief of Staff / Product Architect  
**Target Tool:** Google Stitch  
**Repository:** `haseeb-builds/stryde`  
**Base Commit / Ref:** `fix/conversation-turn-reliability`  

---

## 1. Product Purpose, Core User & Central Outcome

Stryde is a persistent personal pursuit system. Its mission is to move something meaningful from **intention to reality**.

Unlike generic AI chat interfaces, task managers, or research dashboards, Stryde is defined by a single unified loop:
```
user intention → reconstruct real situation → acquire appropriate evidence → interpret uncertainty →
identify one useful next move → obtain authorization → execute or guide the move → observe what actually happened →
verify where possible → update persistent state and memory → choose next move
```

### The Core User
A motivated operator, founder, researcher, or professional pursuing a complex, non-trivial outcome (e.g., launching a technical product, vetting a business model, establishing a rigorous fitness regime, or auditing a migration roadmap).

### The Central Outcome
Tangible progress in reality. Beautiful prose and endless conversation are non-goals. The user must always know:
1. Where their pursuit currently stands (understanding & reality).
2. What is known vs. uncertain vs. verified.
3. What the single recommended next move is right now.
4. How to authorize, execute, or report the outcome of that move.

---

## 2. Core Interaction Principles

1. **One Coherent Pursuit Workspace:**  
   The user operates from a single control surface with a universal composer. Do not force the user into fragmented tabs or separate "modes" (Research Mode, Planning Mode, Chat Mode).
2. **Keep the User Oriented:**  
   Every screen state must anchor the user: Current Goal, Current State, Bottleneck, and Next Move.
3. **Evidence Distinction:**  
   Visually separate **User Claims** (unverified assertions), **External Evidence** (sourced excerpts with citations), **Observations** (system-recorded execution events), and **Verified Outcomes**.
4. **Obvious Next Move:**  
   The interface must clearly highlight the primary next action. If the next action requires human execution, provide clear, unmissable completion controls. If queued for a worker, disclose execution status honestly.
5. **Honest Authority & Verification:**  
   Never imply an action succeeded just because it was queued or proposed. Never confuse code execution success with real-world verification.
6. **No Ontology Leakage:**  
   Users must never be forced to parse internal database enums (`HUMAN_ACTION_RESULT`, `WAITING_EXTERNAL`, `CONTROLLED`, `CREATE_ACTION`). Design natural, human-grade language into the interface.

---

## 3. Screen & Route Inventory

Stryde consists of two primary product routes and contextual panels:

### Route 1: Landing & Intake (`/`)
- **Authentication:** Clean email/password sign-in and sign-up with feedback states.
- **Intake Composer:** A universal input field allowing the user to initiate a pursuit with natural language, pasted roadmaps, goals, or URLs.
- **Pursuit Switcher / History:** A clean list of active and past pursuits with timestamp, title, and current status chip.

### Route 2: Pursuit Workspace (`/pursuits/[id]`)
- **Header:** Pursuit title, current status badge (e.g., "Active", "Waiting for You", "Researching", "Blocked"), and quick context drawer trigger.
- **Active Working Card (The Anchor):** Displays the current understanding, identified bottleneck, and the highlighted **Next Move**.
- **Conversation Stream:** Historical dialogue turns showing user inputs, Stryde's synthesized responses, options, and structured assessments.
- **Universal Composer:** Sticky input bar at the bottom supporting text, voice transcription, file attachments (PDF, Markdown, text), and quick-option chips.
- **Collapsible Evidence & Claims Panel:** Shows extracted sources, verified citations with text excerpts, and factual claims.
- **Artifacts Panel:** Surfaces generated artifacts (plans, code snippets, structured summaries) with revision history.

---

## 4. Key Screen States to Design in Stitch

Please design visual mockups and component flows for the following 12 critical states:

1. **Empty Pursuit Workspace:** A new pursuit created from a high-level goal; Stryde greets the user, outlines initial assumptions, and suggests the first step to clarify the bottleneck.
2. **Standard Active Turn:** Stryde has recommended a next move with interactive option chips (e.g., "Review Plan", "Run Search", "Modify Target").
3. **Working / Thinking State:** While the turn is processing, display an elegant, informative waiting state: *"Stryde is analyzing sources and compiling the next move…"* (reflecting the server-side structured JSON validation).
4. **Blocked Research State:** When required research cannot be performed (e.g. unconfigured provider or quota reached), Stryde honestly explains why without hallucinating advice and offers manual input options.
5. **Partial Evidence / Audit State:** When a source or roadmap is uploaded, show how methods are marked `UNVERIFIED` until verified against cited evidence, with clear visual badges.
6. **Active Human Action Card:** An action assigned to the user with clear instructions, an "I'm done" button (opening a structured outcome modal), and an "I'm blocked" button.
7. **Queued Worker Action Card:** An action assigned to an automated worker (`CONTROLLED`), honestly displaying that a worker daemon is queued, with an immediate fallback to "Complete Manually" so the user is never trapped.
8. **Action Outcome Completion Modal:** A clean dialog allowing the user to report what happened, upload verification evidence, or note unexpected obstacles.
9. **Verified vs. Unverified Lineage Drawer:** A clean side panel displaying extracted source snippets with exact highlighted excerpts and verification confidence.
10. **Provider Outage / Error State:** An honest, dignified degradation card (HTTP 503 / 429) that preserves the last known working state and offers a clean "Retry" action.
11. **Session Expiry / Auth Prompt:** In-place re-authentication prompt that does not discard uncommitted composer text.
12. **Mobile Viewport (Responsive):** Seamless single-column layout where the working state card collapses into an intuitive sticky header or swipeable bottom drawer.

---

## 5. Terminology & Ontology Redesign Map

Stitch designs should replace raw backend ontology with human-centric design tokens:

| Backend Ontology (Internal) | User-Facing Design Language (Stitch) |
| :--- | :--- |
| `WAITING_USER` | **Action Required from You** |
| `WAITING_EXTERNAL` | **Awaiting External Confirmation** |
| `IN_PROGRESS` | **Active / In Progress** |
| `RESOLVED` | **Outcome Achieved** |
| `CONTROLLED` (execution_mode) | **Automated Worker (or complete manually)** |
| `HUMAN` (execution_mode) | **Your Next Step** |
| `HUMAN_ACTION_RESULT` | **Reported Outcome** |
| `WEB_SEARCH_RESULT` | **Web Evidence & Sources** |
| `URL_VERIFICATION` | **Web Verification Check** |
| `UNVERIFIED` | **Needs Verification** |
| `INCOMPLETE` | **Partially Verified / Missing Evidence** |
| `SUPERSEDED` | **Updated by New Evidence** |

---

## 6. Ready-to-Paste Google Stitch Prompt

Copy and paste the prompt below directly into Google Stitch:

```text
Design a world-class, premium web application UI for "Stryde", an AI-powered persistent personal pursuit system that helps people turn complex goals into reality.

Aesthetic & Style Direction:
- Sophisticated, distraction-free editorial interface with Swiss typography discipline, high information density, and subtle visual hierarchy.
- Color palette: Warm monochromatic neutrals (slate, stone, soft charcoal, crisp white) accented with purposeful semantic indicators (subtle emerald for verified outcomes, muted amber for pending/unverified items, soft slate-blue for active steps).
- Clean borders, refined radius (8px to 16px), subtle shadows, and crisp data typography. Avoid decorative neon, purple AI gradients, or generic chatbot bubbles.

Core Views to Design:
1. Main Pursuit Workspace (Desktop 1440px):
   - Left / Top Anchor: Pursuit Title, Status Badge ("Action Required"), and Collapsible Working State Card displaying:
     * Current Understanding (concise synthesis of reality)
     * Active Bottleneck (the single hurdle)
     * Highlighted "Next Move" card with clear action buttons ("Start Action", "Report Outcome", "I'm Blocked")
   - Main Canvas: Chronological dialogue stream showing user inputs, Stryde's synthesized guidance, citation pills with popover excerpts, and structured decision cards.
   - Bottom Sticky Area: Universal Composer bar supporting text input, audio/mic toggle, file attachment button, and quick-response chip options.
   - Right Drawer: Evidence & Provenance panel showing verified sources, exact quote snippets with match confidence, and factual claims.

2. Critical Sub-States & Modals:
   - "Report Outcome" Modal: Where a user documents what actually happened after completing an action, with options for success, partial progress, or blockers.
   - "Automated Worker Step" Card: An action card showing "Queued for background runner" with honest status indicators and an immediate "Complete Manually Instead" override button.
   - "Evidence Citation Drawer": Clean inspection view showing the original text excerpt, SHA-256 hash stamp, and source URL link.

3. Mobile Viewport (390px):
   - Unified single-column flow with a compact sticky header summarizing the current step and a gesture-friendly bottom composer.
```

---

## 7. Scope Boundaries for Stitch Pass

- **Visual & Interaction Exploration Only:** Stitch should explore typography, composition, micro-interactions, responsive behavior, and clear visual hierarchy.
- **Zero Backend Contract Changes:** Stitch designs must map directly to Stryde's existing Next.js App Router components and Supabase data models described in `docs/STITCH_INTEGRATION_CONTRACT.md`.
