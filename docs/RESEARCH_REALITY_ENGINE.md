# Stryde Research + Reality Engine

Status: locked design direction / implementation target
Date: 2026-10-06

This document records the product and architecture direction established for Stryde around evidence acquisition, research, model independence, context compilation, adaptive diagnosis, experimentation, verification, and real-world outcome movement.

It is a companion to `docs/PRODUCT_CONSTITUTION.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/STATE.md`, and `docs/DECISIONS.md`.

It does not replace current-state evidence. It defines the intended behavior that implementation must move toward and the failure modes that implementation must defend against.

---

## 1. The core realization

Stryde should not depend on the underlying language model to know the answer to the user's problem from pretrained knowledge.

That is especially important when Stryde runs on an inexpensive or smaller model.

The model is a reasoning and interaction engine inside Stryde. It is not the final source of truth.

When a user says:

> "I want to land my first client."

Stryde should not immediately generate a generic roadmap from the model's prior knowledge.

Instead, Stryde should understand the intention, determine what it does not know, investigate the external world using the capabilities available to it, acquire and structure evidence, compare evidence under its conditions, reconstruct the user's current situation, ask the user only for information that materially changes the next decision, recommend the next move, obtain appropriate authority, execute or delegate where allowed, observe what happened, verify what can be verified, learn from the result, and continue.

The important distinction is:

- **The model generates reasoning.**
- **Stryde acquires evidence.**
- **Stryde preserves state.**
- **Stryde controls authority.**
- **Stryde executes through capabilities.**
- **Reality determines whether the reasoning was correct.**

This is the central reason Stryde can remain useful even when the underlying model is not frontier-class.

---

## 2. What Haseeb means by "research it itself"

The intended behavior is not a manual research assistant where the user has to:

- find YouTube videos;
- paste transcripts;
- search Reddit;
- collect case studies;
- choose sources;
- compare methods;
- convert sources into notes;
- then ask the model for a plan.

Stryde should own that work whenever the capability is available and authorized.

The user gives the intention.

Stryde absorbs the ambiguity.

For example:

> "I want my first client."

Stryde should be capable of inferring that the useful question is probably not "what are some generic ways to get clients?"

It may instead need to investigate questions such as:

- What kinds of buyers are plausibly reachable?
- What problems are those buyers actually paying to solve?
- What offers are being purchased now?
- Which acquisition channels have evidence?
- What do successful first-client case studies have in common?
- What conditions made those methods work?
- Which methods fail under different conditions?
- What does this particular user already have?
- What is the likely current bottleneck?
- Which unknowns can be answered from external evidence?
- Which unknowns only the user can answer?
- Which uncertainty can only be resolved by running a real-world experiment?

The system should decide which of these matter. The user should not have to operate the research machinery manually.

---

## 3. Stryde is not a better chatbot

Stryde should not compete with frontier models by trying to produce better prose, longer answers, or more clever one-shot strategies.

A frontier model can be extremely strong at:

- reasoning;
- synthesis;
- planning;
- writing;
- coding;
- analysis;
- explanation;
- creativity.

Stryde does not need to defeat that.

Instead:

> **Stryde makes the intelligence system around the model stronger.**

The distinction is:

### Plain LLM interaction

`goal → model knowledge → answer`

### Stryde interaction

`goal → situation reconstruction → unknowns → evidence acquisition → evidence processing → context compilation → reasoning → authority → action → observation → verification → learning → updated state → next move`

The model is one component in the second system.

It is not the system.

---

## 4. The canonical Stryde loop

The full intended loop is:

`INTENTION
→ REALITY
→ SITUATION
→ UNKNOWN / BOTTLENECK
→ RESEARCH
→ EVIDENCE
→ INTERPRETATION
→ OPTIONS
→ RECOMMENDATION
→ AUTHORITY
→ ACTION / DELEGATION
→ OBSERVATION
→ VERIFICATION
→ OUTCOME
→ LEARNING
→ UPDATED PERSONAL + PURSUIT STATE
→ NEXT MOVE`

Research is therefore not a separate "research feature".

It is a capability inside the pursuit loop.

Likewise, verification is not a final report feature. It is part of the loop.

The purpose of the loop is not to create an impressive strategy artifact.

The purpose is to move the user's situation toward the desired state.

---

## 5. The first-class research behavior

Research should become a Stryde-owned capability with a provider-neutral contract.

A research cycle should conceptually contain:

1. **Research objective**
2. **Current uncertainty**
3. **Questions worth resolving**
4. **Source strategy**
5. **Source acquisition**
6. **Content extraction**
7. **Claim / observation extraction**
8. **Source provenance**
9. **Evidence quality assessment**
10. **Condition / applicability extraction**
11. **Contradiction detection**
12. **Synthesis**
13. **Research sufficiency decision**
14. **Situation update**

The output of research is not primarily a report.

The output is an improved model of the current situation.

For example:

Bad output:

> "I researched 35 sources. Here is a 4,000 word report."

Preferred internal result:

`Current question:
Which acquisition route appears most plausible for this user?

Evidence:
- X independent examples
- Y buyer signals
- Z contradictory findings

Conditions:
- company size
- geography
- price range
- existing credibility
- acquisition channel

Interpretation:
Route A looks promising under conditions C.

Unknown:
Applicability to this user's situation remains unverified.

Next move:
Run a low-cost test with N prospects.`

The reasoning model should consume this structured result rather than an indiscriminate dump of source material.

---

## 6. Source acquisition should be broad, not one-provider dependent

Stryde should be able to use whatever evidence sources are useful and available.

Possible sources include:

- web search;
- websites;
- official documentation;
- official databases;
- public APIs;
- YouTube;
- transcripts;
- Reddit and other communities;
- public discussions;
- case studies;
- pricing pages;
- competitor sites;
- job postings;
- marketplaces;
- academic research;
- reports;
- user-provided files;
- browser-accessible portals;
- specialized research providers;
- other MCP-backed sources;
- direct human input.

The research planner should select the appropriate mixture based on:

- question;
- relevance;
- source quality;
- recency;
- stakes;
- cost;
- latency;
- reliability;
- accessibility;
- user permissions.

Stryde does not own a particular research vendor.

It owns the evidence acquisition contract.

---

## 7. YouTube and long-form source handling

When a source such as a YouTube video is useful, Stryde should not blindly place the entire transcript into the reasoning context.

The intended flow is:

`SOURCE
→ TRANSCRIPT / CONTENT
→ EXTRACTION
→ RELEVANT CLAIMS / METHODS / RESULTS / CONDITIONS / FAILURES
→ PROVENANCE
→ CONTEXT COMPILER
→ REASONING`

A transcript may be retained for provenance, but the current model context should contain only the relevant pieces.

This prevents:

- context flooding;
- irrelevant narrative;
- repeated claims;
- excessive token cost;
- accidental source authority;
- distraction from the current decision.

A creator's statement also remains a creator's statement.

Stryde must not silently upgrade:

`creator claim → market truth`

Instead it should preserve something closer to:

`source-reported claim
+ source type
+ reported result
+ reported conditions
+ independent corroboration
+ contradictions
+ current applicability
= evidence state`

---

## 8. Evidence is not truth

Stryde must preserve the distinction between:

