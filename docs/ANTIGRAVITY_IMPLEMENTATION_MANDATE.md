# Stryde — Antigravity Implementation Mandate

**Status:** Authoritative implementation brief for the next full repository reconciliation and build pass  
**Prepared:** 2026-10-18  
**Repository:** https://github.com/haseeb-builds/stryde  
**Purpose:** Convert the agreed Stryde product behavior into working, testable, evidence-backed implementation—not another vision document or a prompt-only prototype.

This document supplements, rather than silently replaces, the canonical product and architecture documents. Where it overlaps with an existing specification, reconcile them and update the canonical source of truth instead of creating competing systems. Repository code, migrations, live-system evidence, tests, and current runtime observations must be inspected before any capability is classified as implemented or complete.

---

## 1. Mission and product contract

Stryde is an evidence-driven personal pursuit and execution system. It helps a person move something meaningful from intention to reality.

Stryde is not a generic chatbot, roadmap writer, task manager, search engine, research report generator, or thin wrapper around an agent framework. Its value is the connected loop:

**Intent → understand the desired outcome → reconstruct the situation → identify material unknowns and bottlenecks → acquire and evaluate evidence → form a recommendation → establish appropriate authority → act or delegate → observe → verify → learn → update personal and pursuit state → choose the next move.**

The model is one replaceable reasoning and interaction component. It is not the source of truth. Stryde must be able to retrieve real source material, preserve provenance, challenge model outputs, detect contradictions, test claims, execute permitted work, and update its decisions when reality disagrees with an earlier answer.

The quality target is improved real-world outcomes, not impressive prose, long reports, activity counts, or simulated autonomy.

### Non-negotiable user experience

- One universal composer is the primary control surface.
- The person can communicate naturally: goals, questions, links, files, images, voice, existing roadmaps, progress reports, corrections, decisions, or results.
- The person should not need to create a Pursuit, configure an agent, choose a research workflow, identify tools, or fill out an extensive intake form.
- Stryde interprets intent and selects the appropriate mode and capabilities.
- Internal concepts such as claim, source, research job, action, worker, or evidence graph are not the default user-facing workflow.
- The UI remains calm and concise, with progressive disclosure for sources, evidence, actions, artifacts, uncertainty, and detailed reasoning summaries.
- Stryde asks only when the answer can materially change the diagnosis, research path, decision, authority, or next action.
- Stryde can recommend changing, pausing, or abandoning a goal when the evidence warrants it. It must not silently substitute its own objective for the user's.
- The person can inspect, correct, pause, resume, merge, archive, or stop pursuits and control personal memory and autonomy.

### Natural intent must create the right state

Support at least these distinct intents:

1. Ordinary chat or a direct question.
2. Exploration of a possible goal without commitment.
3. An explicit or strongly implied ongoing goal, problem, or desired outcome.
4. A source, roadmap, document, or external AI response submitted for critique.
5. A progress report, correction, decision, result, or contradiction affecting an active pursuit.
6. A request to perform a concrete task.
7. A side conversation that should not unintentionally redirect the active pursuit.

Create a pursuit automatically when the evidence of intent is strong enough. When commitment is ambiguous, use a lightweight contextual proposal or one natural question instead of manufacturing a commitment. Avoid duplicate pursuits and recognize when a new intention relates to an existing one. Do not create a persistent pursuit for every trivial question.

### Goal discovery and multiple pursuits

Stryde must not assume every user already knows what the correct goal is. If the user expresses uncertainty, investigate viable directions, identify constraints, ask decision-relevant questions, and use low-cost experiments to resolve uncertainty.

Treat a person's goals as a portfolio, not as unrelated chat threads. Detect shared prerequisites, resource conflicts, deadlines, dependencies, and contradictions among active pursuits. Help surface what matters most now without silently discarding lower-priority commitments. Prioritization must consider user intent, consequence, urgency, expected value, available time/resources, risk, and dependencies—not recency alone.

---

## 2. Research-first behavior: the central implementation requirement

For a goal or recommendation where external facts materially affect the right answer, Stryde must acquire and evaluate evidence **before presenting the substantive research-dependent roadmap or recommendation**.

Do not generate a generic roadmap first and perform research afterward as a separate next move. Reorder and repair the orchestration so the answer, roadmap, options, current situation, and next move are generated or reconciled against the resulting evidence and persisted state.

This rule must be adaptive, not universal overkill:

- A simple definition, trivial exchange, or self-contained question should not trigger an unnecessarily expensive deep research cycle.
- A consequential goal, current-market question, scientific or technical claim, roadmap audit, career or business decision, or plan with high uncertainty should use enough investigation to support the decision.
- When research cannot be completed, Stryde must distinguish conclusions supported by existing evidence from unverified inference, report the missing capability or access boundary honestly, and proceed with useful non-blocked work where appropriate.
- A provider error, quota failure, blocked page, or failed extraction means the acquisition failed; it does not prove that evidence does not exist.
- Never fabricate having visited a source, read a transcript, retrieved a paper, run a test, executed an action, or verified an outcome.

Use research depth tiers internally (for example, quick, standard, and deep) according to expected decision value, stakes, uncertainty, reversibility, freshness requirements, latency, permissions, and available resource budget. These are planner decisions, not mandatory user configuration.

### The research cycle

For each meaningful research cycle:

1. Define the decision or uncertainty that the research must improve.
2. Reconstruct existing relevant pursuit and personal context, including previous research and outcomes.
3. Maintain competing hypotheses when the diagnosis is uncertain.
4. Prioritize questions by expected decision value; do not research every conceivable question.
5. Select domain-appropriate source types and acquisition capabilities.
6. Reserve resources and choose the cheapest sufficiently reliable route—not merely the cheapest call.
7. Retrieve actual content where access permits, rather than relying only on search-result snippets.
8. Extract relevant passages, claims, methods, requirements, prerequisites, numbers, conditions, caveats, outcome claims, and citations.
9. Recursively follow important references to the underlying evidence where useful.
10. Preserve source identity, provenance, content locators, access status, timestamps, and relevant versions.
11. Detect duplicate, syndicated, derivative, outdated, contradictory, and independent material.
12. Evaluate evidence quality and applicability, not just source count.
13. Compile a bounded evidence package for reasoning rather than dumping raw source collections into model context.
14. Reassess the situation and competing hypotheses using the retrieved evidence.
15. Decide whether further research is likely to change the decision.
16. Stop at evidence sufficiency, escalate to a better capability when justified, ask one high-value user question when necessary, or design a real-world experiment when that is the best way to resolve uncertainty.

Every research cycle must have a clear purpose, a resource budget, a stopping rule, and a transition into a decision, action, experiment, or explicit unresolved state. Prevent research from becoming sophisticated procrastination.

---

## 3. Source acquisition must be broad, replaceable, and honest

Stryde should be able to investigate practically any useful domain through the best capabilities actually available and authorized. Support a provider-neutral source-acquisition contract rather than baking product semantics into a single search vendor.

Potential source lanes include:

- Public web pages, search engines, news, official websites, technical documentation, policies, regulations, pricing pages, job postings, marketplaces, and competitor sites.
- Scholarly indexes, journals, systematic reviews, meta-analyses, original papers, preprints, datasets, reports, and relevant reference lists.
- YouTube and other videos, accessible captions/transcripts, timestamps, descriptions, creator references, demonstrations, and course lessons where access permits.
- Reddit and other public communities, discussion forums, issue trackers, Q&A sites, and practitioner discussions.
- Public or authorized APIs, structured data services, repositories, changelogs, release notes, code, tests, and benchmark results.
- Course syllabuses, curricula, lesson content, assessments, projects, prerequisites, and publicly available outcomes.
- User-provided URLs, pasted roadmaps, documents, PDFs, spreadsheets, images, media, audio, transcripts, repositories, and outputs from other AI systems.
- Browser-accessible sources and authenticated services only when a legitimate authorization and credential boundary exists.
- Existing Stryde sources, prior research, artifacts, pursuit observations, and relevant personal context, so the system does not repeatedly reacquire or re-reason about the same material unnecessarily.

### Domain-specific source strategies

Do not treat all sources or domains as interchangeable.

- **Scientific and health questions:** use appropriate guidelines, high-quality reviews, original research, methodology, study populations, outcomes, limitations, and relevant contrary findings. An original paper is not automatically stronger than a well-conducted synthesis for every question.
- **Software and AI:** prioritize relevant official documentation, source code, reproducible tests, technical papers, benchmarks, and actual version-specific behavior. Tutorials and community posts provide application details and failure reports.
- **Business and earning:** investigate buyer demand, market structure, current platform rules, customer evidence, realistic costs, incentives, transparent case studies, independent corroboration, failures, and testable acquisition assumptions. Treat screenshots and creator revenue claims as claims until validated.
- **Learning and courses:** inspect actual content, prerequisites, assessments, projects, and skill outcomes; don't equate course completion or popularity with competence.
- **Career:** inspect real role requirements, hiring evidence, assessment expectations, portfolio standards, geography and experience constraints, while distinguishing current observations from generalized advice.

The appropriate evidence hierarchy depends on the question and decision stakes. An official source is usually authoritative about its own current policy; it may not be unbiased evidence of its real-world effectiveness. A creator can be the primary source for what they teach, but their own claims about effectiveness need separate evaluation.

### Transcript and media handling

For video and audio when a legitimate path exists:

- Capture or obtain the actual available transcript/captions, not just the title and description.
- Preserve the original source URL, platform, title, publication metadata when available, retrieval time, relevant segment text, and timestamps or stable locators.
- Extract material claims and trace cited references where relevant.
- Retain only appropriate excerpts and metadata in durable storage; do not blindly place full transcripts into each model call.
- Mark unavailable transcripts, inaccessible lessons, audio-only segments, and uncertain extraction quality explicitly.
- Use authorized APIs, permitted crawling, available captions, legitimate browser access, licensed providers, or user-provided material. Do not bypass DRM, paywalls, access controls, platform restrictions, or private-account boundaries.

Social/video platform connectors are capability adapters, not a promise that every public or private item can always be fetched. Build fallback paths and honest unavailable states. Do not assume that a tool/provider is configured simply because an adapter exists in the repository.

### Acquisition contract

Every source provider should return normalized records describing, as applicable:

