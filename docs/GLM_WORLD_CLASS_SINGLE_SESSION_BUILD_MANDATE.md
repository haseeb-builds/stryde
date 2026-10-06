# Stryde — World-Class Single-Session Build Mandate

Status: master execution prompt
Date: 2026-10-06
Target: GLM coding agent

## Mission

You are taking ownership of the next major Stryde engineering pass.

Your objective is to take the CURRENT Stryde repository from its present production-hardening state through the complete capability-composition platform defined by the canonical documents, in one continuous autonomous engineering session.

Do not merely design it.
Do not merely document it.
Do not produce a roadmap and stop.
Do not implement a few representative stubs and call the system complete.

Inspect the current code, preserve what already works, implement the missing platform, test it, deploy it when appropriate, verify it, update canonical truth, and continue until the defined completion boundary is reached.

You must work from repository truth and live-system evidence, not from assumptions or stale chat history.

---

# 1. PRODUCT INVARIANT

Stryde is:

> A persistent personal pursuit system that absorbs cognitive ambiguity, investigates reality, reasons over bounded evidence, acts within explicit authority, observes what changed, verifies what can be verified, learns, and keeps the pursuit moving.

Stryde is NOT:

- a generic chatbot;
- a task manager;
- a Kanban board;
- a dashboard-first productivity app;
- a memory database;
- a generic agent framework;
- an MCP client with a UI;
- a research button;
- a browser automation product;
- a marketplace;
- a social feed;
- a workflow-builder for the user.

The central rule is:

> ABSORB COGNITIVE AMBIGUITY. DO NOT REFLECT IT BACK TO THE USER.

The second central rule is:

> AI generates hypotheses. Reality gets the final vote.

Everything you build must strengthen that system.

---

# 2. READ THESE BEFORE TOUCHING CODE

Read all of these completely enough to understand current truth:

1. docs/PRODUCT_CONSTITUTION.md
2. docs/PRODUCT.md
3. docs/ARCHITECTURE.md
4. docs/STATE.md
5. docs/RUNTIME.md
6. docs/VERIFICATION_MATRIX.md
7. docs/DECISIONS.md
8. docs/INTEGRATIONS.md
9. docs/RESEARCH_REALITY_ENGINE.md
10. docs/SUBSCRIPTION_AND_RESOURCE_MODEL.md
11. docs/RESEARCH_COST_CONTROL.md
12. docs/BILLING_PROVIDER_ARCHITECTURE.md
13. docs/AI_CAPABILITY_LANDSCAPE_AND_GAPS.md
14. docs/GLM_MASTER_IMPLEMENTATION_BRIEF.md
15. docs/GLM_RESUME_MANDATE.md
16. HANDOFF.md

Treat these as design/intent evidence, NOT automatic implementation truth.

Then inspect:

- package.json;
- source tree;
- tests;
- migrations;
- current environment configuration;
- current worker/runtime code;
- existing APIs;
- existing UI;
- existing skill, memory, MCP, browser, research, billing, job and observation code.

Authority order:

1. repository code / migrations;
2. live Supabase schema/data/policies;
3. deployed Vercel runtime evidence;
4. tests and verification artifacts;
5. documentation;
6. old chat history.

When they disagree, investigate and reconcile.

---

# 3. CURRENT VERIFIED CHECKPOINT

As of 2026-10-06:

- main = 1e3b7d7dd886d2f8e7a0e70b0e84e06e6b06bfec
- GLM streaming malformed-output repair = a67e36d23e1d7528af71277d8e627be5732216e7
- a67e36d is already an ancestor of current main
- GitHub Actions verify on current main = SUCCESS
- production Vercel deployment = dpl_2w7iPjCcKAWZmQ8VdaJ8CeLb5XcP
- production deployment status = READY
- Vercel project plan = Hobby
- production model configuration currently resolves:
  - OpenRouter preferred
  - nvidia/nemotron-3-super-120b-a12b:free
  - Gemini fallback = gemini-flash-latest
  - OmniRoute disabled
- Supabase project = pvijrnwdnolvnoibarrj
- Supabase migration parity = 37/37
- live user_agent_preference = present
- live skill = present
- live skill_version = present
- live funnel_event = present
- RESEND_API_KEY = removed from Vercel
- EXA / FIRECRAWL live keys = absent
- production worker runtime = NOT ESTABLISHED
- a historical Vercel 55-second conversation timeout signal remains in telemetry, latest occurrence 2026-10-06T15:59:52Z on an older deployment
- a fresh complete current-main authenticated conversation proof is still required
- Free/Pro/Max entitlement/resource enforcement is not yet runtime-complete
- Issue #7 capability-composition layer is not yet implemented