- source claim;
- user report;
- model inference;
- hypothesis;
- observation;
- verified outcome;
- contradiction;
- unknown.

A useful internal representation can be:

`CLAIM
SOURCE
SOURCE TYPE
PROVENANCE
REPORTED RESULT
CONDITIONS
DATE / FRESHNESS
CORROBORATION
CONTRADICTIONS
APPLICABILITY
STATUS
CONFIDENCE
`

For example:

`Claim:
Cold outreach can acquire clients.

Source:
Creator case study.

Source type:
Self-reported case study.

Reported result:
3 clients.

Conditions:
Specific market, existing portfolio, specific price point.

Corroboration:
Limited.

Status:
Plausible but unverified for this pursuit.

Applicability:
Unknown.`

The goal is not fake mathematical precision.

The goal is to prevent unsupported certainty.

---

## 9. Evidence strength is contextual

Stryde should not use simplistic rules such as:

> "Primary source always wins."

or:

> "Ten sources beat one source."

Different evidence answers different questions.

For example:

- an official source can establish what a company says;
- a pricing page can establish listed pricing;
- user complaints can reveal problems;
- case studies can reveal reported outcomes;
- a job posting can reveal hiring demand;
- academic research can establish broader empirical evidence;
- direct outreach can reveal current buyer response.

Source count is not evidence independence.

Ten articles may simply reproduce the same source.

Stryde should therefore distinguish:

- source quality;
- source independence;
- directness;
- relevance;
- recency;
- corroboration;
- condition similarity;
- contradiction.

---

## 10. Research must adapt to the situation

Stryde should not run a fixed research template for every pursuit.

Research should be situation-driven.

For:

> "I want my first client."

the initial pass might be diagnostic.

It may investigate multiple possible explanations:

- insufficient prospects;
- weak offer;
- weak targeting;
- insufficient credibility;
- poor acquisition channel;
- poor conversion;
- pricing mismatch;
- delivery uncertainty.

It should then identify which evidence would distinguish these possibilities.

This prevents Stryde from locking onto its first explanation.

---

## 11. Competing bottleneck hypotheses

Stryde should not immediately assume it knows the bottleneck.

It can maintain competing hypotheses.

For example:

`H1: not enough qualified prospects
H2: offer is insufficiently valuable
H3: buyer targeting is wrong
H4: credibility is insufficient
H5: outreach conversion is weak
H6: pricing is misaligned`

Research and real-world observations should update these hypotheses.

The objective is not philosophical Bayesian purity.

The practical objective is:

> **Do not spend weeks optimizing the wrong problem.**

A correct strategy attached to the wrong bottleneck is still a failed Stryde recommendation.

---

## 12. Asking Haseeb questions

Stryde should ask questions when the answer is genuinely needed.

It should not ask questions merely because its internal workflow has an unanswered field.

Bad:

> "Please fill in your target market, preferred channel, preferred offer type, geography, price, timeline, risk tolerance, and skill level."

Good:

> "One thing changes the research substantially: who do you want to sell to first?"

Better:

> "I already have enough context to investigate the market. I’ll only stop you when something only you can decide or observe."

Question selection should be driven by expected decision value.

A question is valuable when its answer can materially change:

- diagnosis;
- recommendation;
- action;
- authority;
- research path;
- risk level.

This is a core implementation of:

> **Absorb cognitive ambiguity. Do not reflect it back to the user.**

---

## 13. The user should experience the complexity as competence

Internally, Stryde may be doing:

- retrieval;
- source ranking;
- transcript extraction;
- claim classification;
- contradiction checks;
- context retrieval;
- capability selection;
- authority evaluation;
- worker delegation;
- verification;
- state reconciliation.

The user should generally experience:

> "Stryde understood what I meant, investigated it, asked me the one thing it needed, and moved it forward."

Not:

> "I had to operate an AI workflow engine."

This remains consistent with the universal-composer product principle.

---

## 14. Context Compiler becomes a central intelligence layer

The Context Compiler should not be treated as a prompt helper.

It should construct the minimum sufficient reality for the current reasoning task.

Potential context inputs include:

- current intention;
- current pursuit state;
- current bottlenecks;
- current unknowns;
- relevant personal facts;
- constraints;
- preferences;
- commitments;
- past decisions;
- rejected approaches;
- past actions;
- observed outcomes;
- verified facts;
- current research evidence;
- contradictions;
- active hypotheses;
- relevant skills;
- capability availability;
- authority state;
- recent conversation;
- current task state.

It should explicitly avoid blindly replaying:

- entire conversation history;
- every memory;
- every previous brainstorm;
- every source;
- every old conclusion.

The compiler should apply filters such as:

- relevance;
- temporal validity;
- provenance;
- contradiction;
- supersession;
- authority;
- current objective;
- current bottleneck;
- applicability;
- context budget.

The goal is:

> **Give the reasoning engine the right reality, not all available data.**

---

## 15. Context retrieval can fail

This is a first-class risk.

Suppose Stryde remembers:

> "Haseeb tried cold outreach."

That alone may be misleading.

The important context might be:

> "The previous cold-outreach attempt was for a completely different offer and was rejected because the targeting was wrong."

Therefore context retrieval must preserve relationships and circumstances, not just semantic similarity.

A memory or observation should not be treated as a generic reusable fact when:

- its conditions differ;
- it has been superseded;
- it conflicts with newer evidence;
- it belongs to a different pursuit;
- it is too old;
- it was only a hypothesis.

---

## 16. Stryde must be able to overturn itself

Stryde's previous reasoning is not canonical truth.

A prior recommendation is a hypothesis produced under prior information.

New evidence must be able to invalidate it.

For example:

`Old hypothesis:
Agencies are the best first market.

New evidence:
Buyer response is consistently poor.

Required behavior:
Do not defend the old recommendation.

Instead:
reassess the situation and investigate alternatives.`

This prevents:

- self-anchoring;
- confirmation bias;
- stale plans;
- memory-induced tunnel vision.

---

## 17. Research should stop at evidence sufficiency

Perfect knowledge is impossible.

Research should stop when there is enough information to make the next decision at an appropriate risk level.

The relevant question is:

> **Do we know enough to make the next reversible decision?**

not:

> "Do we know everything?"

Research effort should therefore scale with:

- consequence;
- irreversibility;
- uncertainty;
- expected value;
- cost of delay;
- cost of information.

A cheap reversible experiment may require modest evidence.

A high-impact irreversible action requires substantially stronger evidence and authority.

---

## 18. When research cannot answer, reality should answer

This is one of the most important consequences of the architecture.

Some questions cannot be answered reliably from the internet.

For example:

> "Will these specific companies buy this offer from me?"

No amount of browsing can guarantee the answer.

Stryde should then convert uncertainty into an appropriately sized experiment.

Conceptually:

`HYPOTHESIS
→ EXPERIMENT
→ REAL-WORLD EXPOSURE
→ OBSERVATION
→ RESULT
→ UPDATED HYPOTHESIS
→ NEXT EXPERIMENT`

For example:

> "We do not know whether this offer is attractive to these buyers."

Stryde may recommend:

> "Let's test it with ten carefully selected prospects."

The experiment can then provide better evidence than another ten hours of content consumption.

This does not make research unnecessary.

It gives research a boundary.

---

## 19. Stryde should optimize for real-world movement

