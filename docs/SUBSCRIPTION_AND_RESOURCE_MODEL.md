# Stryde Subscription and Resource Model

Status: locked architecture direction / implementation target
Date: 2026-10-06

This document defines how Stryde should turn the Free, Pro, and Max subscriptions into explicit product entitlements and bounded compute/research resources.

It is complementary to:

- `docs/PRODUCT_CONSTITUTION.md`
- `docs/ARCHITECTURE.md`
- `docs/RESEARCH_REALITY_ENGINE.md`
- `docs/DECISIONS.md`
- `docs/INTEGRATIONS.md`
- `docs/STATE.md`

This document defines intended behavior. It does not claim that the billing, entitlement, or resource-metering system is already implemented or production-proven.

---

## 1. Core commercial principle

Stryde should not be an unlimited-cost backend hidden behind a subscription label.

Every Stryde action that can create meaningful variable cost should be attributable to a user, pursuit, operation, provider, and subscription entitlement.

The central rule is:

> **Stryde's intelligence architecture is shared across plans; the amount of reality Stryde can investigate and act on is bounded by plan resources.**

Free should still be useful.

Pro should buy materially more pursuit capacity.

Max should buy materially more depth, execution, persistence, and premium resource access.

The product should not work by making Free intentionally useless.

---

## 2. What changes by subscription

The user should experience subscriptions as differences in capability depth and operating capacity, not as a spreadsheet of vendor API calls.

The external product language should emphasize:

- how much Stryde can investigate;
- how much work Stryde can perform;
- how deeply it can research;
- how much autonomy it can exercise;
- how much long-running pursuit capacity is available;
- how quickly premium resources can be allocated.

Internal infrastructure may still meter:

- provider requests;
- model tokens;
- browser actions;
- transcript minutes;
- extraction pages;
- execution time;
- storage;
- reasoning calls.

But those are implementation controls, not the primary product vocabulary.

---

## 3. Plan model

### Free

Purpose:

Prove the core Stryde loop without creating an economically unsafe unlimited free tier.

Free should include:

- universal composer;
- core pursuit creation;
- persistent pursuit state;
- bounded context compilation;
- evidence and claim representation;
- limited web research;
- limited source extraction;
- limited transcript acquisition;
- limited autonomous work;
- basic verification where available;
- normal state updates;
- standard response priority.

Free should be capable of producing a real outcome.

The product may place strict caps on expensive operations, but it should not simulate usefulness by replacing Stryde with generic static advice.

### Pro

Purpose:

Become the default serious-user tier.

Pro should include:

- substantially larger research budget;
- deeper source discovery;
- larger extraction allowance;
- broader transcript allowance;
- browser observation and authorized browser work where available;
- more autonomous execution;
- longer-running pursuits;
- better model routing;
- more research rounds;
- higher concurrency where safe;
- higher limits on stored pursuit work;
- faster resource allocation than Free.

Pro should feel like the point where Stryde becomes a continuously useful operating system for important pursuits rather than an occasional assistant.

### Max

Purpose:

Serve high-usage users whose pursuits justify materially higher variable costs.

Max should include:

- very large research budget;
- deepest practical research;
- highest execution allowances;
- premium model routing where useful;
- highest browser/action budgets;
- more concurrent or long-running jobs;
- priority resource allocation;
- advanced research providers when available;
- higher ceilings across the major resource dimensions;
- optional high-cost capabilities that cannot be economically offered to all users.

Max is not merely "more messages".

It is a larger operating budget for Stryde.

---

## 4. Plan comparison

| Capability | Free | Pro | Max |
|---|---|---|---|
| Core pursuit loop | Yes | Yes | Yes |
| Persistent pursuit state | Yes | Yes | Yes |
| Context Compiler | Yes | Yes | Yes |
| Evidence / claims | Yes | Yes | Yes |
| Basic web research | Bounded | Generous | Very generous |
| Research rounds | Limited | High | Very high |
| Source count / round | Small | Larger | Larger / deep |
| Source extraction | Limited | Included | High |
| YouTube / transcript research | Limited | Included | High |
| Academic research | Selective | Included | High |
| Browser observation | Minimal / gated | Included | High |
| Autonomous execution | Limited | More | Highest |
| Long-running pursuits | Limited | Included | High |
| Premium model routing | Rare / no guarantee | Selective | Strongly available |
| Research provider diversity | Limited | Multi-provider | Broad |
| Priority / latency | Standard | Faster | Highest |
| Resource ceiling | Low | High | Very high |

