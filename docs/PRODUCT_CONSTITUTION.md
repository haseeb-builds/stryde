# Stryde Product Constitution

Status: canonical product constitution
Reconciliation date: 2026-10-02

## Why Stryde exists

Stryde exists to help a person move something meaningful from intention to reality.

The user should be able to bring a goal, problem, question, source, decision, result, contradiction, or new event through one simple control surface. Stryde absorbs the ambiguity of what that input means, reconstructs the relevant situation, acquires and evaluates useful knowledge, adapts it to the person and their constraints, recommends what matters now, gets the appropriate authority, executes or delegates where allowed, observes what happened, verifies what can be verified, learns from the result, and continues the pursuit.

The product is not a generic chatbot, planner, task manager, research app, agent framework, or AI workspace.

## The core loop

INTENTION
→ REALITY
→ SITUATION
→ UNKNOWN / BOTTLENECK
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
→ NEXT MOVE

The loop is Stryde. Models, providers, tools, browsers, research systems, and workers are replaceable capabilities inside it.

## Non-negotiable product principles

1. One universal composer is the primary control surface.
2. Normal users should not have to understand Pursuit, Claim, Decision, Action, Observation, Verification, Research, or other internal ontology.
3. Do not expose Research / Claim / Action / Evidence / Pursuit / Decision as primary workflow buttons.
4. Users may express intent naturally and may use small optional controls when they already know what artifact they want to provide.
5. Stryde chooses the appropriate mode, tool, provider, research path, and execution path from the situation instead of making the user choose.
6. The same composer handles ordinary messages, links, files, images, voice, progress, corrections, action reports, and other pursuit input.
7. The user should make as few decisions as possible. Complexity should move behind the interface, not onto it.
8. Stryde should challenge weak assumptions and can recommend not acting, changing strategy, changing the objective, or abandoning a pursuit when evidence warrants it.
9. Stryde must be honest rather than agreeable. It should distinguish fact, source claim, inference, uncertainty, observation, outcome, and causation.
10. User-facing reasoning should be concise by default and available when it materially improves understanding. Internal chain-of-thought is not a product surface.
11. User authority is explicit and configurable. Stryde can suggest, prepare, delegate, or operate autonomously within bounded permissions.
12. Autonomous work must have clear scope, capability, data, side-effect, duration, and escalation boundaries.
13. When reliable observation or verification is available, Stryde should do it itself instead of turning the user into a verifier or data-entry clerk.
14. If Stryde cannot observe a required reality, it may ask the user for the smallest missing piece of evidence.
15. Verification is separate from mechanical execution success.
16. UNKNOWN is a legitimate state.
17. Memory is not raw chat history. Stryde should build an evolving, provenance-aware model of the person's constraints, preferences, decisions, actions, outcomes, failures, and patterns.
18. Memory candidates can become stale, contradicted, superseded, or deleted. Personalization must remain inspectable and controllable.
19. Stryde should learn from outcomes and from the user's corrections, not only from conversation quality.
20. The quality target is changed reality, not impressive prose or engagement.
21. A recommendation that is theoretically correct but infeasible for this person is not a good Stryde recommendation.
22. Research should prefer evidence appropriate to the question and stakes, with preference for authoritative and original sources where appropriate. "Primary source" is a preference, not an absolute rule.
23. Stryde should use more than web search when needed: official databases, papers, documents, transcripts, public APIs, browser-accessible portals, user-provided material, specialized retrieval, and human input are all possible evidence sources.
24. Research effort should scale with decision importance and expected value. Do not research forever.
25. External AI output is input to Stryde, not truth. Stryde should be able to ingest, critique, reconcile, and adapt work produced by GPT, Claude, Gemini, GLM, or other systems.
26. Better frontier models should make Stryde better. Stryde is model-independent and may route different tasks to different models.
27. Open source is a resource, not a religion. Reuse mature infrastructure where it is truly commodity; wrap or adapt strategically important capabilities; reconstruct valuable behavior when that provides materially better control; reject components whose license, security, maintenance, or architecture cost is unacceptable.
28. Embedded third-party code must be evaluated by its actual license and integration boundary. "Open source" alone is not permission to copy any code into the proprietary core.
29. Stryde owns the semantic control loop, canonical personal/pursuit state, authority model, evidence/provenance model, verification semantics, and continuation/learning behavior.
30. Stryde must not become an aggregation of impressive dependencies. Add technology only when it materially improves the outcome or meaningfully reduces non-differentiating engineering burden.
31. Social/community is a future possibility. It should earn its place by improving pursuits, such as accountability, shared methods, challenges, or human contribution, not by becoming a generic social feed.
32. Product minimalism means minimal user cognition, not minimal internal capability.

## What Stryde must survive

Stryde should remain useful even if:
- GPT gets dramatically better;
- Claude gets dramatically better;
- Gemini gets dramatically better;
- a new open model replaces today's models;
- the best browser or research infrastructure changes;
- a user switches between different AI systems.

The goal is not to beat frontier models at general intelligence. The goal is to maintain a durable, useful layer around them that accumulates person-specific and pursuit-specific reality.

## Potential compounding advantage

Stryde's moat is not assumed to be any single component.

Candidate compounding assets include:
- longitudinal personal context;
- longitudinal pursuit state;
- evidence and provenance history;
- verified action/outcome history;
- learned intervention patterns for an individual;
- capability selection and substitution policies;
- aggregated, privacy-preserving knowledge about what works for similar situations.

These are hypotheses to validate through real use, not claims to treat as already proven.

## Core test

A useful Stryde session should be able to move:

knowledge → understanding → decision → action → observation → verification → state update → next move.

A beautiful conversation without a meaningful state change is not the target.

## Product boundary

Stryde should feel small and calm on the surface even when its internals are sophisticated.

Preferred user mental model:

"I have something important to move."

Not:

"I need to configure an AI workflow."

## V1 discipline

Do not turn this constitution into a giant feature checklist.

Build the smallest end-to-end vertical slice that proves the core loop, then add capabilities only when they reduce user cognition or materially improve real-world outcomes.
