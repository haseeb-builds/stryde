# Stryde Product-Specific Design Brief

**Status:** Candidate direction for an isolated preview — NOT approved for application implementation  
**Date:** 2026-10-23  
**Evidence base:** Product Constitution, Product Truth, integration contract, source inspection, local/public landing browser audit, supplied Instagram reference analysis, AI Website Design Anti-Patterns.  
**Decision confidence:** 0.76 for the interaction concept; 0.52 for untested visual details.  
**Design target:** Make the real pursuit state and path to an outcome perceptible without turning Stryde into a chat clone, task board, research dashboard, or collection of controls.

## 1. Product and audience

Stryde is a persistent system for moving a person's meaningful intention through reality, evidence, action, observation, verification and learning. The primary user is a person carrying a complicated personal or professional pursuit over days or weeks, often while their situation changes and their next step is not obvious. They need to resume, correct, or move a pursuit forward without reconstructing its history from a long chat transcript.

The immediate job is not “chat with an AI.” It is:

**Know what is true about this pursuit now, what remains uncertain, what Stryde recommends next, and what actually changed after the move.**

The universal composer remains the input/control surface. Users can bring goals, questions, external material, progress, corrections, results and action reports naturally. They should not need to choose research/action modes or understand internal state terminology.

## 2. Product-specific evidence, not decoration

Stryde's distinctive material is the changing record of a pursuit:
- the initial intention and success condition;
- what the system currently understands about reality;
- the unresolved constraint or bottleneck;
- the move chosen and who is responsible for it;
- what the person or tool actually did;
- the reported/observed result and its provenance;
- what is verified, still unknown, contradicted or learned;
- the next move caused by that change.

The central product idea proposed for the first preview is:

**“A pursuit is a living record of what changed in reality.”**

The interface should express that idea as a continuous, readable record with a persistent point of orientation—not by making every internal subsystem visible at once. The signature is a provenance-aware “change spine” that makes consequential state changes legible within the conversation history. It is not a generic dashboard chart, onboarding flow, or numbered multi-step wizard.

### The anti-substitution test

If “Stryde” and its accent colour were replaced with the name of another AI assistant, an ordinary chat shell and its feature cards could transfer unchanged. A pursuit record whose entries explicitly connect the chosen move to an observed/reported result and the system's updated understanding is harder to transplant, because it depends on Stryde's actual state and verification model.

### The decoration-off test

The hierarchy should survive without the orange active marker, rounded edges, icons or animations. The content order, typographic scale, entry structure and state labels must still show intention → current reality → next move → result. If those relationships disappear when decoration is removed, the design is unfinished.

### The second-screen/uncomfortable-state test

The same interaction grammar must work when the next move is clear, when a worker is merely queued, when a move is blocked, when the user reports partial completion, when verification is unavailable, and when an outcome is genuinely verified. A calm happy-path transcript alone is not sufficient.

## 3. Reference analysis and transfer

Original source: https://www.instagram.com/p/DdMCJyagZgR/

The original Instagram carousel was opened in a real browser. Its logged-out overlay prevented complete in-page navigation, but one SmoothUI slide was directly opened from media linked by the original post's metadata. The cover and tool 1 slide were also directly inspected from a matching public repost, and the five tool names were corroborated by the repost caption. These access limits are preserved in docs/UI_UX_REFERENCE_ANALYSIS.md; this brief does not claim to have viewed every original slide.

The directly viewed SmoothUI slide uses a dark field, one strong plain heading, a short explanatory sentence, an actual component-browser screenshot, and an understated source URL. Its useful lesson is not the dark palette. It is the use of real product evidence and explicit provenance to make the subject credible. The cream/turquoise/pixel-art cover is a campaign identity and should not be copied into Stryde.

## 4. Three materially different art directions

These are real alternatives, not three palette choices.

### A. The Pursuit Record (recommended for preview)

**Thesis:** Show the pursuit as an evolving record of meaningful state changes, where conversation is interleaved with the specific reality, next move and result it caused.

**Composition:** A compact horizontal product header with a current-pursuit switcher; a wide, left-aligned record canvas; entries share a consistent date/type gutter, readable body column and optional provenance/status margin; the current next move is integrated into the record as a distinct, action-ready row rather than a floating hero card; the universal composer stays present at the bottom. Supporting sources, memory, artifacts and deeper state open in contextual drawers when requested, not as permanent tabs/panes.

**Signature interaction:** Selecting a record entry reveals its provenance and the relationship to the current situation. Reporting a move changes the actual entry from “planned/active” to “reported”; later verification is represented separately, never inferred from the report. The next move can change when an outcome updates the situation.

**Face:** A visible, meaningful trace of how reality changed. That is Stryde's own material rather than an external aesthetic metaphor.

**Palette/typography hypothesis:** High-contrast neutral canvas, dense ink, a restrained signal-coral marker reserved for the currently actionable point in the trace, and separate semantic treatments for waiting, blocked, error, reported and verified states. The main action remains a clear high-contrast fill; no gradient brand, glow, glass or all-purpose accent. Keep existing Geist only as a temporary implementation-compatible base during the preview, not a declared final brand choice. Establish hierarchy through size/weight/line length and entry alignment, not by a random serif word or monospace everywhere.

**Density/motion:** Enough content to show a coherent slice of a real pursuit at 1440×900; no decorative charts or fake activity. Motion is limited to actual transitions (new streamed text, expanding provenance, opening a context sheet, action status change), with reduced-motion support.

