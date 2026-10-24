# Stryde Known UX Problems & Design Challenges

Use this list during Stitch visual exploration to test whether new layout concepts resolve or worsen these known failure modes:

## 1. Action Reporting Split-Attention Distance
- **The Problem:** In standard chat apps, an action card sits in the message stream, but clicking "Report done" or "I'm blocked" focuses an input located far below at the bottom edge of the screen (often 500px+ away).
- **Design Challenge:** How to dock the outcome/blocker reporting controls directly adjacent to the active move so the user experiences zero cognitive dislocation while describing what happened.

## 2. Conversation Depth vs. Context Discovery
- **The Problem:** As a pursuit progresses past 10–20 turns, supporting context panels (artifacts, sources, evidence, memory) placed below the message stream suffer severe scroll degradation.
- **Design Challenge:** How to maintain clean progressive disclosure (e.g. collapsibles, sheets, or contextual drawers) that are immediately discoverable without cluttering the primary operational reading flow.

## 3. Epistemic Provenance Legibility
- **The Problem:** Users easily conflate self-reported success with externally verified evidence.
- **Design Challenge:** How to visually distinguish unverified user reports (`reported`) from source-backed facts (`verified`) at a glance without relying on complex technical jargon or overwhelming the user with raw database terms.

## 4. Mobile Viewport Height & Keyboard Docking (390×844)
- **The Problem:** On mobile screens, software keyboards consume 300px+ of viewport height, easily concealing sticky action bars or cutting off multi-line text input.
- **Design Challenge:** Ensuring the active move summary and action controls remain legible and accessible even in constrained vertical spaces.

## 5. Artifact Revision Lineage Inspection
- **The Problem:** Deliverables (code, plans, drafts) undergo iterative revisions. Flat cards fail to communicate how version 2 differs from version 1 or whether a draft was saved.
- **Design Challenge:** Designing a lightweight, focused artifact reader that allows quick version scrubbing (`Latest`, `v1..vN`) and side-by-side verification without pulling the user into a separate complex document editor.