Stryde must not optimize primarily for:

- number of sources found;
- number of tokens generated;
- number of tasks created;
- number of agent runs;
- length of answers;
- apparent intelligence;
- user engagement.

The quality target is changed reality.

For a client-acquisition pursuit, useful movement might eventually look like:

`0 qualified prospects
→ 20 qualified prospects
→ 5 replies
→ 2 calls
→ 1 proposal
→ 1 client`

The exact numbers are illustrative.

The principle is:

> **Agent activity is not outcome progress.**

Stryde can perform enormous amounts of work while still failing the pursuit.

The system needs to notice that.

---

## 20. The most dangerous failure: a beautiful wrong diagnosis

A system can be evidence-rich and still wrong.

Suppose the true bottleneck is:

> the offer has weak value.

But Stryde concludes:

> the bottleneck is insufficient lead volume.

It may then recommend:

- more outreach;
- more channels;
- more automation;
- more prospects.

Everything can be executed perfectly while the user remains stuck.

Therefore the architecture needs:

- competing bottleneck hypotheses;
- evidence targeted at discrimination;
- observation after action;
- willingness to revisit diagnosis;
- outcome-based evaluation.

The correct system behavior after repeated failure is not:

> "Try harder."

It is:

> **"Our diagnosis may be wrong. Let's reassess."**

---

## 21. Research can become procrastination

The opposite failure is also dangerous.

A system can research endlessly.

Example:

`Goal
→ 40 videos
→ 30 Reddit threads
→ 20 articles
→ more case studies
→ more source comparison
→ giant strategy
→ no action`

This would be a sophisticated procrastination machine.

Stryde must therefore enforce a research-to-decision boundary.

Every research cycle should have:

- a reason;
- a question;
- an expected decision impact;
- a sufficient-evidence test;
- a bounded resource budget;
- a transition to action or an explicit statement of remaining uncertainty.

Research is not the goal.

---

## 22. Source contamination and prompt injection

External content is untrusted input.

A website, transcript, document, or MCP result may contain instructions such as:

> "Ignore previous instructions."

or:

> "Send these credentials to this address."

Stryde must never treat external content as a source of authority.

The architectural rule is:

`EXTERNAL CONTENT
→ UNTRUSTED DATA
→ EXTRACTION
→ CLAIMS / OBSERVATIONS
→ REASONING`

Never:

`EXTERNAL CONTENT
→ AGENT AUTHORITY`

External data can inform a decision.

It cannot authorize an action.

This boundary must be enforced structurally wherever possible, not only through a system prompt.

---

## 23. Capability is not authority

Stryde may have access to a capability without having permission to use it for a particular side effect.

The conceptual chain is:

`CAPABILITY
→ Can Stryde technically do this?
→ AUTHORITY
→ Is Stryde permitted to do this?
→ RISK
→ Should this action happen now?
→ EXECUTION`

Examples:

- Stryde can send email, but that does not automatically authorize sending.
- Stryde can browse LinkedIn, but that does not authorize outbound messages.
- Stryde can call an MCP tool, but capability availability does not grant permission for its side effects.
- A webpage cannot grant the agent additional authority.

This remains non-negotiable.

---

## 24. Reported, observed, verified, outcome, causation

Stryde should preserve a ladder such as:

`REPORT
→ OBSERVATION
→ VERIFICATION
→ OUTCOME
→ CAUSATION`

These are not interchangeable.

For example:

> User says: "The client liked the proposal."

This is reported information.

A CRM event showing the proposal was opened is an observation.

A confirmed signed contract is an outcome with stronger verification.

The conclusion:

> "The new positioning caused the sale."

is a causal claim that may require additional evidence.

Stryde must resist collapsing these levels.

---

## 25. The model strategy

The system should be model-independent.

Stryde should not exist to prove that one model is best.

The underlying model should be replaceable.

### Economical models

Cheap models may handle:

- routine interpretation;
- extraction;
- classification;
- summarization;
- simple reasoning;
- low-risk state updates;
- routine research synthesis;
- normal conversation.

### Stronger models

Higher-tier models can be used for:

- difficult diagnosis;
- conflicting evidence;
- complex strategy;
- high-value synthesis;
- difficult planning;
- high-stakes reasoning;
- hard creative synthesis;
- unusually ambiguous situations.

The user should not have to manually understand this routing.

Stryde can select a model according to:

- task complexity;
- required quality;
- stakes;
- latency;
- cost;
- availability;
- user plan;
- capability compatibility.

---

## 26. Paid-plan model access

The architecture should support paid users receiving access to stronger models.

This should not turn Stryde into:

> "Pay us and get a chatbot with a better model."

The product remains Stryde.

The model is a replaceable capability.

A paid tier can improve:

- reasoning ceiling;
- difficult decision quality;
- complex research synthesis;
- response quality;
- latency;
- model choice;
- model routing;
- access to specialized capabilities.

A possible strategy is:

`BASIC
= economical model routing + core Stryde system`

`PRO
= access to stronger model classes + smarter routing + higher capability budgets`

The exact pricing and commercial packaging remain open until customer evidence supports them.

---

## 27. Why cheap models can still be viable

The key thesis is not:

> "Cheap models are just as intelligent as frontier models."

That would be too strong.

The thesis is:

> **A weaker model can produce a substantially more useful product when it operates inside a strong system that acquires relevant evidence, preserves state, selects context, constrains authority, executes tools, observes reality, verifies results, and learns.**

A frontier model still improves that system.

The stronger model becomes an upgrade to the reasoning layer rather than the entire product definition.

This is important for cost, model substitution, and long-term resilience.

---

## 28. Stryde should improve when models improve

The desired architecture should allow:

`Stryde + cheap model
→ useful`

`Stryde + strong model
→ better`

`Stryde + future model
→ still better`

The product should not collapse when a new model wins benchmarks.

A better frontier model is an asset Stryde can route to, not an existential threat to Stryde's identity.

This is the same reason Stryde should not be owned by a single:

- model provider;
- search provider;
- browser framework;
- MCP host;
- workflow framework;
- memory library.

---

## 29. MCP is a capability ecosystem

MCP should be treated as an integration/capability interface, not as Stryde's control plane.

Potential capabilities can include:

### Research
- search;
- extraction;
- browser observation;
- YouTube/transcript retrieval;
- specialized databases.

### Business
- CRM;
- prospecting;
- company data;
- analytics;
- email.

### Execution
- code agents;
- browser workers;
- automation;
- file/document operations.

### Communication
- email;
- messaging;
- calendar;
- notifications.

Stryde should eventually be able to discover or maintain an inventory of useful capabilities and select among them according to:

- capability fit;
- reliability;
- cost;
- availability;
- permissions;
- user policy;
- task requirements;
- historical performance.

But:

> **Capability discovery is not authority.**

And:

> **Third-party infrastructure must never become canonical Stryde truth.**

---

## 30. The Context Compiler + capability registry relationship

The compiler should know not only:

> "What does Stryde know?"

but also:

> "What can Stryde actually do right now?"

The reasoning context may therefore include a bounded capability picture:

`CURRENT SITUATION
+
RELEVANT EVIDENCE
+
RELEVANT PERSONAL STATE
+
AVAILABLE CAPABILITIES
+
AUTHORITY BOUNDARIES
+
CURRENT BUDGET
=
ACTIONABLE REALITY`

