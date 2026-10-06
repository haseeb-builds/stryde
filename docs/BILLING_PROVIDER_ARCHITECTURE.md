# Stryde Billing Provider Architecture

Status: architecture direction / implementation target
Date: 2026-10-06

This document defines the billing boundary for Stryde Free, Pro, and Max.

The billing system is intentionally subordinate to Stryde's semantic control plane.

---

## 1. Billing is not Stryde's brain

Stryde's canonical system state remains owned by Stryde.

A billing provider should answer commercial questions:

- subscription status;
- product/plan;
- billing cycle;
- payment state;
- cancellation;
- renewal;
- entitlement-triggering events.

The billing provider should not own:

- pursuit state;
- evidence;
- personal memory;
- authority;
- capability semantics;
- research decisions;
- action state;
- verification.

The boundary is:

`Billing Provider
→ Commercial State
→ Entitlement Resolver
→ Resource Policy
→ Stryde Runtime`

---

## 2. Provider-neutral billing interface

Stryde should use a provider-neutral contract similar to:

`BillingProvider
├── createCheckoutSession
├── handleWebhook
├── getCustomer
├── getSubscription
├── cancelSubscription
├── changePlan
└── reconcileSubscription
`

The semantic product layer should not care whether the provider is:

- Paddle;
- Lemon Squeezy;
- another future eligible provider.

The actual provider choice remains an integration decision.

---

## 3. Why provider neutrality matters

A provider can change:

- supported countries;
- tax behavior;
- payout methods;
- pricing;
- webhook schemas;
- checkout flows;
- compliance requirements;
- commercial terms.

Stryde should not make a payment provider a permanent architectural dependency.

The provider adapter absorbs those differences.

---

## 4. Commercial state machine

Subscription lifecycle should be normalized internally.

Suggested states:

`TRIALING
ACTIVE
PAST_DUE
PAUSED
CANCELLED
EXPIRED
INCOMPLETE
UNKNOWN`

Exact mappings depend on the provider.

Stryde should preserve:

- provider status;
- normalized status;
- last event;
- event timestamp;
- effective period;
- reconciliation timestamp.

Unknown provider states must not silently become ACTIVE.

---

## 5. Webhook truth

Webhooks are external input.

Every webhook should be:

- authenticated;
- signature-verified;
- deduplicated;
- stored or represented in an audit record;
- applied idempotently;
- reconciled against current subscription state.

A single duplicate webhook should not create duplicate entitlement changes.

---

## 6. Subscription versus entitlement

The internal model should make the distinction explicit.

Example:

`Subscription
provider = x
status = active
product = pro
billing_period = monthly
`

becomes:

`EffectiveEntitlement
plan = pro
research_depth = high
browser = enabled
premium_reasoning = selective
resource_budget = pro_envelope
`

This decouples the commercial source from runtime policy.

---

## 7. Plan identity

Use stable internal plan IDs.

Suggested:

- `free`
- `pro`
- `max`

Do not make provider product IDs the internal canonical plan identity.

Example:

`internal plan = pro`

could map to different provider price IDs over time.

---

## 8. Overrides

Support controlled overrides for:

- founding users;
- test users;
- promotional credits;
- support grants;
- migration cases;
- refunds;
- incident recovery.

Overrides should be explicit, auditable, and time-bounded where appropriate.

The hierarchy should remain deterministic.

---

## 9. Suggested entitlement object

Conceptually:

`Entitlement {
  account_id
  plan_id
  effective_at
  expires_at
  features
  resource_limits
  autonomy_limits
  provider_access
  concurrency_limits
  source
  version
}`

The version is useful because plan policy will evolve.

---

## 10. Resource policy separation

Billing should not directly calculate provider calls.

Instead:

`plan_id
→ resource policy
→ current budget
→ planner`

Example:

`pro
→ research_rounds = high
→ extraction = high
→ browser = enabled
→ premium_reasoning = selective
`

The exact numeric policy should be stored in application configuration or database state, not hard-coded into route handlers.

---

## 11. Plan changes

When a user upgrades:

1. billing provider reports the subscription change;
2. webhook is validated;
3. internal subscription state is updated;
4. effective entitlement is recomputed;
5. resource policy changes;
6. future operations use the new policy.

Existing operations should not be rewritten retroactively.

When a user downgrades:

- new operations use the lower policy;
- active jobs continue only within their already-reserved safe limits;
- future reservations must respect the new entitlement;
- any excess should be handled explicitly rather than silently invalidated.

---

## 12. Cancellation

Cancellation should have a clear effective time.

A user may cancel at the end of the current period.

The system should retain:

- cancellation requested at;
- effective cancellation at;
- current entitlement until;
- next renewal date if applicable.

The runtime should use the effective entitlement, not merely the fact that cancellation was requested.

---

## 13. Past-due behavior

Do not immediately corrupt the pursuit experience on transient payment problems.

A normalized policy can define:

- grace period;
- limited continuation;
- downgrade timing;
- cancellation timing.

Exact commercial policy remains open.

The architecture must support it without coupling payment status to pursuit state.

---

## 14. Free is the default recovery state

If a paid subscription becomes invalid and no valid grace period applies, the account should resolve to Free.