- Provider/capability identity and version.
- Requested URL or query and original source identity.
- Title, canonical URL, source type, publisher/author, publication/update date when known, retrieval timestamp, and access method.
- Extracted content or relevant excerpts with character ranges, page numbers, transcript timestamps, section anchors, or equivalent locators.
- Content hash/version and duplicate/derivative relationships when feasible.
- Extraction quality and limitations.
- Attribution and permission/access metadata.
- Cost, latency, status, retryability, and error details.
- Whether the source was discovered, actually retrieved, actually parsed, or merely referenced.

Distinguish discovery, retrieval, extraction, interpretation, and verification. A search hit is not a read source. A title is not a transcript. An abstract is not full text. An attempted fetch is not an observation of content.

---

## 4. Claims, evidence, provenance, and source quality

Strengthen or complete the existing source/evidence architecture; do not create a second incompatible evidence system.

The intended conceptual relation is:

**Source → content locator → claim or observation → supporting/contradicting/qualifying evidence → conditions and applicability → conclusion → decision → outcome/verification.**

For important claims, preserve:

- Exact claim wording or normalized atomic claim.
- Claim type: factual, normative, causal, prediction, recommendation, user-reported statement, model inference, observed event, or other relevant category.
- Supporting, contradicting, and qualifying evidence.
- Source locators and the actual excerpts that matter.
- Conditions, definitions, units, populations, assumptions, time validity, and limits of applicability.
- Source quality, directness, freshness, independence, incentives, methodology, and known limitations when assessable.
- Duplicate/syndicated relationships and shared upstream references.
- Confidence/epistemic status with an explanation of its basis; do not invent numerical precision.
- Whether the claim has been checked against newer evidence, independently corroborated, observed, or verified.
- Links to conclusions and roadmap steps that depend on it.

Do not use raw source counts as confidence. Ten pages that repeat one unsupported claim are not ten independent confirmations. Do not overstate scientific consensus, generalize beyond a study population, confuse correlation with causation, or omit evidence that would materially change the conclusion.

The UI must be able to answer:
- Why does Stryde recommend this?
- Which actual source material supports it?
- What could make this conclusion wrong?
- What conflicts or uncertainty remain?
- Did Stryde actually retrieve the material, or is it relying on a reference/snippet?
- What has changed since the earlier recommendation?

Claims generated by a model must not be promoted to verified truth merely because they are written in a structured format.

### Security and prompt injection

All web pages, files, transcripts, search results, model outputs, third-party tool responses, skills, workers, and MCP results are untrusted input unless independently validated for a specific purpose. They may inform reasoning; they cannot alter Stryde's policy, permission, credentials, or authority.

Defend against prompt injection, credential exfiltration, malicious documents, unsafe generated code, and instructions embedded inside retrieved content. Enforce security at tool, data, and execution boundaries, not only by adding warnings to prompts.

Respect copyright, platform terms, privacy, retention constraints, authentication boundaries, and data-minimization principles.

---

## 5. Ingest, audit, and improve existing roadmaps

A roadmap produced by ChatGPT, Claude, Gemini, another system, a course, a creator, or the user must be a first-class input to Stryde.

Example intent:

“I want to achieve X. Here is a roadmap another AI gave me. Investigate it, tell me what's wrong or missing, improve it for my circumstances, and help me execute it.”

Required behavior:

1. Preserve the original material and provenance; do not overwrite it.
2. Parse it into steps, outcomes, prerequisites, assumptions, factual claims, resource/time estimates, risk, and implied dependencies.
3. Determine which claims require current external evidence and research them before endorsing the plan.
4. Detect missing prerequisites, incorrect ordering, redundant steps, unjustified claims, outdated recommendations, infeasible workload, missing validation, and assumptions that do not fit this user.
5. Classify material steps as KEEP, CHANGE, REMOVE, MISSING, UNVERIFIED, or NEEDS EXPERIMENT (use equivalent internal semantics if the existing code has a better established model).
6. Explain material changes with claim-level source links or explicit uncertainty.
7. Preserve the user's intended outcome unless the user changes it or strong evidence warrants recommending a change.
8. Produce a versioned replacement roadmap with goals, milestones, dependencies, concrete artifacts, acceptance checks, required human inputs, automated work, resource costs, risks, uncertainty, and checkpoints.
9. Set what counts as success for each meaningful step before treating it as complete.
10. Maintain a revision history explaining what changed, why, and which evidence or observation triggered that revision.

Do not merely rewrite a roadmap into better prose or attach a bibliography to an otherwise generic plan. The evidence must materially influence the plan.

Avoid fake precision in timelines, probabilities, income, job prospects, outcomes, or study hours. Use ranges and assumptions when evidence supports them, state unknowns, and identify which experiments will improve the estimate.

---

## 6. Adaptive interaction and personal context

Stryde should have an ongoing conversation with the person while research and work proceed.

- Ask the smallest, highest-value question when only the user can resolve a decision-relevant unknown.
- Do not ask questions just to complete internal fields or make the user configure a workflow.
- Do not re-ask information already provided or reliably stored unless it is stale, contradicted, ambiguous, or the context is materially different.
- Research in parallel with waiting for a response when the architecture supports durable parallel work and doing so is useful.
- A response to one question should not trigger a pointless chain of more questions if enough information exists to make progress.
- Keep unrelated conversation from contaminating the active pursuit; handle the user's side question without accidentally changing the pursuit goal.
- Generate the user-facing message, visible choices, roadmap state, and next action from one coherent final state. No response should say one thing while a later adaptive-controller pass silently writes a contradictory work state.

