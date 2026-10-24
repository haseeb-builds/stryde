# UI/UX Reference Analysis — Instagram: @shai.hq “5 free tools, zero slop”

**Analysis date:** 2026-10-23  
**Original post:** https://www.instagram.com/p/DdMCJyagZgR/  
**Creator:** @shai.hq  
**Original post date:** September 12, 2026 (from indexed page metadata)  
**Access status:** Partial direct visual inspection; complete tool list cross-checked against a matching public repost. Do not describe this as a direct visual review of all seven original slides.

## 1. Evidence and access boundaries

**Directly observed in a browser**
- The original Instagram URL opens a seven-slide carousel page with a logged-out registration overlay. In-page navigation to every slide is blocked by that overlay.
- A direct media asset linked from the original post's page metadata was opened in a separate browser session. It visibly presents the SmoothUI resource with the labels “01 / COMPONENTS,” “SmoothUI,” the description “130 animated components that drop straight into shadcn. One command each,” a small screenshot of a component explorer, the URL smoothui.dev and a “01 / 05” tool index.
- Screenshot: `.design-lab/reference-original-carousel-image-2.png`.

**Corroborating public repost**
- Matching five-tool caption found at https://www.instagram.com/p/Ddp-1aPDn4B/ (account @just.build.apps, published September 23, 2026).
- Its caption lists the five resource names below in order. This is evidence of the intended list, but the repost is not the original author and its caption alone does not prove the full visual content of slides 3–7 in the original.
- Repost cover opened and viewed directly. Screenshot: `.design-lab/reference-repost-slide-image-1.png`.
- Repost tool 1 slide opened and viewed directly. Screenshot: `.design-lab/reference-repost-slide-2.png`.

**Caption from the original page metadata**
> If you're vibecoding apps using Claude code then these are gold mine of inspiration and libraries. Bookmark these before they disappear. It's time that you stop building AI slops! Also comment “UI” and I'll DM you all the resources.

**Five resources corroborated by the matching repost caption**
1. SmoothUI — “animated components” — https://smoothui.dev/
2. shadcn MCP — “the registry, inside your agent” — https://ui.shadcn.com/docs/mcp
3. DesignMD Directory — “taste for your agent” — https://designmd.directory/
4. Ora — “is your site agent-ready?” — https://ora.ai/
5. Bencho — “live UI blocks, weekly” — https://bencho.dev/

## 2. Observable visual direction

### Directly visible in the original SmoothUI slide
- Near-black field, with no decorative gradient or glow being used as the main composition.
- Small, dim section index at the top (“01 / COMPONENTS”).
- A clear, simple white heading and short grey supporting description.
- A real product/component-browser screenshot is the main visual evidence; it is not a fictional floating dashboard.
- The source URL and sequence number sit at the bottom of the page, peripheral to the content rather than competing with it.
- The hierarchy is one topic → what it does → its actual interface → where to find it.
- The presentation is intentionally spare, but the screenshot supplies product specificity.

### Directly visible in the matching repost cover and first tool slide
- Portrait 4:5 composition.
- Cover: warm ivory field; tracked small turquoise eyebrow; very large heavy black headline; contrasting turquoise italic phrase; compact explanatory sentence; one large, illustrative pixel-art robot/rocket panel.
- Tool slide: the same family retains a light cream field, black heavyweight heading, grey explanation, direct blue underlined source URL, and a large pixel-art visual of a robot assembling components.
- These visuals are an authored campaign identity. They are not a neutral interface design system for Stryde.

## 3. What the reference is trying to achieve

**DERIVED, high confidence:** Replace improvised, generic generated interfaces with a repeatable craft process: browse a curated component source, let coding agents discover components, create a design-system file, inspect the finished site’s agent accessibility, and use real interactive blocks where they help.

The practical lesson is not “use turquoise and pixel-art robots,” nor “install five tools and the design will become distinctive.” It is **give the builder source material and criteria, choose components intentionally, and show real working output instead of dressing up an empty template**.

## 4. What transfers to Stryde

1. **Show the real product object.** In the relevant Stryde screen, use the actual pursuit state, a truthful next-move/action state, actual conversation content, a source excerpt, an artifact revision, or an outcome report. Never invent a screenshot or fabricate a verified outcome.
2. **One hierarchy per screen.** Let the user understand the goal, the current state and the next meaningful move without making every system subsystem equally prominent.
3. **Keep utilities peripheral.** Source links, sequence numbers, deeper metadata and secondary controls should be easy to find, but should not become the primary story of the screen.
4. **Use discovery tools before writing from scratch.** Search actual component source, inspect its props/dependencies/behavior/license and adapt only the useful part.
5. **Write an explicit visual contract.** DesignMD/Antigravity rules can preserve a Stryde-specific system across sessions; the contract must be built from Stryde's behavior and approved art direction rather than copied from another brand.
6. **Test the user's actual pathway.** Ora can flag machine-discovery issues on a public site; actual desktop/mobile browser checks and Stryde action-state tests remain necessary for UI/UX quality.

## 5. What should not transfer

- Do not copy the cream/turquoise/pixel-art rocket campaign cover into Stryde's app.
- Do not copy SmoothUI's dark component-browsing page wholesale as Stryde's workspace.
- Do not adopt a popular DESIGN.md (Vercel, Linear, shadcn, etc.) as Stryde's full visual system. Use the directory to inspect examples, not to outsource product identity.
- Do not add motion, cursors, or animations solely because a component library provides them.
- Do not present an agent-readiness score as a visual quality score.
- Do not add unauthenticated public API/MCP endpoints merely to raise Ora's score. Stryde currently handles private, user-owned pursuit data; authority and multi-tenancy are stronger product requirements than an arbitrary score.

## 6. Stryde-specific direction to evaluate next

These are hypotheses to test in a new design contract, not an already-approved final visual style:

- Use an **evidence-first pursuit record** as the product-specific concept: a visible history of meaningful changes in reality—user intent, what is known, the selected move, the result reported/observed, and whether the outcome is verified.
- Let the current move grow out of that real state rather than using an ornamental “hero card” on every turn.
- Treat the conversation as the way the user and Stryde reason together, not as the entire product. The persistence and evidence of completed moves are what should distinguish Stryde from ordinary chat.
- Reveal supporting context at the point it materially helps, and give substantial artifacts a dedicated viewing space.
- Use typography, structural rules, precise alignment and authentic content first. Select palette, typeface and surface materials only after comparing at least two materially different art directions; color alone cannot make the system distinctive.
- Preserve state semantics: proposed, started, queued/waiting, blocked, failed, user-reported, observed and verified are not interchangeable.

## 7. Source/tool references

- Original post: https://www.instagram.com/p/DdMCJyagZgR/
- Matching repost containing the five-name caption: https://www.instagram.com/p/Ddp-1aPDn4B/
- SmoothUI AI integration/MCP reference: https://smoothui.dev/docs/guides/ai-integration
- SmoothUI installation reference: https://smoothui.dev/docs/guides/installation
- shadcn MCP reference: https://ui.shadcn.com/docs/mcp
- DesignMD directory: https://designmd.directory/
- Ora: https://ora.ai/
- Bencho: https://bencho.dev/

## 8. Open evidence limits

The logged-out Instagram overlay blocked navigation through all seven original slides. The original SmoothUI slide was independently opened from its post-linked media asset; the cover and tool 1 slide were viewed from the matching repost. Resource names 1–5 are corroborated by the repost's caption. Slides 3–7 from the original were not independently viewed in-page. Do not invent descriptions of their unseen artwork.
