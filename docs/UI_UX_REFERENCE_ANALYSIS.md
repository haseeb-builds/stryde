# UI/UX Reference Analysis — Founder-Supplied Google Stitch Exports (`Auralis` Light-Mode System)

**Analysis date:** 2026-10-25  
**Primary supplied references:** Two Google Stitch export archives uploaded directly by the founder from Stitch project `9193811334822991419`:
1. **Stitch Export 1 (`zip1`):** `code.html` (378 lines) + `screen.png` — *"Auralis - AI Voice Infrastructure"* (Centered editorial hero + framed stage + 3-column 24px card grid).
2. **Stitch Export 2 (`zip2` — Selected Primary Foundation):** `code.html` (493 lines) + `screen.png` — *"Auralis - Bringing technology to life"* (ElevenLabs-inspired warm-stone editorial light mode, asymmetric 12-column hero, `rounded-3xl` `#F3F2EF` interactive stage, pill-tagged horizontal section dividers, and `#FCFCFB` bento cards).

---

## 1. Evidence and Access Boundaries

**Directly observed and extracted**
- Both `.zip` archives (`media_1792870948389_03f67568.zip` and `media_1792870948390_f34f4f85.zip`) were extracted and inspected in full (`code.html` source DOM, Tailwind token config, typography scale, CSS rules, and rendered `screen.png` captures).
- Earlier in the session, direct headless navigation to `https://stitch.withgoogle.com/projects/9193811334822991419` hit a Google authentication gate; the founder then exported and uploaded the exact screen bundles directly, resolving the reference gate with 100% source fidelity.

---

## 2. Observable Visual & Structural System (`zip2/code.html` & `zip1/code.html`)

### A. Surface & Color Architecture (Warm Stone Light Mode)
Unlike generic dark-mode "AI terminal" templates or the rejected muted-sage `.design-lab` explorations, the supplied Stitch exports establish a calm, high-contrast **Warm Stone & Pure Ink** light-mode hierarchy:
- **Canvas Background (`bg-background`):** `#F7F7F5` (Export 2) / `#F9F9F9` (Export 1) — a warm alabaster/stone neutral that avoids clinical blue-white glare while keeping text contrast crisp.
- **Interactive Stage / Container Surface (`bg-panel`):** `#F3F2EF` — a soft warm-stone container surface used for the centerpiece interactive stage and secondary grouping blocks.
- **Elevated Card Surface (`bg-card`):** `#FCFCFB` / `#FFFFFF` — crisp off-white cards that sit cleanly on top of `#F7F7F5` or `#F3F2EF`.
- **Border Hairlines (`border-border`):** `#E7E7E4` — 1px solid stone hairlines (`border-[#E7E7E4]`), paired with subtle hover darkening (`hover:border-zinc-300`).
- **Primary Ink & Actions (`primary`):** `#111111` / `#000000` with `#FFFFFF` text for primary pill buttons (`rounded-full px-6 py-3.5 text-sm font-medium bg-[#111111] text-white hover:opacity-90`).
- **Secondary Text (`muted`):** `#6B6B6B` / `#444748` — balanced warm charcoal for body copy and supporting descriptions.
- **Semantic Status Cues:** Restrained status dots (`w-2 h-2 rounded-full bg-emerald-500`) inside white pill badges (`bg-white border border-[#E7E7E4] px-3 py-1.5 rounded-full text-xs font-medium`) rather than loud multi-colored banners.

### B. Typography & Scale Hierarchy
- **Font Family:** `Geist` (`'Geist', -apple-system, BlinkMacSystemFont, sans-serif`) and `Inter` with `font-feature-settings: "cv02", "cv03", "cv04", "cv11"`.
- **Display Hero Headline (`h1`):** `text-5xl md:text-7xl lg:text-[84px] font-semibold tracking-[-0.04em] leading-[0.95]` — monumental, tightly tracked editorial display type in pure ink (`#111111`), without gradient text or italic serif gimmicks.
- **Section Headings (`h2`):** `text-4xl md:text-5xl font-semibold tracking-[-0.03em] leading-[1.08]`.
- **Card Titles (`h3`):** `text-xl` to `text-2xl font-semibold tracking-tight`.
- **Section Pill Tags:** `text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-[#EBEAE6] text-[#111111]`.

