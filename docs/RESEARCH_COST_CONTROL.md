# Stryde Research Cost Control

Status: locked architecture direction / implementation target
Date: 2026-10-06

This document defines the economic control layer for Stryde's research-first architecture.

The core idea is simple:

> **Research is valuable only when the expected information gained can justify the resources spent.**

This document is deliberately separate from `docs/RESEARCH_REALITY_ENGINE.md`, which defines the evidence and research architecture itself.

---

## 1. Why a cost-control layer exists

Stryde may use:

- semantic search;
- web extraction;
- crawling;
- YouTube transcripts;
- academic search;
- structured company data;
- browser sessions;
- model calls;
- worker execution;
- storage;
- verification calls.

These capabilities have different cost, latency, quality, freshness, and failure profiles.

A naive system would do:

`question
→ call every provider
→ collect everything
→ send everything to the model
`

That is economically and cognitively wasteful.

Stryde should instead do:

`question
→ identify uncertainty
→ estimate decision value
→ select the cheapest sufficient acquisition path
→ acquire evidence
→ reassess
→ stop or escalate`

---

## 2. Resource dimensions

Research cost is multi-dimensional.

### Provider cost

Examples:

- search credits;
- extraction credits;
- crawl credits;
- transcript credits;
- academic-provider credits;
- structured-data lookups;
- browser-provider charges.

### Model cost

Examples:

- input tokens;
- output tokens;
- premium model calls;
- fallback model calls;
- repeated synthesis calls.

### Operational cost

Examples:

- browser actions;
- worker execution time;
- concurrent sessions;
- network retries;
- storage;
- cache maintenance.

### Opportunity cost

An operation can also be expensive because it delays a real-world experiment.

A five-minute browser action may be technically cheap but strategically expensive if the user could have tested the hypothesis directly in those five minutes.

---

## 3. Resource abstraction

Stryde should expose normalized product-level resource dimensions instead of requiring planner code to understand every provider's pricing scheme.

Example:

`ResourceEnvelope {
  research_rounds
  source_discovery
  source_extraction
  crawl_depth
  transcript_minutes
  academic_queries
  browser_actions
  worker_seconds
  model_input_tokens
  model_output_tokens
  premium_reasoning_calls
}`

A provider adapter maps these resources to actual vendor usage.

---

## 4. Cost estimates

Before execution, each operation should produce an estimate.

`estimated_cost = provider_cost + model_cost + operational_cost`

The estimate may be exact, bounded, or approximate.

Each estimate should include:

- currency or normalized cost unit;
- resource dimensions;
- confidence;
- expected latency;
- expected output size;
- provider availability.

When a provider cannot provide precise pricing at planning time, use a conservative internal estimate.

---

## 5. Reservation

A running system cannot simply check remaining balance and then execute.

Concurrent operations can race.

The safe sequence is:

`check
→ reserve
→ execute
→ measure
→ reconcile
`

Reservations should have:

- reservation ID;
- account;
- pursuit;
- operation;
- resource type;
- expected amount;
- expiration;
- status.

Unused reservation should be released.

---

## 6. Reconciliation

After execution:

`actual usage - reserved usage = reconciliation delta`

If actual is lower:

- return unused budget.

If actual is higher:

- record overage;
- apply policy;
- prevent uncontrolled chaining;
- adjust estimates where appropriate.

This is important for providers where actual usage depends on result size or crawl depth.

---

## 7. Research unit economics

For every provider operation, maintain:

`unit_cost(provider, operation, resource)`

Examples:

- cost per search;
- cost per extracted page;
- cost per crawl unit;
- cost per transcript minute;
- cost per browser action;
- cost per model token or call.

The exact provider prices should be stored as configuration or pricing records, not scattered throughout application code.

---

## 8. Cost-aware routing objective

The planner should evaluate candidate operations using several dimensions:

`score(operation)
=
information_value
× relevance
× reliability
× freshness_fit
÷ normalized_cost
`

This is a planning heuristic, not a scientific truth.

Cost alone should never dominate.

For high-stakes questions, the planner may choose a more expensive provider because the cost of being wrong is much larger.

---

## 9. Value of information

Research should be evaluated by expected decision impact.

A useful internal question is:

> "Could this evidence change what Stryde does next?"

If no:

- do not acquire it.

If maybe:

- prefer a cheap acquisition.

If yes:

- spend enough to resolve it.

This prevents broad research from becoming the default response to every goal.

---

## 10. Research ladder

The planner should generally escalate in this order:

`Existing state
→ cache
→ cheap discovery
→ targeted extraction
→ specialized source
→ browser
→ premium synthesis
→ real-world experiment`

The order is not absolute.

For example, a current authenticated dashboard may require browser access immediately.

A research planner should optimize for the actual question, not blindly follow a fixed sequence.

---

## 11. Search diversity has a cost

Diversity improves evidence quality but costs resources.

Therefore Stryde should use staged diversity.

Example:

### Stage A

Find a small set of relevant sources.

### Stage B

Look for independent corroboration.

### Stage C

Search for contradiction or failure evidence.

### Stage D

Stop when the evidence is sufficient for the next decision.

Do not automatically maximize source count.

---

## 12. Duplicate-source detection saves money

Many web pages reproduce the same underlying article, press release, report, or study.

Stryde should track:

- canonical URL;
- redirects;
- content hash;
- publisher;
- original source;
- syndication relationship where detectable.

If twenty pages contain effectively the same evidence, Stryde should not treat them as twenty independent confirmations.

This also avoids unnecessary repeated extraction.

---

## 13. Cache-aware acquisition

Before acquiring a source:

1. check canonical URL;
2. check content hash if known;
3. check previous retrieval;
4. inspect freshness requirement;
5. reuse if still sufficient;
6. refresh only if needed.

A cache hit is not automatically a truth claim.

Cached evidence retains:

- retrieval timestamp;
- published date;
- freshness class;
- source version or content hash.

---

## 14. Failure-aware retries

Retries consume money.

Not every failure should be retried.

### Retry may be appropriate

- transient provider error;
- network timeout;
- short-lived rate limit;
- malformed temporary response.

### Retry may be wasteful

- unsupported source type;
- missing authorization;
- provider permanently unavailable;
- content is not accessible;
- same source already failed repeatedly.

Every retry policy should include:

- max attempts;
- backoff;
- expected resource cost;
- stop reason.

---

## 15. Provider fallback

Provider fallback should exist only when it solves a demonstrated weakness.

Example:

`Exa discovery
→ no useful result
→ alternate web provider
→ compare`

not:

`Exa + Tavily + Firecrawl + five other providers
`

for every query.

Fallback selection should consider:

- remaining plan budget;
- expected value;
- provider health;
- evidence diversity;
- latency.

---

## 16. Premium model routing

Cheap models should handle routine transformations:

- classification;
- extraction;
- deduplication;
- metadata normalization;
- relevance filtering;
- condition tagging.

Stronger models should be reserved for:

- contradictory evidence;
- nuanced applicability;
- competing hypotheses;
- difficult synthesis;
- high-stakes reasoning;
- complex strategic trade-offs.

The point is not to deny the user high-quality models.

The point is to spend them where they materially change the result.

---

## 17. Research stopping policy

A research round can stop for several reasons.

### Sufficient

There is enough evidence for the next safe decision.

### Budget constrained

More research may help, but current plan resources are exhausted.

### Provider constrained

The preferred capability is unavailable and alternatives do not justify their cost.

### Question unresolved

External evidence cannot determine the answer.

The last case should often trigger an experiment.

---

## 18. Research versus experiment

There is a point where information from the real world is cheaper and more reliable than more research.

Example:

> "Will these buyers respond to this offer?"

Web evidence can establish plausibility.

It cannot establish the user's actual response rate.

Stryde should therefore compare:

`cost(additional_research)
vs
cost(real_world_test)`

and consider which has greater information value.

---

## 19. Free-plan optimizer

The Free planner should bias toward:

- cache reuse;
- small source sets;
- inexpensive discovery;
- targeted extraction;
- cheap models;
- short research rounds;
- action after sufficient evidence;
- experiments when appropriate.

It should avoid:

- broad crawling;
- repeated premium synthesis;
- expensive browser loops;
- redundant provider calls;
- large transcript processing without evidence value.

The Free plan should optimize for **proof of the Stryde loop**, not maximum activity.

---

## 20. Pro-plan optimizer

Pro can afford:

- deeper discovery;
- more independent evidence;
- broader source comparison;
- more transcripts;
- more browser work;
- stronger synthesis;
- longer pursuits.