### Personal reality and memory

Keep Postgres and existing canonical domain state as the source of truth unless inspection proves the architecture has changed deliberately. Conversation text is context, not canonical truth.

Memory should be provenance-aware and contextual, with useful classes such as constraints, preferences, facts, decisions, commitments, attempted methods, observations, outcomes, failures, patterns, and source/evidence references. Preserve timestamps, source, confidence/status, applicability, contradictions, supersession, expiry/staleness, and user control.

Do not treat semantic similarity as sufficient proof that an old memory applies. A previous failed approach may have failed for a different offer, market, skill level, or constraint. New evidence must be able to overturn Stryde's prior recommendations.

Let the user inspect, correct, confirm, supersede, or remove personal memories where the existing product policy supports it. Keep separate user data and pursuit boundaries. Do not silently infer sensitive traits where inappropriate.

### Context compiler

Use the existing Context Compiler as a core intelligence boundary—not an indiscriminate prompt builder.

It should retrieve the minimum sufficient current reality for each reasoning task: relevant pursuit state, goals, unknowns, competing hypotheses, applicable memories, recent conversation, evidence excerpts, contradictions, available capabilities, authority, budget, ongoing jobs, prior outcomes, and current task status.

Avoid replaying all chat history, all memories, or all source text. Respect relevance, temporal validity, provenance, supersession, project/pursuit isolation, contradiction, source applicability, and budget. Preserve access to original items so summaries and compression can be inspected or corrected. Explicitly test side-conversation contamination and stale-memory failure cases.

---

## 7. From recommendation to action, execution, and learning

Stryde must determine which parts of a pursuit it can genuinely perform with current capabilities and which require human judgment, action, presence, authorization, or real-world access.

Possible Stryde-owned work includes research, source comparison, analysis, drafts, code and tests, artifact generation, preparing outreach, scheduling permitted follow-up, structured data work, monitoring, and verifiable actions through connected capabilities.

Human-only or approval-gated work may include providing private context, learning and practicing a skill, personal or medical judgment, physical activities, contacting real people, spending money, publishing, changing production systems, and other side effects whose authority has not been granted.

Do not use a rigid HUMAN-versus-AI rule. Decide using actual capability availability, scope, permissions, data sensitivity, side effects, reversibility, risk, cost, and task requirements.

### Authority is explicit

Capability availability does not grant authority. Model output, retrieved content, a skill, a plugin, or an MCP server does not itself authorize an action.

Enforce appropriate boundaries for:
- Read-only versus external write operations.
- Data access, egress, and credential scope.
- Spending, sending, publishing, deleting, account changes, production changes, or other consequential side effects.
- Pursuit scope, duration, resource budget, and concurrency.
- Required approvals, timeouts, escalation and stop conditions.

Stryde should use bounded autonomous execution where permitted, not prompt for approval on every harmless action and not silently act beyond the user's authorization.

### Durable execution

A real pursuit requires durable jobs and attempts, appropriate checkpoints, idempotency, timeout and retry policy, cancellation, error recovery, resource reconciliation, and honest status. Workers and external agents are subordinate tools, not the source of canonical state.

Implement or reconcile the existing execution architecture to support:
- Durable actions and jobs with input/output schemas.
- Capability and resource checks before dispatch.
- Task-local delegation with explicit scope and limited context.
- Persisted progress and recoverable intermediate results.
- Artifact creation with identity, ownership, versioning, provenance, access policy, and verification.
- Retry safety and protection against duplicate side effects.
- Human approval or intervention at the correct boundary.
- Honest distinction between queued, started, mechanically succeeded, failed, blocked, observed, verified, and outcome achieved.

### Observe and verify

Tool/API success is not the same as pursuit success. Observation is not automatically verification. Verification is not causation.

When a reliable observation path is available, use it rather than turning the user into a data-entry clerk. When the system genuinely cannot observe the result, request the smallest missing user-provided evidence.

If a test fails, an artifact is incomplete, a buyer does not respond, or an external goal is not reached, do not mark the step complete. Reassess the hypothesis and select a next move based on what happened.

---

## 8. Experiments, monitoring, scheduling, and goal portfolio

### Real-world experiments

Where external research cannot resolve uncertainty, convert it into a bounded experiment:
- Explicit hypothesis and why it matters.
- Cheapest sufficiently informative test.
- Preconditions and risks.
- Defined measurement and success/failure criteria.
- Sample/observation plan justified by the context, without pretending a small test proves universal truth.
- Resource and authority requirements.
- Result capture and verification criteria.
- A decision rule for what to do after each plausible outcome.

Use the result to update the situation, roadmap and competing hypotheses. Do not recommend endless browsing when a real experiment has substantially higher information value.

### Monitoring and proactive continuation

Use the existing scheduler/trigger/job system wherever possible; do not build a second one. Where capabilities and permissions allow, support one-time, recurring, event-based and state-based work, including conditions such as a pursuit being blocked, an external policy changing, a source being updated, or a deadline approaching.

Monitoring needs explicit conditions, frequency, budget, retention, notification preferences, authority, idempotency, retry and stop rules. Do not scrape or poll recklessly, create notification spam, or promise background work without an actual scheduled-job path.

When a material event occurs, update only the affected reality and reassess its impact. Resume a pursuit when useful rather than blindly regenerating the whole plan.

### Cross-pursuit prioritization