Do not redo completed work merely because older documents mention it as pending.
When an older statement conflicts with this checkpoint, update the current-truth section rather than reverting correct code.

---

# 4. WHAT THE PREVIOUS GLM PASS ALREADY DID

Preserve these results:

- documentation reconciliation;
- Linux/Node CI path repair;
- live migration reconciliation;
- migration parity restoration to 37/37;
- removal of stale RESEND_API_KEY;
- production model investigation;
- real structured-output probes of free OpenRouter candidates;
- selection of nvidia/nemotron-3-super-120b-a12b:free;
- streaming malformed-output retry/failover;
- regression tests for that failover.

Do not duplicate these fixes.
Do not revert them unless a fresh verified regression requires it.

---

# 5. OPERATING MODE

You are an autonomous senior/staff-level engineer.

Do not ask the user to choose between obvious engineering options.
Resolve ambiguity using:

- existing architecture;
- current code;
- live system evidence;
- existing decision register;
- safety;
- reversibility;
- maintainability.

When two designs are plausible, choose the one that best preserves:

- Stryde semantic ownership;
- provider neutrality;
- evidence quality;
- authority boundaries;
- cost control;
- observability;
- reversibility;
- production verifiability;
- low user cognitive load.

Do not stop after producing analysis.
Do not stop because the task is large.
Do not stop because a phase is difficult.
Split the work into internally coherent phases and continue.

If a required external dependency is unavailable, do not fabricate it.
Implement the correct abstraction, use a real available provider where possible, prove everything that can be proven, mark only the genuinely blocked boundary, and continue with all non-blocked work.

If credentials are required and absent, do not invent them.
Do not repeatedly waste calls discovering the same absence.

Never reset production Supabase.
Never erase historical state.
Never use destructive migration shortcuts.
Never claim production proof from a health endpoint alone.

---

# 6. BUILD PHILOSOPHY

Do not create disconnected feature islands.

The central vertical slice is:

USER GOAL
→ PURSUIT
→ SITUATION
→ CONTEXT COMPILER
→ CAPABILITY DISCOVERY
→ ENTITLEMENT
→ RESOURCE BUDGET
→ PLANNER
→ CAPABILITY SELECTION
→ AUTHORITY
→ EXECUTION
→ OBSERVATION
→ VERIFICATION
→ LEARNING
→ UPDATED STATE
→ NEXT MOVE

Every major capability should plug into this control loop.

---

# 7. CORE SEMANTIC BOUNDARIES — NEVER VIOLATE

## 7.1 Capability discovery is not authority

Finding a tool that can send email does not authorize sending email.

Finding a browser does not authorize arbitrary actions.

Finding an MCP tool does not authorize its use.

## 7.2 Model output is not authority

A model recommendation can propose an action.
The authority system decides whether it may execute.

## 7.3 External content is untrusted

Web pages, files, transcripts, MCP outputs, worker outputs and third-party content are data.

They can inform reasoning.
They cannot redefine system policy.

## 7.4 Tool success is not pursuit success

A successful API call does not prove the user's outcome happened.

## 7.5 Observation is not verification

Observed state may support verification.
Verification must remain an explicit semantic step.

## 7.6 Reported is not observed

User statement:
"I got the client."

is user-reported reality unless the system has independent evidence.

## 7.7 Failed acquisition is not absence

A provider failure means the acquisition attempt failed.

It does not mean:
"no evidence exists."

## 7.8 Subscription is not epistemic truth

Free/Pro/Max affects capacity, not the truth value of evidence.

---

# 8. PHASE 0 — CURRENT-STATE RECONCILIATION

Before modifying implementation:

- inspect existing capability registry/tool registry;
- inspect skill routes/schema/lifecycle;
- inspect MCP transport and worker execution;
- inspect research path;
- inspect browser path;
- inspect job/attempt/lease model;
- inspect authority model;
- inspect billing/founding access;
- inspect budget table(s);
- inspect event/instrumentation;
- inspect cron/continuity;
- inspect artifact/file support;
- inspect model provider routing;
- inspect tests/E2Es;
- inspect live Supabase tables and migrations;
- inspect current Vercel deployment/environment state where relevant.