These labels are directional. Exact quotas remain a unit-economics decision, not a guess.

---

## 5. Entitlements are not billing state

Stryde should separate commercial state from runtime permission.

Billing state answers questions such as:

- Is this user subscribed?
- What plan are they on?
- Is the subscription active?
- Is it paused, cancelled, expired, or in a grace period?

Entitlements answer:

- Which capabilities can this user invoke?
- Which resource ceilings apply?
- Which limits remain?
- Which premium capabilities are available?
- Which concurrency or autonomy policies apply?

A billing event should update entitlement state through a controlled path.

The runtime should not infer authority from a payment-provider webhook payload directly.

Conceptually:

`Billing provider → subscription state → entitlement service → effective plan → runtime policy`

---

## 6. Effective entitlement resolution

The effective runtime policy should combine:

`account plan
+ product entitlements
+ user-level overrides
+ pursuit-level restrictions
+ capability availability
+ authority policy
+ current resource budget
`

The strongest restriction wins.

For example:

A Max user may have browser access at the account level, but a particular pursuit may have browser disabled.

A Pro user may have research enabled, but a provider may be temporarily unavailable.

A Free user may have remaining research budget, but a specific high-cost capability may still be gated.

Plan entitlement is therefore not authority.

---

## 7. Capability access matrix

Capabilities should be registered independently from plan logic.

A capability registry can expose metadata such as:

`capability_id
kind
provider
variable_cost_class
availability
required_credentials
supported_operations
risk_class
minimum_plan
quota_dimensions
failure_modes
`

The subscription layer then determines which registered capabilities are eligible for a user.

This prevents plan logic from being hard-coded throughout the research and execution code.

---

## 8. Resource budgets

A plan should resolve to a resource budget.

The budget is multidimensional.

Suggested resource dimensions:

### Research

- research rounds;
- searches;
- source candidates;
- extracted pages;
- crawl depth;
- transcript acquisitions;
- transcript minutes;
- academic searches;
- structured-data lookups.

### Models

- input tokens;
- output tokens;
- expensive reasoning calls;
- model class usage;
- fallback calls.

### Browser / execution

- browser sessions;
- browser actions;
- page interactions;
- execution seconds;
- worker jobs;
- concurrent jobs.

### Storage

- retained source material;
- evidence records;
- artifacts;
- cached content;
- long-running state.

### Operational limits

- concurrent pursuits;
- active jobs;
- queued jobs;
- daily execution budget;
- monthly variable-cost budget.

No single dimension should be assumed to represent total cost.

---

## 9. Budget is a control mechanism, not a user-facing punishment

A budget exists so the system can answer:

> "What can Stryde afford to do next?"

It should not cause Stryde to repeatedly complain about limits.

Bad behavior:

> "You have used 73% of your Firecrawl quota."

Preferred behavior:

> "I have enough evidence to make the next move, so I stopped here."

When a hard entitlement boundary is actually reached, Stryde should explain the practical consequence:

> "I have reached this month's research allowance. I have enough evidence for the current next move, so we can continue execution without more research."

Only when more research is materially necessary should Stryde surface the limit.

---

## 10. Cost-aware operation selection

Before an expensive operation, Stryde should consider:

- expected information value;
- expected decision impact;
- provider cost;
- latency;
- reliability;
- source quality;
- freshness requirement;
- availability of cached evidence;
- cheaper alternatives;
- whether the operation is reversible;
- remaining budget.

The planner should prefer the cheapest operation that is good enough for the decision.

Conceptually:

`choose operation = highest useful information value per unit cost`

This does not mean always selecting the cheapest provider.

A cheap source that is unreliable can be more expensive in total because it creates bad reasoning and wasted execution.

---

