# Stryde Redesign Strategy & Visual Architecture Specification

> **STATUS RECONCILIATION (2026-10-22):** The architecture/product-contract observations in this document may inform the audit, but its preset palette, Geist type direction, centered reading lane, pinned next-move treatment, layout scores and prototype roadmap are **not approved art direction**. Do not use its earlier fixed visual prescription as the source of truth. The initial .design-lab directions 01–04 were explicitly rejected as generic/vibe-coded. The replacement process is defined in docs/ANTIGRAVITY_UI_UX_REDESIGN_PLAYBOOK.md and guarded by docs/AI_WEBSITE_DESIGN_ANTI_PATTERNS.md. Treat the recommended layout as an untested hypothesis until reference analysis, actual-browser audit, and Argon 4 design review are completed.

**Status:** Historical Redesign Strategy — superseded for art direction by the evidence-based Antigravity playbook  
**Author:** Lead Product Designer & Frontend Architect  
**Target Repository:** `haseeb-builds/stryde`  
**Base Ref:** `fix/conversation-turn-reliability` (HEAD `273847c`)  
**Date:** 2026-10-22  

---

## 1. Executive Summary & Design Mission

Stryde's core mission is to move meaningful outcomes from **intention to reality**. It is neither a generic chatbot nor an administrative task board. It is an adaptive pursuit system designed around a single closed loop:

$$\text{Intention} \to \text{Situation} \to \text{Bottleneck} \to \text{Next Move} \to \text{Action/Delegation} \to \text{Observation} \to \text{Verification} \to \text{Memory/Learning}$$

This document defines the architectural strategy, visual tokens, and interaction models for upgrading Stryde's user experience. It operationalizes the findings from [`docs/UX_RESEARCH.md`](file:///c:/Users/DELL/Desktop/Stryde/stryde/docs/UX_RESEARCH.md) while strictly honoring the repository's 344 passing tests, Supabase auth boundaries, and backend contracts.

---

## 2. The Three Architectural Design Hypotheses

To avoid premature convergence on a single aesthetic, we evaluate three genuinely distinct design hypotheses. Each represents an alternative balance between conversational flow, situational grounding, and supporting evidence.

```
                                  ARCHITECTURAL COMPARISON
                                  
  ┌─────────────────────────────────┬─────────────────────────────────┬─────────────────────────────────┐
  │ Option A: Conversation-First    │ Option B: Pursuit-Aware         │ Option C: Work-Oriented         │
  │ Shell (Chat-Centric)            │ Workspace (Adaptive Anchor)     │ Workstation (Dense Dual-Pane)   │
  ├─────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
  │                                 │                                 │                                 │
  │  ┌────┬──────────────────────┐  │  ┌────┬──────────────────────┐  │  ┌────┬──────────────┬────────┐ │
  │  │Nav │                      │  │  │Nav │ [Pinned Situation]   │  │  │Nav │              │Evidence│ │
  │  │    │                      │  │  │    │ [Next Move Card]     │  │  │    │ Conversation │& Claims│ │
  │  │    │ Conversation Stream  │  │  │    ├──────────────────────┤  │  │    │ Stream       │Panel   │ │
  │  │    │                      │  │  │    │ Conversation Stream  │  │  │    │              │        │ │
  │  │    │                      │  │  │    │                      │  │  │    │              │Artifact│ │
  │  │    ├──────────────────────┤  │  │    ├──────────────────────┤  │  │    ├──────────────┤Preview │ │
  │  │    │ [Universal Composer] │  │  │    │ [Universal Composer] │  │  │    │ [Composer]   │        │ │
  │  └────┴──────────────────────┘  │  └────┴──────────────────────┘  │  └────┴──────────────┴────────┘ │
  │                                 │  (Slide-out Drawer for Extras)  │  (Permanent 380px Inspector)    │
  └─────────────────────────────────┴─────────────────────────────────┴─────────────────────────────────┘
```

### Option A: The Conversation-First Shell (GPT/Grok-Inspired)
- **Concept:** Maximize conversational velocity. The conversation stream occupies the primary viewport. The `WorkingState` and next move are injected as styled event bubbles directly inside the chat timeline, or surfaced as a subtle floating chip over the composer. Contextual tools (Sources, Claims, Artifacts) are accessed via a slide-out drawer or modal.
- **Score:** **6.8 / 10**
  - *Rationale:* High initial comfort for users accustomed to ChatGPT or Grok. However, as conversations grow past 10 turns, the user's primary goal and current bottleneck scroll off-screen, creating "context amnesia."
  - *Confidence:* 8.5 / 10.
  - *Trade-offs:* Sacrifices continuous situational grounding for conversational simplicity.
  - *What Falsifies It:* If user testing shows users lose track of whether an action was assigned to them or if they stop taking real-world actions because the UI feels like "just another chat."

