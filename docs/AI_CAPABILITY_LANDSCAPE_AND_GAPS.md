# Stryde AI Capability Landscape and Gap Analysis

Status: strategic architecture / implementation target
Date: 2026-10-06

This document compares the capability surfaces now common across leading AI products and maps them onto Stryde.

It is not a mandate to clone competitors.

The purpose is to identify capabilities Stryde could be missing, distinguish foundational infrastructure from differentiation, and define what Stryde should own versus reuse through subordinate providers.

---

## 1. The central conclusion

Stryde is not missing "more AI features" in the abstract.

The largest gap is a **capability composition layer**.

Stryde already has important primitives:

- persistent pursuits;
- situation / working state;
- Context Compiler;
- evidence / claims;
- observation and verification;
- memory lifecycle;
- skill lifecycle;
- workers;
- MCP transport;
- browser worker;
- basic web-search/extraction adapters;
- model provider routing;
- continuity cron;
- authority controls.

But several of those are currently islands.

The next product maturity jump is:

> **Turn isolated capabilities into a governed, discoverable, composable toolbox that Stryde can select automatically against the current pursuit, entitlement, cost budget, authority, and evidence requirements.**

This is the layer that modern products increasingly expose as:

- Apps / connectors;
- Skills;
- Plugins;
- Agents / sub-agents;
- scheduled tasks;
- projects / persistent workspaces;
- computer use;
- artifacts;
- multimodal input/output;
- background work;
- model/tool routing.

Stryde should learn from these patterns without becoming a clone.

---

# 2. What leading products now establish

## OpenAI / ChatGPT

Current ChatGPT product surfaces include:

- persistent Projects with files, instructions, chats and project memory;
- connected Apps that can retrieve data and, where supported, take actions;
- Deep Research;
- agentic Work that can research, work across connected apps/files, and create finished outputs;
- scheduled/event-triggered Work tasks;
- voice;
- Canvas;
- file/data analysis;
- memory;
- browser/agent execution;
- MCP-powered apps and write actions in eligible environments.

The important architectural pattern is not any one feature.

It is:

`persistent context
+ tools/apps
+ research
+ agent execution
+ scheduled work
+ output artifacts
`

rather than a chat-only model.

Sources:
- https://help.openai.com/en/articles/10169521-projects-in-chatgpt
- https://help.openai.com/en/articles/11487775-connected-apps-in-chatgpt
- https://help.openai.com/en/articles/10500283-deep-research-faq
- https://help.openai.com/en/articles/11391654-chatgpt-business-release-notes

---

## Anthropic / Claude

Claude's current capability surface makes several pieces explicit:

- Projects for persistent context and instructions;
- remote MCP-powered Connectors;
- custom and pre-built connectors;
- Skills that load instructions/resources dynamically;
- Plugins that bundle skills, agents, connectors and related behavior;
- Artifacts as a durable output workspace and interactive app surface;
- file creation/editing;
- computer-use capabilities;
- research that can invoke supported connected tools.

The strongest lesson for Stryde is the separation:

> **Connector = access. Skill = procedure. Plugin = packaged composition.**

That distinction is valuable and should be reflected in Stryde's architecture.

Sources:
- https://support.anthropic.com/en/articles/11817150-connect-your-tools-to-unlock-a-smarter-more-capable-ai-companion
- https://support.anthropic.com/en/articles/11175166-about-custom-integrations-using-remote-mcp
- https://www.anthropic.com/research/skills
- https://github.com/anthropics/skills
- https://www.anthropic.com/news/build-artifacts

---

## Google / Gemini

Gemini's current surfaces include:

- Skills replacing Gems;
- reusable and composable skill instructions;
- reference files inside skills;
- scheduled actions;
- personalization using connected Google data;
- Deep Research;
- agentic multi-step workflows;
- Google Search grounding;
- URL Context;
- code execution;
- computer use;
- managed agents.

The important architectural pattern is:

`model
+ managed tools
+ reusable procedure
+ personal context
+ recurring execution
`

Sources:
- https://blog.google/products-and-platforms/products/gemini/automate-tasks-with-skills/
- https://blog.google/products-and-platforms/products/gemini/scheduled-actions-gemini-app/
- https://ai.google.dev/gemini-api/docs/tools
- https://ai.google.dev/gemini-api/docs/url-context
- https://ai.google.dev/gemini-api/docs/code-execution
- https://ai.google.dev/gemini-api/docs/agents
- https://blog.google/innovation-and-ai/models-and-research/google-deepmind/gemini-computer-use-model/

