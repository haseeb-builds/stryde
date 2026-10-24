# Stryde Visual Design Reference Collection

This collection synthesizes external design references analyzed in `docs/UI_UX_REFERENCE_ANALYSIS.md` and `docs/UX_RESEARCH.md`, highlighting what specifically transfers to Stryde versus what should not be copied.

---

## 1. SmoothUI (@shai.hq Instagram Reference)
- **Source:** [Instagram post @shai.hq](https://www.instagram.com/p/DdMCJyagZgR/) (Analyzed in `docs/UI_UX_REFERENCE_ANALYSIS.md`).
- **Observed Characteristics:** High-contrast neutral field, spare typography, one clear heading, concise explanatory copy, and actual real component screenshots as primary proof rather than fictional floating graphics.
- **What Transfers to Stryde:**
  - Let real product evidence (actual pursuit state, genuine turn text, verified source snippets) be the hero of the screen.
  - Keep secondary utilities (source links, sequence numbers, hash stamps) understated and peripheral.
- **What Must NOT Transfer:**
  - Do not copy the decorative turquoise / cream pixel-art robot campaign visuals.
  - Do not blindly adopt dark-mode neon shortcuts.

---

## 2. OpenAI Canvas
- **Source:** OpenAI Product Release (October 2024).
- **Core Pattern:** Side-by-side dual-surface collaboration that opens ephemerally when an artifact is active.
- **What Transfers to Stryde:**
  - Dedicated focused viewing/reading surface for substantial deliverables (plans, specifications, code).
  - Clean revision scrubbing (`Latest`, `v1..vN`) that respects Stryde's append-only artifact lineage.
  - Disclosive presence: Keep the primary pursuit reading measure clean and focused when no artifact is being inspected.
- **What Must NOT Transfer:**
  - Do not force a permanent 3-column split view that reduces laptop reading columns to < 550px.

---

## 3. Linear
- **Source:** Linear Issue Properties & Workflow Documentation.
- **Core Pattern:** High-density, keyboard-first issue tracking with unambiguous, immutable state progression.
- **What Transfers to Stryde:**
  - Strict, truthful state labeling (`Proposed` → `In Progress` → `Reported` → `Verified`).
  - Crisp hairlines, tabular numbers, and compact property chips.
- **What Must NOT Transfer:**
  - Stryde is a personal pursuit partner, not a shared team ticketing queue. Do not turn the pursuit into a Kanban board or complex multi-assignee bug tracker.

---

## 4. Perplexity AI
- **Source:** Perplexity Search & Citation Interface.
- **Core Pattern:** Direct inline citation pills linked to verified web snippets with confidence and source URLs.
- **What Transfers to Stryde:**
  - Explicit provenance tracking linking extracted assertions directly to original source text excerpts and SHA-256 hashes.
- **What Must NOT Transfer:**
  - Stryde is an outcome execution system, not an exploratory search engine. Citations serve the bottleneck and the next move, not endless trivia.

---

## 5. xAI Grok
- **Source:** Grok 4.1 Reasoning & Tool Execution Documentation.
- **Core Pattern:** Transparent disclosure of background tool runs (web search, python execution) as collapsible timeline events.
- **What Transfers to Stryde:**
  - Expose pre-turn research and background tool runs honestly as structured events rather than opaque loading spinners.
- **What Must NOT Transfer:**
  - Do not clutter the primary reading stream with verbose raw API debug logs.
