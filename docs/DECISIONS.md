# Stryde Decision Register

Status: canonical decision register
Reconciliation date: 2026-10-02

## Product decisions

### D1 — One universal control surface
LOCKED.
The user interacts primarily through one composer. Internal workflow types are hidden from normal UX.

### D2 — User cognition is scarce
LOCKED.
Stryde should absorb ambiguity and operational complexity rather than reflecting it back as forms, modes, or workflow configuration.

### D3 — Mode selection is automatic
LOCKED.
Stryde chooses whether to interpret, research, reconcile, ask, act, delegate, verify, wait, or continue based on the current situation. Users can express explicit intent naturally and use small optional controls.

### D4 — Evidence-aware honesty
LOCKED.
Stryde distinguishes source claims, inference, reported information, observation, verification, contradiction, and unknowns. It should challenge unsupported assumptions and may recommend not acting.

### D5 — Outcome over answer quality
LOCKED.
A good interaction changes pursuit state and, where possible, reality. Beautiful prose is not the target metric.

### D6 — Model independence
LOCKED.
Models are replaceable intelligence providers. Better GPT/Claude/Gemini/other models should improve Stryde rather than redefine it.

### D7 — Personal longitudinal state
LOCKED as a direction.
Stryde should learn from constraints, decisions, actions, failures, outcomes, corrections, and patterns. Exact storage/retrieval architecture remains open.

### D8 — Automatic verification
LOCKED.
When a reliable observation path exists, Stryde verifies itself. Ask the user only for missing reality it genuinely cannot observe.

### D9 — Configurable authority/autonomy
LOCKED as a direction.
Support bounded suggestion, preparation, delegation, and autonomous operation with explicit scope and escalation policy. Exact V1 policy remains open.

### D10 — Third-party technology boundary
LOCKED.
Reuse, wrap, adapt, combine, or reconstruct third-party technology case-by-case. Stryde owns semantic control, state, authority, evidence, verification, learning, and continuation.

### D11 — Appropriate evidence, not primary-source absolutism
LOCKED.
Prefer authoritative/original sources where appropriate, but choose evidence according to the question and stakes.

### D12 — Social later
UNLOCKED for V1.
Community may eventually increase pursuit value, but it must not become a generic feed.

## Engineering decisions

### D13 — Postgres remains V1 system of record
LOCKED for now.
Do not add a second canonical database simply to satisfy a memory/agent trend.

### D14 — No giant agent framework by default
LOCKED.
Add LangGraph, Letta, LiteLLM, Temporal, or similar only when a demonstrated problem justifies the added abstraction and ownership boundary.

### D15 — No casual migration reset
LOCKED.
Live Supabase migration history is not one-to-one with repository files. Reconcile before destructive or schema-reset actions.

### D16 — Production proof is required
LOCKED.
No claim of production readiness without deployed authenticated E2E evidence appropriate to the feature.

## Open decisions

- exact initial user wedge;
- precise authority levels and policy grammar;
- exact memory implementation;
- browser provider;
- document/media stack;
- capability-routing implementation;
- proactive continuity;
- future social/network design;
- long-term commercial model.
