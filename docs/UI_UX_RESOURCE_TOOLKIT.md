# Stryde UI/UX Resource Toolkit — Installed and Verified

**Date:** 2026-10-23  
**Purpose:** Make the five resources from the @shai.hq carousel available in Stryde's Antigravity workflow, without installing an indiscriminate component pile or importing someone else's visual identity.

## Current integration status

| Resource | Integration/status | What it is for | Guardrail |
|---|---|---|---|
| shadcn MCP | Configured in workspace `.agents/mcp_config.json`; verified registry discovery via shadcn CLI | Allows Antigravity to query the shadcn-compatible component registry | Needs Antigravity to reload/reopen the workspace for the MCP server to appear in the agent tool list; don't install any component without reviewing code/dependencies. |
| SmoothUI | Registry configured in `components.json` as `@smoothui`; CLI verified 275 registry items are discoverable | Source for individual React UI/interaction components | No SmoothUI components have yet been added to Stryde. Check component accessibility, motion cost, license, compatibility and design fit before install. |
| DesignMD Directory | `designmd-cli` was run via `npx`; catalog is available; no third-party brand DESIGN.md has been installed | Browse design-system examples and query/reference material | Do not install Vercel/Linear/shadcn branding as Stryde's design identity. Create Stryde's own `DESIGN.md` only after the founder-approved art direction. |
| Ora | `ax` CLI was run via `npx`; a read-only audit of the public alias completed; the verified Ora skill is installed at `.agents/skills/agent-ready-website/SKILL.md` | Public-site agent-readiness and discoverability assessment | Ora's grade is not visual UX quality. Do not make APIs public or add auth/discovery endpoints only to increase a score; reconcile with Stryde's security/product goals first. |
| Bencho | Catalog/reference: https://bencho.dev/ | Inspect live UI blocks and micro-interactions; consider copying only source that solves a real interaction problem | No global MCP/CLI/package installation was identified in the reviewed material. Use it as a source gallery; inspect source, license, dependencies and interaction before adopting a component. |

## Verified commands

Run from the Stryde repository root:

- Inspect detected stack and UI registry state: `npx --yes shadcn@latest info --json`
- Search SmoothUI components: `npx --yes shadcn@latest list "@smoothui"`
- Inspect Ora CLI commands: `npx --yes ax --help`
- Audit public site agent readiness: `npx --yes ax audit https://stryde-topaz.vercel.app --json`
- Search DesignMD resources: `npx --yes designmd-cli search "editorial workflow"`
- List DesignMD resources: `npx --yes designmd-cli list`

These commands were invoked through `npx`; the package runners themselves were not added to Stryde's app dependencies. The shadcn registry query showed 275 items after configuring the root registry URL `https://smoothui.dev/r/{name}.json`. A style-prefixed URL generated a 404 when the CLI queried the registry index, so it was replaced with the verified working root URL.

## Antigravity reload/verification step

The Stryde project now includes workspace MCP configuration. Reopen/reload this project in Antigravity and inspect the MCP panel / `/mcp` list. Verify that `shadcn` is connected and that the agent can search the `@smoothui` registry before asking it to add any UI components. The separate desktop MCP tools already configured globally should not be duplicated or rewritten.

## Ora public-alias scan — 2026-10-23

Command: `npx --yes ax audit https://stryde-topaz.vercel.app --json`

Ora's completed result:
- Score: **24/100**, grade **F**.
- Discovery: 3/11.
- Access: 10/54.
- Usability: 17/62.
- Ora scan time: `2026-10-23T06:45:40.616Z`.
- It reports the public landing route is reachable to the tested agents, but raw HTML contains only 307 characters of content, no sitemap, and no agent discovery files. It does not detect a public API or public MCP surface; authentication appears to gate the API.

Interpretation:
- This is a site discoverability/agent-readiness score, not a visual design score, WCAG conformance score, or proof that the authenticated Stryde workspace is unusable.
- Several suggested checks (public SDK, public API, OAuth for autonomous external agents, catalog endpoints, etc.) are not automatically suitable for a personal pursuit product with user-owned data and strict authorization. Do not act on them without a separate threat-model/product decision.
- Relevant follow-up: compare the public alias, source repository and current deployment; decide deliberately what public docs/discovery should exist. Keep authenticated user data and action APIs protected.
- The same public alias visually shows the current sign-in/landing screen in a read-only browser; that is different evidence from the local authenticated workspace, which remains unverified.

## Component selection rule

The anti-pattern catalog and approved Stryde design contract take precedence over a library's demo/presentation style. Before each installation:
1. State the exact user interaction or state it improves.
2. Inspect the component source, install command, transitive dependencies, license and responsive/accessibility behavior.
3. Decide whether Stryde can do it more simply with existing CSS/React primitives.
4. Add only the selected source and dependencies needed for the approved design.
5. Render it in the real app at desktop and mobile widths and test its actual behavior.

**Nothing in this tool setup approves a visual direction or authorizes changes to the real app UI.**