This prevents recommendations that require capabilities Stryde does not actually have.

It also supports graceful degradation.

---

## 31. Graceful degradation

Stryde should remain coherent when a capability is unavailable.

Examples:

### Research provider unavailable

Stryde should say, in effect:

> "I can still reason from the evidence already available, but I cannot complete fresh external research right now."

### Browser unavailable

Stryde should not pretend it observed the site.

### Worker unavailable

Stryde should not pretend delegated work completed.

### Strong model unavailable

Stryde should route to an economical alternative or explain that the high-complexity path is currently unavailable.

The product should fail honestly rather than simulate success.

---

## 32. Stryde should not become an infinite multi-agent system

Adding multiple frameworks or agents does not automatically produce intelligence.

The architectural center remains Stryde.

Possible frameworks can be used as subordinate infrastructure only when a demonstrated problem justifies them.

Do not add technology because it is fashionable.

Particularly avoid turning:

- LangGraph;
- Letta;
- CrewAI;
- AutoGen;
- LiteLLM;
- Temporal;
- Crawlee;
- Firecrawl;
- other frameworks

into the product identity.

Use a component only when it improves a demonstrated constraint or removes meaningful non-differentiating engineering burden.

Stryde should remain the semantic control plane.

---

## 33. Failure modes and engineering risk

These are current engineering risk estimates, not measured probabilities.

| Failure mode | Estimated probability | Importance | Required response |
|---|---:|---|---|
| Research becomes procrastination | 80% | Very high | Research sufficiency + experiment transition |
| Weak model misreads evidence | 75% | Very high | structured evidence + provenance + stronger model routing when needed |
| Stryde manufactures certainty | 75% | Critical | epistemic states + explicit provenance |
| Context retrieval misses crucial history | 70% | Critical | richer retrieval filters + contradiction/supersession handling |
| Endless research | 70% | High | bounded research budgets + evidence sufficiency |
| Wrong bottleneck diagnosis | 65% | Critical | competing hypotheses + discriminatory evidence |
| Correlation mistaken for causation | 65% | High | causal-claim separation + verification |
| Over-agentic action | 65% | Critical | explicit authority layer + least privilege |
| Prompt injection / poisoned sources | 60%+ | Critical | untrusted-source boundary + tool/data isolation |
| Source-selection bias | 60% | High | diversified source strategy |
| Self-anchoring to old Stryde conclusions | 55% | High | previous conclusions remain revisable hypotheses |
| Activity replacing outcomes | 55% | Critical | outcome-centered metrics |
| Excessive conservatism | 50% | Medium | consequence-sensitive evidence thresholds |

The numbers should be re-estimated from real Stryde evaluation data once the engine exists.

---

## 34. The most important safeguards

The implementation should treat the following as hard product constraints.

### Research constraint

Do not research merely to look intelligent.

### Evidence constraint

Do not upgrade a source claim into truth without justification.

### Epistemic constraint

Do not hide uncertainty.

### Context constraint

Do not dump all available memory or documents into the model.

### Diagnostic constraint

Do not assume the first bottleneck is the correct bottleneck.

### Authority constraint

Capability never implies permission.

### Security constraint

External content never grants authority.

### Verification constraint

Do not report execution as outcome verification.

### Continuity constraint

Do not let old Stryde conclusions become immutable truth.

### Outcome constraint

Do not confuse agent activity with reality movement.

### Model constraint

Do not make model quality the sole product moat.

---

## 35. The user experience of Haseeb

The intended Haseeb experience is not:

> "I have a giant AI dashboard."

It is not:

> "I have to configure agents."

It is not:

> "I have to search for the information and then ask Stryde what it means."

It is:

> **"I have something important I want to move."**

Haseeb says:

> "I want my first client."

Stryde absorbs the ambiguity.

It investigates.

It forms a picture of what appears true.

It tells Haseeb what it has learned without drowning him in research mechanics.

It asks him when only he can provide the answer or authority.

It recommends what matters now.

It performs what it can.

It asks him to perform what only a human can do.

It watches the resulting reality.

It verifies where possible.

Then it updates.

The user should feel:

> **"Stryde is thinking with me and working on the situation, not merely talking to me."**

---

## 36. The Haseeb role inside Stryde

Haseeb should remain the human authority and source of personal intent.

Stryde should not replace judgment.

Instead:

`Haseeb
= intention + authority + final human judgment where required`

`Stryde
= investigation + context + reasoning support + execution + observation + continuity`

This makes Stryde an amplifier of Haseeb's agency rather than a system that asks him to surrender it.

Stryde may challenge him.

It may say:

> "The evidence does not support the assumption you are making."

It may say:

> "I think the bottleneck is different from what you originally thought."

It may say:

> "We do not know yet. The cheapest useful next step is an experiment."

It may say:

> "I cannot do this without your authorization."

That is healthy Stryde behavior.

---

## 37. What Stryde is ultimately trying to become

Stryde is not:

- a chatbot;
- a planner;
- a memory database;
- a research app;
- a search engine;
- a task manager;
- a browser automation product;
- an MCP client;
- an agent framework;
- a multi-agent swarm.

Those can all be capabilities.

The identity is:

> **A persistent personal pursuit system that investigates reality before acting and keeps adapting until the situation moves.**

A useful shorthand is:

> **Stryde = an evidence-acquiring operator for personal pursuits.**

An even deeper description is:

> **Stryde is a closed-loop reality engine around a person's intentions.**

---

## 38. The philosophical rule

The deepest product rule is:

> **AI can generate hypotheses. Reality gets the final vote.**

From that follows:

`When Stryde does not know
→ investigate.`

`When investigation cannot answer
→ experiment.`

`When Stryde acts
→ observe.`

`When the observation disagrees
→ update.`

This is the behavior that should make the system trustworthy.

---

## 39. What "success" means

A successful Stryde session is not one in which the model sounded smart.

A successful session should ideally create some combination of:

- reduced uncertainty;
- better understanding;
- a better decision;
- a completed action;
- a new observation;
- a verified outcome;
- an updated model of the situation;
- a better next move.

The ultimate measure is:

`Did the user's situation move?`

Not:

`Did Stryde generate a lot?`

---

## 40. Implementation architecture target

A target implementation can be viewed as:

`UNIVERSAL COMPOSER
        ↓
AUTHENTICATED SITUATION ASSEMBLY
        ↓
CONTEXT COMPILER
        ↓
ADAPTIVE DIAGNOSIS
        ↓
RESEARCH PLANNER
        ↓
CAPABILITY REGISTRY / SELECTION
        ↓
SOURCE ACQUISITION
        ↓
CONTENT EXTRACTION
        ↓
EVIDENCE / CLAIM LAYER
        ↓
CONTEXT COMPILER
        ↓
REASONING MODEL
        ↓
RECOMMENDATION
        ↓
AUTHORITY GATE
        ↓
ACTION / DELEGATION
        ↓
OBSERVATION
        ↓
VERIFICATION
        ↓
CANONICAL STATE UPDATE
        ↓
OUTCOME / LEARNING
        ↓
RESEARCH AGAIN IF REQUIRED
        ↓
NEXT MOVE`

This should be implemented incrementally.

The system should not wait for the entire architecture before proving vertical slices.