Recognize resource conflicts and shared dependencies across simultaneous pursuits. Help decide the next best use of the person's attention and Stryde's resources, preserving the user's authority over major goal trade-offs. Avoid making every pursuit active, urgent, or noisy.

---

## 9. Model, capability, provider, and cost architecture

### Provider direction

The intended primary model path is the direct Google AI Studio Gemini API, with OpenRouter as fallback, not OpenRouter as the preferred path. Respect explicit user configuration and preserve backward compatibility where necessary. Model and provider identifiers must remain configurable and provider-neutral.

Inspect current environment variable names, provider routing, structured-output behavior, streaming, retries, timeouts, usage accounting, and error handling before changing them. Validate that the selected model ID is actually supported by the chosen API. Do not silently substitute another model if the explicitly configured identifier fails; use a configured fallback and disclose the route accurately. Do not assume a consumer Google AI subscription includes API credits or that a free model/provider is production-viable.

Do not perform billable model experiments unless specifically authorized or already covered by an explicit, verified test policy. Preserve the model/provider abstraction and test fallback behavior with controlled mocks and appropriate integration tests.

### Task-aware model routing

Use a model/capability suitable for the actual task: classification, extraction, research planning, evidence assessment, synthesis, coding, multimodal parsing, tool calling, structured output, or high-stakes review. Consider task complexity, required quality, provider health, latency, schema reliability, cost, privacy and available resources.

Do not route based solely on model reputation or add multiple model calls without evidence they improve outcomes. Avoid redundant serial review calls. Prefer deterministic validation, retrieval constraints, tests, and the smallest sufficient model/call sequence where these provide the required reliability.

### Unified capability registry and discovery

Inspect and reuse the existing tool/capability registry. A capability contract should describe, where relevant:
- Stable semantic key and version.
- Provider, adapter and availability/health.
- Input and output schemas.
- Trust classification and provenance.
- Required credentials and scopes.
- Data access/egress boundary.
- Read/write side effects, risk and reversibility.
- Required authority and approval.
- Plan eligibility and resource cost model.
- Expected latency and reliability.
- Verification and observability support.
- Fallback candidates and rejection reasons.

Answer internally: “What can Stryde use for this task, for this user, under current permissions and resource budget?” Do not expose a raw tool catalog as the default UI.

### Resource economics and graceful degradation

Every variable-cost operation should be attributable to user, pursuit, operation, capability, provider, estimated/reserved/actual usage, status and outcome. Resource reservations must reconcile after completion, error, cancellation and timeout. Enforce budgets server-side and test concurrent reservation races. Entitlements control capacity, not truth, authority or epistemic status.

Plan resources across model tokens/calls, source discovery, extraction, transcript acquisition/minutes, browser/worker execution, storage, latency, concurrency and other actual cost dimensions. Prefer cached valid evidence before reacquisition; use cheap discovery before broad crawling; target extraction to relevant content; escalate to specialized providers only where valuable.

When cost, quota, authentication or provider availability prevents work, use an honest fallback, preserve partial progress and complete unrelated possible work. No invented credentials or pretend integrations.

---

## 10. UI and user-facing behavior

Keep the universal composer and minimal cognitive effort. Do not create a research dashboard or expose internal ontology as the product.

For meaningful research and execution, the user should be able to understand:
- What Stryde concluded and what matters now.
- What Stryde actually researched or executed.
- The next recommended action and why.
- What changed in the pursuit or roadmap.
- The important evidence and source passages.
- What remains unknown, disputed, inaccessible or blocked.
- Whether an action is proposed, awaiting approval, in progress, completed mechanically, or verified.
- Artifacts created and how to inspect them.
- The resources or permission boundary only when it matters to the user's choice.

Use concise summaries and progressive disclosure. Make citations meaningful and source-bound. Keep citations separate from model-generated statements they do not support. Do not represent a source as read if only its search snippet was retrieved.

The user can ask follow-up questions or go off-topic without losing pursuit continuity. Present automatic pursuit creation in a user-understandable way, avoid noisy duplicates and preserve easy user correction.

---

## 11. Testing and evaluation requirements

Do not declare this mandate fulfilled based on code compilation, a successful health endpoint, a green deployment status, mocked providers, or a test count alone. A capability's implemented, unit-tested, integration-tested, configured, deployed, production-proven, and customer-proven statuses must remain separate.

First inspect the existing tests and verification matrix; extend existing suites instead of duplicating them. Add or reconcile unit, contract, integration, E2E, security, resilience, and product-behavior tests.

### Required research tests

1. A consequential goal requiring external facts starts research before the substantive roadmap/recommendation is committed or shown.
2. A simple direct question does not trigger unnecessary broad research.
3. Search results, retrieved pages, transcripts, abstracts and full text are distinctly represented; the system never confuses discovery with successful retrieval.
4. A transcript excerpt preserves source identity and correct time/segment locator.
5. A supplied roadmap is decomposed, challenged against evidence, versioned and materially improved where warranted.
6. Important recommendations trace to actually retrieved supporting material and meaningful locators.
7. Citation/excerpt mismatch, nonexistent references and unsupported claims are rejected or marked unverified.
8. Contradictory evidence changes or qualifies the result when material.
9. Duplicate, syndicated and shared-upstream sources do not create false independent corroboration.
10. Stale, inaccessible, failed, truncated or partially retrieved content is represented honestly.
11. Missing credentials/provider failure produces an explicit degraded state, not fabricated research.
12. Research stops when the decision is sufficiently supported or further information has low expected value; resource ceilings are enforced.
13. When experimentation has greater information value than more browsing, Stryde proposes a bounded, measurable experiment.
14. Retrieved prompt injection cannot modify policy, permissions, credentials, or authorization.
15. Different domains use appropriate evidence standards and source strategies.
16. Untrusted model output is validated before becoming a claim, roadmap step, canonical state, or action input.

