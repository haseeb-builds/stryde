# AI Website Design Anti-Patterns Reference (Stryde Quality Gate)

Use this checklist during Stitch visual design exploration to avoid falling into generic AI interface tropes.

## 1. Visual Identity & Color (Anti-Patterns A1–A9)
- **A1 — Default Violet/Indigo/Blue Gradient:** Banned. Do not use generic AI purple/indigo gradients or glowing orb graphics.
- **A2 — Gradient Text on Headlines:** Banned. Establish hierarchy through typography, size, scale, and contrast.
- **A3 — Dark Mode as a Technical Shortcut:** Dark surfaces require a specific functional rationale; default to a clean, high-contrast light/stone field.
- **A4 — Decorative Glow & Blurred Blobs:** Remove any ambient glow, blurry background circles, or floating light sources.
- **A5 — Glassmorphism Everywhere:** Avoid frosted-glass cards or layered blur effects. Use solid surfaces with crisp `1px` hairlines.
- **A7 — One Accent Everywhere:** Maintain distinct semantic roles: neutral (`#161917`), signal move (`#c84326`), verified (`#15603c`), waiting (`#7c5100`), blocked (`#a12221`).
- **A8 — Low-Contrast Subtle UI:** All text must meet WCAG 2.1 AA contrast (`>4.5:1` normal, `>3:1` large). Do not wash out labels.
- **A9 — Color as the Only State Signal:** Always pair status colors with explicit text labels and icon/glyph shapes.

## 2. Layout & Composition (Anti-Patterns B1–B13)
- **B1 — Centered Hero Stack:** Avoid the generic "Eyebrow + Giant Slogan + Subtitle + Twin Pill Buttons" stack without concrete evidence.
- **B4 — Exactly Three Icon Feature Cards:** Real product capability determines container forms—not a lazy 3-column card grid.
- **B6 — Everything is a Card:** Use hairlines, whitespace, alignment, and tables. Avoid nesting cards inside cards (B7).
- **B8 — Same Rounded Pill & Shadow Everywhere:** Define border-radius by function (4px–8px for inputs/cards). Avoid giant 9999px pills for standard buttons.
- **B12 — Fake Product Mockup as Filler:** Never display impossible mockups, fictional graphs, or fabricated dashboard widgets.
- **B13 — Decorative Sparklines:** Do not add fake trendlines or charts that do not carry verified user data.

## 3. Typography & Copy (Anti-Patterns C1–C8, E1–E11)
- **C2 — Flat Hierarchy:** Maintain unmistakable contrast between headings, body text, and monospace metadata tags.
- **C4 — Monospace Overuse:** Reserve monospace (`Geist Mono`) for turn numbers (`#1`), hashes (`SHA-256`), and status codes (`ACTIVE`).
- **E1 — Interchangeable Marketing Copy:** Avoid phrases like *"Unlock the power of AI"*, *"Transform your workflow"*, or *"Supercharge productivity"*.
- **E4 — Fabricated Testimonials & Proof:** Never invent customer logos, testimonials, or fake success metrics.

## 4. The 3 Diagnostic Design Tests
1. **The Substitution Test:** If the brand name "Stryde" were swapped with another AI brand, could the screen transfer unchanged? If yes, it lacks product specificity.
2. **The Decoration-Off Test:** If you strip all accent colors, borders, and shadows, does the hierarchy still communicate: *Intention → Bottleneck → Next Move → Verified Outcome*?
3. **The Second-Screen / Uncomfortable-State Test:** Does this visual language still work gracefully when an action is blocked, a worker is merely queued, verification is missing, or the network is stalled?