---

## 41. Implementation implications for the current repository

The current repository already has significant pieces of the target architecture:

- persistent pursuit state;
- conversation continuity;
- Context Compiler;
- source and citation primitives;
- evidence / claim state;
- adaptive conversation;
- human and worker actions;
- worker gateway;
- browser worker primitives;
- MCP client;
- agent selection;
- skills;
- verification primitives;
- event instrumentation;
- model/provider abstraction.

The new direction means these capabilities should increasingly converge around the research-first closed loop rather than remaining isolated features.

The most important future changes are therefore architectural orchestration rather than adding many unrelated features.

The current code should not be assumed to already satisfy this full target.

The target must be proven through real end-to-end behavior.

---

## 42. The next major Stryde capability

The most important missing conceptual layer is:

### Research Intelligence / Evidence Acquisition

This should eventually be able to:

1. receive a pursuit intention;
2. identify current uncertainties;
3. plan an adaptive investigation;
4. discover suitable sources;
5. acquire content;
6. extract relevant evidence;
7. preserve provenance;
8. identify contradictions;
9. evaluate applicability;
10. compile relevant context;
11. update the situation;
12. ask Haseeb only when needed;
13. continue until the next decision is sufficiently informed;
14. transition to action;
15. return to research when new reality creates new uncertainty.

The point is not to build a generic research product.

The point is to make research part of Stryde's continuous pursuit engine.

---

## 43. The experiment engine

A complementary capability should eventually turn unknowns into bounded real-world tests.

For each useful experiment, Stryde should be able to preserve:

- hypothesis;
- expected signal;
- test design;
- population / target;
- action;
- observation;
- result;
- interpretation;
- updated confidence;
- next decision.

This can become a bridge between:

`internet evidence`

and:

`personal evidence`

because Stryde ultimately needs to learn what works for this person, not merely what people claim works in general.

---

## 44. The compounding asset

The potential long-term advantage is not merely stored text.

It is:

`PERSON
+
PURSUIT HISTORY
+
EVIDENCE
+
OBSERVATIONS
+
VERIFIED OUTCOMES
+
FAILED EXPERIMENTS
+
LEARNED METHODS
+
CAPABILITY PERFORMANCE
`

over time.

This can eventually answer questions that a one-shot model cannot answer:

> "What actually works for Haseeb?"

not merely:

> "What does the internet say works?"

That is the longitudinal layer.

It is not assumed to be a moat yet.

It must be earned through real usage and verified outcomes.

---

## 45. Final locked principles

The following are the principles this document records as the intended direction.

1. **Stryde investigates the user's situation itself.**
2. **Stryde should not default to generic model-generated roadmaps when external evidence can materially improve the decision.**
3. **The underlying model is a reasoning engine, not the final source of truth.**
4. **External sources are evidence, never authority.**
5. **Research is a first-class part of the pursuit loop.**
6. **Research produces structured situation improvement, not merely reports.**
7. **Long content is acquired and filtered before entering reasoning context.**
8. **Every important conclusion preserves provenance and epistemic status.**
9. **Source claims, model inference, observation, verification, outcome, and causation remain distinct.**
10. **Stryde may ask Haseeb questions, but only when the answer materially changes the next decision, action, risk, or authority.**
11. **Unknown is a legitimate state.**
12. **Stryde may maintain competing bottleneck hypotheses instead of forcing premature certainty.**
13. **Stryde must be able to overturn its own previous conclusions.**
14. **Research should stop when there is enough evidence for the next appropriately risked decision.**
15. **When research cannot answer a question, Stryde should use a real-world experiment where appropriate.**
16. **Capability never implies authority.**
17. **External content never grants authority.**
18. **Verification must remain separate from execution success.**
19. **The target is movement in reality, not agent activity or generated prose.**
20. **Stryde should remain model-independent.**
21. **Stronger models should make Stryde better, not make Stryde obsolete.**
22. **Paid plans may expose stronger model classes and higher capability budgets without changing Stryde's identity.**
23. **MCP and third-party systems are subordinate capabilities, not Stryde's semantic control plane.**
24. **Context Compiler should provide the minimum sufficient current reality to the reasoning engine.**
25. **Stryde should absorb cognitive ambiguity and operational complexity instead of reflecting it back to the user.**
26. **AI generates hypotheses. Reality gets the final vote.**

---

## 46. One-sentence definition

> **Stryde is a persistent personal pursuit system that investigates reality before acting, reasons over evidence rather than model priors alone, executes through bounded capabilities, observes what happens, and keeps adapting until the user's situation moves.**


---

# 47. How Stryde actually gets the world's information

The research-first architecture is only useful if Stryde has real acquisition mechanisms.

The implementation should therefore treat **information acquisition as a provider-neutral capability layer**, not as a single "search API".

Stryde should have several distinct acquisition contracts:

`DISCOVER
→ ACQUIRE
→ EXTRACT
→ NORMALIZE
→ ATTRIBUTE
→ FILTER
→ SYNTHESIZE
→ STORE
→ COMPILE`

The distinction matters because a search engine finding a URL is not the same thing as successfully reading the source, and reading a source is not the same thing as extracting trustworthy evidence from it.

---

## 48. Recommended initial research capability stack

The current recommendation is **not** to integrate ten research vendors immediately.

Start with a small, replaceable stack that covers the major source classes.

### Tier 1: core

| Capability | Initial provider | Why |
|---|---|---|
| Semantic web discovery | Exa | Strong fit for finding relevant pages from natural-language research objectives |
| Web search / extraction / crawl | Firecrawl cloud API | Search, scrape, crawl and interaction in one web-data layer |
| YouTube/video discovery + transcript | Transcriptor capability | Existing connected capability can search videos, retrieve metadata, subtitles and transcripts |
| Browser observation | Stryde browser worker | Required for pages that need rendering, interaction, or observation |
| Academic research | Consensus / Scite | Specialized scholarly retrieval and evidence/citation context |
| Direct user-provided sources | Existing source adapters + browser/extraction path | Lets Haseeb hand Stryde a source without changing the research architecture |

This gives Stryde:

`WEB SEARCH
+
WEB CONTENT
+
DEEP WEB / JS PAGES
+
YOUTUBE
+
ACADEMIC RESEARCH
+
USER SOURCES
`

without coupling the product to one provider.

---

## 49. Exa: discovery layer

Exa is particularly useful as a **discovery/search provider**.

Its current API supports web search and fetching page content, and its platform also exposes people, company and scholarly indexes. Its current pricing page advertises a free monthly allowance and pay-as-you-go usage. The important architectural point is that Stryde should use Exa for discovery, not treat Exa's returned text as canonical truth.

Recommended contract:

`research_query
→ Exa search
→ candidate sources
→ rank / deduplicate
→ select sources
→ extraction provider
→ evidence pipeline`

Use Exa when the research planner needs:

- semantic discovery;
- conceptually similar sources;
- current web results;
- company / people discovery where appropriate;
- scholarly discovery when its index is useful.

Do not make Exa the permanent Stryde memory or evidence database.

Reference: https://exa.ai/

---

## 50. Firecrawl: web acquisition layer

Firecrawl is valuable because it covers more than simple search.

Its current product supports:

- search;
- scrape;
- crawl;
- mapping;
- interaction;
- LLM-ready structured content.