### Required pursuit and execution tests

17. Natural-language goals create or propose a pursuit at the appropriate confidence boundary.
18. Exploratory intent, ordinary chat, direct questions and side conversations do not spawn unwanted pursuits.
19. Duplicate intents link to an existing pursuit where appropriate.
20. High-value dynamic questions are asked only when they can change a decision; already resolved questions are not repeated.
21. Research, assistant message, options, persisted working state and next move remain coherent with one another.
22. A supplied roadmap stays available as the original and revisions retain reasons and evidence links.
23. The plan reflects current user constraints and records assumptions rather than fabricating personal facts.
24. Multiple active pursuits surface conflicts and shared dependencies without silent goal substitution.
25. Work is dispatched only to actually available, authorized capabilities.
26. Authority restrictions are enforced independently from model recommendations and tool discovery.
27. Retries and timeouts do not create duplicate side effects or contradictory state.
28. Failed tests or real-world failures change the diagnosis/plan rather than being marked as success.
29. Observable outcomes are verified automatically; unobservable outcomes request the minimum missing evidence.
30. User memory can be corrected, superseded or removed according to existing policy; stale/conflicting memory does not silently dominate.
31. Background scheduling and triggers are proven end to end before the product claims to monitor or resume work.
32. Artifacts have proper ownership, versioning, provenance, permissions and actual usable UI.
33. Cross-user isolation, auth boundaries, credential isolation, malicious files, SSRF, data egress and destructive-action gating are tested.
34. Usage reservations, reconciliation, concurrency, hard budgets and degraded provider routing are tested.
35. Current user-facing flow is verified through a realistic authenticated full journey, including at least a second turn and persisted state.

### Outcome evaluation

Where feasible, create evaluation fixtures or replayable scenarios that score:
- Evidence retrieval quality and freshness.
- Claim-to-source alignment.
- Contradiction recognition.
- Roadmap audit quality and prerequisite correctness.
- Relevance and burden of user questions.
- Correct pursuit creation and continuity.
- Execution correctness and artifact usability.
- State consistency and verification quality.
- Research cost per decision improved.
- Time to a useful, testable next move.
- Real outcome progress when enough product usage exists to measure it.

Do not claim customer-outcome improvement before there is evidence from actual users. Track the metric as unknown until it can be measured.

---

## 12. Current-repository reconciliation is mandatory before implementation

The current GitHub main branch includes extensive documentation describing intended research and capability behavior. Some documentation also records known production gaps and historical checkpoints. There may be newer local work or a local checkpoint not present on remote main. Do not treat this document's existence, an old handoff, or a prior chat summary as implementation evidence.

Use the architecture's existing authority ordering:
1. Actual code and migrations define repository implementation.
2. Live Supabase schema, functions, policies, and data define database runtime truth.
3. Deployed Vercel runtime evidence defines deployed behavior.
4. Tests and verification artifacts define the exact boundary of tested behavior.
5. Canonical product/architecture documents define intended behavior.
6. Historical handoffs and conversation history provide clues but must be reconciled.

Before changing files:

- Inspect the actual local branch, commit, worktree changes, untracked files, and all relevant remotes.
- Preserve the user's work. Never reset, clean, overwrite, force-push or switch away from uncommitted work without first preserving and reconciling it.
- Fetch the dedicated documentation branch that contains this mandate, but do not blindly replace a local branch or discard newer implementation.
- Compare local changes, remote main, existing branches and the current mandate. Keep the most recent correct work; merge/rebase only with a clear, safe approach.
- Read the canonical product, architecture, state, decisions, runtime, integrations, research engine, cost-control/resource model, verification matrix and handoff documents.
- Inspect the actual conversation pipeline, initial message path, adaptive controller, work route, research planner/executor, source ingestion/adaptation, citations/evidence model, Context Compiler, personal memory, pursuit creation, tool/capability registry, workers/MCP/browser, jobs/attempts/leases, artifacts, notifications, scheduler/triggers, authority/policy checks, billing/resource reservations, provider routing, model/schema/streaming handling, tests, migrations and UI.
- Reconcile conflicting docs, code, tests, environment state and deployed proof. Update the canonical current-truth location rather than creating a third competing description.
- Check the previous reported local second-turn fixes and all new work against the actual checked-out code and test output. Do not assume a commit exists remotely merely because it was reported in conversation.
- Treat test counts as derived data: run the relevant commands and report the actual totals instead of copying counts from older handoffs.
- For live/production state, inspect only what is necessary and authorized. Do not expose secret values or user content in logs/reports.

Produce an internal gap map that identifies existing reusable components, missing implementation, defects, conflicts, blockers and proof requirements. Then implement; do not stop after producing that gap map.

---

## 13. Required implementation sequence

