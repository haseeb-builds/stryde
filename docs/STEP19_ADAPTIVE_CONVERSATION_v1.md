# STRYDE — Step 19 Adaptive Conversation v1

## Status
IMPLEMENTED

## Product principle

Stryde should absorb cognitive ambiguity rather than reflect it back to the user.

The user does not need to know what information Stryde needs. Stryde should interpret the user's signal, move understanding forward, and ask only the smallest next question when another question materially improves the situation model.

## Interaction contract

The Pursuit entry surface is a conversation, not a fixed wizard.

The user may:
- choose a lightweight starting signal,
- type anything in their own words,
- say they are unsure,
- reject Stryde's interpretation,
- select context-specific options suggested by Stryde, or
- tell Stryde to work with the current understanding.

Stryde responses may contain any combination of:
- interpretation,
- useful observation,
- proposed framing,
- small recommendation,
- a single next question,
- a small set of options.

A response is not required to contain a question.

## Adaptive behavior

There is no fixed Step 1 → Step 2 → Step 3 sequence.

The model decides whether another question is useful. The model may report `ready_for_reasoning=true` when enough understanding exists to run the canonical reasoning kernel without inventing missing facts.

## Context integrity

Conversation messages are bounded working memory. They are not canonical domain state.

The server supplies the current persisted Situation separately from the conversation transcript. Conversation history is explicitly framed as working signal and is limited to the most recent messages and bounded message lengths.

User corrections must be treated as corrections to the working interpretation, not as silent rewrites of durable Claims.

## Authority boundary

Conversation output is untrusted model output.

It cannot:
- authorize side effects,
- create Jobs,
- execute tools,
- mark verification successful,
- grant permissions,
- change canonical Claims directly.

When the user chooses `Work with this`, the bounded conversation is passed into the existing `/reason` path, which creates the durable Run and applies the deterministic reasoning kernel.

## Implementation

- `POST /api/v1/pursuits/:id/conversation` performs adaptive conversational elicitation.
- `lib/model-gateway.ts` contains the structured `ConversationTurn` contract and provider call.
- `app/pursuits/[id]/page.tsx` renders the conversation, model-generated options, correction controls, and explicit `Work with this` transition.
- No new domain entity was introduced for ConversationQuestion, GuidedFlow, PromptStep, or WizardState.

## Deferred

- Durable conversational transcript storage.
- Voice input.
- Proactive/ambient monitoring.
- Multi-agent conversation.
- Automatic canonical Claim creation from conversation turns.
