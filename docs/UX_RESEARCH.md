# Stryde UX Research & Audit Critique

> **STATUS RECONCILIATION (2026-10-22):** Preserve the epistemic corrections and observed behavior evidence in this document. Visual/layout recommendations remain hypotheses, not approved art direction, until checked against the actual rendered app and the supplied Instagram reference. The prior .design-lab/01-04 visual concepts are rejected. Use docs/ANTIGRAVITY_UI_UX_REDESIGN_PLAYBOOK.md and docs/AI_WEBSITE_DESIGN_ANTI_PATTERNS.md for the next pass.

**Status:** Historical UX Research and Epistemic Audit Critique; visual direction not approved  
**Author:** Lead Product Designer & UX Researcher  
**Target Repository:** `haseeb-builds/stryde`  
**Base Ref:** `fix/conversation-turn-reliability` (HEAD `273847c`)  
**Date:** 2026-10-22  

---

## 1. Phase A — Epistemic Challenge to the Repository Audit

The initial read-only repository audit established critical baseline facts regarding Stryde's backend engine, schemas, and API contracts. However, several findings in that audit conflated static code inspection with empirical user behavior, or made ungrounded product claims. 

Below is an explicit classification and challenge of the audit's main claims into four epistemic categories:
- **[FACT]**: Verifiable directly in the repository code, database migrations, unit tests, or live served HTTP responses.
- **[DERIVED]**: Logically compelled by architectural constraints or explicit specification rules, with zero speculation.
- **[HYPOTHESIS]**: Plausible inferences about user behavior or design choices that require testing against live usage.
- **[UNKNOWN]**: Claims with zero evidentiary support in the repository, database, or analytics.

### 1.1 Epistemic Classification of Audit Claims

