# Stryde GLM Master Implementation Brief

Status: execution brief
Date: 2026-10-06

## Mission

Implement the capability-composition layer that turns Stryde's existing primitives into a governed, cost-aware, subscription-aware toolbox.

Do not rebuild Stryde.

Do not turn Stryde into a generic chatbot, agent framework, workflow builder, or dashboard.

Preserve the locked product thesis:

> Stryde is a persistent personal pursuit system that absorbs cognitive ambiguity, investigates reality, reasons over bounded evidence, acts within explicit authority, observes what changed, verifies what can be verified, learns, and keeps the pursuit moving.

## Read first

Before changing code, read:

1. docs/PRODUCT_CONSTITUTION.md
2. docs/PRODUCT.md
3. docs/ARCHITECTURE.md
4. docs/STATE.md
5. docs/DECISIONS.md
6. docs/INTEGRATIONS.md
7. docs/RUNTIME.md
8. docs/VERIFICATION_MATRIX.md
9. docs/RESEARCH_REALITY_ENGINE.md
10. docs/SUBSCRIPTION_AND_RESOURCE_MODEL.md
11. docs/RESEARCH_COST_CONTROL.md
12. docs/BILLING_PROVIDER_ARCHITECTURE.md
13. docs/AI_CAPABILITY_LANDSCAPE_AND_GAPS.md
14. HANDOFF.md
15. Existing capability-reuse audit and current tests.

Treat repository code, live Supabase schema, deployment evidence, and tests according to the authority order in docs/ARCHITECTURE.md.

Do not assume a design document means a feature is implemented.

## Current known reality

Existing important primitives include:

- Pursuits and conversations
- Context Compiler
- Personal memory lifecycle
- Skills lifecycle (proposal, security scan, approval, versioning, rollback, usage)
- Hermes worker
- OpenCode worker
- Browser worker
- MCP transport
- Exa search adapter
- Firecrawl search/render fallback
- Observation/claim/verification model
- Basic model provider chain
- Continuity cron
- Founding-access billing path

Important known gaps include:

- skills are procedural-memory records, not yet a rich runtime package/composition system;
- MCP transport exists, but arbitrary MCP capability discovery and planner-directed execution are not complete;
- research is not yet a full adaptive provider-neutral planner;
- production browser/worker availability is not established;
- user-defined schedules/triggers are not a general subsystem;
- artifacts are not a first-class durable output model;
- Free/Pro/Max entitlements and resource metering are architecture targets, not proven runtime behavior;
- connector/OAuth/app management is not a mature user-facing subsystem;
- multimodal input/output remains incomplete;
- task-aware model/capability routing is incomplete.

## Non-negotiables

1. Stryde owns semantic state.
2. Third-party services are subordinate capabilities.
3. Capability discovery is not authority.
4. Model output never becomes authority by itself.
5. External content is untrusted data.
6. Failed acquisition is not evidence of absence.
7. Reported claims are not observations.
8. Observations are not verified outcomes.
9. Tool success is not pursuit success.
10. Free must remain genuinely useful.
11. Max does not bypass safety ceilings.
12. Provider-specific APIs must sit behind replaceable interfaces.
13. Do not introduce a heavyweight framework unless a demonstrated problem requires it.
14. Do not reset live Supabase.
15. Do not claim production proof without production evidence.
16. Prefer reversible, incremental changes and preserve historical state.

# Phase 0 — Reconcile before coding

Inspect the existing implementation and produce a compact internal gap map.

Confirm:

- existing skill routes and persistence;
- current tool registry;
- MCP client and worker path;
- research adapter path;
- browser path;
- current billing path;
- existing job/attempt/lease model;
- existing event model;
- existing cron;
- existing file/artifact support;
- current tests.

Do not duplicate already-existing primitives.

# Phase 1 — Unified Capability Registry

Create a first-class provider-neutral capability registry.

A capability should represent something Stryde can potentially do.

Suggested shape:

`Capability {
  id
  capability_key
  version
  provider
  description
  input_schema
  output_schema
  output_classification
  risk_class
  side_effect_class
  reversibility
  required_credentials
  required_scopes
  egress_policy
  plan_eligibility
  estimated_cost
  cost_dimensions
  latency_class
  reliability
  freshness
  verification_capability
  availability
  metadata
}`

The existing `tool` registry can remain the low-level persisted mechanism where appropriate. Do not create duplicate registries without need.

The important addition is a unified semantic adapter layer.

Capabilities should include at least:

- search web
- extract page
- crawl
- browser observe
- worker execution
- MCP tools
- transcript acquisition
- future code runner
- future artifacts
- future connectors.

Every capability must be:

- discoverable;
- schema-valid;
- risk-classified;
- budget-aware;
- entitlement-aware;
- authority-gated;
- provenance-capable.

Add tests before broad routing.

# Phase 2 — Capability Discovery and Selection

Build a resolver that answers:

> What can Stryde use for this task right now?

Inputs:

- pursuit;
- task;
- user;
- effective plan;
- remaining budget;
- authority;
- provider health;
- capability requirements.

Output:

- eligible capabilities;
- rejected capabilities;
- rejection reason;
- cost estimate;
- required authority;
- fallback options.

Do not expose all capabilities as a raw toolbox to the user.

The planner should normally select them automatically.

# Phase 3 — Skills V2

Preserve the existing skill lifecycle.

Evolve skill representation to support:

- name;
- description;
- trigger;
- instructions;
- scripts;
- references;
- assets;
- required capabilities;
- allowed capabilities;
- required permissions;
- expected outputs;
- verification steps;
- cost profile;
- version;
- provenance;
- compatibility;
- freshness;
- security scan.

Implement progressive disclosure:

`skill metadata
→ instructions
→ referenced material
→ scripts/assets`

Skills should load only when relevant.

Implement composition:

`skill A + skill B + capability X`

without turning the user into a workflow engineer.

A skill never grants authority.

Add migration compatibility for current JSON procedures.

# Phase 4 — Plugin Package Contract

Create a provider-neutral plugin manifest.

Suggested shape:

`PluginManifest {
  id
  name
  version
  publisher
  license
  description
  skills[]
  agents[]
  connectors[]
  hooks[]
  capabilities[]
  permissions[]
  data_access[]
  network_access[]
  side_effects[]
  compatibility
  provenance
  security
}`

Do not build a public marketplace yet.

First support local/first-party package loading and validation.

Add:

- manifest validation;
- security scan;
- dependency validation;
- version compatibility;
- provenance;
- enable/disable;
- rollback;
- trust status.

# Phase 5 — MCP as dynamic capability source

The existing MCP transport must remain.

Add:

- server registration;
- tool discovery;
- normalized capability metadata;
- per-server trust state;
- per-tool scopes;
- read/write classification;
- provider health;
- plan eligibility;
- estimated cost;
- audit events.

A discovered MCP tool should become a normal Stryde capability.

The model/planner should not need custom MCP-specific reasoning.

Do not allow arbitrary MCP execution without authority checks.

# Phase 6 — Research Planner

Replace the current single-step research behavior with the architecture already specified in docs/RESEARCH_REALITY_ENGINE.md and docs/RESEARCH_COST_CONTROL.md.

Planner must:

- inspect current evidence;
- define uncertainty;
- produce candidate research operations;
- compare costs;
- choose providers;
- enforce budget;
- record reservations;
- execute;
- normalize;
- capture provenance;
- detect contradictions;
- compile bounded context;
- stop or escalate.

Initial providers:

- Exa;
- Firecrawl;
- current direct page fetch;
- browser escalation when available.

Add Transcriptor as a provider-neutral transcript capability only when implementation path is confirmed.

Do not add every possible provider immediately.

# Phase 7 — Subscription + Resource Enforcement

Implement actual runtime enforcement for:

- Free;
- Pro;
- Max.

Stable plan IDs:

- free
- pro
- max

Create:

- entitlement resolver;
- resource policy;
- usage meter;
- reservation;
- reconciliation;
- per-pursuit budget;
- concurrency ceiling;
- safe degradation.

Do not hard-code vendor call counts.

Prefer:

`plan
→ resource envelope
→ capability cost
→ planner
→ provider`

Use actual usage telemetry to calibrate numerical limits later.

Until exact numbers are evidence-backed, keep numeric policies centralized/configurable.

# Phase 8 — Scheduler / Trigger Engine

Evolve the continuity cron into a general trigger model.

Support target architecture:

`Trigger
→ Condition
→ Job
→ Situation snapshot
→ entitlement/budget
→ planner
→ action
→ observation
→ notification / next move`

Trigger types:

- one-time;
- recurring;
- event-driven;
- state-driven;
- monitoring/watch.

Reuse the current job system where possible.

Do not create a second job engine.

# Phase 9 — Artifacts

Create a first-class artifact model.

Suggested:

`Artifact {
  id
  pursuit_id
  run_id
  type
  version
  storage_reference
  mime_type
  title
  provenance
  verification_state
  created_at
  updated_at
}`