### C. Layout & Rhythm (`zip2/code.html` — Founder-Selected Foundation)
1. **Fixed Translucent Navbar (`h-[72px]`):**
   - `fixed top-0 left-0 right-0 z-50 bg-[#F7F7F5]/80 backdrop-blur-md border-b border-zinc-200/60`.
   - Left: Brand wordmark + clean navigation links (`text-sm font-medium text-zinc-600 hover:text-black`).
   - Right: Quiet `Sign in` link + primary black pill button (`rounded-full bg-[#111111] text-white px-4 py-2 text-sm font-medium`).
2. **Asymmetric 12-Column Hero Header:**
   - Left 7 columns (`lg:col-span-7`): Massive `84px` headline + two pill CTAs (`bg-[#111111] text-white rounded-full` primary + `bg-white border border-[#E7E7E4] rounded-full` secondary).
   - Right 4 columns (`lg:col-span-4 lg:col-start-9`): Concise, grounded paragraph explaining the product without buzzword fluff.
3. **Centerpiece Interactive Product Stage (`rounded-3xl bg-[#F3F2EF] border border-[#E7E7E4] p-6 md:p-8`):**
   - Immediately below the asymmetric hero text sits a full-width tactile stage (`max-w-[1280px]`).
   - Top bar of stage: Scenario switcher pills on the left (`bg-[#111111] text-white rounded-full` active, `bg-white border border-[#E7E7E4] text-zinc-600 rounded-full` inactive) and a live status indicator pill on the right (`w-2 h-2 rounded-full bg-emerald-500`).
   - Center of stage: Interactive product experience (in `Auralis`, an interactive voice canvas; in **Stryde**, our live **"Try-Before-Sign-Up" Pursuit Stage**).
   - Bottom bar of stage: Quick prompt/capability pills on the left + primary action pill on the right.
4. **Pill-Tagged Modular Sections:**
   - Each major section begins with a horizontal rule + pill tag (`<span class="px-3 py-1 rounded-full bg-[#EBEAE6] text-xs font-semibold uppercase tracking-wider">...</span><div class="h-px bg-[#E7E7E4] flex-grow"></div>`).
   - Followed by a 12-column split header (`lg:col-span-5` H2 on left, `lg:col-span-6 lg:col-start-7` explanation on right) and clean `rounded-2xl` / `rounded-3xl` `#FCFCFB` bento cards.

---

## 3. What Transfers to Stryde vs. What Must Be Adapted

### Transfers Directly (Approved by Founder)
- **Exact Warm-Stone Palette & Surface Tokens:** `#F7F7F5` canvas, `#F3F2EF` interactive stage/containers, `#FCFCFB` elevated cards, `#E7E7E4` borders, `#111111` ink primary & pill buttons.
- **Exact Typography & Scale:** `Geist` / `Inter` display scale (`84px` `-0.04em` hero H1, `48px` `-0.03em` section H2, crisp body hierarchy) with minimal monospace use (reserved only for real IDs/timestamps, never as the default label font everywhere).
- **Exact Asymmetric 12-Column Hero + Interactive Stage Composition:** Headlines and actions above, live interactive product stage immediately below.
- **Pill-Tagged Section Dividers & Clean Card Radii:** `rounded-3xl` (`24px`) for primary stages/briefs, `rounded-2xl` (`16px`) for cards, `rounded-full` for primary buttons and switcher pills.

### Adapted Specifically for Stryde's Domain
- **No Audio Waveforms / Voice Orbs / Fake Telemetry:** `Auralis` is an AI voice platform, so its stage features an audio orb, play button, and voice persona cards (`Adam`, `Dorothy`). Stryde is a **persistent pursuit and execution system**. We replace the audio player with Stryde's **Live "Try-Before-Sign-Up" Pursuit Stage**, where a visitor selects a scenario pill or types their own goal and watches Stryde structure their **Current Situation**, **Active Bottleneck**, and **Single Next Move** in real time.
- **No Fabricated Enterprise Logos (`Linear`, `Vercel`, `Raycast`, `Loom`, `Scale`) or Fake Metrics (`99.99%`, `<40ms`):** In compliance with `docs/AI_WEBSITE_DESIGN_ANTI_PATTERNS.md` (E4, E5, E6), we omit unverified third-party logos and latency claims, replacing them with real Stryde product capabilities and truthful state semantics (`Proposed`, `In Progress`, `Queued`, `Reported`, `Verified`).
- **Workspace Continuity:** The exact same Warm-Stone aesthetic (`#F7F7F5` canvas, `#FCFCFB` cards, `#111111` black pill buttons, `rounded-2xl`/`rounded-3xl` geometry) carries directly into the authenticated Pursuits Home (`/`) and Pursuit Workspace (`/pursuits/[id]`), eliminating the jarring visual disconnect between landing page and app.