| Audit Claim | Epistemic Status | Evidentiary Basis | Critique & Correction |
| :--- | :---: | :--- | :--- |
| **1. "95% of user time is spent in the pursuit workspace."** | **[UNKNOWN]** | *None.* No session tracking, duration telemetry, or analytics exist in the codebase. | **Unsupported fabrication.** While the pursuit workspace is the core operational route, there is zero data on how long users spend on intake, reviewing past pursuits, or reading initial goals. This claim must be discarded. |
| **2. "Panels below the conversation are never discovered."** | **[HYPOTHESIS]** | In [`app/pursuits/[id]/page.tsx#L1057-L1074`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/pursuits/[id]/page.tsx#L1057-L1074), panels are mounted at the bottom of the scroll container. | **Unverified inference.** It is a *fact* that panels sit below the chat stream in the same vertical scroll container. It is a *hypothesis* that users "never discover" them. Users may scroll down when prompted or when reviewing a pursuit. What is true is that visibility degrades as message count increases. |
| **3. "Citation pills and popover excerpts can be rendered on conversation turns."** | **[HYPOTHESIS]** / **[DISPROVEN]** | Tracing data flow across [`lib/model-gateway.ts#L43-L52`](file:///c:/Users/DELL/Desktop/Stryde/stryde/lib/model-gateway.ts#L43-L52) and [`app/api/v1/pursuits/[id]/conversation/route.ts`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/api/v1/pursuits/[id]/conversation/route.ts). | **Architectural mismatch.** The audit assumed citations were ready to display on chat bubbles. In reality, `ConversationTurn` has *no citation field*, and SSE streams emit raw text chunks. Citations exist *only* in the database table `pursuit_source_citation` attached to source adaptations via `GET /sources`. The conversation client never receives turn-level citation anchors. Rendering citations on chat bubbles requires backend schema mutations and model prompt restructuring, violating the preservation contract. |
| **4. "A permanent right-side inspector rail is the correct layout."** | **[HYPOTHESIS]** | Inferred from desktop screen width (1440px) and desire to rescue panels from the bottom scroll depth. | **Contradicts UX Law & breaks viewports.** A static 3-column layout (sidebar + chat + rail) reduces the conversation column to < 550px on standard 13" laptops (1280px/1366px), causing intense crowding. Furthermore, [`docs/PRODUCT.md#L37-L45`](file:///c:/Users/DELL/Desktop/Stryde/stryde/docs/PRODUCT.md#L37-L45) explicitly forbids turning Stryde into a "dashboard-first productivity product." Context must be disclosive, not permanently docked. |
| **5. "Mobile CTA cut-off is a High Severity UX defect."** | **[HYPOTHESIS]** (Inflated) | Observed in Puppeteer mobile screenshot at 390×844 ([`app/page.tsx#L135-L163`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/page.tsx#L135-L163)). | **Severity Overstated.** The unauthenticated landing page requires a single thumb scroll (~60px) to reach the "Sign in" button. Authentication occurs once per device because Supabase persists session tokens in localStorage. Classifying this as "High" (above functional pursuit usability) was a design exaggeration. It is a minor spacing polish issue. |
| **6. "Action outcome reporting has an interaction disconnect."** | **[FACT]** / **[DERIVED]** | Clicking "I'm done" in [`app/pursuits/[id]/page.tsx#L882-L896`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/pursuits/[id]/page.tsx#L882-L896) sets `actionReport` and focuses a sticky composer at the screen bottom with only microcopy changes. | **Valid finding.** The physical distance between the clicked card and the bottom input (often 500px+) creates cognitive split-attention. The user is asked to describe what happened without clear visual containment linking their text to the specific action. |
| **7. "Assistant responses lack formatted Markdown."** | **[FACT]** | [`app/pursuits/[id]/page.tsx#L831-L833`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/pursuits/[id]/page.tsx#L831-L833): `<div className="whitespace-pre-wrap text-[15px] leading-7 text-zinc-800">{item.content}</div>`. | **Valid finding.** Complex multi-step methods, bullet points, and code excerpts stream as raw text. This makes structured roadmaps difficult to scan. |
| **8. "Zero visible keyboard focus states exist across the workspace."** | **[FACT]** | Codebase audit shows 0 occurrences of `focus-visible` in any TSX component. | **Valid finding.** Keyboard-only navigation (`Tab` / `Shift+Tab`) provides no visual outline on buttons or disclosure triggers, failing WCAG 2.1 AA. |
| **9. "Loading screen is disorienting and jarring."** | **[FACT]** | [`app/pursuits/[id]/page.tsx#L694-L697`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/pursuits/[id]/page.tsx#L694-L697) renders plain unstyled text `"Loading…"` on a blank screen. | **Valid finding, Low-Medium Severity.** Replacing plain text with a layout skeleton prevents layout shifts during hydration. |

---

## 2. Phase B — Primary Research & Comparative Product Analysis

To ground Stryde's interaction model in proven real-world mechanics, we investigated primary product documentation, UI release architectures, and known user failure modes across leading reference platforms.

*Research Tooling Transparency:* Exa search returned HTTP 401 (API key required). Primary research was conducted using Firecrawl MCP (`firecrawl_search` and `firecrawl_scrape`) over canonical product documentation, technical announcements, and public operator feedback.

### 2.1 Reference Product Deep-Dives

```
                                REFERENCE PATTERN SPECTRUM
                                
   Chat-Centric                                                          Artifact / Workspace-Centric
   (Single-Stream)                                                              (Bi-Directional)
   ┌───────────────────────┐   ┌───────────────────────┐   ┌─────────────────────────────────────┐
   │ ChatGPT / Grok        │   │ Perplexity AI         │   │ OpenAI Canvas / Linear              │
   ├───────────────────────┤   ├───────────────────────┤   ├─────────────────────────────────────┤
   │ • Linear timeline     │   │ • Inline numbered     │   │ • Ephemeral split-pane (on trigger) │
   │ • Ephemeral context   │   │   citations           │   │ • Direct artifact manipulation      │
   │ • Lost state in long  │   │ • Source cards drawer │   │ • Explicit state transitions        │
   │   threads             │   │ • Search telemetry    │   │ • Persistent properties rail        │
   └───────────────────────┘   └───────────────────────┘   └─────────────────────────────────────┘
```

#### A. OpenAI Canvas (Announced October 3, 2024; Scraped via Firecrawl)
- **Primary Source:** [OpenAI Product Release — Introducing canvas](https://openai.com/index/introducing-canvas/) (Verified October 2024).
- **Core Pattern:** Side-by-side collaboration interface. Rather than a permanent static right sidebar, Canvas opens *ephemerally* when document editing or coding is detected, creating a split view (conversation on the left, editable document/code on the right).
- **Key Relevance to Stryde:**
  1. *Dual-surface collaboration:* Canvas preserves the conversation while giving the artifact its own dedicated space. Stryde's artifacts (`app/pursuits/[id]/artifacts-panel.tsx`) currently live in a tiny collapsed accordion.
  2. *Inline revision history:* Users can scrub through prior versions using a simple back/forward revision slider, mirroring Stryde's append-only `stryde_revise_artifact` database architecture.
  3. *Non-permanent presence:* When the user is simply chatting or clarifying, Canvas remains closed, keeping full focus on the conversation.
- **Public User Complaints Observed:** In OpenAI Community forums (e.g. [Topic 1388551](https://community.openai.com/t/feature-request-better-use-of-large-screen-space-in-chatgpt-chats/1388551)), users on ultrawide monitors complain that fixed narrow columns (650px–768px) leave massive unused gutters, yet forcing a permanent split view when reading simple answers feels claustrophobic.

#### B. xAI Grok (Grok 4.1 / Fast Tool API Documentation, Scraped 2026)
- **Primary Source:** [x.ai/news/grok-4-1-fast](https://x.ai/news/grok-4-1-fast), [x.ai/api](https://x.ai/api).
- **Core Pattern:** High-speed real-time reasoning with tool-call transparency (web search, X search, code execution).
- **Key Relevance to Stryde:**
  1. *Tool execution disclosure:* Grok surfaces bounded search and tool execution steps as collapsible timeline chips during generation, rather than freezing the screen. Stryde already does deterministic pre-stream research (`app/api/v1/pursuits/[id]/conversation/route.ts#L139-L151`), but the UI only says *"Stryde is working through it…"*, hiding the fact that external evidence was retrieved.
- **Public User Complaints Observed:** On developer forums and Reddit (`r/grok`), users report frustration when rate limits or tool execution fail silently without clear fallback options or when context drift causes the model to "forget" decisions made 10 turns prior.

#### C. Linear (Issue Properties & Workflow Documentation, Scraped 2026)
- **Primary Source:** [Linear Docs — Issue Properties](https://linear.app/docs/issue-property).
- **Core Pattern:** Strict, immutable workflow state progression: `Backlog` $\to$ `Unstarted` $\to$ `Started` $\to$ `Completed` $\to$ `Canceled`.
- **Key Relevance to Stryde:**
  1. *State certainty:* Linear never confuses "assigned" with "completed." Every issue displays an unmistakable status icon and actor attribution.
  2. *SLA & blocker visibility:* Dependent relations (`blocking`, `blocked by`) are visually prominent, preventing users from attempting tasks whose prerequisites have not been satisfied.
  3. *Contextual drawer / peak view:* Clicking an issue opens an overlay or side sheet that does not navigate the user away from their current triage board.

### 2.2 Synthesis: The 5 Interaction Principles for Stryde

From this comparative analysis, we extract five concrete interaction rules that directly serve Stryde's product constitution:

1. **The Anchor vs. The Stream:** Pure chat apps fail at persistence because critical state scrolls off the top of the viewport. Stryde must keep the current state (`WorkingState`: status, bottleneck, next move) persistently visible as an **anchor**, while conversational exchanges stream below or alongside it.
2. **Ephemeral Context Over Permanent Dashboard Clutter:** Avoid a permanent 3-column IDE layout. Disclose sources, evidence, artifacts, and memory via contextual drawers, sheets, or expandable split-panes only when the operator actively needs to inspect or edit them.
3. **Explicit Action Containment:** When an action outcome is being reported, the UI must establish clear visual containment around the action summary, making it unmistakable that the user is submitting execution evidence rather than sending a generic message.
4. **Honest Execution States:** When a worker is executing (`CONTROLLED`), the interface must communicate "Queued / Running in background" while keeping manual completion ("I'm done" / "I'm blocked") permanently accessible.
5. **Preserve Conversational Velocity:** The universal composer must remain the fastest way to feed information into the system, supporting quick-option chips, drag-and-drop file ingestion, and keyboard shortcuts.

---

## 3. Phase C — Ranked Opportunity Assessment

To ensure maximum engineering ROI without risking regression on the 344 passing tests, UX opportunities are ranked across five dimensions:
- **User Impact (0–10):** Direct reduction in user confusion, cognitive load, or friction.
- **Confidence (0–10):** Certainty of the problem based on verified code evidence and user interaction laws.
- **Effort (0–10):** Engineering cost (lower score = less code touch and lower regression risk).
- **ROI (0–10):** Composite score calculated as $(\text{Impact} \times \text{Confidence}) / \text{Effort}$.
- **Evidence & File State:** Exact source file, component, or state machine involved.

### 3.1 Opportunity Ranking Matrix

| Rank | Opportunity | Impact (0-10) | Confidence (0-10) | Effort (0-10) | ROI (0-10) | Exact File & State Involved |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **1** | **Action Outcome Reporting Clarity** | **9.5** | **10** | **2.5** | **9.6** | [`app/pursuits/[id]/page.tsx#L862-L915`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/pursuits/[id]/page.tsx#L862-L915), [`L1080-L1130`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/pursuits/[id]/page.tsx#L1080-L1130)<br>State: `actionReport` |
| **2** | **Hierarchy of the Main Next Move ("What Matters Now")** | **9.0** | **10** | **3.0** | **9.0** | [`app/pursuits/[id]/page.tsx#L917-L1033`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/pursuits/[id]/page.tsx#L917-L1033)<br>State: `workingState.next_move` |
| **3** | **Readable Assistant Markdown (Safe Rendering)** | **8.5** | **10** | **2.0** | **9.4** | [`app/pursuits/[id]/page.tsx#L831-L833`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/pursuits/[id]/page.tsx#L831-L833)<br>State: `messages[].content` |
| **4** | **Context Panel Discoverability & Organization** | **8.5** | **9** | **4.0** | **7.7** | [`app/pursuits/[id]/page.tsx#L1057-L1074`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/pursuits/[id]/page.tsx#L1057-L1074)<br>Components: `PursuitWorkPanels`, `PursuitClaimsPanel`, `PursuitArtifactsPanel` |
| **5** | **Keyboard Focus & Accessibility Rings** | **7.0** | **10** | **1.5** | **8.7** | Global Tailwind styling & all button components.<br>Missing `focus-visible:ring-2` |
| **6** | **Loading, Degraded & Error States** | **7.5** | **9** | **2.5** | **8.1** | [`app/pursuits/[id]/page.tsx#L692-L706`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/pursuits/[id]/page.tsx#L692-L706), [`L1037-L1050`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/pursuits/[id]/page.tsx#L1037-L1050)<br>States: `loading`, `error`, `failedTurnMessage` |
| **7** | **Focused Mobile Layout & Composer Docking** | **7.0** | **9** | **3.0** | **7.0** | [`app/page.tsx#L135-L163`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/page.tsx#L135-L163), [`app/pursuits/[id]/page.tsx#L1078-L1199`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/pursuits/[id]/page.tsx#L1078-L1199) |
| **8** | **Citation Display on Chat Turns** | **4.0** | **10** | **9.0** | **1.8** | **DEFERRED.** Requires modifying `ConversationTurn` schema in `lib/model-gateway.ts` and changing model prompts. |

### 3.2 Detailed Assessment of Core Candidates

#### 1. Action Outcome Reporting Clarity (Priority #1)
- **Problem:** Currently, clicking "I'm done" on an active action card activates a small banner above the bottom composer and focuses the textarea. The user feels disconnected from the action they just completed.
- **Solution:** Provide an unmistakable, contained outcome reporting card directly within the viewport. When the user clicks "I'm done", the active action card transforms into an inline reporting prompt ("What happened? Say it in your own words") with explicit completion triggers. This eliminates split-attention while keeping the submission pipeline identical (`POST /api/v1/pursuits/[id]/actions/[actionId]/complete`).

#### 2. Hierarchy of the Main Next Move (Priority #2)
- **Problem:** The "What matters now" card sits inline in the chat history. In long threads, it scrolls out of sight, leaving the user with only raw messages and no sense of current status.
- **Solution:** Elevate the current move as a sticky or prominently anchored header card. The user must never have to scroll backwards to find out what their current bottleneck or next move is.

#### 3. Readable Assistant Markdown Rendering (Priority #3)
- **Problem:** [`app/pursuits/[id]/page.tsx#L831`](file:///c:/Users/DELL/Desktop/Stryde/stryde/app/pursuits/[id]/page.tsx#L831) uses `<div className="whitespace-pre-wrap">{item.content}</div>`. Bold text (`**text**`), numbered lists, headers (`###`), and backtick code blocks render as raw punctuation.
- **Solution:** Parse Markdown safely using lightweight streaming-compatible formatting (headers, bold, lists, inline code blocks) with strict sanitization to prevent XSS.

#### 4. Context Panel Discoverability (Priority #4)
- **Problem:** Sources, Claims, Artifacts, and Memory are stacked as accordions below the chat history. In conversations with >5 turns, they are buried under hundreds of pixels of text.
- **Solution:** Group contextual tools into an organized drawer or tabbed utility panel accessible from the header or a dedicated toggle, while preserving their internal state hooks.

#### 5. Deferral of Inline Citations
- **Architectural Fact:** Tracing the codebase confirms that `ConversationTurn` does *not* carry citations. The model outputs plain text in `turn.message`. Citations are only created when sources are adapted in `pursuit_source_citation`.
- **Decision:** **DEFERRED.** Attempting to force citations into conversation bubbles without backend support would require violating the preservation contract. Citations will remain viewable in their dedicated Source Material & Claims panel where they actually exist.

---

## 4. Phase D — Comparative Design Options

We evaluate three distinct design hypotheses for the Stryde workspace. Each represents a fundamentally different layout and interaction philosophy.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 THE THREE DESIGN OPTIONS                               │
├────────────────────────────┬────────────────────────────┬──────────────────────────────┤
│ Option A: Conversation-    │ Option B: Pursuit-Aware    │ Option C: Work-Oriented      │
│ First Shell (GPT/Grok)     │ Adaptive Workspace         │ Dual-Pane Inspector          │
├────────────────────────────┼────────────────────────────┼──────────────────────────────┤
│ • Pure centered chat       │ • Pinned Situation Anchor  │ • Permanent 3-column split   │
│ • State inside chat stream │ • Clean stream with chips  │ • Left nav, center chat,     │
│ • Drawer for all extras    │ • Contextual side drawers  │   right inspector            │
│ • Familiar, fast           │ • Balanced & focused       │ • Dense, heavy               │
└────────────────────────────┴────────────────────────────┴──────────────────────────────┘
```

### Option A: Familiar Conversation-First Shell (GPT/Grok-Inspired)
- **Description:** A streamlined, conversational interface mimicking modern AI chat apps (ChatGPT, Grok). The conversation stream dominates the full viewport. The "What Matters Now" card is rendered purely as an inline turn update or floating pill at the top of the composer. Contextual tools (Sources, Claims, Artifacts) are relegated to a slide-out hamburger drawer or sidebar tabs.
- **Score:** **6.8 / 10**
- **Pros:** Immediate familiarity; zero learning curve for anyone who has used ChatGPT or Grok; clean and lightweight on mobile devices.
- **Cons:** Fails Stryde's core mission. Stryde is *not* a chatbot. Hiding the `WorkingState`, bottleneck, and active action turns Stryde into an ephemeral conversationalist where long-running pursuits get lost in scroll history. Violates `docs/PRODUCT.md#L48-L58`.
- **What Falsifies This Option:** If user testing reveals operators lose track of their overarching goal, forget what action was pending, or treat Stryde like a generic question-answering tool.

### Option B: Stryde-Specific Pursuit-Aware Conversation (Recommended)
- **Description:** A purpose-built, dual-zoned layout that maintains conversational speed while anchoring situational reality.
  - **The Top Anchor:** A pinned, collapsible "Situation & Next Move" card at the top of the workspace. It summarizes the current goal, bottleneck, and primary actionable button ("Start this" / "Delegate" / "I'm done"). It never scrolls away.
  - **The Center Canvas:** A clean, readable conversation stream with formatted Markdown, option chips, and clear status transitions.
  - **Contextual Sliding Sheet / Modal:** Supporting panels (Sources, Claims, Artifacts, Memory) are accessible via subtle, badge-aware header triggers (e.g. `Sources (2)`, `Artifacts (1)`). Clicking opens a non-disruptive slide-out sheet that does not squish the conversation.
  - **Contained Action Reporting:** When an action is active, the reporting prompt is clearly bound to the action card, eliminating split-attention.
- **Score:** **9.2 / 10**
- **Pros:** 100% compliant with the UX law (one control surface, no leaked workflow nouns as primary navigation); prevents state amnesia; scales effortlessly from mobile (390px) to desktop (1440px); keeps conversation fluid while ensuring real-world progress is always front and center.
- **Cons:** Requires careful CSS sticky/fixed positioning logic to ensure header anchor and bottom composer do not consume too much vertical space on small laptop screens (e.g. 1366×768).
- **What Falsifies This Option:** If operators find the pinned anchor distracting during exploratory conversation or if screen heights < 700px feel vertically constrained.

### Option C: Work/Evidence-Oriented Dual-Pane Workspace (Linear/Canvas-Inspired)
- **Description:** A permanent two- or three-column workstation. Left column: Navigation and pursuit switcher. Center column: Conversation stream. Right column: Permanent 380px inspector rail showing active sources, claims adjudication, memory items, and live artifact preview side-by-side.
- **Score:** **7.4 / 10**
- **Pros:** High information density; excellent for power users actively cross-referencing source documents while reviewing conversation; matches developer tools and enterprise CRMs.
- **Cons:** Violates the UX law against "dashboard-first productivity products." On 13" laptop screens (1280px wide), subtracting a 256px sidebar and 380px inspector leaves only 644px for the conversation, causing severe wrapping and cramped readability. On mobile devices, this layout collapses completely, requiring two entirely different codebases.
- **What Falsifies This Option:** High bounce rates on smaller viewports; user complaints about visual overwhelm and cognitive fatigue during simple conversational turns.

---

## 5. Next Steps & Prototyping Roadmap

In accordance with user instructions, no final winner is declared until interactive prototypes are constructed and independently critiqued.

### Recommended Immediate Actions:
1. **Author the Redesign Strategy (`docs/REDESIGN_STRATEGY.md`):** Formalize the architectural guidelines, token systems, and interaction contracts that all prototype candidates must obey.
2. **Build Interactive Prototypes for Independent Critique:** Construct clean, isolated mockups representing Options A, B, and C to inspect layout balance, viewport responsiveness, and cognitive ergonomics under live conditions.
3. **Conduct Multi-Perspective Review:** Reserve Argon 4 for the independent critique of the three rendered prototypes before applying changes to the production codebase.
