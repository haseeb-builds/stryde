# Stryde Product Truth

Status: canonical product document
Reconciliation date: 2026-09-28

This document describes the intended product contract. It is not evidence that every capability is currently implemented or deployed. Current implementation/runtime truth is in docs/STATE.md and docs/RUNTIME.md.

## Intended product

Stryde is a persistent situational-intelligence workspace. Its intended job is to help a person turn a messy real-world situation into a continuously adapting pursuit:

REALITY → SITUATION → UNKNOWN / BOTTLENECK → RECOMMENDATION → AUTHORITY → ACTION → EXECUTION → EVIDENCE → VERIFICATION → STATE UPDATE → NEXT MOVE

The product boundary is not a generic chatbot, static planner, productivity dashboard, bookmark manager, course summarizer, or unconstrained autonomous agent.

## User contract

The primary interaction should eventually let the user bring a goal, question, contradiction, source, result, decision, progress update, or new real-world event through one conversational control surface.

Stryde should:
- reconstruct relevant context;
- distinguish what is known from what is uncertain;
- use external knowledge when useful;
- reconcile sources against the user's actual constraints;
- identify the current bottleneck;
- propose the smallest useful next move;
- preserve human authority for consequential decisions;
- execute only explicitly authorized work through bounded capabilities;
- capture results as evidence;
- verify what can be verified;
- update durable state;
- continue the pursuit.

## Product principles

1. Conversation is an interaction surface, not the project's memory or canonical truth.
2. Durable state is typed, owned, provenance-aware, and evidence-graded.
3. Source material remains source material; source claims are not silently promoted into user truth.
4. Model output is advisory and never grants authority by itself.
5. Action is not outcome.
6. Mechanical execution success is not real-world verification.
7. UNKNOWN is a valid state and is not silently converted into failure or success.
8. Human corrections preserve history rather than rewriting it.
9. Stryde should absorb ambiguity instead of forcing users through a rigid questionnaire.
10. External tools and agents are capabilities/workers, not the product's control plane.
11. Reuse mature infrastructure where appropriate, but Stryde owns the semantic control loop, authority, canonical state, reconciliation, evidence, and continuation.
12. Product progress is measured by demonstrated runtime behavior, not code presence.

## Intended capability envelope

The intended long-term envelope includes:
- adaptive conversation and a unified Bar;
- source ingestion and source-grounded research;
- relevance, comparison, conflict handling, and source-to-reality adaptation;
- human execution loops;
- controlled external actions;
- bounded worker execution;
- browser capabilities;
- document and media processing;
- explicit user-owned context connectors;
- saved-content reuse;
- proactive continuity;
- voice interaction;
- evidence memory;
- repeatable experiments;
- capability discovery and substitution.

None of the above is assumed to be currently available merely because it appears here.

## Current product boundary

The current repository contains a partial implementation of the product: canonical persistence, authenticated routes, adaptive conversation code, source/search adapters, a human-action path, worker gateway/dispatcher infrastructure, and verification primitives. Current production behavior is not fully verified.

The current highest-value question is therefore not whether Stryde needs more features. It is whether one real vertical pursuit loop works end-to-end in the deployed environment and can be reproduced from durable project evidence.

## Product non-goals

Stryde should not become:
- a new general-purpose agent framework;
- a second memory database detached from canonical state;
- a tool collection without policy;
- an autonomous system whose model output can directly cause consequential side effects;
- a duplicate implementation of mature browser, crawling, document, media, or worker infrastructure.