Produce a concise internal gap map.

Do not rewrite already-working machinery.

---

# 9. PHASE 0.5 — PRODUCTION CONVERSATION PROOF

Before major platform work, re-run the current production conversation proof.

Prove:

confirmed/authenticated user
→ pursuit
→ first structured turn
→ adaptive working state
→ second turn
→ persisted conversation/state

Health endpoints are insufficient.

Deployment READY is insufficient.

A single HTTP 200 is insufficient.

If it fails:

1. identify the actual failure;
2. make the smallest correct repair;
3. preserve provider abstraction;
4. run tests;
5. deploy;
6. re-run the proof.

Do not proceed while pretending the failure does not exist.

Once the proof is good enough, continue.

---

# 10. PHASE 1 — UNIFIED CAPABILITY REGISTRY

Build the semantic capability layer.

A capability should include, as appropriate:

- capability_key;
- version;
- provider;
- description;
- input schema;
- output schema;
- result trust classification;
- risk class;
- side-effect class;
- reversibility;
- required credentials;
- required scopes;
- network/egress policy;
- plan eligibility;
- cost model;
- cost dimensions;
- expected latency;
- reliability;
- freshness;
- verification capability;
- availability;
- provenance metadata.

Reuse the existing public.tool registry where possible.

Do not create two competing registries unless there is a demonstrated separation requirement.

The target is:

existing low-level tool records
+
provider-neutral semantic adapters
=
unified capability surface.

Register at least:

- web search;
- web extraction;
- crawl;
- direct page observation;
- browser;
- worker execution;
- MCP tools;
- transcript acquisition interface;
- future artifacts;
- future code execution;
- connector interfaces.

Everything must remain provider-replaceable.

---

# 11. PHASE 2 — CAPABILITY DISCOVERY / ELIGIBILITY

Implement a resolver:

> What can Stryde use for this task, for this user, right now?

Inputs:

- pursuit;
- situation;
- task;
- user;
- plan;
- remaining resources;
- authority policy;
- provider health;
- capability requirements.

Outputs:

- eligible capabilities;
- ineligible capabilities;
- reason for rejection;
- expected resource cost;
- required authority;
- fallback candidates.

Do not expose a raw tool catalog as the primary UX.

The planner should normally choose.

---

# 12. PHASE 3 — ENTITLEMENT + RESOURCE CONTROL

Implement actual Free / Pro / Max runtime enforcement.

Stable plan IDs:

- free
- pro
- max

Build:

- entitlement resolver;
- plan policy;
- resource envelope;
- usage meter;
- reservation system;
- reconciliation;
- per-user budget;
- per-pursuit budget;
- per-operation budget;
- concurrency limits;
- safe degradation;
- budget reset;
- controlled grants;
- auditability.

Do not hard-code:
"Pro = 50 Firecrawl calls."

Instead:

plan
→ resource envelope
→ capability cost
→ planner
→ provider selection

Track:

- estimated usage;
- reserved usage;
- actual usage;
- released usage;
- provider cost;
- model cost;
- operational cost.

Server-side enforcement is mandatory.

The client is never authoritative.

---

# 13. PHASE 4 — SKILLS V2

Preserve the existing skill lifecycle:

- proposed;
- security scanned;
- approved;
- active;
- stale;
- archived;
- versioned;
- rollback by new version.

Extend skills into reusable capability packages.

Support:

- metadata;
- trigger/when-to-use;
- instructions;
- references;
- scripts;
- assets;
- required capabilities;
- allowed capabilities;
- required permissions;
- expected outputs;
- verification rules;
- cost profile;
- compatibility;
- freshness;
- provenance.

Use progressive disclosure:

metadata
→ instructions
→ supporting resources
→ scripts/assets

Load only what is relevant.

Support skill composition without forcing users to build workflows.

A skill never grants authority.

Maintain backwards compatibility with existing JSON procedures.

Add security protections:

- prompt-injection scanning;
- credential exfiltration detection;
- destructive-pattern detection;
- privilege-change gating;
- provenance;
- versioning;
- rollback;
- staleness;
- usage tracking.

---

# 14. PHASE 5 — PLUGIN PACKAGE CONTRACT

Implement the package model, not a marketplace.