---

## GitHub Copilot / Cursor

Coding products have pushed the composition model further.

GitHub Copilot now exposes:

- custom agents;
- sub-agent orchestration;
- agent skills;
- MCP servers;
- hooks;
- plugins;
- asynchronous background agents;
- unified task/agent management.

Cursor similarly exposes:

- project rules;
- skills;
- custom agents;
- MCP;
- hooks;
- plugins bundling these pieces.

The key lesson:

> **A capable agent needs reusable instructions, scoped tools, isolated sub-agents, lifecycle events, and a package/distribution mechanism.**

Sources:
- https://docs.github.com/en/copilot/concepts/agents
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/custom-agents
- https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills
- https://docs.github.com/en/copilot/concepts/agents/about-plugins
- https://cursor.com/docs/agent/overview
- https://cursor.com/docs/plugins

---

## Manus

Manus demonstrates another relevant layer:

- scheduled tasks;
- connected apps;
- projects;
- skills;
- cloud computer resources;
- preferred browser environments;
- local computer access;
- background operation.

The lesson is:

> **A personal agent becomes materially more useful when it can continue operating outside the immediate chat and can reach the user's actual working environment.**

Sources:
- https://manus.im/blog/manus-schedules
- https://manus.im/blog/manus-preferred-browser
- https://manus.im/blog/manus-my-computer
- https://manus.im/features/skills

---

# 3. The new ecosystem layer: MCP registry + agent ecosystem

The official MCP registry is now populated by a very large and rapidly changing ecosystem of servers covering:

- email;
- social;
- data;
- design;
- coding;
- finance;
- local tools;
- browser automation;
- domain intelligence;
- maps;
- research;
- content creation;
- business operations;
- and many specialized verticals.

This changes the economics of building Stryde.

Stryde does **not** need to build every capability itself.

It needs to build:

1. capability discovery;
2. trust / security evaluation;
3. permissions;
4. cost-aware selection;
5. execution;
6. provenance;
7. observation;
8. verification;
9. learning.

The official registry:
https://registry.modelcontextprotocol.io/

---

# 4. Stryde's current state

The current repository already contains:

| Area | Current reality | Gap |
|---|---|---|
| Pursuit state | Implemented | Product-strengthen |
| Context Compiler | Implemented | Need broader capability-aware inputs |
| Personal memory | Implemented V1 | Stronger retrieval / conflict / lifecycle needed |
| Skills | Lifecycle implemented | Missing true runtime composition/discovery/package model |
| Agents/workers | Hermes + OpenCode | Missing general multi-agent orchestration |
| MCP | Transport implemented | Missing dynamic capability discovery and autonomous tool orchestration |
| Web research | Exa + Firecrawl adapters | Missing planner depth, transcripts, academic lane, broader evidence graph |
| Browser | Worker implemented locally | Production runtime / broader computer layer not established |
| Scheduling | Continuity cron | Missing user-defined schedules and event triggers |
| Billing | Founding-access path | Missing real Free/Pro/Max entitlement + resource enforcement |
| Cost control | Architecture defined | Runtime metering/reservation/planner integration missing |
| Files | Text/PDF ingestion exists | Missing broad multimodal/media and richer file workspace |
| Artifacts | No first-class artifact system | Significant gap |
| Voice | Browser speech recognition | Missing richer realtime multimodal interaction |
| Connectors | MCP transport exists | Missing user-facing OAuth/app connector system |
| Plugins | No plugin package system | Significant gap |
| Notifications | Limited continuity message path | Missing general notification/delivery layer |
| Background work | Job infrastructure exists | Production worker availability and durable user workflows remain incomplete |
| Model routing | Provider chain exists | Missing task-aware quality/cost routing |
| Generated UI | Not a core surface | Useful later for bounded artifact views |
| Sharing/collaboration | Not core | Later |
| Marketplace | Not core | Later |
| API/SDK | Internal API surface exists | No public extensibility contract |
| Evaluation | Large test base | Need capability/economic/outcome benchmarks |

This table is the important diagnosis.

---

# 5. Skills: Stryde already has the seed, but not the full system

Current Stryde has a procedural-memory lifecycle:

- proposal;
- scan;
- approval;
- activation;
- versioning;
- usage;
- staleness;
- rollback.

That is good.

But the system should evolve from:

`skill = stored procedure JSON`

toward:

`skill = reusable capability package`

A mature Stryde skill can contain:

- metadata;
- trigger description;
- instructions;
- scripts;
- references;
- templates;
- assets;
- required capabilities;
- allowed tools;
- required permissions;
- cost profile;
- expected outputs;
- verification rules;
- examples;
- version;
- provenance;
- compatibility;
- security scan;
- freshness;
- usage history.

Stryde should use **progressive disclosure**:

`metadata
→ skill instructions
→ supporting resources
→ scripts/assets only when needed`

This mirrors a proven pattern used by Claude Agent Skills and reduces context waste.

Stryde should also support skill composition:

`research-market
+
prospect-selection
+
outreach-preparation
`

without requiring the user to manually configure the chain.

---

# 6. Plugins: the missing package layer

A plugin should be a distribution unit that may bundle:

- skills;
- agents;
- MCP servers/connectors;
- hooks;
- templates;
- configuration;
- optional UI;
- capability metadata.

Conceptually:

`Plugin
├── manifest
├── skills
├── agents
├── connectors
├── hooks
├── resources
└── security metadata`

Plugins should not become a second semantic system.

They extend capability.

Stryde still owns:

- pursuit state;
- context;
- authority;
- evidence;
- action;
- observation;
- verification.

---

# 7. Connectors / Apps

Stryde currently has MCP transport but does not yet have a polished user-facing connector model.

A connector should allow:

`service
→ authenticated connection
→ scoped capabilities
→ Stryde tool registry
→ planner
`

Potential high-value connectors:

- Gmail;
- Google Calendar;
- Google Drive;
- GitHub;
- Slack;
- Notion;
- Linear;
- Discord;
- Microsoft 365;
- Dropbox;
- LinkedIn where legally/technically supported;
- CRM systems;
- analytics systems;
- social platforms;
- user-specific MCP servers.

The connector model needs:

- OAuth / secure authentication;
- read versus write scopes;
- per-tool permission;
- data-boundary declaration;
- source provenance;
- revoke;
- expiry;
- health;
- audit;
- provider ownership;
- user authorization.

The same connector may provide information and action.

These must remain distinct.

---

# 8. Capability discovery

Stryde needs a real capability registry.

The planner should be able to answer:

> "What capabilities are available to this user right now?"

Possible capabilities might include:

- search_web;
- extract_web;
- transcript_youtube;
- research_academic;
- browse_web;
- read_gmail;
- send_email;
- create_calendar_event;
- update_github;
- run_code;
- edit_files;
- create_spreadsheet;
- generate_image;
- generate_video;
- publish_web;
- query_crm.

Every capability needs metadata:

`capability_id
provider
version
inputs
outputs
risk
side_effects
required_auth
plan_eligibility
cost
latency
reliability
freshness
verification
availability
`

This becomes the foundation for intelligent routing.

---

# 9. Capability selection is not authority

This distinction must stay locked.

Discovering:

`send_email`

does not mean:

`Stryde may send email`

Discovering:

`purchase_item`

does not mean:

`Stryde may purchase`

Capability selection says:

> "This tool could solve the problem."

Authority says:

> "Stryde is allowed to use it here."

These remain separate layers.

---

# 10. Agent / sub-agent architecture

Stryde has worker agents, but the semantic layer should become capable of task-local delegation.

Example:

`Pursuit
→ research agent
→ evidence extraction worker
→ market analysis worker
→ execution worker
→ verification worker`

Each sub-agent should have:

- scoped context;
- scoped tools;
- scoped skill set;
- resource budget;
- explicit objective;
- output contract;
- parent run ID;
- isolation boundary.

Sub-agent output is still untrusted result data unless independently verified.

The parent Stryde control plane remains authoritative.

---

# 11. Scheduled work and triggers

Current Stryde has a continuity cron.

That is not the same as a general scheduled-action system.

Stryde should eventually support:

### One-time

"Tomorrow at 9, remind me to contact these prospects."

### Recurring

"Every Monday research competitors."

### Event triggered

"When a new GitHub issue arrives, investigate it."

"When a prospect replies, determine the next move."

"When the payment fails, inspect the account."

### State triggered