## 11. Research budget hierarchy

A research request should be evaluated in layers.

### Layer 1: Existing state

Can current personal state, pursuit state, observations, prior evidence, or cached sources answer the question?

### Layer 2: Cheap discovery

Can a low-cost search or metadata lookup resolve it?

### Layer 3: Targeted extraction

Can Stryde extract only the few relevant pages instead of crawling broadly?

### Layer 4: Specialized capability

Would transcript, academic, structured-data, or news retrieval materially improve the answer?

### Layer 5: Browser escalation

Is interaction necessary because the source is dynamic, filtered, authenticated, visual, or otherwise inaccessible through static extraction?

### Layer 6: Premium reasoning

Does the evidence now justify a stronger model call for synthesis or contradiction resolution?

### Layer 7: Real-world experiment

Would another research operation have less information value than testing the hypothesis in reality?

This is the cost-aware research ladder.

---

## 12. Free-tier economics

Free cannot be economically defined as:

> "All Stryde features, unlimited, but free."

That would make variable-cost usage an open liability.

Instead:

`Free user value
= limited but meaningful Stryde loop
+ strict variable-cost ceilings
+ prioritization toward cheap/high-value operations`

The system should use inexpensive operations aggressively for Free users and reserve expensive operations for cases where they are unusually valuable.

Examples:

- cached source before fresh extraction;
- lightweight search before browser;
- cheap extraction before premium synthesis;
- small source set before broad crawl;
- experiment before another long research round.

---

## 13. Pro economics

Pro should be designed around a higher expected monthly variable-cost envelope.

Its budget can support:

- more source acquisition;
- more research rounds;
- deeper extraction;
- more browser work;
- stronger model routing;
- more persistent background work.

Pro should still be cost-aware.

A paid plan does not mean:

> "Spend until the quota disappears."

It means:

> "You have a larger budget, so Stryde can investigate and act more deeply before stopping."

---

## 14. Max economics

Max is the tier where higher variable costs are intentionally sold.

Max should make it economically reasonable to use:

- premium model calls;
- deeper provider coverage;
- more browser execution;
- larger research rounds;
- long-running pursuits;
- higher concurrency;
- expensive specialized data sources.

The Max user should be the user for whom the value of additional pursuit work is high enough that the additional infrastructure cost is justified.

---

## 15. Research Planner contract

The Research Planner should receive effective entitlements and current budget.

Conceptually:

`ResearchRequest
→ entitlement check
→ remaining resource budget
→ candidate operations
→ cost estimate
→ expected decision impact
→ provider selection
→ operation
→ usage accounting
→ evidence
→ budget update
`

The planner must be provider-neutral.

It should not contain logic such as:

> "Pro gets exactly 20 Firecrawl calls."

That belongs in provider accounting.

The planner should instead reason in product-level resources and select providers underneath them.

---

## 16. Research operation cost model

Every operation should report or estimate its resource use.

Example:

`OperationCost {
  provider
  operation
  estimated_provider_cost
  estimated_model_cost
  estimated_latency
  resource_units
  confidence
}`

Actual usage should be recorded separately.

`OperationUsage {
  operation_id
  provider
  started_at
  completed_at
  actual_provider_cost
  model_input_tokens
  model_output_tokens
  browser_actions
  transcript_minutes
  extracted_pages
  status
}`

Estimated cost is for planning.

Actual usage is for accounting.

The two must never be silently conflated.

---

## 17. Hard budget enforcement

Resource limits should be enforced server-side.

The client may display remaining capacity, but it cannot be the authority.

Before a variable-cost operation starts, Stryde should reserve budget.

Conceptually:

`remaining budget
→ reserve expected amount
→ execute
→ reconcile expected vs actual
→ return unused reservation
`

This prevents concurrent jobs from overspending the same allowance.

If the operation fails before using the resource, the reservation should be released where possible.

If actual usage exceeds the estimate, the accounting system must reconcile it and apply a defined overage policy.

---

## 18. Concurrency matters

Monthly quotas alone are insufficient.

A user could launch many simultaneous jobs and overspend before any one job updates the account total.