Create a validated manifest along the lines of:

PluginManifest
- id
- name
- version
- publisher
- license
- description
- skills
- agents
- connectors
- hooks
- capabilities
- permissions
- data access
- network access
- side effects
- compatibility
- provenance
- security

Support:

- validation;
- dependency checking;
- version compatibility;
- trust state;
- enable/disable;
- provenance;
- security scanning;
- rollback.

Do not build a public marketplace yet.

---

# 15. PHASE 6 — MCP AS A DYNAMIC CAPABILITY SOURCE

Keep the existing first-party MCP transport.

Add:

- server registration;
- capability discovery;
- tool normalization;
- per-server trust;
- per-tool scopes;
- read/write classification;
- availability/health;
- plan eligibility;
- estimated cost;
- audit events.

MCP tools should become ordinary Stryde capabilities.

Do not require special planner logic for every MCP server.

Do not permit arbitrary MCP tool execution without authority checks.

Do not let an MCP response become canonical truth.

---

# 16. PHASE 7 — ADAPTIVE RESEARCH PLANNER

Upgrade the current mechanical research executor into the research architecture defined by:

- docs/RESEARCH_REALITY_ENGINE.md
- docs/RESEARCH_COST_CONTROL.md

Planner must:

1. inspect current evidence;
2. identify uncertainty;
3. maintain competing hypotheses when appropriate;
4. determine what evidence could discriminate between them;
5. create candidate acquisition operations;
6. estimate cost;
7. consider freshness;
8. consider provider quality;
9. choose the cheapest sufficient path;
10. reserve resources;
11. execute;
12. normalize results;
13. preserve provenance;
14. detect duplicates/syndication;
15. detect contradictions;
16. compile bounded evidence;
17. reassess;
18. stop when further research is unlikely to change the decision;
19. escalate when justified;
20. choose a real-world experiment when that has better information value.

Initial provider lanes:

- Exa;
- Firecrawl;
- direct page fetch;
- browser when available.

Add transcript capability through the existing Transcriptor integration if the implementation path is actually available.

Add academic capability only where relevant.

Do not call every provider for every question.

Do not dump raw source contents into model context.

---

# 17. PHASE 8 — SOURCE / EVIDENCE GRAPH

Strengthen research representation.

Track:

SOURCE
→ CLAIM
→ EVIDENCE
→ CONDITION
→ CORROBORATION / CONTRADICTION
→ APPLICABILITY
→ VERIFICATION

Detect:

- duplicated content;
- syndicated sources;
- shared primary source;
- independent corroboration;
- contradictions;
- outdated information;
- condition mismatch.

Avoid false source-count confidence.

---

# 18. PHASE 9 — GENERAL SCHEDULER / TRIGGER ENGINE

Do not create a second job engine.

Extend current job infrastructure to support:

### One-time

run at specific time.

### Recurring

daily/weekly/etc.

### Event-driven

"When event X arrives."

### State-driven

"When this pursuit has been blocked for three days."

### Monitoring

"Watch this source/company/condition."

Architecture:

trigger
→ condition
→ job
→ situation snapshot
→ entitlement
→ budget
→ planner
→ capability
→ observation
→ notification / next move

Must be:

- idempotent;
- auditable;
- retry-safe;
- budget-aware;
- authority-aware.

---

# 19. PHASE 10 — FIRST-CLASS ARTIFACTS

Create durable artifact state.

At minimum:

- artifact id;
- pursuit id;
- run id;
- type;
- version;
- storage reference;
- MIME type;
- title;
- provenance;
- verification state;
- timestamps.

Support:

- markdown/text;
- JSON;
- CSV;
- code/text;
- research dossiers.

Use existing file infrastructure where possible.

Do not create a generic file manager product.

The conversation should reference durable artifacts.

---

# 20. PHASE 11 — NOTIFICATIONS / DELIVERY

Build a provider-neutral delivery layer.

Initial channels:

- in-app;
- email;
- webhook.

Later-ready abstraction:

- Slack;
- Discord;
- push;
- other authorized channels.

Delivery must be:

- deduplicated;
- auditable;
- linked to pursuit/run/action;
- priority-aware;
- authority-aware.

Do not spam users.

---

# 21. PHASE 12 — TASK-AWARE MODEL ROUTING

Keep the current model-provider abstraction.

Add task-aware routing based on:

- task type;
- plan;
- budget;
- model capability;
- quality requirement;
- latency;
- provider health;
- recent success rate.

Typical policy:

Cheap model:
- classification;
- normalization;
- extraction;
- deduplication.

Stronger model:
- difficult synthesis;
- contradiction resolution;
- nuanced applicability;
- higher-stakes reasoning.

Specialized model:
- vision;
- coding;
- other modality-specific work.

Do not waste premium reasoning on routine transformations.

Instrument:

cost
vs
decision improvement
vs
outcome movement.

---

# 22. PHASE 13 — TASK-LOCAL SUB-AGENTS

Use existing Hermes/OpenCode/browser workers.

Do NOT introduce a generic agent framework merely for abstraction.

A sub-agent must have:

- explicit objective;
- scoped context;
- scoped tools;
- scoped skills;
- resource budget;
- timeout;
- output schema;
- parent run ID;
- trust classification.

Sub-agent output is untrusted result data until verified.

Parent Stryde remains authoritative.

---

# 23. PHASE 14 — MULTIMODAL / COMPUTER CAPABILITIES

Implement the architecture now even where external provider availability determines production proof.

Capability classes:

- image/screenshot input;
- richer PDF handling;
- audio;
- video/transcripts;
- screen recording;
- cloud browser;
- authorized browser;
- local computer bridge;
- sandboxed code execution.

Each must have:

- capability metadata;
- cost;
- authority;
- network policy;
- provenance;
- verification;
- failure states.

Never grant arbitrary host execution to the main web runtime.

---

# 24. PHASE 15 — CONNECTORS / APPS

Build the connector abstraction even if only a subset of integrations is implemented immediately.

A connector is:

service
→ secure authentication
→ scoped access
→ capability registration
→ planner availability
→ authority
→ execution
→ provenance.

Potential connector classes:

- Gmail;
- Google Calendar;
- Drive;
- GitHub;
- Slack;
- Notion;
- Linear;
- CRM;
- analytics systems;
- other authorized MCP-backed services.

Security requirements:

- OAuth where applicable;
- read/write separation;
- scope control;
- credential isolation;
- revocation;
- expiry;
- audit;
- health;
- provenance.

Do not hard-code one vendor into the connector architecture.

---

# 25. PHASE 16 — PERSONAL REALITY / MEMORY MATURITY

Preserve current factual/personal memory semantics.

Evolve toward:

Memory types:
- fact;
- preference;
- constraint;
- commitment;
- decision;
- method tried;
- outcome;
- lesson;
- skill;
- evidence;
- working state.

Lifecycle:
- proposed;
- confirmed;
- active;
- superseded;
- contradicted;
- stale;
- removed.

Retrieval should consider:

- relevance;
- recency;
- pursuit scope;
- conditions;
- provenance;
- contradiction;
- importance.

Do not introduce a vector database just because it is fashionable.

Postgres remains V1 system of record unless evidence proves otherwise.

---

# 26. PHASE 17 — HOOKS / POLICY EVENTS

Add lifecycle hooks where they materially help:

- before research;
- after research;
- before capability execution;
- after capability execution;
- before external write;
- after external write;
- before skill activation;
- after skill activation;
- budget threshold;
- verification failure;
- pursuit inactivity;
- outcome recorded.

Hooks can enforce:

- policy;
- logging;
- security;
- cost;
- verification;
- escalation;
- notifications.

Hooks must never bypass the authority layer.

---

# 27. PHASE 18 — PUBLIC EXTENSIBILITY

Eventually expose semantic APIs rather than raw database structures.

Prepare contracts for:

- pursuit API;
- observation API;
- research API;
- capability API;
- skill API;
- artifact API;
- event/webhook API.

Do not make a stable public API promise before the semantics are proven.

---

# 28. SECURITY HARDENING

Threat-model the entire capability system.

Test at minimum against:

- prompt injection from webpages;
- malicious skill files;
- malicious MCP tool descriptions;
- credential exfiltration attempts;
- privilege escalation;
- arbitrary network egress;
- destructive actions;
- replay;
- duplicated execution;
- budget races;
- concurrent over-consumption;
- untrusted worker output;
- falsified verification;
- cross-user data access;
- unauthorized external writes.

Use least privilege.

Keep credentials isolated.

Audit consequential operations.

Fail closed for high-impact authority.

---

# 29. ECONOMIC HARDENING