"When this pursuit has been blocked for three days, reassess the bottleneck."

### Watch / monitor

"Watch this company and tell me when its pricing changes."

The architecture:

`trigger
→ scheduled/event job
→ situation snapshot
→ entitlement/budget
→ planner
→ capability execution
→ observation
→ next action / notification`

---

# 12. Notifications / delivery

A proactive agent needs somewhere to deliver results.

Potential channels:

- in-app;
- email;
- push;
- webhook;
- Slack/Discord;
- SMS/WhatsApp where supported and authorized.

Delivery itself is a capability with authority and cost.

Notifications should be:

- deduplicated;
- prioritized;
- actionable;
- linked to the underlying pursuit;
- auditable.

Do not build a generic notification center as the product goal.

Build **reliable outcome delivery**.

---

# 13. Artifacts

This is one of the largest gaps.

Modern AI products increasingly treat the output as a durable object rather than chat text.

Stryde should be able to create:

- documents;
- reports;
- spreadsheets;
- slide decks;
- tables;
- charts;
- images;
- diagrams;
- code patches;
- websites;
- research dossiers;
- outreach lists;
- experiment results;
- decision briefs.

An artifact should have:

`artifact_id
pursuit_id
run_id
type
version
content/reference
provenance
created_at
updated_at
verification_state
shareability
`

The conversation should reference the artifact instead of swallowing it.

This fits Stryde's philosophy:

> The answer is often a thing the user needs to use, not a paragraph they need to copy.

Claude's Artifacts are a direct evidence point for this product pattern.

---

# 14. Multimodal reality ingestion

Stryde should eventually accept:

- images;
- screenshots;
- PDFs;
- audio;
- video;
- screen recordings;
- camera input;
- voice;
- structured files.

The important distinction is:

`input
→ observation
→ evidence
→ situation update`

For example:

User uploads a screenshot of a failed checkout.

Stryde should extract:

- visible state;
- errors;
- timestamps;
- relevant UI text;
- possible diagnosis;
- uncertainty.

It should not blindly treat its visual inference as verified truth.

---

# 15. Computer / desktop capability

Browser worker is useful but narrower than a true personal computer bridge.

Stryde could eventually have:

### Cloud computer

Sandboxed environment for public web tasks.

### Remote personal browser

User-authorized browser with existing sessions.

### Local computer bridge

Explicitly paired machine capable of:

- reading selected files;
- opening apps;
- running commands;
- observing desktop state;
- performing approved actions.

This is expensive and risky.

It should therefore be a controlled capability, not a default assumption.

---

# 16. Code execution and sandboxes

Stryde will need isolated computation for some pursuits.

Examples:

- data analysis;
- simulations;
- numerical optimization;
- document transformations;
- extracting structured information;
- validating code;
- running tests;
- processing media.

A code runner should have:

- sandbox;
- filesystem restrictions;
- network policy;
- time/memory limits;
- output classification;
- artifact capture;
- execution logs;
- reproducibility metadata.

Do not grant arbitrary host execution from the main web runtime.

---

# 17. Context and memory maturity

Current Stryde memory is already stronger than a simple chat replay model.

The next layer should include:

### Memory classes

- personal fact;
- preference;
- constraint;
- commitment;
- decision;
- method tried;
- outcome;
- lesson;
- skill;
- source/evidence;
- temporary working state.

### Memory lifecycle

- proposed;
- confirmed;
- active;
- superseded;
- contradicted;
- stale;
- forgotten/removed.

### Retrieval

- relevance;
- recency;
- pursuit scope;
- conditions;
- provenance;
- contradiction;
- user importance.

### Project/pursuit isolation

Some context should stay inside one pursuit.

Some should become durable personal knowledge.

The system must decide which.

---

# 18. Model routing maturity

Stryde currently has a provider chain.

That is only the beginning.

The next level is **task-aware model routing**.

Examples:

Cheap model:
- classification;
- extraction;
- normalization;
- deduplication;
- small summaries.

Medium model:
- ordinary pursuit reasoning;
- moderate synthesis.

Strong model:
- contradictory evidence;
- difficult strategic reasoning;
- high-stakes decisions;
- complex applicability.

Vision model:
- screenshots;
- charts;
- images.

Coding model:
- repository changes;
- tests;
- patches.

Research model:
- deep research synthesis when justified.

The router must consider:

- plan;
- budget;
- task type;
- quality requirement;
- latency;
- model availability;
- provider health;
- prior success rate.

---

# 19. Research capability maturity

Stryde's current Exa/Firecrawl adapters are the beginning, not the finished research engine.

The target capability matrix:

| Need | Capability |
|---|---|
| Discover sources | SearchProvider |
| Extract static pages | ExtractProvider |
| Crawl sites | CrawlProvider |
| YouTube/video evidence | TranscriptProvider |
| Scholarly evidence | AcademicProvider |
| Current news | NewsProvider |
| Structured companies/people | StructuredDataProvider |
| Dynamic/authenticated portals | BrowserProvider |
| User files | FileProvider |
| Cross-source comparison | Evidence engine |
| Provenance | Source/evidence graph |
| Verification | Verification engine |

The source itself should never become the context.

The Context Compiler remains the boundary.

---

# 20. Evidence and provenance should become stronger

Stryde should eventually model:

- source;
- claim;
- evidence excerpt;
- observation;
- condition;
- independent corroboration;
- contradiction;
- applicability;
- verification;
- temporal validity.

The system should answer:

> "Why does Stryde believe this?"

and:

> "What could make this conclusion wrong?"

That is a differentiator.

---

# 21. Hooks and event-driven control

Modern agent systems are starting to expose hooks.

Stryde should eventually support lifecycle hooks around:

- before research;
- after research;
- before tool execution;
- after tool execution;
- before external write;
- after write;
- before skill activation;
- after skill activation;
- verification failure;
- budget threshold;
- pursuit inactivity;
- outcome recorded.

Hooks can implement:

- policy checks;
- logging;
- notifications;
- security scans;
- cost controls;
- automatic verification;
- escalation.

Hooks must not bypass the main authority layer.

---

# 22. Public API / webhooks / extensibility

Stryde can eventually expose:

- pursuit API;
- observations API;
- research API;
- capability API;
- events/webhooks;
- artifact API;
- skill API.

This lets other systems feed reality into Stryde.

Example:

`CRM webhook
→ observation
→ pursuit update
→ Stryde reassesses
→ action`

The API should expose Stryde semantics, not raw internal tables.

---

# 23. Plugin / skill distribution

Longer term, Stryde can support a capability ecosystem.

Possible distribution units:

- personal skills;
- verified skills;
- organization skills;
- plugin bundles;
- connector packages;
- industry packs.

However:

> **Do not build the marketplace first.**

First prove the package model internally.

Then prove install/update/security.

Then prove a small private registry.

Only then consider a public marketplace.

---

# 24. Trust model for external plugins and MCP

External capability packages are untrusted until evaluated.

Stryde should track:

- publisher;
- version;
- source;
- license;
- tool permissions;
- data access;
- network access;
- side effects;
- credential requirements;
- security scan;
- provenance;
- reputation;
- update history.

Every package needs a trust classification.

Example:

`TRUSTED
REVIEWED
UNVERIFIED
BLOCKED
`

Untrusted does not necessarily mean unusable.

It means the system applies stricter controls.

---

# 25. Personal autonomy profiles

Subscriptions and autonomy are different.

Stryde can eventually let a user establish broad preferences such as:

- suggest only;
- prepare but ask before executing;
- execute low-risk actions automatically;
- execute within specific capabilities;
- notify after completion;
- never send external messages automatically.

This is an **authority policy**, not an AI personality setting.

---

# 26. Learning from outcomes

Skills are not the only learning mechanism.

Stryde should learn:

`method
→ conditions
→ action
→ observation
→ outcome
→ effectiveness
`

Example:

`Method: cold email
Market: local agencies
Offer: X
Result: 0 replies from 30
`

That becomes evidence about the user's situation.

Over time Stryde can estimate:

- which methods have worked for this user;
- under what conditions;
- which approaches repeatedly fail;
- where the user is strong;
- where execution bottlenecks appear.

This is far more useful than generic personalization.

---

# 27. Evaluation maturity

Stryde needs more than unit tests.

Add benchmark categories:

### Capability evaluation

Can the tool actually perform its contract?

### Research evaluation

Did Stryde find the right evidence?

### Reasoning evaluation

Did Stryde reason correctly over evidence?

### Authority evaluation

Did Stryde respect permission boundaries?

### Security evaluation

Did malicious external content fail to gain authority?