Support at minimum:

- markdown/text;
- JSON/CSV;
- code/text files.

Then extend to richer document types when existing tooling can safely produce them.

Artifacts should be linked from conversation and pursuit state.

Do not turn the UI into a generic file manager.

# Phase 10 — Notifications

Create a provider-neutral delivery capability.

Channels may include:

- in-app;
- email;
- webhook.

Later:

- Slack;
- Discord;
- mobile push;
- other authorized channels.

Notifications must be:

- deduplicated;
- auditable;
- related to a pursuit/action/run;
- priority aware;
- authority aware.

# Phase 11 — Model Routing

Evolve the current model provider chain into task-aware routing.

Route based on:

- task type;
- plan;
- budget;
- latency;
- model capabilities;
- quality requirement;
- provider health;
- recent performance.

Add instrumentation so the system can compare:

`cost
vs
decision improvement
vs
outcome movement`

Do not replace the provider abstraction.

# Phase 12 — Sub-agent orchestration

Add task-local sub-agents only after capability routing exists.

Sub-agent contract should include:

- objective;
- scoped context;
- scoped skills;
- scoped tools;
- budget;
- timeout;
- output schema;
- parent run;
- result trust classification.

Use existing Hermes/OpenCode/browser workers rather than adding an agent framework.

# Phase 13 — Multimodal / computer expansion

After the core capability layer works:

- screenshots/images;
- richer PDF handling;
- audio/video ingestion;
- cloud browser interaction;
- authorized local browser;
- local computer bridge;
- sandboxed code execution.

Each becomes a normal capability with cost, authority, provenance and verification.

# Phase 14 — Evaluation

Add capability-level benchmark tests.

At minimum:

1. capability discovery;
2. authority refusal;
3. budget reservation;
4. budget reconciliation;
5. skill loading;
6. skill composition;
7. MCP discovery;
8. research provider fallback;
9. research stopping;
10. artifact creation;
11. scheduler idempotency;
12. notification deduplication;
13. model routing;
14. sub-agent isolation;
15. prompt-injection resistance;
16. outcome-state update.

Run:

- npm test
- tsc
- lint
- build
- relevant E2Es

Do not stop at unit tests.

# Production safety

Known existing production gaps remain relevant:

- funnel_event production schema error must be reconciled;
- worker/browser production runtime is not yet established;
- research keys are externally gated;
- billing is not production-proven;
- 32/37 migrations were historically applied with five pending as of the last truth reconciliation.

Do not hide these while implementing new features.

# Definition of done

This work is not complete when code compiles.

For each capability, record:

- implemented;
- unit-tested;
- integration-tested;
- configured;
- deployed;
- production-proven;
- customer-proven.

The final proof should demonstrate one real pursuit that can:

1. reconstruct situation;
2. discover capabilities;
3. respect plan;
4. reserve resource budget;
5. research or act using selected capabilities;
6. preserve evidence/provenance;
7. create a useful artifact where applicable;
8. obey authority;
9. observe reality;
10. update state;
11. continue to the next move.

# What not to do

Do not:

- add a generic agent framework;
- create a second canonical database;
- add a giant vector DB just because competitors have memory;
- implement 20 providers at once;
- build a marketplace before package security works;
- duplicate worker/job infrastructure;
- expose a tool console as the default UX;
- let the model choose authority;
- let third-party MCP servers become canonical truth;
- treat successful tool execution as outcome success;
- use more research just because budget remains;
- turn Free into an unusable demo;
- silently subsidize unlimited external costs.

# Execution order

The preferred implementation order is:

1. reconcile current state;
2. unified capability registry;
3. capability discovery/eligibility;
4. resource/entitlement enforcement;
5. skills V2;
6. MCP dynamic discovery;
7. research planner;
8. scheduler/triggers;
9. artifacts;
10. notifications;
11. task-aware model routing;
12. sub-agents;
13. multimodal/computer;
14. evaluation hardening.

Keep each phase independently shippable and verifiable.

# Final instruction

Make the smallest set of coherent changes that creates the platform layer.

Do not implement random feature parity.

When two designs are possible, prefer the one that:

- keeps Stryde semantic ownership;
- preserves provider replaceability;
- improves evidence quality;
- improves cost control;
- reduces user cognitive load;
- increases observability;
- is reversible;
- can be production-proven.

The target is not "Stryde has more features."

The target is:

> **Stryde can discover the right capability, afford it, authorize it, use it, understand what happened, and continue the pursuit.**
