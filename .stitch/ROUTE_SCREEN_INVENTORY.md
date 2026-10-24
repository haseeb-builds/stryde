# Stryde Route & Screen Inventory

## 1. Primary Product Routes

### Route A: Root Landing & Pursuit Index (`/`)
- **Unauthenticated State:**
  - **Operational split:** Left column outlines the core thesis (`Intention → Bottleneck → Next Move → Verified Outcome`) and operating principles.
  - **Access Card:** Clean, focused email and password sign-in / create-account controls with immediate inline error feedback.
- **Authenticated State (Pursuit Index):**
  - **Header:** `stryde. | PURSUIT INDEX` with `Sign out` action.
  - **Intake Dock (`WHAT NEEDS TO MOVE?`):** Primary input allowing instant pursuit creation with goal statement and optional collapsible roadmap/context input.
  - **Pursuit List:** Filterable list of all pursuits (`All`, `Active`, `Done`) with live search (`Filter pursuits...`).
  - **Pursuit Item:** Displays title, status badge (`ACTIVE`, `COMPLETED`, `STALLED`), relative timestamp, and highlights the most recent active pursuit (`CONTINUE` indicator).
  - **Founding Access Status:** Non-distracting subscription/tier indicator with payment verification check.

### Route B: Pursuit Workspace (`/pursuits/[id]`)
- **Universal Shell Header:**
  - `stryde. /` brand stamp with accessible `<details>` Pursuit Switcher allowing instant search and switching across all user pursuits without returning to home.
  - Quick action controls: `Context & files` jump button and `+ New` pursuit trigger.
- **Top Operational Brief (The Anchor):**
  - Persistent orientation card anchoring the user:
    - Status badge (`ACTIVE`, `WAITING`, `BLOCKED`, `STALLED`).
    - State status code and recovery action (`Reassess`).
    - Situation summary paragraph explaining what is true right now.
    - Highlighted `CURRENT BOTTLENECK` callout isolating the single blocker.
    - Collapsible disclosure: `Why Stryde currently sees it this way (N known · N unknown)`.
- **Active Move & Action Reporting Surface:**
  - Prominent next meaningful move card.
  - Truthful ownership and runner state indicators (`Your Next Step` vs. `Queued for background runner (not running yet)`).
  - Inline action completion dock with `Report done`, `Report blocker`, and `Retry` controls.
- **Chronological Pursuit Record:**
  - Numbered, structured ledger entries (`YOU #1`, `STRYDE #2`) displaying dialogue, system reasoning, and formatted Markdown deliverables (headings, code blocks, lists, quotes).
  - Inline expandable `Drafted work` cards.
- **Progressive Context Disclosures (The Ledger):**
  - `<details>` **Working artifacts:** Revision chains (`Latest`, `v1..vN`), formatted/raw reader, and new revision draft controls.
  - `<details>` **Source material & Bounded research:** Link/paste source ingestion, citation provenance with SHA-256 hash snippets, method step adaptation audit (`kept`, `modified`, `dropped`, `flagged`), goal adoption, and bounded web research.
  - `<details>` **Evidence & claims:** Explicit ledger separating `verified`, `evidence linked`, `reported`, `contradicted`, and `unverifiable` claims, with manual verification buttons.
  - `<details>` **What Stryde remembers:** User and pursuit memory facts with `Confirm` and `Forget` controls.
  - `<details>` **Learned procedures:** Custom skills with `Approve`, `Reject`, and `Archive` controls.
  - `<details>` **What Stryde may do on its own:** Autonomy delegation policy and agent assignment controls.
- **Sticky Universal Composer:**
  - Viewport-anchored multi-line composer with `Attach` file trigger, `Voice` transcription toggle, and `Send` button.

## 2. Critical Viewport Targets
- **Desktop Primary:** `1440×900`
- **Laptop / Compact Desktop:** `1280×800`
- **Mobile Primary:** `390×844` (iPhone standard)
- **Mobile Small:** `360×800` (Android standard)