Stryde therefore needs:

- reservation;
- atomic accounting;
- concurrency limits;
- per-pursuit budgets;
- per-user budgets;
- global provider safety limits.

The effective constraint is:

`min(account_remaining,
     pursuit_remaining,
     provider_remaining,
     concurrency_remaining,
     capability_policy)`

---

## 19. Budget inheritance by pursuit

Each pursuit can receive a local budget envelope from the account.

This prevents one pursuit from consuming the entire user's monthly capacity.

Suggested hierarchy:

`subscription
→ account monthly budget
→ pursuit budget
→ research round budget
→ operation budget`

A high-value pursuit can receive a larger share.

A low-value or experimental pursuit can receive a smaller share.

The user should be able to direct emphasis naturally without needing to operate a budgeting console.

---

## 20. Budget reset and rollover

Exact commercial policy is still open.

The architecture should support:

- monthly reset;
- daily safety ceilings;
- non-rollover default;
- optional controlled rollover;
- promotional credits;
- one-time research credits;
- administrator grants;
- founding-user grants.

Credits must remain distinguishable from entitlement.

For example:

`plan entitlement = "browser available"`

does not mean:

`browser balance = unlimited`

---

## 21. Credits vs quotas

Use both where appropriate.

### Quota

A product-facing ceiling such as:

- research rounds;
- active pursuits;
- browser sessions;
- transcript minutes.

### Internal resource accounting

Lower-level measurement such as:

- provider credits;
- tokens;
- execution seconds;
- extraction pages.

The product can expose a simplified balance while retaining detailed internal metering.

---

## 22. When a budget is exhausted

Stryde should degrade gracefully.

Priority order:

1. continue with existing evidence;
2. use cached or already-paid resources;
3. switch to a cheaper eligible capability;
4. reduce research depth;
5. ask for the user to perform a low-cost reality test when appropriate;
6. stop with an honest boundary;
7. offer upgrade only when additional paid capacity materially changes the outcome.

The user should never receive fabricated research just because the budget ended.

---

## 23. Subscription boundaries must not corrupt epistemics

A Free user reaching a research limit does not make the research result less true.

A Max user having more research budget does not make their conclusions automatically more true.

Subscription affects:

- breadth;
- depth;
- freshness;
- execution capacity;
- provider selection;
- model selection.

Subscription does not affect the semantic status of evidence.

The evidence layer remains:

- reported;
- observed;
- inferred;
- verified;
- contradicted;
- unknown.

---

## 24. Premium does not mean unlimited

Even Max should retain safety boundaries.

There should be hard platform ceilings for:

- runaway crawling;
- infinite browser loops;
- repeated failing provider calls;
- uncontrolled model retries;
- destructive actions;
- excessive concurrency;
- credential-sensitive operations;
- anomalous spending.

Max is a large budget, not a bypass around system safety.

---

## 25. What should trigger a plan boundary

Good plan boundaries are based on economically meaningful differences.

Examples:

### Free

"Basic evidence acquisition is available."

### Pro

"Deeper research and more execution are available."

### Max

"High-intensity research and execution are available."

Poor boundaries would be arbitrary feature fragmentation such as:

- no claims on Free;
- no context compiler on Free;
- no persistence on Free;
- no basic Stryde loop on Free.

Those undermine the core product.

---

## 26. Upgrade behavior

The upgrade moment should happen when the user's pursuit actually encounters a meaningful resource constraint.

Example:

> "The next research step would require a deeper crawl across many sources. Your current plan has reached its research depth for this month. I already have enough evidence for a smaller test, or you can increase capacity."

The system should prefer continuing with a valid lower-cost path where one exists.

This makes the paid boundary feel like increased operating capacity rather than an artificial paywall.

---

## 27. Usage telemetry

Stryde should record at minimum:

- account;
- plan;
- capability;
- provider;
- operation;
- estimated cost;
- actual cost;
- tokens;
- resource units;
- success/failure;
- latency;
- research round;
- pursuit;
- whether output changed the next decision;
- whether action followed;
- whether outcome changed.

This supports both accounting and product learning.

---

## 28. The most important metric is not provider usage

