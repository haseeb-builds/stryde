# Stryde

Stryde is a persistent situational-intelligence workspace under active development.

The repository is the durable project memory. Current database truth is the connected Supabase project. Deployment truth is the Vercel deployment and its runtime evidence. Tests and verification artifacts are evidence. Chat history is not canonical project memory.

## Canonical project documents

Read these before changing behavior:

1. docs/PRODUCT.md
2. docs/ARCHITECTURE.md
3. docs/STATE.md
4. docs/DECISIONS.md
5. docs/INTEGRATIONS.md
6. docs/RUNTIME.md
7. docs/VERIFICATION_MATRIX.md
8. docs/OPERATING_MODEL.md
9. HANDOFF.md
10. docs/RESEARCH_REALITY_ENGINE.md
11. docs/SUBSCRIPTION_AND_RESOURCE_MODEL.md
12. docs/RESEARCH_COST_CONTROL.md
13. docs/BILLING_PROVIDER_ARCHITECTURE.md
14. docs/AI_CAPABILITY_LANDSCAPE_AND_GAPS.md
15. docs/GLM_MASTER_IMPLEMENTATION_BRIEF.md
16. docs/COMMERCIAL_OPEN_SOURCE_AND_LAUNCH_STRATEGY.md
17. docs/GLM_RESUME_MANDATE.md

Historical STEP documents preserve implementation history and should not override the current-state documents.

## Development

Install dependencies with npm ci.

Available scripts:
- npm run dev
- npm run build
- npm run lint
- npm test
- npm run worker:dispatch

Do not treat successful build/typecheck/lint as proof of production behavior.