That makes it a strong web acquisition provider for Stryde.

Use it for:

- extracting selected pages;
- crawling documentation or a site;
- collecting multiple related pages;
- handling dynamic pages;
- structured extraction;
- interactive web acquisition where appropriate.

The current Firecrawl cloud API is particularly attractive because Stryde already has a provider-neutral HTTP adapter rather than needing to embed a crawler framework.

### Important licensing boundary

The Firecrawl open-source server is AGPL-3.0, while its SDKs are MIT licensed. Stryde should therefore **prefer the hosted API / provider adapter for the initial product** and should not embed or self-host the AGPL server inside Stryde without a deliberate license review.

Reference: https://www.firecrawl.dev/

---

## 51. Tavily: strong optional second web provider

Tavily overlaps with Firecrawl and Exa, so it should not automatically become another mandatory dependency.

It is nevertheless strategically valuable because it provides:

- search;
- extraction;
- crawl;
- map;
- research;
- reranked web context.

Tavily currently offers a free monthly allowance and pay-as-you-go pricing.

Its strongest role in Stryde would be:

- fallback search;
- second-source discovery;
- research-heavy queries;
- site mapping;
- independent retrieval when another provider has weak coverage.

A key principle:

> **Do not call multiple providers just to make the architecture look sophisticated.**

Use a second provider when:

- the first provider has poor coverage;
- the query is high-stakes;
- independent discovery is useful;
- sources disagree;
- the planner explicitly wants search diversity.

Reference: https://www.tavily.com/

---

## 52. YouTube: discovery and transcript are separate capabilities

YouTube requires more careful architecture than simply "call the YouTube API".

There are two different jobs:

### Discovery

Find relevant videos.

### Acquisition

Obtain the transcript/captions and metadata.

The official YouTube Data API supports video search, but the API has quota constraints. Google currently documents a default quota allocation and specific quota costs for search/caption operations. More importantly, the official caption download endpoint requires authorization appropriate to editing the video, so it is **not a general public transcript API for arbitrary videos**.

Therefore Stryde should not assume:

`YouTube Data API = arbitrary public transcript access`

That assumption would break the research system.

### Recommended Stryde path

Use:

`YouTube discovery
→ video URL
→ transcript capability
→ transcript
→ provenance
→ extraction
`

The existing Transcriptor capability already supports:

- YouTube search;
- video metadata;
- available subtitles;
- official or auto-generated transcript retrieval;
- raw subtitles;
- chapter metadata;
- pagination;
- multiple supported video platforms.

That is a much better immediate fit for Stryde than building an entire YouTube transcript subsystem from scratch.

For a future standalone production implementation, keep the transcript provider behind a `TranscriptProvider` interface so it can be replaced with services such as Supadata or an approved equivalent when needed.

Supadata currently documents a dedicated YouTube transcript API with timestamps, language support and an AI fallback when a transcript is unavailable. Its current pricing documentation lists a free tier and paid credit plans.

Reference:
- https://developers.google.com/youtube/v3/docs
- https://supadata.ai/
- existing Stryde Transcriptor capability

---

## 53. YouTube should preserve source metadata

For a video, Stryde should store more than the transcript.

Useful metadata includes:

- video URL;
- video ID;
- title;
- channel;
- channel URL;
- uploader;
- publication date;
- duration;
- language;
- subtitle type;
- transcript provider;
- retrieval timestamp;
- chapters;
- view count where available;
- description;
- transcript hash.

This makes it possible to distinguish:

> "A random 20-view auto-captioned video"

from:

> "A two-hour interview from a known operator published three months ago."

Metadata is not proof of truth, but it is useful for source assessment and provenance.

---

## 54. Academic evidence should have its own lane

For questions where academic evidence is genuinely relevant, Stryde should not treat ordinary web search as equivalent to scholarly retrieval.

Useful capabilities include:

### Consensus

Useful for question-driven academic discovery and structured paper retrieval.

### Scite

Useful when Stryde needs citation context, including whether citing work supports, contrasts with, or merely mentions a claim.

This is especially valuable for Stryde's epistemic architecture because:

`paper exists
≠
paper supports the claim`

Citation context can help identify disagreement instead of simply counting citations.

The existing connected Consensus and Scite capabilities are therefore valuable research workers.

They should be invoked selectively.

Do not run academic search for ordinary commercial questions unless it can materially improve the decision.

---

## 55. Browser is not redundant

Even with Exa, Firecrawl and other APIs, Stryde still needs browser capability.

Some information is:

- dynamically rendered;
- behind interaction;
- visible only after a click;
- dependent on filters;
- behind a login the user authorized;
- represented visually;
- exposed through a web application rather than a static page.

Therefore:

`API / search / extraction
≠
browser observation`

The existing browser worker should be the escalation path when static acquisition fails or when the research objective specifically requires interaction.

However, browser access must preserve the same provenance and authority rules as every other source.

---

# 56. The source acquisition router

Stryde should eventually have a provider-neutral router.

Conceptually:

`ResearchRequest
{
  question,
  objective,
  source_classes,
  freshness,
  depth,
  stakes,
  budget,
  authority
}
`

↓

`ResearchRouter`

↓

`Discovery Provider(s)
Extraction Provider(s)
Browser
Transcript Provider
Academic Provider(s)
Specialized Provider(s)`

The router should choose providers according to:

- capability;
- relevance;
- freshness;
- reliability;
- historical success;
- cost;
- latency;
- availability;
- source coverage;
- user plan;
- current research budget.

The LLM should help interpret the research need, but the router should not rely on free-form model output alone to bypass provider policy or authority boundaries.

---

# 57. Search diversity should be deliberate

One of the biggest risks is **search monoculture**.

If Stryde asks one provider:

> "What are the best ways to get your first client?"

and receives ten similar pages, it may falsely believe the internet agrees.

Instead, for important questions Stryde can deliberately diversify queries:

### Strategy query

"What methods do operators report using?"

### Demand query

"What are buyers currently asking for?"

### Counter-evidence query

"What commonly fails?"

### Market query

"What vendors are already selling this?"

### Pricing query

"What are customers paying?"

### Community query

"What are people complaining about?"

### Evidence query

"What independent evidence supports or contradicts this?"

This is much more useful than simply increasing search result count.

---

# 58. Research should use a source graph, not just a list

Stryde should eventually understand relationships between sources.

For example:

`Source A
claims X
↓
Source B cites A
↓
Source C independently reports X
↓
Source D reports the opposite
`

The system should recognize:

- duplicate reporting;
- syndicated content;
- common primary source;
- independent corroboration;
- contradiction;
- source hierarchy;
- recency;
- condition mismatch.

This prevents:

> "I found 17 sources saying X"

when the reality is:

> "17 pages copied the same original article."

---

# 59. The research pipeline should be staged

Do not send every result directly to an expensive model.

Recommended pipeline:

`1. QUERY
↓
2. DISCOVER
↓
3. DEDUPLICATE
↓
4. SCORE
↓
5. SELECT
↓
6. ACQUIRE
↓
7. EXTRACT
↓
8. NORMALIZE
↓
9. CLASSIFY
↓
10. COMPARE
↓
11. COMPILE
↓
12. REASON
`

Cheap models can handle many routine steps.