That does not mean:

- delete pursuits;
- delete evidence;
- delete personal state;
- destroy historical work.

Commercial downgrade should primarily affect future resource entitlement.

---

## 15. Billing failure must not destroy canonical state

A failed payment is not a product-state deletion event.

Stryde should preserve:

- pursuits;
- observations;
- evidence;
- decisions;
- actions;
- memory;
- verification history.

Only commercial capability changes.

---

## 16. Entitlement cache

Entitlements may be cached for performance.

But the cache must have:

- TTL;
- invalidation path;
- version;
- source timestamp;
- safe fallback.

A stale entitlement cache should fail toward the safer resource policy where practical.

It should never grant unlimited paid resources because a cache is stale.

---

## 17. Security boundary

Billing integration handles sensitive commercial data.

At minimum:

- verify webhook signatures;
- prevent replay;
- store provider IDs safely;
- never trust client-submitted plan IDs;
- never let the client select arbitrary entitlement values;
- audit plan changes;
- server-side enforce resource limits.

The browser is a display surface, not the billing authority.

---

## 18. Payment provider selection

The architecture intentionally does not hard-code a provider.

The launch decision should evaluate:

- availability for the target business geography;
- payout support;
- tax handling;
- subscription support;
- webhook quality;
- checkout UX;
- refund handling;
- dispute handling;
- compliance burden;
- commercial cost;
- API reliability.

A provider should be selected after current eligibility is verified.

---

## 19. Founding-access mode

Before full subscription commerce is ready, Stryde can support a controlled founding-access mode.

Possible internal states:

`FOUNDING_ACCESS
FREE
PRO
MAX`

Founding access should be:

- explicit;
- auditable;
- time-bounded or revocable;
- separate from fake billing state.

Do not fabricate paid provider transactions to simulate subscriptions.

---

## 20. Subscription-aware research loop

The complete runtime path becomes:

`USER GOAL
→ SITUATION
→ EFFECTIVE ENTITLEMENT
→ REMAINING RESOURCE BUDGET
→ RESEARCH / EXECUTION PLANNER
→ PROVIDER SELECTION
→ OPERATION
→ USAGE ACCOUNTING
→ EVIDENCE / RESULT
→ REASONING
→ AUTHORITY
→ ACTION
→ OBSERVATION
→ VERIFICATION
→ NEXT MOVE`

This keeps the subscription boundary outside the epistemic core while still controlling variable cost.

---

## 21. Upgrade prompts must be context-aware

Stryde should only surface an upgrade when all of these are true:

1. the next capability is materially useful;
2. current plan capacity is the blocker;
3. a cheaper valid path is not available;
4. the user would plausibly benefit from additional capacity.

Otherwise Stryde should continue within the available plan.

This is important because unnecessary upgrade prompts would directly conflict with the "absorb ambiguity" product principle.

---

## 22. Do not expose infrastructure unnecessarily

The user should usually not see:

- Exa units;
- Firecrawl credits;
- raw token counts;
- browser action counts.

These can exist in an advanced usage view, but normal UX should speak in pursuit capacity:

- research depth;
- work capacity;
- remaining capacity;
- next useful move.

---

## 23. Billing observability

Record enough data to answer:

- when did plan state change?
- which event caused the change?
- what entitlement was effective?
- what budget policy applied?
- which operations were allowed?
- which were refused?
- what resource reservation existed?

This is necessary for support and debugging.

---

## 24. Failure modes

### Webhook delayed

Use last confirmed entitlement until reconciliation.

### Webhook duplicated

Idempotently ignore the duplicate.

### Webhook missing

Reconcile with the provider.

### Provider unavailable

Use last valid state with a bounded safety policy; do not grant unlimited usage.

### Internal entitlement bug

Fail closed on expensive capability access where practical.

### Client reports paid plan

Ignore it unless server-side commercial state agrees.

### Plan changes during long-running job

Apply the policy to future reservations and define how existing reservations are treated.

---

## 25. Implementation sequence

1. Define stable plan IDs.
2. Define entitlement schema.
3. Define resource policy schema.
4. Add provider-neutral billing interface.
5. Add subscription state persistence.
6. Add webhook verification and idempotency.
7. Add entitlement resolver.
8. Add budget reservation.
9. Add usage accounting.
10. Connect planner to effective entitlement.
11. Add founding-access mode.
12. Select and integrate the payment provider.
13. Add customer-facing billing UI.
14. Verify downgrade, cancellation, failure, refund, and grace-path behavior.

---

## 26. Current boundary

The current Stryde repo may already contain pieces of billing/founding-access behavior.

Those existing pieces must be reconciled against this target rather than assumed complete.

In particular:

- existing billing abstractions should remain provider-neutral;
- existing "503 until configured" behavior should remain honest;
- payment provider selection should be verified for business geography;
- production billing is not proven merely because checkout code exists.

---

## 27. Final principle

> **The billing provider collects money. Stryde decides what that money unlocks.**

The plan controls resource capacity.

The resource layer controls spending.

The planner decides what is worth spending.

The evidence layer decides what the evidence means.

The authority layer decides what Stryde may do.

Stryde remains the control plane.
