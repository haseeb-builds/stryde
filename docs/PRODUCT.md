# Stryde Product Truth

Status: canonical product document
Reconciliation date: 2026-10-02

The canonical product philosophy is defined in docs/PRODUCT_CONSTITUTION.md. This document summarizes the product contract for implementation.

## Product

Stryde is a persistent personal pursuit system. Its job is to help a person move something meaningful from intention to reality.

The core loop is:

INTENTION → REALITY → SITUATION → UNKNOWN / BOTTLENECK → EVIDENCE → INTERPRETATION → OPTIONS → RECOMMENDATION → AUTHORITY → ACTION / DELEGATION → OBSERVATION → VERIFICATION → OUTCOME → LEARNING → UPDATED STATE → NEXT MOVE

The user brings reality through one universal composer. Stryde determines whether the input is a question, source, correction, progress update, action report, decision, or another useful artifact.

## User contract

The user should not have to operate a workflow system.

Stryde should:
- reconstruct relevant personal and pursuit context;
- distinguish known, inferred, uncertain, observed, verified, and contradicted information;
- obtain relevant knowledge through the best available capability, not just one search provider;
- prefer appropriate authoritative/original evidence without worshipping "primary source" as a universal rule;
- adapt methods and information to the person's actual constraints and previous results;
- challenge weak assumptions;
- decide when to ask, research, act, wait, stop, delegate, or continue;
- recommend the smallest useful move when appropriate;
- allow bounded autonomous execution;
- observe and verify outcomes wherever possible;
- learn from outcomes and corrections;
- maintain continuity over time.

## UX law

The primary experience is one control surface.

Do not expose internal workflow nouns as primary navigation or action buttons:
Research, Claim, Action, Evidence, Pursuit, Decision, Run, Worker, Agent, etc.

Contextual UI is allowed when it reduces ambiguity or makes an actual action easier. The UI should surface the minimum information needed to understand what matters now and what can happen next.

## Product non-goals

Stryde is not:
- a generic ChatGPT clone;
- a general-purpose agent framework;
- a task manager with an AI layer;
- a dashboard-first productivity product;
- a browser automation product;
- a search engine;
- a memory database;
- a social feed.

Those capabilities may exist as subordinate infrastructure or future layers without becoming Stryde's product identity.

## Strategic resilience

Stryde should improve as external AI improves. It should route tasks across interchangeable models and capabilities while preserving person-specific and pursuit-specific state.

The core value is not a particular model's answer. It is the continuity and transformation of:
what is happening → what matters → what to do → what happened → what changed → what next.

## Current implementation boundary

The repository already contains substantial persistence, conversation, source, execution, worker, and verification primitives. Do not assume a capability is product-complete simply because the primitive exists.

Use docs/STATE.md and docs/VERIFICATION_MATRIX.md for evidence status.