Implement:

- usage accounting;
- reservation;
- reconciliation;
- concurrency control;
- per-pursuit budgets;
- cost estimates;
- provider cost records;
- model usage records;
- retry accounting;
- cache accounting;
- anomaly detection;
- cost-aware planner decisions.

Plans:

FREE:
real but bounded.

PRO:
serious individual usage.

MAX:
high-intensity individual usage.

Do not finalize exact public quotas from intuition.

Centralize configurable numbers.

Do not hard-code vendor-specific call quotas into product semantics.

---

# 30. UX RULES

The user should experience:

one primary control surface.

Do not expose:

- raw tool consoles;
- provider dashboards;
- infrastructure concepts;
- unnecessary workflow configuration;
- giant forms.

Use contextual disclosure for:

- sources;
- evidence;
- memory;
- skills;
- autonomy;
- artifacts;
- execution results.

The UI should communicate:

what changed,
why it matters,
what Stryde did,
what remains uncertain,
what happens next.

The UI should not turn internal ontology into the user experience.

---

# 31. TESTING STRATEGY

Every phase requires tests before being called complete.

At minimum add coverage for:

1. capability registration;
2. capability discovery;
3. capability rejection reasons;
4. authority refusal;
5. plan gating;
6. resource reservation;
7. resource reconciliation;
8. concurrent budget races;
9. skill loading;
10. progressive disclosure;
11. skill composition;
12. plugin validation;
13. MCP discovery;
14. MCP authority refusal;
15. research provider fallback;
16. research duplicate detection;
17. contradiction handling;
18. research stopping;
19. budget-aware degradation;
20. scheduler idempotency;
21. trigger recovery;
22. artifact versioning;
23. notification deduplication;
24. model routing;
25. sub-agent isolation;
26. prompt-injection resistance;
27. multimodal input classification;
28. outcome-state update;
29. cross-user isolation;
30. destructive-action gating.

Run:

npm test
tsc
lint
build

Then relevant E2Es.

Then production checks for every feature that has a production path.

---

# 32. VERIFICATION STANDARD

For every important capability record independently:

IMPLEMENTED
TESTED
INTEGRATION-TESTED
CONFIGURED
DEPLOYED
PRODUCTION-PROVEN
CUSTOMER-PROVEN

Do not collapse these into one "done" flag.

Update docs/VERIFICATION_MATRIX.md with exact evidence.

---

# 33. DOCUMENTATION TRUTH

During implementation, keep these synchronized:

- docs/STATE.md
- docs/RUNTIME.md
- docs/VERIFICATION_MATRIX.md
- docs/INTEGRATIONS.md
- docs/DECISIONS.md
- HANDOFF.md

Do not rewrite historical evidence into present truth.

Instead:

- append current checkpoints;
- clearly mark historical sections;
- record contradictions;
- preserve evidence.

---

# 34. GIT DISCIPLINE

Work in coherent increments.

Recommended commit boundaries:

1. current-state/proof fixes;
2. capability registry;
3. capability discovery;
4. entitlement/resource system;
5. Skills V2;
6. plugin contract;
7. MCP discovery;
8. research planner;
9. source/evidence graph;
10. scheduler;
11. artifacts;
12. notifications;
13. model routing;
14. sub-agents;
15. multimodal/computer;
16. connector layer;
17. security/economic hardening;
18. final verification/docs.

Each commit should:

- be buildable where practical;
- have focused scope;
- preserve prior behavior;
- include tests.

Do not create giant opaque commits merely to satisfy "one session."

The one-session requirement means autonomous continuity, not poor version control.

---

# 35. DO NOT USE THESE SHORTCUTS

Never:

- reset Supabase;
- wipe production data;
- bypass RLS;
- silently downgrade security;
- use service credentials in client code;
- treat client plan data as authoritative;
- let models grant authority;
- treat provider failure as evidence absence;
- dump source text into every context;
- add a giant vector DB by default;
- add LangGraph/Letta/CrewAI/AutoGen/etc. without a demonstrated need;
- add 20 external providers simultaneously;
- build a marketplace before package security;
- create a second orchestration/job system;
- duplicate existing memory/skill/worker/MCP abstractions;
- fabricate credentials;
- call a feature production-proven when it is only locally tested;
- leave "TODO: implement later" in a phase that you claim is complete.

---

# 36. STOPPING RULES