### Option B: The Pursuit-Aware Workspace (Pinned Anchor + Adaptive Stream)
- **Concept:** A dual-zoned workspace that balances persistent grounding with fluid dialogue.
  - **The Top Situation Anchor:** A pinned, compact card anchored beneath the header displaying the overarching goal, identified bottleneck, and the highlighted **Next Move** with primary action triggers ("Start this", "Delegate", "Tell Stryde"). It can be collapsed into a compact single-line status bar when reviewing past dialogue.
  - **The Stream:** A clean conversation timeline with formatted Markdown, option chips, and in-flight stream indicators.
  - **Contextual Sliding Utility:** Supporting panels (Sources, Claims, Artifacts, Memory) are grouped into a slide-over sheet or top drawer accessible via subtle status badges in the header (e.g., `3 Sources`, `1 Artifact`).
  - **Inline Action Reporting:** When an action is active, clicking "I'm done" opens a focused reporting dock directly within the action card, eliminating split-attention.
- **Score:** **9.2 / 10** (Recommended Architectural Direction)
  - *Rationale:* Fully satisfies the UX Law against dashboard clutter while ensuring the user never loses sight of "What matters now." Scales seamlessly from 390px mobile screens to 1440px desktop monitors.
  - *Confidence:* 9.5 / 10.
  - *Trade-offs:* Requires rigorous CSS flexbox/grid layout discipline to prevent header anchors and sticky composers from vertically compressing the chat stream on small laptop screens (e.g., 768px height).
  - *What Falsifies It:* If operators find the pinned anchor distracting during freeform brainstorming or find the slide-over contextual sheet too isolated from the chat.

### Option C: The Work-Oriented Dual-Pane Workstation (Linear/Canvas-Inspired)
- **Concept:** A multi-pane productivity workstation. On desktop (1440px+), the screen permanently splits into two equal or 60/40 columns: Conversation on the left, and a live Inspector Rail on the right displaying active sources, extracted methods, claims adjudication, and artifacts side-by-side.
- **Score:** **7.4 / 10**
  - *Rationale:* Powerful for complex technical pursuits where the user is actively cross-referencing extracted source documents while conversing.
  - *Confidence:* 8.0 / 10.
  - *Trade-offs:* Violates `docs/PRODUCT.md#L52` ("Stryde is not a dashboard-first productivity product"). On 13" laptop screens (1280px wide), subtracting a 256px sidebar and 380px inspector leaves only 644px for the conversation, causing severe text wrapping. It completely collapses on mobile, forcing two disconnected layouts.
  - *What Falsifies It:* High abandonment rates on screens < 1400px; operator complaints of visual clutter and cognitive fatigue.

---

## 3. Strict Preservation & Boundary Contracts

Every redesign prototype and implementation must strictly obey the following architectural invariants:

### 3.1 Uncompromising Authentication & Route Invariants
- **Auth Provider:** Must continue to use `@supabase/supabase-js` browser client via `supabase.auth.getSession()` and `supabase.auth.signInWithPassword()`.
- **Token Injection:** All authenticated API requests must pass `headers: { Authorization: 'Bearer ' + token }`.
- **Zero API Route Mutations:** No changes to request payloads or response schemas for:
  - `POST /api/v1/pursuits`
  - `POST /api/v1/pursuits/[id]/conversation`
  - `POST /api/v1/pursuits/[id]/work`
  - `POST /api/v1/pursuits/[id]/actions/start`
  - `POST /api/v1/pursuits/[id]/actions/delegate-worker`
  - `POST /api/v1/pursuits/[id]/actions/[actionId]/complete`
  - `POST /api/v1/pursuits/[id]/sources`

