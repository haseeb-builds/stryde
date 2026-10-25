# Stryde Product-Specific Design Brief & Contract (Stitch Warm-Stone Edition)

**Status:** Founder-Interviewed Design Contract — Ready for Isolated Browser Preview & Final Approval  
**Date:** 2026-10-25  
**Reference Authority:** Founder-supplied Google Stitch Export 2 (`zip2/code.html` & `zip2/screen.png`, Stitch project `9193811334822991419`) + `docs/AI_WEBSITE_DESIGN_ANTI_PATTERNS.md` + `docs/PRODUCT_CONSTITUTION.md`  
**Design Reasoning Model:** Gemini 4 Argon (High)

---

## 1. Product, Audience, and Primary Job

Stryde is a persistent pursuit and execution system that moves a person's meaningful goal from **intention to verified reality**.
- **Primary User Job:** Know where my pursuit stands right now (*Current Situation*), what is blocking progress (*Active Bottleneck*), what the single recommended action is (*Next Move*), and what actually changed in reality (*Reported vs. Verified Outcome*)—without drowning in chat history or configuring AI agents.
- **Core Differentiator:** The connected **5-Stage Truth Loop**:
  `Intention → Situation → Evidence → Next Move → Verified Learning`

---

## 2. Settled Founder Decisions (From 3-Round Design Interview)

1. **Primary Layout & Visual System (`zip2/code.html`):**
   - Use **Stitch Export 2's** warm-stone editorial light mode (`#F7F7F5` canvas, `#F3F2EF` stage containers, `#FCFCFB` elevated cards, `#E7E7E4` 1px borders, `#111111` ink primary with `rounded-full` pill buttons, and `Geist` `84px` `-0.04em` display typography).
   - **Hero Headline:** *"Turn intention into verified reality."*
2. **Centerpiece Interactive Hero Stage ("Try-Before-Sign-Up"):**
   - Replace the raw login wall on `/` with the asymmetric 12-column hero header followed immediately by the large `rounded-3xl bg-[#F3F2EF] border border-[#E7E7E4]` interactive **Pursuit Stage**.
   - Visitors can click top scenario pills (*"Launch SaaS"*, *"Fix Revenue Bottleneck"*, *"Career Pivot"*) or type their own goal directly into the stage, immediately seeing Stryde map out **Current Situation**, **Key Blocker**, and **Single Next Move** inside the stage.
   - Clicking *"Continue & Save Pursuit"* (or *"Sign in"* in the navbar) opens a clean **Warm-Stone Auth Modal** that preserves their typed pursuit automatically.
3. **Landing Page Modular Sections Below the Hero:**
   - Introduced by Stitch Export 2's signature pill tag + horizontal `1px` stone rule:
     - **Section 01 (`The Truth Loop`):** 5-stage bento breakdown (*Intention → Situation → Evidence → Next Move → Verified Learning*).
     - **Section 02 (`Execution & Honesty`):** Interactive cards demonstrating grounded web research, background execution with manual fallback, and the strict distinction between *Self-Reported* and *Verified* outcomes.
     - **Section 03 (`Pricing & Access`):** Clean Free vs. Pro `#FCFCFB` comparison cards (backed by Paddle Merchant of Record) + final minimal dark CTA block.
4. **Signed-In Home Dashboard (`/` when authenticated):**
   - Shows a clean **Pursuits Home** on `#F7F7F5`: a prominent *"Start a new pursuit"* stage (`bg-[#F3F2EF] rounded-3xl`) at the top, and a clean grid/list of active pursuit cards (`bg-[#FCFCFB] rounded-2xl border border-[#E7E7E4]`) below showing each pursuit's Title, Status Pill, and Next Move summary.
5. **Inside the App Workspace (`/pursuits/[id]`):**
   - **Zero Agent / Model Clutter:** Completely remove all UI asking the user to pick an agent (`Hermes`, `OpenCode`, `Browser`, `agent-preference`) or exposing internal worker routing. Stryde acts as one unified intelligence.
   - **Decluttered Single-Column Focus + Collapsible Left Sidebar:**
     - Left collapsible pursuit switcher rail with a quiet, dignified *"Free Plan · Upgrade"* row at the bottom.
     - Top **"Current Reality & Next Move" Brief Card** (`bg-[#FCFCFB] rounded-3xl border border-[#E7E7E4]`): shows the pursuit title, current situation synthesis, active bottleneck callout, and the highlighted **Next Move**.
     - **Inline Outcome Reporting (Zero Popups):** Clicking *"Report Outcome"* or *"I'm Blocked"* smoothly expands an inline reporting bar right inside the Next Move card.
     - **Single Slide-Over "Context & Sources" Drawer:** Remove the duplicate 6-panel dump from the bottom of the workspace. Sources, Verified Claims, Memories, and Deliverables open cleanly in a single right-hand drawer when the user clicks the top-right `"Context & Sources"` pill.
     - **Universal Bottom Composer:** Clean `rounded-2xl bg-[#FCFCFB] border border-[#E7E7E4]` bar with paperclip attachment, voice input toggle, natural-language textarea, and `#111111` black pill Send button.