A provider call is not valuable merely because it happened.

Stryde should eventually evaluate:

`marginal resource cost
vs
decision improvement
vs
real-world outcome movement`

Examples:

- Did another search change the recommendation?
- Did an additional source overturn a hypothesis?
- Did deeper extraction prevent a wrong action?
- Did a browser observation reveal the critical fact?
- Did premium reasoning materially change the next move?
- Did the resulting action produce a better outcome?

This is how Stryde should learn where to spend money.

---

## 29. Product architecture

The intended architecture becomes:

`USER
→ PURSUIT
→ SITUATION / CONTEXT
→ ENTITLEMENT RESOLUTION
→ RESOURCE BUDGET
→ RESEARCH / EXECUTION PLANNER
→ PROVIDER SELECTION
→ OPERATION
→ USAGE ACCOUNTING
→ EVIDENCE / RESULT
→ CONTEXT COMPILER
→ REASONING
→ AUTHORITY
→ ACTION
→ OBSERVATION
→ VERIFICATION
→ LEARNING
`

Billing sits outside the semantic pursuit loop.

It supplies commercial state and budget policy.

Stryde remains the control plane.

---

## 30. Implementation boundary

The subscription system should have clear modules.

### Commercial layer

Owns:

- subscription state;
- billing provider webhook handling;
- plan lifecycle;
- invoices/payment state where applicable.

### Entitlement layer

Owns:

- effective plan;
- feature access;
- quota definitions;
- plan overrides;
- account-level restrictions.

### Budget layer

Owns:

- reservations;
- consumption;
- reconciliation;
- reset;
- rollover/grants;
- per-pursuit budgets;
- concurrency.

### Capability layer

Owns:

- provider registry;
- capability metadata;
- estimated cost;
- actual usage;
- provider health;
- availability.

### Planner layer

Owns:

- operation selection;
- cost-aware routing;
- research stopping;
- downgrade/degradation;
- premium-model escalation.

No single billing integration should own the research architecture.

---

## 31. Do not hard-code provider quotas into product logic

Avoid:

`if plan === "pro" then firecrawl_calls = 50`

This creates:

- provider coupling;
- difficult price changes;
- migration pain;
- misleading product semantics;
- bad fallback behavior.

Prefer:

`plan → resource envelope → operation cost → provider choice`

Provider-specific constraints live in provider adapters.

---

## 32. Launch strategy

Do not finalize Free/Pro/Max numerical limits from intuition.

First collect real unit-cost evidence from:

- actual model usage;
- actual search usage;
- actual extraction usage;
- transcript usage;
- browser usage;
- storage;
- worker execution;
- observability;
- failed/retried operations.

Then derive:

`expected cost per active user
expected cost per paying user
gross margin target
support / infrastructure overhead
expected usage distribution
`

Only after that should exact quotas and public pricing be locked.

---

## 33. Initial qualitative policy

Until unit economics are measured, use this policy:

### Free

Enough capacity to demonstrate the complete Stryde thesis with bounded research and execution.

### Pro

Large enough capacity for a regular serious user.

### Max

Large enough capacity for heavy personal use and premium resource consumption, while retaining platform safety ceilings.

The exact resource numbers are intentionally TBD.

---

## 34. Non-negotiable commercial principles

1. Never silently subsidize unlimited third-party variable costs for Free.
2. Never make Free so weak that the core Stryde loop cannot be experienced.
3. Never let billing state directly become authority.
4. Never make provider-specific quotas the semantic product model.
5. Never fabricate or degrade evidence merely because a budget is exhausted.
6. Never allow Max to bypass safety ceilings.
7. Always account for variable-cost operations.
8. Prefer a cheaper sufficient operation over an expensive unnecessary one.
9. Measure outcome value, not only infrastructure consumption.
10. Recalibrate plan limits from reality.

---

## 35. Final principle

> **Free proves that Stryde works. Pro funds serious pursuit. Max funds intensive pursuit.**

The three plans should share the same Stryde brain and control plane.

What changes is how much external reality, computation, and execution Stryde is economically authorized to consume on the user's behalf.