Do not stop simply because:

- the repository is large;
- a phase requires many files;
- the implementation is tiring;
- the context is getting long;
- one provider is unavailable.

You may stop a specific branch of work only when:

- the capability is truly blocked by missing external authority/credentials;
- the blocked boundary is isolated;
- the correct abstraction is implemented;
- tests cover the boundary;
- the current state is documented;
- all non-blocked phases continue.

Never pretend an unimplemented dependency is complete.

---

# 37. FINAL VERTICAL-SLICE ACCEPTANCE

The implementation is only meaningfully complete when one representative pursuit demonstrates:

goal
→ situation reconstruction
→ capability discovery
→ entitlement
→ resource budget
→ cost-aware planning
→ capability selection
→ authority
→ research and/or action
→ evidence/result
→ useful durable artifact where applicable
→ observation
→ verification
→ state update
→ learned information
→ next move

The user should not have to manually orchestrate the internal pieces.

---

# 38. PRODUCTION ACCEPTANCE

Before declaring the platform complete, prove as much as the environment allows on the actual deployed system.

At minimum:

- authenticated user path;
- current production conversation;
- real structured model output;
- current production pursuit state;
- one real research path if credentials exist;
- one real capability execution path if a production worker exists;
- observation persistence;
- verification;
- resource accounting;
- entitlement gating;
- no unauthorized side effects.

For capabilities without current production credentials/runtime:

- prove locally/integration;
- explicitly mark production status as not established;
- do not fabricate production evidence.

---

# 39. COMMERCIAL ACCEPTANCE

Stryde must be economically survivable.

Prove that:

- Free is bounded;
- Pro is higher-capacity;
- Max is higher-capacity;
- variable-cost operations are accounted;
- budget races are controlled;
- planner can choose cheaper sufficient operations;
- premium reasoning is selectively allocated;
- external cost is attributable to a user/pursuit/operation.

Do not silently subsidize unlimited third-party API spend.

---

# 40. LAUNCH / OPEN-SOURCE BOUNDARY

Do not convert the entire project into a public open-source platform as part of this build.

Follow docs/COMMERCIAL_OPEN_SOURCE_AND_LAUNCH_STRATEGY.md.

For now:

- keep highest-value Stryde control-plane implementation private;
- keep provider neutrality;
- keep extension contracts clean;
- make future selective/open-core extraction possible;
- do not build a marketplace;
- do not let marketing work interrupt the core platform implementation.

---

# 41. IF YOU ENCOUNTER ARCHITECTURAL CONFLICT

Do not immediately create another abstraction.

Ask:

1. What semantic responsibility is missing?
2. Which current component already owns adjacent state?
3. Can the current abstraction be extended?
4. Does the new component create a second source of truth?
5. Does it bypass authority?
6. Does it couple Stryde to a provider?
7. Does it create unnecessary user-facing complexity?
8. Can it be tested and verified?

Prefer extension over duplication.

---

# 42. FINAL OUTPUT REQUIREMENT

At the end of the session, leave:

- working code;
- tests;
- migrations;
- updated environment/configuration requirements;
- updated canonical docs;
- explicit verification matrix;
- coherent commit history;
- production verification evidence where possible;
- explicit remaining blockers;
- next-state handoff.

Do not finish with a prose summary instead of implementation.

Do not leave the repository in a state where the next engineer has to rediscover what happened.

---

# 43. THE STANDARD

Operate as though this is a production system that will eventually have real users paying for it.

That means:

- correctness over speed;
- evidence over assumption;
- security over convenience;
- maintainability over cleverness;
- composability over duplication;
- measurable cost over hidden spend;
- verified behavior over claimed behavior;
- user outcome over feature count.

The goal is not to make Stryde look sophisticated.

The goal is to make Stryde **actually become the system described by its architecture**.

---

# 44. EXECUTE NOW

Start immediately.

First:
read the canonical documents,
inspect repository truth,
inspect live state,
complete the current production conversation proof.

Then proceed through the phases in order.

Do not ask for a plan.
Do not return a roadmap.
Do not stop after Phase 0.
Do not stop after one feature.
Do not reopen completed work without evidence of regression.

Continue until:

- all non-blocked phases are implemented;
- every phase has test evidence;
- the central vertical slice is proven;
- documentation reflects truth;
- current blockers are isolated and explicit.

This is the Stryde build mandate.