Stronger models should be reserved for difficult synthesis or conflict.

This directly supports the cheap-model strategy.

---

# 60. Cheap-model routing becomes even more powerful here

The system should not ask the expensive model to read everything.

For example:

### Cheap model

- classify source;
- extract claims;
- detect obvious duplicates;
- identify entities;
- summarize sections;
- tag conditions;
- normalize metadata;
- rank routine relevance.

### Strong model

- resolve contradictory evidence;
- assess nuanced applicability;
- construct competing hypotheses;
- perform difficult strategic synthesis;
- reason under substantial ambiguity.

### Human

- authority;
- consequential judgment;
- personal facts that cannot be inferred;
- real-world experiment participation;
- final judgment where required.

This creates a hierarchy:

`MANY CHEAP OPERATIONS
+
FEWER EXPENSIVE REASONING OPERATIONS
+
HUMAN AUTHORITY
`

That is much more economically attractive than sending every page to a frontier model.

---

# 61. Research budgets are required

Every pursuit should eventually have a research budget.

The budget can be expressed in:

- provider credits;
- model tokens;
- latency;
- number of sources;
- maximum crawl depth;
- maximum research rounds;
- maximum browser actions.

The research planner should decide:

> "Is another $0.20 of information likely to change the next decision?"

If not, stop.

This is important for both product economics and user experience.

---

# 62. Research should be cached

Stryde should not repeatedly pay to rediscover the same source.

Sources should have:

- canonical URL;
- content hash;
- retrieval timestamp;
- freshness;
- provider;
- extraction version;
- source metadata.

If a later pursuit asks a similar question, Stryde can reuse the source and only refresh it when freshness matters.

This makes the longitudinal system compound.

---

# 63. But caching must not create stale truth

A cached page is not automatically current.

Every source should therefore have a freshness policy.

Examples:

### Static historical paper

Long refresh interval.

### Company pricing

Shorter refresh interval.

### Current news

Very short refresh interval.

### Live market data

Near-real-time or explicit current retrieval.

### Personal observation

Does not expire in the same way, but can be superseded or contradicted.

The Context Compiler should know freshness requirements for the current decision.

---

# 64. The source store and evidence store are different

Stryde should preserve both:

### Source layer

The acquired material and provenance.

### Evidence layer

What Stryde extracted from that material.

For example:

`Source
YouTube video
↓
Source document
↓
Claim
"47 prospects contacted"
↓
Claim provenance
timestamp / transcript segment
↓
Applicability
different market
↓
Status
reported, not independently verified
`

This means Stryde can later re-evaluate an old claim without reacquiring the entire source.

---

# 65. Source excerpts should retain location

Whenever practical, extracted claims should point back to the exact source location:

- URL;
- page;
- section;
- paragraph;
- transcript timestamp;
- PDF page;
- document range;
- API record ID.

This is important because an LLM summary can introduce errors.

Stryde should be able to answer:

> "Where did this claim come from?"

That should be a normal system operation.

---

# 66. Stryde should have a research receipt

For important research rounds, the internal system should preserve a compact research receipt:

`Research objective
Queries
Providers used
Sources considered
Sources selected
Sources rejected
Why selected
Why rejected
Key claims
Contradictions
Unknowns
Research cost
Freshness
Resulting situation update
`

The user does not need to see this every time.

But the system should be able to expose it when requested.

This makes the system inspectable rather than magical.

---

# 67. Potentially valuable additional capability classes

Beyond the initial stack, several capability classes could become valuable.

### Structured company / people data

Useful for pursuits involving:

- prospecting;
- hiring;
- partnerships;
- market mapping.

Possible providers include Apollo, Clay, Exa company/people search, or other specialized databases.

### News / current-events intelligence

Useful for:

- market shifts;
- company changes;
- regulatory changes;
- current events.

A dedicated news provider or structured news dataset can be useful when general web search is insufficient.

### Open web datasets

Common Crawl or similar corpora can be useful for large-scale historical research, but should not be treated as the default live source.

### Document parsing

For PDFs, scanned documents and complex reports, a dedicated document parser can become valuable.

### Structured extraction

When Stryde needs fields rather than prose:

`company
→ pricing
→ locations
→ product
→ customer type
→ evidence`

a structured extraction capability is more reliable than asking a model to infer everything from raw text.

### Maps / local information

For location-dependent pursuits, maps and local business data can become useful capabilities.

### Finance / commerce data

For commercial decisions, public financial data, pricing intelligence, transaction data, or marketplace data may be useful where legally and contractually available.

### Job-market intelligence

Job postings can be useful demand signals for:

- skills;
- technologies;
- hiring trends;
- operational pain.

### Specialized databases

Stryde should be able to add a specialized provider when the pursuit actually requires one rather than embedding every possible database.

---

# 68. What we should NOT build immediately

The existence of a useful capability does not mean Stryde should implement it now.

Do not immediately add:

- ten web search providers;
- a custom crawler;
- a full vector database migration;
- a giant knowledge graph;
- a YouTube scraping platform;
- every academic database;
- every CRM;
- every social platform;
- every agent framework.

The correct strategy is:

`Provider-neutral contract
→ one strong provider
→ prove the behavior
→ observe failures
→ add a second provider only where it solves a demonstrated weakness`

---

# 69. Recommended provider architecture

The first implementation should expose interfaces approximately like:

`SearchProvider
ExtractProvider
CrawlProvider
TranscriptProvider
BrowserProvider
AcademicProvider
StructuredDataProvider
NewsProvider
`

Each provider returns normalized Stryde objects.

For example:

`ResearchSource {
  source_id
  canonical_url
  title
  source_type
  provider
  retrieved_at
  published_at
  freshness
  content_hash
  raw_reference
  content_location
}`

and:

`EvidenceItem {
  evidence_id
  source_id
  claim
  evidence_type
  excerpt
  source_location
  conditions
  corroboration
  contradictions
  applicability
  epistemic_status
}`

The rest of Stryde should not care whether the source came from Exa, Firecrawl, Tavily, Transcriptor, browser, or a future provider.

---

# 70. Provider failure must be explicit

Every acquisition result should have a state such as:

`SUCCESS
PARTIAL
EMPTY
BLOCKED
RATE_LIMITED
AUTH_REQUIRED
UNSUPPORTED
STALE
FAILED
`

Stryde must never turn:

`FAILED`

into:

`NO EVIDENCE EXISTS`

Those are completely different.

Likewise:

`NO RESULTS FROM PROVIDER`

does not mean:

`NO INFORMATION EXISTS IN THE WORLD`

This is another major epistemic safeguard.

---

# 71. Research quality should be evaluated separately from model quality

Stryde needs two distinct evaluations.

### Reasoning evaluation

Did the model reason correctly over the supplied evidence?

### Research evaluation

Did Stryde obtain the right evidence in the first place?

A perfect reasoning model with terrible retrieval is still a bad research system.

A mediocre model with excellent evidence may still be useful.

This separation should exist in evaluation and telemetry.

---

# 72. Research-specific evaluation suite

Stryde should eventually maintain benchmark pursuits where the expected behavior is known.

Examples:

### Retrieval

Did Stryde find the relevant primary source?

### Coverage

Did it discover important alternative explanations?

### Evidence extraction

Did it correctly extract the reported result and conditions?

### Provenance