### 3.2 Server-Sent Events (SSE) Stream Protocol
The client consumer [`consumeConversationStream<T>()`](file:///c:/Users/DELL/Desktop/Stryde/stryde/lib/conversation-client-stream.ts) must remain intact. It processes three event types:
1. `{ type: "message_delta", content: string }`: Concatenated progressively into the active assistant bubble.
2. `{ type: "complete", turn: ConversationTurn, provider?: string, model?: string }`: Delivers the canonical `turn` payload containing `turn.work` (`WorkingState`), `turn.options`, and `turn.question`.
3. `{ type: "error", message: string }`: Triggers client error recovery state with retry capability.

### 3.3 The Natural Language Ontology Invariant
To prevent technical jargon from leaking into the user interface, the automated test suite enforces the UX Law via [`scripts/e2e-ui-flow.mjs`](file:///c:/Users/DELL/Desktop/Stryde/stryde/scripts/e2e-ui-flow.mjs#L101-L115).
- **Forbidden as Primary Navigation or Buttons:** `Research`, `Claim`, `Evidence`, `Observation`, `Decision`, `Worker`, `Agent`.
- **Approved Human-Grade Labels:**
  - `WAITING_USER` $\to$ *"Action required from you"*
  - `WAITING_EXTERNAL` $\to$ *"Waiting for external confirmation"*
  - `IN_PROGRESS` $\to$ *"In progress"*
  - `HUMAN` execution mode $\to$ *"Your next step"*
  - `CONTROLLED` execution mode $\to$ *"Automated worker (or complete manually)"*
  - Observations & Claims $\to$ *"What Stryde remembers"* / *"What you've established"*

### 3.4 Mandatory Manual Completion Fallback
Even when an action is assigned to an automated worker (`execution_mode === "CONTROLLED"`), the UI must **always** expose the manual completion triggers (`I'm done` / `I'm blocked`). Users must never be locked out of moving their pursuit forward if a worker daemon is offline.

---

## 4. Visual Identity & Design System Specification

Stryde's aesthetic direction is an **editorial, distraction-free thinking workspace**. It avoids toy-like AI tropes (purple gradients, glowing neon borders, bouncing chat bubbles) in favor of crisp typography, disciplined spacing, and quiet semantic indicators.

### 4.1 Color Palette & Semantic Tokens

```
                                  SEMANTIC COLOR SYSTEM
                                  
   Surface Hierarchy                         Semantic Status Indicators
   ┌──────────────────────────────────┐     ┌──────────────────────────────────┐
   │ Background: #f7f7f8 (zinc-50)    │     │ Emerald (Verified / Complete)    │
   │ Card Fill:  #ffffff (white)      │     │ bg-emerald-50 text-emerald-700   │
   │ Card Border: #e4e4e7 (zinc-200)  │     │ Amber (Waiting / Unverified)     │
   │ Subsurface: #f4f4f5 (zinc-100)   │     │ bg-amber-50 text-amber-700       │
   │ Input Ring: #18181b (zinc-900)   │     │ Rose (Blocked / Failed)          │
   └──────────────────────────────────┘     │ bg-rose-50 text-rose-700         │
                                            │ Sky (Active Research / Worker)   │
                                            │ bg-sky-50 text-sky-700           │
                                            └──────────────────────────────────┘
```

- **Canvas Background:** `#f7f7f8` (warm, high-key neutral that reduces eye fatigue).
- **Cards & Surfaces:** `#ffffff` with crisp `1px border border-zinc-200/80` and subtle elevation (`shadow-[0_1px_3px_rgba(0,0,0,0.05)]`).
- **Typography:**
  - Headings: `Geist Sans`, semi-bold (`tracking-tight`).
  - Section Labels: Micro uppercase (`text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400`).
  - Body Text: `text-[15px] leading-7 text-zinc-800` for high legibility during sustained reading.
  - Monospace / Code: `Geist Mono` (`text-xs bg-zinc-100 text-zinc-800 rounded px-1.5 py-0.5`).
- **Accessible Focus Rings:** Every button, link, and interactive input must enforce `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2`.

---

## 5. Viewport & Responsive Layout Architecture

### 5.1 Desktop Layout ($\ge 1024\text{px}$)
- **Left Navigation:** Fixed 256px sidebar (`border-r border-zinc-200/80 bg-[#f7f7f8]`) displaying brand, pursuit switcher, and account triggers.
- **Main Canvas:** Flexible column with a centered `max-w-3xl` reading lane.
- **Top Situation Anchor:** Pinned below the header, summarizing the current state and next move.
- **Sticky Universal Composer:** Anchored to the bottom (`left-64 right-0`), containing text, voice, attachment triggers, and option chips.
- **Slide-Over Context Sheet:** Clicking header utility badges (Sources, Artifacts, Claims) slides out a clean 420px sheet from the right edge, overlaying without displacing the conversation.

### 5.2 Mobile & Small Viewports ($< 1024\text{px}$)
- **Navigation:** Sidebar collapses into an accessible slide-out mobile drawer or header dropdown.
- **Situation Anchor:** Collapses into a compact, 2-line expandable header banner showing current status and the primary action button.
- **Composer Dock:** Sticks to `bottom-0 left-0 right-0` with safe-area padding for mobile keyboards (`pb-safe`).

---

## 6. Prototyping Roadmap: What Should Be Prototyped Next

To determine whether **Option A**, **Option B**, or **Option C** provides the superior user experience without touching production code, we will construct three isolated, interactive visual prototypes:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              PROTOTYPING MILESTONES                                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   1. Prototype A: Familiar Conversation-First Shell                                    │
│      - Exercises clean single-stream chat with inline state pills and drawer.          │
│      - Evaluates if conversational flow feels faster or if goal tracking is lost.     │
│                                                                                        │
│   2. Prototype B: Pursuit-Aware Workspace (Pinned Anchor)                              │
│      - Exercises the pinned "What Matters Now" anchor with inline action reporting.    │
│      - Evaluates vertical space budget, header collapse, and context slide-over.       │
│                                                                                        │
│   3. Prototype C: Work-Oriented Dual-Pane Workstation                                  │
│      - Exercises a split 60/40 desktop layout with live inspector rail.                │
│      - Evaluates information density versus screen crowding on smaller laptops.        │
│                                                                                        │
│   4. Independent Argon 4 Multi-Perspective Critique:                                   │
│      - Review all three rendered prototypes under desktop (1440px) and mobile (390px). │
│      - Stress-test cognitive load, keyboard accessibility, and state clarity.          │
│      - Select the final design winner based on empirical evaluation.                   │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

*By building these three prototypes in isolation first, we validate the human experience before implementing a single change to the production application.*
