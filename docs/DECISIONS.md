# Stryde Decision Register

Status: canonical decision register
Reconciliation date: 2026-10-02

## Product decisions

### D1 — One universal control surface
LOCKED.
The user interacts primarily through one composer. Internal workflow types are hidden from normal UX.

### D2 — User cognition is scarce
LOCKED.
Stryde should absorb ambiguity and operational complexity rather than reflecting it back as forms, modes, or workflow configuration.

### D3 — Mode selection is automatic
LOCKED.
Stryde chooses whether to interpret, research, reconcile, ask, act, delegate, verify, wait, or continue based on the current situation. Users can express explicit intent naturally and use small optional controls.

### D4 — Evidence-aware honesty
LOCKED.
Stryde distinguishes source claims, inference, reported information, observation, verification, contradiction, and unknowns. It should challenge unsupported assumptions and may recommend not acting.

### D5 — Outcome over answer quality
LOCKED.
A good interaction changes pursuit state and, where possible, reality. Beautiful prose is not the target metric.

### D6 — Model independence
LOCKED.
Models are replaceable intelligence providers. Better GPT/Claude/Gemini/other models should improve Stryde rather than redefine it.

### D7 — Personal longitudinal state
LOCKED as a direction.
Stryde should learn from constraints, decisions, actions, failures, outcomes, corrections, and patterns. Exact storage/retrieval architecture remains open.

### D8 — Automatic verification
LOCKED.
When a reliable observation path exists, Stryde verifies itself. Ask the user only for missing reality it genuinely cannot observe.

### D9 — Configurable authority/autonomy
LOCKED as a direction.
Support bounded suggestion, preparation, delegation, and autonomous operation with explicit scope and escalation policy. Exact V1 policy remains open.

### D10 — Third-party technology boundary
LOCKED.
Reuse, wrap, adapt, combine, or reconstruct third-party technology case-by-case. Stryde owns semantic control, state, authority, evidence, verification, learning, and continuation.

### D11 — Appropriate evidence, not primary-source absolutism
LOCKED.
Prefer authoritative/original sources where appropriate, but choose evidence according to the question and stakes.

### D12 — Social later
UNLOCKED for V1.
Community may eventually increase pursuit value, but it must not become a generic feed.

## Engineering decisions

### D13 — Postgres remains V1 system of record
LOCKED for now.
Do not add a second canonical database simply to satisfy a memory/agent trend.

### D14 — No giant agent framework by default
LOCKED.
Add LangGraph, Letta, LiteLLM, Temporal, or similar only when a demonstrated problem justifies the added abstraction and ownership boundary.

### D15 — No casual migration reset
LOCKED.
Live Supabase migration history is not one-to-one with repository files. Reconcile before destructive or schema-reset actions.

### D16 — Production proof is required
LOCKED.
No claim of production readiness without deployed authenticated E2E evidence appropriate to the feature.

## Open decisions

- exact initial user wedge;
- authority policy beyond the V1 grammar (implemented 2026-10-03 as a
  tighten-only policy: delegation on/off, worker-type allowlist, research
  on/off; it can refuse, never approve — per-action approval is unchanged);
- memory implementation beyond the V1 lifecycle (implemented 2026-10-03:
  confirmation, model-proposed supersession, ranked retrieval, user
  control; semantic/embedding retrieval deliberately deferred while Postgres
  remains the system of record);
- browser provider and production worker runtime beyond the current local/browser implementation;
- document/media stack beyond the 2026-10-03 text/PDF ingestion (image and
  audio ingestion still deferred);
- capability-routing implementation beyond the 2026-10-03 VERIFY_WEB and
  RESEARCH_WEB mechanical executors;
- proactive continuity beyond the 2026-10-03 daily check-in cron
  (deterministic, no model calls; model-driven re-engagement deferred);
- future social/network design;
- exact public pricing and numerical Free/Pro/Max resource limits; payment provider selection remains subject to current geography/commercial eligibility verification.


### D17 — Subscription capacity is explicit

LOCKED as a design direction.

Stryde Free, Pro, and Max share the same core pursuit architecture. Plans primarily change economically available research, computation, execution, persistence, and premium-capability capacity.

### D18 — Free must prove the product

LOCKED.

Free cannot be an intentionally useless chatbot. It must let a user experience a bounded but genuine Stryde pursuit loop while protecting Stryde from unlimited variable-cost subsidy.

### D19 — Resource budgeting is first-class

LOCKED as a design direction.

Variable-cost operations must be budgeted, reserved, accounted, and reconciled. Monthly quotas alone are insufficient; Stryde also needs per-pursuit, per-operation, and concurrency controls.

### D20 — Cost-aware research planning

LOCKED.

Research Planner decisions must consider expected decision impact, information value, provider quality/reliability, freshness, stakes, latency, and cost. The system should stop when additional research is unlikely to change the next decision.

### D21 — Billing provider is replaceable

LOCKED.

Payment infrastructure is a subordinate commercial integration. Stable internal plan IDs and entitlement semantics must not be replaced by provider-specific product identifiers.

### D22 — Exact plan limits are evidence-driven

LOCKED.

Do not choose Free/Pro/Max numerical quotas from intuition. Measure real model, provider, browser, worker, storage, retry, and concurrency costs first, then calibrate pricing and resource limits against the desired gross margin and usage distribution.


### D23 — Capability composition is the next platform layer

LOCKED as an implementation direction.

Stryde should unify its existing research, skills, workers, MCP, memory, authority, and execution primitives behind a discoverable capability layer. The user should not have to manually operate the underlying tools.

### D24 — Skills, connectors, and plugins are distinct

LOCKED.

- Skill = reusable procedure.
- Connector = authenticated access to an external service/data source.
- Plugin = distributable bundle that may contain skills, agents, connectors, hooks, and resources.

None of these becomes canonical semantic state or grants authority by itself.

### D25 — Scheduled work is a first-class capability

LOCKED as a direction.

Stryde should support one-time, recurring, event-driven, state-driven, and monitoring triggers through the existing job/execution model rather than creating a second orchestration engine.

### D26 — Durable outputs are artifacts

LOCKED as a direction.

When work produces a reusable deliverable, Stryde should persist it as a versioned artifact linked to the pursuit/run rather than treating the final output as chat text only.

### D27 — Modern feature parity is not the product goal

LOCKED.

Stryde should selectively adopt patterns from ChatGPT, Claude, Gemini, Manus, Copilot, Cursor, and the broader MCP ecosystem only when they strengthen pursuit understanding, action, verification, learning, or economic viability.

### D28 — Capability ecosystem is staged

LOCKED.

Build internal capability packaging, security, discovery, permissions, and composition before building a public plugin/skill marketplace.