This is a dependency-guided sequence, not permission to rewrite each subsystem in order if already-working code exists. Inspect first, then take the shortest safe route through the connected end-to-end behavior.

### Phase 0 — Preserve and reconcile

- Establish exact branch/commit/worktree state; preserve all work.
- Read and reconcile canonical docs and the latest code.
- Run a baseline of install/typecheck/lint/tests/build and appropriate existing E2Es.
- Inspect production proof and current configured capability/provider status without triggering deployment or destructive operations.
- Record known failures, contradictions and missing credentials.

### Phase 1 — Repair the core conversation/pursuit loop

- Ensure intent classification distinguishes chat, exploration, goal, roadmap intake, progress, decision, side conversation and concrete action.
- Make pursuit creation or proposal natural, idempotent and reversible.
- Reconstruct current situation and context consistently.
- Ensure subsequent turns do not overwrite fresh state with stale controller state.
- Ensure user-facing text, work state, options, actions and persisted state agree.
- Keep ordinary chat simple and prevent unrelated messages from contaminating ongoing pursuits.

### Phase 2 — Make research-first orchestration real

- Inspect and repair the first-response pipeline so the planner can run research before a research-dependent response is shown or committed.
- Implement a durable research job / bounded research cycle using existing job, source and capability primitives; do not create a competing job engine or an unrelated research subsystem.
- Maintain the research objective, questions, competing hypotheses, candidate sources, resource reservation, retrieval status, relevant excerpts, evidence, conflicts and stopping conditions.
- Normalize acquired source content, preserve provenance/locators, and represent inaccessible/failed content correctly.
- Use targeted source adapters and fallbacks based on domain and question. Do not call every provider for every question.
- Compile selected evidence into the reasoning context and persist the material provenance required to reconstruct why the answer was made.
- Reconcile assistant output and next move from the final evidence-aware state.

### Phase 3 — Improve claim/evidence and roadmap representation

- Reuse the existing evidence model and source-citation path.
- Add missing provenance, locators, source lineage, contradiction/duplicate detection or temporal validity only where the existing schema truly lacks them.
- Build and version a roadmap from atomic steps, dependencies, outcomes, evidence, assumptions, risks, required human actions and verification criteria.
- Make source-backed KEEP/CHANGE/REMOVE/MISSING/UNVERIFIED/NEEDS EXPERIMENT assessments inspectable.
- Preserve the original roadmap and explain significant revisions.
- Ensure important recommendations point to source material actually acquired by Stryde.

### Phase 4 — Connect roadmap steps to actual execution

- Reuse the current action/job/attempt/worker/artifact/authority infrastructure.
- Make tasks executable or explicitly human-owned, with acceptance criteria and dependencies.
- Support durable artifacts, real tool outputs, retry safety, approvals, progress and failure recovery.
- Verify actual results wherever possible and update canonical pursuit state.
- Keep unobservable real-world outcomes explicitly unverified until evidence arrives.

### Phase 5 — Connect memory, portfolio, experimentation and proactive work

- Apply relevant personal reality without blindly replaying conversations.
- Support goal ambiguity and cross-pursuit dependencies/prioritization.
- Turn unanswerable external questions into suitable bounded experiments.
- Use the existing scheduler/trigger engine for genuine monitoring and continuation, but only claim behavior after end-to-end verification.
- Ensure monitoring respects budgets, permissions, idempotency, quiet/noise boundaries and stop controls.

### Phase 6 — Capabilities, providers, economics and reliability

- Unify or complete the provider-neutral capability discovery and eligibility contract using existing registry infrastructure.
- Reconcile direct Gemini primary / OpenRouter fallback and environment compatibility.
- Validate model IDs, structured output, streaming, timeouts, retry amplification, fallbacks and resource accounting.
- Complete server-side entitlements/resource reservations and reconciliation wherever currently missing.
- Clearly mark unconfigured source lanes as blocked/unavailable and implement useful non-blocked fallbacks.
- Confirm worker, transcript, academic, browser, connector and artifact capabilities only to the degree actually configured and proven.

### Phase 7 — Verification, UX and canonical docs

- Test realistic journeys from natural language to pursuit, research, evidence-based plan, action, artifact/observation, verification and next move.
- Test error paths, provider failure, missing credentials, contradictory evidence, stale memory, side conversations, prompt injection, authority, budgets, cross-user isolation and restart/retry recovery.
- Verify responsive UI and accessibility where touched.
- Update canonical docs, state, integration inventory, verification matrix, decision register and handoff with current evidence, distinguishing implemented/tested/deployed/production-proven/customer-proven.
- Summarize final code changes, actual command output/status, unresolved external blockers, remaining user actions and the precise first manual launch/deploy steps.

---

## 14. Engineering operating rules

Operate as an autonomous senior/staff engineer. Do not ask the user to choose obvious implementation details. Resolve ambiguity from existing architecture, code, tests, security, reversibility, cost, provider neutrality, user intent and verified runtime evidence.

