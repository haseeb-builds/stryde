# Stryde UI/UX Baseline Audit (Reconciled with Source & Stitch Reference)

**Date:** 2026-10-25  
**Status:** Complete read-only baseline audit across `/` (unauthenticated & authenticated) and `/pursuits/[id]` workspace + sub-panels  
**Branch/HEAD:** `fix/conversation-turn-reliability` / `ca31f20`  
**Target:** Local repository & rendered routes; `stryde-exec-repair` untouched.

---

## 1. Environment & Repository Snapshot

- **Active Worktree:** `c:\Users\DELL\Desktop\Stryde\stryde` on branch `fix/conversation-turn-reliability` (`ca31f202f05762d65f11ed7ae83fabf11315055a`).
- **Separate Worktree:** `c:\Users\DELL\Desktop\Stryde\stryde-exec-repair` (`e56425c`) — untouched.
- **Test & Build Baseline:** 368/368 tests passing, TypeScript 0 errors, ESLint 0 warnings, Next.js build clean, Vercel preview deployment `state: "success"`.
- **Browser Captures Inspected:**
  - Desktop Landing (`1440×900`): `desktop-landing.png`
  - Mobile Landing (`390×844`): `mobile-landing.png`
  - Desktop Authenticated Dashboard (`1440×900`): `desktop-dashboard.png`
  - Desktop Pursuit Workspace (`1440×900`): `desktop-pursuit.png`
  - Mobile Pursuit Workspace (`390×844`): `mobile-pursuit.png`

---

## 2. Anti-Pattern & Product-Experience Findings

| ID / Category | Exact Element / File Evidence | User & Product Impact | Concrete Product-Specific Fix | Severity / Confidence |
|---|---|---|---|---|
| **H1 / B6 — Boxy, monospace-heavy "developer log" styling instead of editorial clarity** | `app/globals.css`, `app/page.tsx`, `app/pursuits/[id]/page.tsx`: Every container uses tight `rounded-[4px]` boxes, muted-sage tinted surfaces (`#eef0ec`, `#d5dad4`), and `font-mono text-[11px] uppercase` on almost every label, button, and status row (`C4 — Monospace as generic tech signal`). | Makes Stryde feel like an internal database admin panel rather than a calm, high-craft pursuit product. Directly caused the founder's complaint that the UI feels "generic, vibe-coded, and cluttered." | Replace the muted-sage `rounded-[4px]` / monospace-everywhere aesthetic with the founder's Stitch Export 2 semantic system: Warm Stone `#F7F7F5` canvas, `#F3F2EF` stage containers (`rounded-3xl`), `#FCFCFB` elevated cards (`rounded-2xl`), `#E7E7E4` borders, `#111111` ink primary with `rounded-full` pill actions, and `Geist` typographic hierarchy. | **High** / High confidence (FACT) |
| **B1 / F8 — Raw login wall on `/` blocks immediate product experience** | `app/page.tsx` lines 325–492: Unauthenticated visitors see a static 3-row box on the left and a raw `Access your pursuit workspace` email/password form on the right. Visitors cannot try or interact with Stryde before creating an account. | Fails to demonstrate Stryde's value interactively. Visitors hit a login wall before seeing how Stryde turns an intention into a structured Situation, Bottleneck, and Next Move. | Implement the Stitch Export 2 asymmetric 12-column hero (`84px` headline `"Turn intention into verified reality."`) above the live **"Try-Before-Sign-Up" Pursuit Stage** (`rounded-3xl bg-[#F3F2EF]`). Move Sign-In / Sign-Up into a clean Warm-Stone Auth Modal triggered from the navbar or when saving the previewed pursuit. | **High** / High confidence (FACT) |
| **Ontology & Plumbing Leakage — Asking user to pick internal agents/runners** | `app/pursuits/[id]/autonomy-row.tsx` lines 18–23, 51–102, 200–248: Exposes `Runners allowed: Hermes / OpenCode / Browser` and a dropdown `Agent for delegated work on this pursuit: [Stryde chooses / Hermes / OpenCode / Browser]`. | Violates the core product rule that users should never have to know or choose which internal agent, runner, or model operates behind the scenes. | Remove all agent/runner selection UI (`WORKER_LABELS`, `agent-preference` dropdown, and `allowed_worker_types` toggles) from user-facing surfaces. Stryde routes work autonomously behind the scenes while still asking permission before consequential actions. | **Critical** (Founder Mandate) / High confidence (FACT) |
| **B6 / B7 / D7 — Duplicate 6-panel dump at the bottom of `/pursuits/[id]`** | `app/pursuits/[id]/page.tsx` lines 1390–1437 AND `app/pursuits/[id]/context-drawer.tsx`: All 6 panels (`PursuitArtifactsPanel`, `PursuitWorkPanels`, `PursuitClaimsPanel`, `PursuitMemoryPanel`, `PursuitSkillsPanel`, `PursuitAutonomyRow`) are rendered inline at the bottom of the main workspace AND duplicated inside `ContextDrawer`. | Creates massive visual noise and redundancy at the bottom of every pursuit page, competing with the conversation stream and Next Move brief. | Remove the inline 6-panel dump from the bottom of `app/pursuits/[id]/page.tsx`. Keep the main workspace focused strictly on: (1) Top "Current Reality & Next Move" Brief Card, (2) Clean Conversation Record, and (3) Universal Bottom Composer. Surface Sources, Verified Claims, Memories, and Deliverables exclusively via the slide-over `"Context & Sources"` drawer when requested. | **High** / High confidence (FACT) |
| **D7 — Redundant Action Outcome Reporting Banners** | `app/pursuits/[id]/page.tsx` lines 1140–1180 AND lines 1443–1463: Clicking `I'm done` or `I'm blocked` opens an inline input inside the Action card AND simultaneously renders a second banner above the bottom composer (`Action finished · Reporting outcome`). | Confuses the user about which input box to type into when reporting an outcome. | Consolidate outcome and blocker reporting into a single smooth inline expansion directly inside the top **Next Move** card (with a dedicated local input state so it doesn't hijack the bottom chat composer). | **High** / High confidence (FACT) |
| **A8 — Low contrast on secondary labels** | Automated axe-core scan flagged `.text-xs` pale labels on light backgrounds (`text-zinc-400`). | Reduces readability and fails WCAG AA contrast thresholds on secondary metadata. | Use `#6B6B6B` (`--ink-secondary`) and `#52525B` on `#F7F7F5` / `#FCFCFB` surfaces, ensuring ≥ 4.5:1 contrast for all readable labels. | **High** / High confidence (FACT) |

---

## 3. Three Mandatory Tests on the Current Baseline

1. **Substitution Test:**
   - *Landing Page (`/`):* Currently fails. The static 3-step box + right-hand login card looks like an internal corporate portal or generic B2B login screen.
   - *Workspace (`/pursuits/[id]`):* Partially passes on data model (it has `understanding`, `bottleneck`, `next_move`, and `activeAction`), but fails on presentation because the 6-panel governance dump and monospace box chrome obscure the primary loop.
2. **Decoration-Off Test:**
   - Removing the `rounded-[4px]` borders and `font-mono` badges exposes duplicated sections (inline panels + drawer panels, inline report input + footer report banner).
3. **Second-Screen & Uncomfortable-State Test:**
   - The underlying state handling in `/pursuits/[id]` is solid (supports `HUMAN` vs `CONTROLLED` queued actions, manual completion fallback, retry on failed turn, file attachment, voice input), and all of these behavioral contracts must be 100% preserved during the visual redesign.