### Economic evaluation

Did Stryde spend efficiently?

### Outcome evaluation

Did the pursuit move?

### Longitudinal evaluation

Did Stryde learn correctly from previous outcomes?

These should become product-quality gates.

---

# 28. What Stryde should NOT copy

Do not add a feature merely because ChatGPT, Claude or Gemini has it.

Reject or defer:

- generic chat modes;
- generic "personas";
- decorative dashboards;
- feed/social surfaces;
- arbitrary model playgrounds;
- pointless custom UI builders;
- giant vector-memory systems without a demonstrated retrieval problem;
- marketplace before the package model is mature;
- massive connector catalog before permission architecture is solid.

The test is:

> **Does this make Stryde better at understanding a pursuit, changing the situation, or learning from reality?**

If not, it is probably secondary.

---

# 29. Priority matrix

## P0 — capability platform foundations

These unlock many other features.

1. Unified Capability Registry
2. Capability metadata / schemas
3. Capability discovery
4. Skill runtime V2
5. Skill progressive disclosure
6. Skill composition
7. Connector model
8. MCP capability ingestion
9. Entitlement-aware capability gating
10. Resource accounting hooks
11. General scheduler / trigger model
12. Background job orchestration
13. Artifact model
14. Local/cloud computer boundary
15. Model task router

## P1 — major capability expansion

16. YouTube / transcript provider
17. academic provider
18. structured company/people provider
19. news provider
20. browser interaction beyond observation
21. code sandbox
22. multimodal ingestion
23. notification delivery
24. sub-agent orchestration
25. event-driven pursuit updates
26. richer memory retrieval
27. artifact editing/preview
28. public-ish capability API/webhooks

## P2 — ecosystem

29. plugin package format
30. private plugin registry
31. skill/connector discovery UX
32. verified third-party packages
33. marketplace
34. sharing/collaboration
35. generated UI/artifact apps
36. external agent interoperability

---

# 30. What I would build first

Not 36 independent features.

Build one compositional vertical slice:

`Pursuit
→ Capability Registry
→ entitlement
→ budget
→ planner
→ skill
→ connector/MCP capability
→ research/action
→ observation
→ artifact
→ verification
→ updated pursuit
`

Use one real workflow to prove it.

A strong first workflow is:

> "Research this market, identify the best targets, produce a verified shortlist, create an outreach artifact, and tell me the smallest real-world test."

This can exercise:

- research;
- source graph;
- structured extraction;
- skills;
- cost control;
- artifacts;
- planner;
- observation;
- verification.

---

# 31. The deeper product opportunity

ChatGPT, Claude, Gemini and Manus are converging on increasingly capable general assistants.

Stryde should not try to win by being a slightly different generic assistant.

The opportunity is:

> **Stryde becomes the system that owns a person's pursuits over time.**

The difference is:

### Generic assistant

"Here is an answer."

### Agent workspace

"Here is the work I completed."

### Stryde

"Here is where you are, what is actually known, what remains uncertain, what I investigated, what I am authorized to do, what we tried, what happened, what changed, and what the next move is."

The additional capabilities are valuable because they make that system more capable.

They are not the product by themselves.

---

# 32. Final architecture

The mature Stryde stack should look like:

`USER
↓
UNIVERSAL COMPOSER
↓
PURSUIT / SITUATION
↓
CONTEXT COMPILER
↓
CAPABILITY DISCOVERY
↓
ENTITLEMENT
↓
RESOURCE BUDGET
↓
PLANNER
├── RESEARCH
├── SKILL
├── CONNECTOR / MCP
├── SUB-AGENT
├── COMPUTER
├── CODE
├── ARTIFACT
└── SCHEDULE / TRIGGER
↓
AUTHORITY
↓
EXECUTION
↓
OBSERVATION
↓
VERIFICATION
↓
OUTCOME
↓
LEARNING
├── MEMORY
├── SKILL
├── EFFECTIVENESS
└── UPDATED SITUATION
↓
NEXT MOVE`

This is the platform Stryde needs.

---

# 33. Final rule

> **Build the control plane once. Make capabilities replaceable, composable, measurable, permissioned, and evidence-producing.**

That is how Stryde can absorb the best ideas from ChatGPT, Claude, Gemini, Manus, Cursor, Copilot and the MCP ecosystem without becoming a clone of any of them.