- Do not deliver only an analysis, roadmap, or prompt and stop. Continue implementing all safe, non-blocked work.
- Do not turn the existing codebase into a rewrite just to express the architecture in a new shape.
- Do not create disconnected feature islands or redundant registries, queues, memories, source models, roadmaps or job engines.
- Prefer mature, appropriately licensed infrastructure for commodity tasks; keep Stryde's semantic control loop and state ownership explicit.
- Do not add heavyweight frameworks, multi-agent review loops or model calls without a demonstrated benefit.
- Do not repeatedly spend calls rediscovering the same missing credential. Record it once and continue.
- Do not treat a provider's health endpoint, a mocked success, a deployment status or a successful API response as proof of the user's intended outcome.
- Do not misrepresent external access or fabricate transcript, paper, content, test, or execution results.
- Do not make destructive database changes or reset production.
- Do not log, commit, or expose secrets.
- Do not relax security controls to make a test pass.
- Do not rewrite history in canonical docs; append current truth and identify superseded statements.
- Keep changes small enough to review, but complete enough to deliver coherent behavior.
- After each meaningful unit of work, run focused tests; then run the full required test/typecheck/lint/build suite and relevant E2Es.
- If a blocker requires credentials, external approval, unavailable infrastructure or a human decision, finish every independent useful task, then list the blocker once with its exact impact, evidence, and minimum required resolution.
- Do not stop to ask the user mid-run for low-value clarification. Make reasonable reversible choices and consolidate genuinely required user decisions at the end.

---

## 15. Explicit stop boundary: no deployment or production mutation

**This mandate ends before any Vercel deployment. The user will deploy manually only after reviewing the completed work.**

Unless the user explicitly authorizes a separate later operation:

- Do not deploy, promote, roll back, or change a production Vercel deployment.
- Do not merge the work into main or push code changes to main.
- Do not perform production database migrations, destructive operations, or production data mutations.
- Do not trigger paid production API operations or incur new external spend without explicit authorization or a documented, already-authorized test budget.
- Do not claim the work is production verified if it was verified only locally or on a preview.
- Safe local tests, static checks, isolated test databases, mocks, and appropriately authorized read-only inspections are allowed.
- Keep changes on the dedicated working branch; do not force-push or discard pre-existing user work.
- If branch preview deployments occur automatically, do not promote them or treat them as production releases.

Before finishing, verify that no deployment or prohibited production mutation was triggered by the work.

---

## 16. Definition of completion for this build pass

Do not declare the mission complete because all phases have been attempted. Completion requires evidence for the actual boundaries touched.

At minimum:

1. The current repository and working tree have been reconciled and preserved.
2. The most consequential known second-turn/conversation state issues have been checked against actual current code and tests.
3. A natural-language goal can produce or propose the right pursuit without requiring manual workflow configuration.
4. Research-dependent recommendations go through evidence acquisition before presentation when the capability is available.
5. The system distinguishes genuinely retrieved content from snippets, references, unavailable sources and failed acquisitions.
6. Important roadmap claims are linked to actual source material and evidence locators.
7. Supplied roadmaps can be audited and versioned, not simply paraphrased.
8. A coherent evidence-informed next action is connected to actual available tools or explicitly assigned to the user.
9. Execution, observation, verification and state update remain distinct and tested.
10. The user-facing response, pursuit state, roadmap, options and next move agree.
11. Missing credentials/integrations degrade honestly; unrelated work still completes.
12. Research and execution honor authority, resource budgets, retries, timeouts and security boundaries.
13. Focused tests and full local validation have been run; relevant E2Es have real evidence.
14. Canonical docs and the verification matrix accurately state current implemented, tested, configured, deployed and proven boundaries.
15. The final report clearly separates completed work, partial proof, unresolved blockers, required human inputs, and manual deployment instructions.
16. No production deployment, merge to main, destructive production action or unauthorized external spend has occurred.

If a production or external boundary cannot be proven without credentials, human action, or the user's future manual deployment, mark it precisely as BLOCKED/NOT PROVEN rather than claiming completion. Implement the reusable capability and all locally testable portions that remain safe and useful.

---

## 17. Canonical documents to reconcile

Inspect the current files; paths may evolve and code remains authoritative for implementation:

- docs/PRODUCT_CONSTITUTION.md
- docs/PRODUCT.md
- docs/ARCHITECTURE.md
- docs/STATE.md
- docs/DECISIONS.md
- docs/INTEGRATIONS.md
- docs/RUNTIME.md
- docs/VERIFICATION_MATRIX.md
- docs/OPERATING_MODEL.md
- docs/RESEARCH_REALITY_ENGINE.md
- docs/RESEARCH_COST_CONTROL.md
- docs/SUBSCRIPTION_AND_RESOURCE_MODEL.md
- docs/BILLING_PROVIDER_ARCHITECTURE.md
- docs/AI_CAPABILITY_LANDSCAPE_AND_GAPS.md
- docs/GLM_MASTER_IMPLEMENTATION_BRIEF.md
- docs/GLM_RESUME_MANDATE.md
- docs/GLM_WORLD_CLASS_SINGLE_SESSION_BUILD_MANDATE.md
- HANDOFF.md
- Relevant linked issues and PRs, current branch history, migration files, tests, and actual deployed/runtime evidence.

This document is the current implementation mandate for the agreed work; it does not make older, conflicting status reports true. Reconcile them.

## Final instruction

Understand the user's intended end-to-end behavior, reconcile existing work, and then implement it. Preserve useful work, verify rather than assume, keep all capabilities connected to the pursuit loop, continue through every safe and resolvable blocker, and stop at the no-deployment boundary. Finish with a precise evidence-backed account of what works, what does not, what remains blocked, and what the user must do manually next.