**Mobile:** The record becomes a single sequence. Date/type provenance is a short label above each entry, the active move enters the reading order rather than hiding in a fixed right pane, the composer respects keyboard/safe-area insets, and context opens as a full-width sheet.

**Risks:** The timeline could become a task history, dense chronological diary or “everything at once” page. It must foreground the current situation and next useful move; old events collapse progressively. Any provenance text must be from real stored evidence or marked as an illustrative sample.

**Falsifier:** Users cannot quickly answer “what matters now?” or report a move without hunting for the right event; the state spine adds more reading than it removes.

### B. The Working Brief (strongest competitor)

**Thesis:** Treat the active pursuit like a living decision brief whose current position, key unknown and next move stay at the top; conversation and evidence support that brief as it evolves.

**Composition:** Main page reads like a concise, continuously revised brief, with the current reality and one recommendation occupying the first visual hierarchy; the conversation/history is a lower chronological record, and supporting evidence is opened only when needed. A meaningful current-state change rewrites the brief while preserving the preceding version/history.

**Signature interaction:** “What changed?” compares the previous state summary with the current one and cites the triggering event/result.

**Strength:** Exceptional orientation and fast resumption in long-running pursuits.

**Risks:** Easy to collapse into the exact “pinned next-move card + chat” pattern rejected in previous prototypes. It is less compelling if the current summary simply restates the last assistant message rather than proving what changed.

**Falsifier:** The pinned brief occupies so much vertical room that the dialogue/action path is compressed, or users lose trust because the summary changes without a visible reason.

### C. The Move Bench

**Thesis:** Put the current consequential move at the centre and reveal the rest of the pursuit only when the user needs to diagnose, authorize, report or verify it.

**Composition:** A task-like but non-kanban work surface centred on one next move. The record and source/context are pulled in contextually. It is optimized for people resuming after a break to execute something, not browse history.

**Signature interaction:** The active move has a linked outcome-reporting path and cannot silently become “complete”; it requires a report/observation state, then separate verification if applicable.

**Strength:** Strong action clarity, potentially best when a pursuit has one immediate action.

**Risks:** Too easily becomes a task manager with an AI layer; loses the continuity and learning that define Stryde. It may overfit work with a clear next move and underperform when the user is exploring or resolving uncertainty.

**Falsifier:** The UI hides the reason a move matters or obscures how previous results affect current recommendations.

## 5. Recommendation and rejected defaults

Recommend A, the Pursuit Record, as the first isolated preview. Confidence 0.76 in the interaction model; lower confidence in exact colour, typography and spacing until visual comparison and browser evaluation. Its product identity comes from state causality and provenance—not from unusual colours. B is the strongest competitor, especially for quick resumption, and should win if tests show the record structure is too dense. C is appropriate only for a phase where a single move is clear and action completion is the user's dominant job.

Explicitly avoid:
- centered generic chat lane as the entire product;
- three identical explanatory/feature cards;
- permanent equal-width chat + inspector pane;
- a permanent “What Matters Now” hero card merely to make the current state visible;
- card around every paragraph/control;
- purple/blue gradients, glowing dark UI, glass, random grain, fake charts, decorative icon tiles, excessive pills and meaningless numbers;
- a copy-pasted Vercel/Linear/shadcn/SmoothUI/Bencho theme;
- pixel-art robot, cream/aqua cover graphics from the Instagram repost;
- fabricated proof, sample activity pretending to be live, or generic claims that the agent “verifies outcomes itself” without a real mechanism.

## 6. Current evidence vs. unknowns

**FACT:** The local/public root route renders Stryde's sign-in/intake screen. Mobile 390×844 has no horizontal overflow, but the form extends below the first viewport. The automated axe scan reported one serious contrast violation on the pale .text-xs label. Empty account submission shows inline validation.

**FACT:** A fresh unauthenticated browser is redirected from the pursuit route to sign-in. The authenticated workspace has not yet been tested interactively in the current audit.

**FACT:** The repository has an SSE conversation stream, working state, actions, source and claim panels, memory panel, artifact revisions and manual completion/blocker fallback per the inspected code/docs; the UI completeness of those flows still requires browser proof.

**HYPOTHESIS:** A pursuit-record composition will improve resumption and honesty because the state transitions and their provenance are visible near their context. The design experiment must test this; no user research/analytics result is available yet.

**UNKNOWN:** Current authenticated workspace behavior on desktop/mobile; whether context entry discoverability is a problem in actual user behavior; how the original Instagram slides 3–7 look beyond the corroborated five-name repost caption; which final typeface/colours the founder will approve.

## 7. Acceptance for the preview

The isolated preview should demonstrate:
- an explicit goal/pursuit and a concise current-reality statement;
- the most recent state-changing events with provenance and truthful statuses;
- a single recommended move with why, responsibility and what would count as completion;
- a working simulated composer that appends a clearly marked local preview entry;
- a move/report interaction in which “reported” is not mislabeled “verified”;
- on-demand supporting context (source/observations/artifact revision) without a permanent inspector rail;
- one waiting or blocked state and one verified-result state;
- 1440×900, 1280×800, 390×844 layouts; keyboard focus, contrast, reduced motion and long copy.
Any sample content must be labeled as illustrative preview data, not live Stryde data.

No application UI code should change until the preview passes its browser QA and the founder explicitly approves the direction.