The planner should still stop when the next resource unit is unlikely to change the decision.

---

## 21. Max-plan optimizer

Max allows higher-cost exploration when justified by pursuit value.

It may support:

- deep multi-source research;
- premium synthesis;
- larger browser operations;
- broader structured data;
- parallel evidence lanes;
- longer-running work.

Max must retain the same stopping discipline.

"More budget" is not "more noise."

---

## 22. Budget-aware context compilation

Research cost is not only acquisition.

Context size creates model cost.

The Context Compiler should therefore summarize and filter before premium reasoning.

Preferred:

`100 source pages
→ 40 relevant excerpts
→ 15 claims
→ 6 decision-relevant evidence items
→ bounded reasoning context`

The exact numbers are illustrative.

The principle is:

> **Acquire broadly enough to be useful; compile narrowly enough to reason well.**

---

## 23. Budget-aware source retention

Long-term retention should also be selective.

Retain:

- provenance;
- useful claims;
- relevant excerpts;
- source metadata;
- hashes;
- freshness;
- contradictions;
- evidence status.

Do not blindly retain every source in full forever.

Full-source retention may be justified when:

- reproducibility requires it;
- the source is legally/technically storable;
- the source is expensive to reacquire;
- the user explicitly wants it;
- a durable evidence record needs it.

---

## 24. Cost anomaly detection

Stryde should detect abnormal spend patterns.

Examples:

- one pursuit consuming most monthly capacity;
- repeated failed provider calls;
- unusually large crawls;
- browser loops;
- model retry storms;
- rapid quota depletion;
- provider price changes;
- a new provider unexpectedly dominating spend.

An anomaly should cause controlled degradation or escalation, not silent continuation.

---

## 25. Accounting truth

Usage accounting must distinguish:

- estimated usage;
- reserved usage;
- actual usage;
- billable provider usage;
- internal resource units;
- refunded or released usage.

This prevents billing disputes and makes debugging possible.

---

## 26. Research cost telemetry

Record enough information to answer:

- What did Stryde spend?
- Why did it spend it?
- Which provider did it choose?
- What cheaper alternatives existed?
- What evidence was gained?
- Did the evidence change the recommendation?
- Did it change the action?
- Did reality change?

This is the basis for future cost optimization.

---

## 27. The key long-term metric

The strongest economic metric is not:

> cost per research call

It is closer to:

`incremental cost
/
incremental useful decision change
`

and eventually:

`incremental resource cost
/
incremental real-world outcome movement
`

This lets Stryde learn which capabilities actually matter.

---

## 28. Do not optimize on cost alone

A very cheap provider that creates false confidence can be more expensive than a reliable provider.

The planner therefore balances:

- cost;
- quality;
- reliability;
- independence;
- freshness;
- stakes;
- reversibility;
- decision impact.

The cheapest incorrect evidence is not an optimization.

---

## 29. Research receipt additions

The existing research receipt should also record economics:

`Research objective
Queries
Providers used
Sources selected
Sources rejected
Evidence extracted
Contradictions
Unknowns
Estimated cost
Reserved cost
Actual cost
Resources consumed
Why research stopped
Resulting situation update
`

This creates an auditable economic trail.

---

## 30. Implementation sequence

The cost layer should be introduced before making research broadly available.

Recommended order:

1. Define normalized resource dimensions.
2. Define plan entitlement schema.
3. Define operation cost contracts.
4. Implement reservation and reconciliation.
5. Add usage telemetry.
6. Add per-pursuit budgets.
7. Add concurrency ceilings.
8. Add provider adapters.
9. Add cost-aware planner scoring.
10. Add budget-aware stopping.
11. Measure real usage.
12. Calibrate Free/Pro/Max numbers.
13. Add automatic cost optimization from observed patterns.

---

## 31. Initial provider classes

The research system should remain provider-neutral.

Examples:

- SearchProvider
- ExtractProvider
- CrawlProvider
- TranscriptProvider
- BrowserProvider
- AcademicProvider
- StructuredDataProvider
- NewsProvider

Cost control should sit above those providers.

---

## 32. Final principle

> **Stryde should spend money the same way it spends attention: only when doing so can materially improve the next move.**

The goal is not maximum research.

The goal is maximum useful pursuit movement per unit of resource.
