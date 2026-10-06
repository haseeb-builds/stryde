# Stryde Architecture Truth

Status: canonical architecture document
Reconciliation date: 2026-10-02
Re-affirmed: 2026-10-06 (final truth reconciliation pass; content unchanged)

## Authority order

1. Repository code and migrations define implementation structure.
2. Live Supabase schema/data/functions/policies define database runtime truth.
3. Deployed Vercel runtime evidence defines deployed truth.
4. Tests and verification artifacts define evidence of tested behavior.
5. Chat history is control context only.

When authoritative sources disagree, record the contradiction rather than guessing.

## Architectural center

Stryde is a semantic control plane around replaceable intelligence and capability providers.

User
→ universal composer
→ authenticated server boundary
→ situation + personal context assembly
→ policy / capability selection
→ reasoning and evidence acquisition
→ working proposal
→ authority decision
→ Action / Job / Attempt
→ worker or external capability
→ mechanical result
→ Observation
→ verification
→ canonical state update
→ next move

The semantic state machine is Stryde-owned. Providers and workers are subordinate capabilities.

## Canonical state

Postgres is the V1 system of record.

Canonical domain state includes, as applicable:
- Pursuit;
- Claim;
- Decision;
- Action;
- Observation;
- Verification lineage;
- Run;
- Event;
- Source and source provenance;
- conversation continuity state.

Conversation transcript is not canonical truth.

## Personal reality model

Stryde should progressively maintain a provenance-aware personal model containing useful:
- facts and constraints;
- preferences;
- decisions;
- commitments;
- past actions;
- observed outcomes;
- failures and blocked attempts;
- methods tried;
- patterns learned from outcomes.

Memory infrastructure is subordinate to this semantic policy. A vector database, graph database, memory library, or embedding store may be used when it materially helps retrieval, but none becomes canonical truth merely by being installed.

## Evidence model

The system must distinguish:
- user-reported information;
- external source claims;
- model inference;
- observed events;
- verified outcomes;
- contradictions;
- unknowns.

Action success is not outcome verification.
Outcome verification is not causation.
Correlation is not causation.

## Research architecture

Stryde does not own "a search provider."

It owns a capability-independent evidence acquisition contract.

Possible providers/capabilities include:
- web search;
- official APIs/databases;
- source extraction;
- public documents;
- transcript extraction;
- browser observation;
- user-supplied files;
- specialized research workers;
- human clarification.

Provider choice should be adaptive to reliability, relevance, stakes, cost, latency, authorization, and availability.

## Capability architecture

Examples of subordinate infrastructure:
- chat/composer UI primitives;
- UI component libraries;
- model providers;
- browser automation;
- crawlers/extractors;
- document/media parsers;
- workers;
- MCP;
- external-service adapters.

Stryde may wrap or replace these capabilities without changing the semantic contract.

## Authority

Model output never directly grants authority for consequential side effects.

Authority is an explicit state determined by user policy, action scope, risk, and capability.

Autonomous operation must support bounded permission concepts such as:
- what capability may be used;
- what data may be sent;
- what side effects are allowed;
- which pursuits it applies to;
- duration/time budget;
- escalation conditions;
- approval requirements.

## UX architecture

There should be one primary user control surface.

Internal actions may appear as contextual inline affordances when needed. Do not rebuild the old separate source/research/execution/evidence workflow as the default UI.

## Integration rule

Third-party infrastructure must have:
- acceptable license and redistribution terms;
- acceptable security posture;
- stable enough maintenance;
- a clear boundary and replaceability strategy;
- explicit data and credential handling;
- side-effect classification;
- provenance and verification behavior.

## Implementation rule

Do not add a large agent framework, memory system, model router, workflow engine, or capability platform merely because it exists.

First identify the demonstrated problem. Reuse the smallest mature primitive that solves the non-differentiating portion. Keep Stryde's semantic control plane explicit.


## Subscription and resource control

Stryde's commercial layer must control variable resource consumption without becoming part of the semantic pursuit model.

The intended boundary is:

`Billing provider
→ subscription state
→ entitlement resolver
→ resource policy
→ research / execution planner
→ provider capability`

Plan identity is stable and provider-neutral:

- `free`
- `pro`
- `max`

Plans determine resource capacity and capability eligibility. They do not determine evidence truth, authority, or semantic state.

Every variable-cost operation should be attributable to:

- account;
- pursuit;
- operation;
- capability;
- provider;
- estimated usage;
- reserved usage;
- actual usage;
- outcome/status.

The runtime must enforce budgets server-side. The client is never authoritative for plan or quota.

The planner should prefer the cheapest sufficient operation rather than the cheapest operation in isolation. Cost is balanced against information value, reliability, freshness, stakes, latency, and reversibility.

Free must be a real Stryde experience with bounded capacity. Pro and Max increase research depth, execution capacity, model-routing options, persistence, and concurrency. Exact numerical limits remain a unit-economics decision and must be calibrated from observed usage rather than guessed.

Billing provider choice remains replaceable. Stryde owns the semantic control plane, entitlement resolution, resource policy, research planning, authority, evidence, observation, verification, and continuation.
