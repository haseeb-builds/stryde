---
name: Stryde Operational Baseline
colors:
  surface: '#ffffff'
  surface-dim: '#f6f7f4'
  surface-bright: '#ffffff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f7f4'
  surface-container: '#eef0ec'
  surface-container-high: '#e5e9e3'
  surface-container-highest: '#d5dad4'
  on-surface: '#161917'
  on-surface-variant: '#3f4742'
  inverse-surface: '#161917'
  inverse-on-surface: '#ffffff'
  outline: '#d5dad4'
  outline-variant: '#9ea79f'
  surface-tint: '#c84326'
  primary: '#161917'
  on-primary: '#ffffff'
  primary-container: '#f6f7f4'
  on-primary-container: '#161917'
  secondary: '#3f4742'
  on-secondary: '#ffffff'
  secondary-container: '#eef0ec'
  on-secondary-container: '#3f4742'
  signal: '#c84326'
  on-signal: '#ffffff'
  verified: '#15603c'
  on-verified: '#ffffff'
  waiting: '#7c5100'
  on-waiting: '#ffffff'
  blocked: '#a12221'
  on-blocked: '#ffffff'
  background: '#f6f7f4'
  on-background: '#161917'
typography:
  display-lg:
    fontFamily: Geist Sans, system-ui, sans-serif
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.025em
  headline-md:
    fontFamily: Geist Sans, system-ui, sans-serif
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  body-base:
    fontFamily: Geist Sans, system-ui, sans-serif
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-bold:
    fontFamily: Geist Sans, system-ui, sans-serif
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  mono-code:
    fontFamily: Geist Mono, monospace
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-caps:
    fontFamily: Geist Mono, monospace
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  lg: 0.75rem
---

# Design System: Stryde Operational Baseline (Current System)
**Project ID:** Pending Stitch Project Initialization  
**Baseline Status:** Extracted from active application source (`app/globals.css`, `app/page.tsx`, `app/pursuits/[id]/*.tsx`).  
> **Notice:** This document captures the *existing baseline* design system. It serves as the starting foundation for visual exploration in Google Stitch, not the locked final design.

---

## 1. Visual Theme & Atmosphere
The Stryde operational baseline is an intentional, distraction-free environment built around high-density editorial discipline. Rather than defaulting to generic SaaS glassmorphism or floating colorful gradients, the interface draws inspiration from Swiss modernist typography, GitHub issues, and Linear. It feels like an evidence-aware operational brief: austere, calm, highly legible, and rigorous about state.

The background field is a warm bone/limestone neutral (`#f6f7f4`), layered with crisp paper-white operational cards (`#ffffff`) and subtle recessed wells (`#eef0ec`). Structural distinction is achieved through razor-thin `1px` hairlines (`#d5dad4`) rather than blurry drop shadows. Color is deployed sparingly and strictly for functional meaning: an energetic burnt sienna (`#c84326`) isolates the single active move, while verified facts receive a quiet forest green (`#15603c`).

---

## 2. Color Palette & Roles

### Primary Foundation
- **Canvas / Root Background (`#f6f7f4`):** Warm limestone neutral that eliminates glare and establishes an editorial, printed document feel.
- **Surface / Card Background (`#ffffff`):** Pure white container surface for active dialogue, operational brief summaries, and focus areas.
- **Surface Subtle / Wells (`#eef0ec`):** Recessed wells for disclosures, search inputs, code snippets, and metadata blocks.
- **Hairline Rules (`#d5dad4`):** Architectural boundary lines defining sections and header barriers without visual weight.
- **Rule Strong (`#9ea79f`):** Higher-contrast dividers used for active card outlines and focus states.

### Accent & Interactive
- **Primary Ink (`#161917`):** Deep carbon black used for high-emphasis headings, active button fills, and primary text.
- **Signal Sienna (`#c84326`):** High-salience burnt sienna reserved exclusively for the active "Next Meaningful Move" and progress anchors.

