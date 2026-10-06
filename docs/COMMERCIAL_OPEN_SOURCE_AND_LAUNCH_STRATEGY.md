# Stryde Commercial, Open-Source, and Launch Strategy

Status: strategic direction
Date: 2026-10-06

## 1. Recommendation

Do not fully open-source the entire Stryde product right now.

Build Stryde to a real production-capable vertical slice first, keep the semantic/control-plane advantages private while the product thesis is being validated, and revisit open-sourcing after the moat and unit economics are clearer.

Recommended long-term model:

> Open-core / selective open source, with the hosted Stryde service retaining the highest-value control-plane and operational layers.

## 2. Why not fully open source now

Stryde is still changing rapidly. Full public source disclosure now would expose unfinished architecture, proprietary control-plane decisions, billing/resource policy, research planner implementation, evaluation methodology, internal security assumptions, production weaknesses, and future differentiation before it is validated.

The immediate objective is not community size. It is to prove the pursuit loop, research/evidence loop, capability composition, cost economics, and willingness to pay.

## 3. What can eventually be open sourced

Good candidates include capability interfaces/contracts, provider adapters where licenses allow, MCP interoperability, skill format, plugin manifest/specification, local tooling, SDK/client, public API types, selected UI components, documentation, benchmark/evaluation harnesses, and self-hostable basic primitives.

## 4. What should remain private initially

Keep private while the business is proving itself: Stryde semantic control-plane implementation, adaptive pursuit controller, production research planner, cost-aware routing policy, entitlement/resource enforcement implementation, proprietary evaluation datasets, outcome-learning heuristics, abuse prevention, production security controls, operational telemetry, billing/commercial infrastructure, proprietary ranking/routing data, and customer-derived improvements.

## 5. The actual moat

The moat should not simply be secret TypeScript. Stronger defensibility comes from longitudinal pursuit state, evidence/provenance, real-world outcome history, user-specific effectiveness learning, capability routing, authority, cost-aware planning, verified observations, operational reliability, accumulated skills, and the product UX around continuous pursuits.

## 6. Open-source business options

Potential revenue can come from hosted Stryde, Pro/Max resource capacity, premium research/providers, managed connectors, background execution, team/organization features, enterprise controls, premium verification/data sources, managed security, higher limits, support, private deployments, and API usage.

> Open source can increase adoption; hosted services monetize convenience, scale, proprietary operations, and higher-value capability.

## 7. License strategy

Do not choose a single OSS license casually. Evaluate MIT, Apache-2.0, AGPL-3.0, source-available licenses, and commercial dual licensing per layer. License choice affects commercial reuse, hosted competition, derivatives, patents, contributions, and distribution.

## 8. Current repository posture

The repository is already public. That is different from declaring the whole Stryde runtime a stable open-source platform. Before making that promise, define the intentional public API and supported extension boundaries.

## 9. Production infrastructure reality

Vercel Hobby is currently limited to personal/non-commercial use by its terms, so it should not be treated as the production commercial hosting plan. Supabase Free also has bounded quotas and usage limits. Vercel may change or discontinue Hobby conditions, and Supabase has defined Free-plan usage ceilings.

Sources: https://vercel.com/legal/terms and https://supabase.com/docs/guides/platform/billing-on-supabase

> A free infrastructure stack is a development advantage, not the business model.

Before real paid usage, establish a commercial hosting plan and a measured variable-cost model. Do not pay for unnecessary scale before users exist, but do not accept commercial traffic under terms that prohibit it.

## 10. Domain

The current Vercel topaz deployment domain is acceptable for development/internal testing. For serious public launch, use a Stryde-owned custom domain.

## 11. Marketing recommendation

Reserve the Stryde Instagram identity early, but do not start expensive serious marketing before there is product proof.

Recommended sequence:

working product → real user results → credible demo → waitlist/access → testimonials/case studies → serious launch content → paid acquisition after economics are known

## 12. What to market

Do not lead with Postgres, MCP, Firecrawl, Exa, skill graphs, or model routing.

Lead with behavior:

> Stryde investigates reality, does the work it is authorized to do, watches what changed, verifies what it can, and keeps important goals moving.

The evidence thesis is a useful recurring message:

> AI can generate the plan. Reality decides whether it worked.

## 13. Instagram content pillars

Show pursuit in action, research, reality checks, execution, verification, and learning. The point is to demonstrate the system's behavior, not to advertise an architecture diagram.

## 14. Launch threshold

Before a serious marketing push, target at least: stable production domain, authenticated signup, reliable pursuit/conversation loop, real research, real capability execution, observation, verification, one useful artifact, honest failure handling, usage metering, meaningful Free plan, a small set of external testers, evidence of retained use, and known variable cost per active user.

## 15. Commercial strategy

Free proves value. Pro supports serious individual use. Max supports intensive individual use. Team/Business can come later after the individual pursuit system is proven.

## 16. Open-source timing

Stage A — now: public repository, selective disclosure, rapid validation.

Stage B — after product proof: open selected contracts, SDKs, MCP/plugin specs, adapters, tooling, and evaluation components where that increases adoption.

Stage C — after moat clarification: decide which larger runtime layers should be open source, source available, dual licensed, or hosted-only.

## 17. Final recommendation

> Build first. Validate first. Monetize second. Open-source selectively after the valuable boundaries are known. Market seriously after there is evidence worth marketing.

Do not let open-source strategy or Instagram become another form of avoiding the core build.

## 18. Current build priority

This document is downstream of docs/GLM_MASTER_IMPLEMENTATION_BRIEF.md.

The immediate job remains the capability-composition layer.

Marketing, open-source packaging, and scale infrastructure are downstream of that build.