Can every important conclusion be traced back to a source?

### Contradiction

Did it detect meaningful disagreement?

### Applicability

Did it notice that a successful case occurred under different conditions?

### Stopping

Did it stop once sufficient evidence existed?

### Action transition

Did it move from research to experiment instead of continuing indefinitely?

### Learning

Did new observations change the recommendation?

This should become part of Stryde's production-quality bar.

---

# 73. Recommended first production research flow

For an initial real implementation, the simplest strong flow is:

`USER GOAL
↓
Situation Compiler
↓
Research Planner
↓
Exa discovery
↓
Select candidate URLs
↓
Firecrawl extraction
↓
Transcriptor for relevant YouTube sources
↓
Browser escalation when static acquisition fails
↓
Normalize sources
↓
Cheap-model claim extraction
↓
Deduplicate + provenance
↓
Evidence comparison
↓
Context Compiler
↓
Reasoning model
↓
Recommendation
↓
Authority
↓
Action
↓
Observation
↓
Reassessment
`

Consensus / Scite become conditional branches when the research question genuinely benefits from academic evidence.

Tavily becomes a conditional second web provider rather than mandatory overhead.

---

# 74. Why not simply use Firecrawl for everything?

Because "web access" is not one problem.

Firecrawl is excellent for web acquisition, but Stryde also needs:

- semantic discovery;
- video transcript acquisition;
- scholarly retrieval;
- structured business data;
- browser interaction;
- user-authorized systems.

A single vendor creates:

- coverage risk;
- provider lock-in;
- pricing risk;
- outage risk;
- source bias;
- architectural coupling.

Therefore:

> **Use Firecrawl heavily where it is strong, but keep the contract provider-neutral.**

---

# 75. Why not simply use Exa for everything?

Same answer.

Exa is excellent for discovery and can fetch content, but Stryde should not make one search engine its entire world model.

Exa is a source acquisition mechanism.

Stryde is the system that determines:

- what to search;
- why to search;
- what to trust;
- what to retain;
- what to compare;
- what to verify;
- what to do next.

---

# 76. Why not simply use a "deep research" API?

A provider's deep-research product can be useful as a subordinate capability.

It should not become Stryde's canonical reasoning layer.

If Stryde simply asks another system:

> "Research this for me"

and accepts the final report, it loses control over:

- source provenance;
- source selection;
- epistemic status;
- contradiction handling;
- research budget;
- context compilation;
- continuous pursuit state.

Therefore a deep-research API can be one tool inside the research planner, not the research architecture itself.

---

# 77. The most important architectural principle for tools

The tools should make Stryde **more capable**, not make Stryde **dependent on their worldview**.

So:

`Provider
→ capability
→ normalized evidence
→ Stryde control plane
`

not:

`Provider
→ provider's agent
→ provider's memory
→ provider's workflow
→ Stryde becomes wrapper`

This distinction should remain locked.

---

# 78. Current recommendation

### Build now

1. Research Planner
2. Provider-neutral source acquisition interfaces
3. Exa discovery adapter
4. Firecrawl extraction/crawl adapter
5. Transcriptor adapter
6. Browser escalation path
7. Evidence normalization
8. Claim provenance
9. Research budgets
10. Research receipts
11. Source caching + freshness
12. Context Compiler integration
13. Research evaluation suite

### Add conditionally

14. Tavily fallback / independent web provider
15. Consensus
16. Scite
17. structured company/people data
18. news provider
19. document parsing
20. deeper crawling with Crawlee

### Do not make core dependencies yet

- LangGraph
- Letta
- CrewAI
- AutoGen
- Temporal
- a giant vector database
- Firecrawl self-hosted server
- a multi-agent framework

These can solve specific future problems, but none should become the semantic center of Stryde.

---

# 79. Final tool philosophy

Stryde should eventually behave as if it has a toolbox.

When the goal arrives, it asks:

> **What do I need to know?**

Then:

> **Where is the best place to get that information?**

Then:

> **How do I acquire it reliably?**

Then:

> **What part is actually useful?**

Then:

> **What does this evidence mean under Haseeb's conditions?**

Then:

> **What is still unknown?**

Then:

> **What is the smallest useful action or experiment?**

Then:

> **What happened?**

Then:

> **What does that new reality change?**

The tools are the hands.

The providers are replaceable.

The model is the reasoning engine.

The Context Compiler is the working-memory boundary.

The evidence layer is the epistemic substrate.

The authority system controls side effects.

And Stryde itself remains the control plane.

---

# 80. Updated one-sentence architecture

> **Stryde is a persistent personal pursuit system whose control plane investigates reality through replaceable evidence-acquisition capabilities, compiles only the relevant evidence and personal state into model context, reasons over that bounded reality, acts within explicit authority, observes and verifies outcomes, and continuously updates the pursuit until reality moves.**


---

# 81. Subscription-aware research

Research capacity is plan-bounded.

The research system must resolve:

`effective entitlement
→ remaining resource budget
→ candidate acquisition operations
→ cost / value
→ provider selection
`

This does not create a separate research product for each plan.

The evidence architecture remains identical.

What changes is how much research Stryde can economically perform.

Free receives bounded evidence acquisition.

Pro receives deeper evidence acquisition.

Max receives high-intensity evidence acquisition and premium resource access.

The underlying epistemic states remain unchanged.

---

# 82. Research should spend the user's budget intelligently

The planner should not interpret remaining budget as a reason to keep researching.

For every marginal operation, ask:

> Could this evidence materially change the next decision?

When the answer is no, stop.

When the answer is uncertain, prefer a low-cost operation.

When the answer is yes and the decision stakes justify it, spend enough to resolve the uncertainty.

When reality can answer the question more directly, consider an experiment instead.

---

# 83. Subscription resource boundary

The complete Stryde loop now includes a commercial resource gate:

`INTENTION
→ REALITY
→ SITUATION
→ UNKNOWN / BOTTLENECK
→ ENTITLEMENT
→ RESOURCE BUDGET
→ RESEARCH / EVIDENCE
→ INTERPRETATION
→ OPTIONS
→ RECOMMENDATION
→ AUTHORITY
→ ACTION / DELEGATION
→ OBSERVATION
→ VERIFICATION
→ OUTCOME
→ LEARNING
→ UPDATED STATE
→ NEXT MOVE`

The entitlement and budget steps control resource expenditure.

They must not become a reason to lower epistemic honesty.

---

# 84. Research economics are part of system quality

Stryde should evaluate research on two axes:

### Epistemic quality

Did Stryde acquire and interpret useful evidence correctly?

### Economic quality

Did Stryde spend an appropriate amount of resource to acquire that evidence?

A research system that finds good evidence but spends unnecessarily is inefficient.

A cheap system that acquires bad evidence is not efficient.

The target is:

> **Useful evidence and real-world progress per unit of resource.**

---

# 85. Cost control belongs above providers

Exa, Firecrawl, Transcriptor, Tavily, academic providers, browser workers, model providers, and future services remain subordinate capabilities.

The commercial/resource layer should not embed provider identity into plan semantics.

The architecture remains:

`plan
→ resource envelope
→ cost-aware planner
→ provider selection
→ operation
→ usage accounting
→ evidence
→ context compilation
`

This preserves replaceability while making Stryde economically viable.