### Typography & Text Hierarchy
- **Ink Primary (`#161917`):** Maximum contrast (`>14:1`) for body text, dialogue, and primary inputs.
- **Ink Secondary (`#3f4742`):** Medium carbon neutral (`>8:1`) for descriptions, instructions, and secondary summaries.
- **Ink Muted (`#56605a`):** WCAG AA compliant muted neutral (`>6.2:1`) for metadata, turn sequence tags (`#1`, `#2`), and timestamps.

### Functional States
- **Verified (`#15603c`):** Deep forest green denoting independently observed, source-backed, or verified facts.
- **Waiting / Queued (`#7c5100`):** Warm ochre amber for queued background tasks, awaiting user input, or unverified claims.
- **Blocked / Error (`#a12221`):** Crimson red for blocked paths, API errors, or failed attempts.

---

## 3. Typography Rules

### Hierarchy & Weights
- **Display Headings (`32px / 38px`, font-bold, -0.025em tracking):** Reserved for unauthenticated intake and primary page titles.
- **Operational Titles (`20px / 28px`, font-semibold, -0.02em tracking):** Used for pursuit titles and operational brief anchors.
- **Body Measure (`15px / 24px`, font-normal, max-width 68ch–72ch):** Comfortable, scannable measure for conversation turns and artifact reading.
- **Monospace Tags (`11px / 16px`, font-semibold, uppercase, 0.08em tracking):** Fixed-pitch typographic labels for state codes (`ACTIVE`, `STALLED`), event actors (`YOU #1`, `STRYDE #2`), and citation hashes.

### Spacing Principles
- Consistent `8px` spatial grid with tight internal card padding (`p-4` to `p-6`).
- No arbitrary white space; spacing separates distinct causal steps in the pursuit loop.

---

## 4. Component Stylings

### Buttons
- **Primary Action (`bg-[#161917] text-white hover:bg-black`):** Crisp high-contrast rectangular button with gentle `rounded-md` (6px) corners.
- **Secondary Action (`bg-[#eef0ec] text-[#161917] hover:bg-[#e5e9e3]`):** Neutral utility button for cancel, secondary filters, and disclosures.
- **Signal Button (`bg-[#c84326] text-white hover:bg-[#b03a20]`):** Prominent button for authorizing or executing the recommended next move.

### Cards & Operational Containers
- Flat white containers with `1px border border-[#d5dad4]`, flat or minimal `shadow-sm`, and `rounded-lg` (8px) corners.
- Cards never nest more than one level deep.

### Navigation & Pursuit Switcher
- Compact horizontal shell (`h-14`) with inline `<details>` dropdown for searching and selecting pursuits without leaving the current view.

### Inputs & Composer
- Clean text fields with `1px border border-[#d5dad4] focus:border-[#161917] focus:ring-1 focus:ring-[#161917]`.
- Sticky multi-line composer with accessory icons (`Attach`, `Voice`) positioned along the bottom edge.

### Disclosures & Ledgers
- Semantic HTML `<details>` and `<summary>` tags styling supporting material (artifacts, sources, evidence, memory) as collapsible ledger rows with clean arrow indicators.

---

## 5. Layout Principles
- **Desktop (1440px):** Single centered operational column (`max-w-4xl`) containing the Top Operational Brief, Pursuit Record ledger, and progressive context disclosures.
- **Mobile (390px):** Single vertical stream with touch targets `>= 44px`, compact header with collapsed pursuit switcher, and fixed bottom composer respecting safe areas.

---

## 6. Design System Notes for Stitch Generation
- **Atmosphere:** Think "Stripe Press meets Linear operational ticket". Authoritative, calm, truthful, without decorative neon or generic chatbot bubbles.
- **Key Descriptors:** Monochromatic limestone background, crisp architectural borders, burnt sienna active move anchor, forest green verification badges, tabular monospace tags, structured chronological ledger.
- **Avoid:** Purple/indigo gradients, floating glass blur, oversized circular avatars, decorative 3D robot graphics, fake analytics sparklines.
