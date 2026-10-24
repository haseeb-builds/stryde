---
trigger: always_on
description: Mandatory Stryde-specific design gate for every UI/UX audit, concept, implementation, or review.
---

# Stryde UI/UX Quality Gate

Before material UI/UX work, read `@docs/AI_WEBSITE_DESIGN_ANTI_PATTERNS.md` and follow the full contract. Do not merely mention that it was read.

- The earlier `.design-lab/01-04` concepts are **rejected visual directions**. Do not reuse their composition, sage-green palette, generic pursuit rail, centered chat lane, or next-move card treatment. They are not approved brand references.
- Never choose a style, palette, font, layout, component kit, or motion treatment before inspecting actual Stryde behavior, supplied references, product invariants, and the current design. The absence of the old look is not, by itself, a new art direction.
- Never use the default SaaS recipe, three equal feature cards, cards around everything, decorative gradients/glows/noise, fake product mockups, arbitrary asymmetry, generic AI copy, or excessive status pills without a written product-specific reason.
- Keep evidence distinct from assumptions. Show real product-specific workflow and state; label sample content; never invent customers, claims, capabilities, sources, execution, persistence, or verification.
- The first visual deliverable must be an isolated, reviewable preview with realistic states. Do not mutate application code until the baseline audit, reference analysis, and design contract have passed the approval gate.
- Preserve the universal composer, natural user-facing language, truthful action lifecycle, reported/observed/verified distinctions, manual completion/blocker fallback for queued work, authentication/multi-tenancy, SSE event contract, persistence, artifacts/revisions, memory controls, source lineage, and existing API payloads.
- Inspect rendered UI in a real browser. Test route/state coverage, desktop, laptop-height, mobile, long text, keyboard/focus, contrast, error recovery, console errors, and horizontal overflow.
- Use installed focused skills rather than recreating their guidance. For implementation, use the requested Gemini 3.8 Flash model only after design approval. Use Argon 4 for decision-quality design and independent critique when available in the user's Antigravity model selector. Never claim a model or tool ran unless the result is observed.
- Do not deploy, migrate production data, touch the separate `stryde-exec-repair` worktree, or overwrite unrelated untracked work without explicit authorization.

The accepted outcome is a product-specific interface that makes the real pursuit loop clearer—not merely a tidy or “less AI-looking” skin.