---

## 3. Semantic Design Tokens (Derived from Stitch Export 2)

| Token Role | CSS Custom Property | Value | Usage |
|---|---|---|---|
| **Canvas Background** | `--canvas` | `#F7F7F5` | Primary page & workspace background |
| **Stage / Container** | `--surface-subtle` / `--panel` | `#F3F2EF` | Interactive hero stage, nested callout wells, sidebar background |
| **Elevated Card** | `--surface` / `--card` | `#FCFCFB` | Brief card, bento cards, pursuit cards, composer bar |
| **Pure Surface** | `--surface-pure` | `#FFFFFF` | Active pills, modal dialogs, input fields |
| **Tag Fill** | `--surface-muted` | `#EBEAE6` | Section pill tags, subtle badges |
| **Border Hairline** | `--rule` | `#E7E7E4` | Standard 1px container and divider borders |
| **Border Strong** | `--rule-strong` | `#D4D4D0` | Hover/active borders, input focus rings |
| **Primary Ink** | `--ink` | `#111111` | Display headlines, titles, primary pill button fill |
| **Secondary Ink** | `--ink-secondary` | `#52525B` | Body copy, explanations (WCAG AA compliant ≥ 7:1 on `#F7F7F5`) |
| **Muted Ink** | `--ink-muted` | `#6B6B6B` | Metadata, timestamps, helper text (WCAG AA compliant ≥ 4.8:1 on `#F7F7F5`) |
| **Verified Status** | `--verified` / `--verified-wash` | `#059669` / `#ECFDF5` | Independently verified outcomes & active status dot (`#10B981`) |
| **Waiting / Queued** | `--waiting` / `--waiting-wash` | `#B45309` / `#FFFBEB` | Bottleneck callouts, queued background runner steps, reported (unverified) state |
| **Blocked / Error** | `--blocked` / `--blocked-wash` | `#DC2626` / `#FEF2F2` | Blocked actions, inline errors, retry alerts |

---

## 4. Component Disposition Matrix (Phase 5 Preparation)

| Existing File / Component | Action | Details |
|---|---|---|
| `app/globals.css` | **Restyle tokens** | Update CSS custom properties from muted-sage to Stitch Export 2 Warm Stone (`#F7F7F5`, `#F3F2EF`, `#FCFCFB`, `#E7E7E4`, `#111111`). |
| `app/page.tsx` (Unauthenticated) | **Restructure visual hierarchy** | Implement Stitch Export 2 navbar, 12-col asymmetric hero, live "Try-Before-Sign-Up" Pursuit Stage (`#F3F2EF`), 3 pill-tagged sections, and Warm-Stone Auth Modal (preserving `signIn`, `signUp`, and pending pursuit handoff). |
| `app/page.tsx` (Authenticated) | **Restyle & refine** | Clean Pursuits Home on `#F7F7F5` with top `rounded-3xl bg-[#F3F2EF]` intake stage and `rounded-2xl bg-[#FCFCFB]` pursuit cards + quiet billing control. |
| `app/pursuits/[id]/page.tsx` | **Restructure visual hierarchy** | Add collapsible left pursuit sidebar, restyle Top Brief & Next Move card (`rounded-3xl bg-[#FCFCFB]`), keep inline outcome reporting strictly inside the Next Move card, remove duplicate 6-panel bottom dump, and restyle Universal Bottom Composer (`rounded-2xl bg-[#FCFCFB]`). |
| `app/pursuits/[id]/autonomy-row.tsx` | **Remove agent/runner picker** | Remove `agent-preference` dropdown and `HERMES`/`OPENCODE`/`BROWSER` buttons so internal agent routing is never exposed to the user; keep simple human-readable permission toggles inside the Context Drawer. |
| `app/pursuits/[id]/context-drawer.tsx` | **Restyle without behavior change** | Restyle slide-over drawer to Warm Stone (`#F7F7F5` / `#FCFCFB`) with clean pill tabs for Sources, Evidence, Memory, Deliverables, and Permissions. |
