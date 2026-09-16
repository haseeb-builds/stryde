# STRYDE — Step 19 Model Gateway v1

## Status
IMPLEMENTED

## Purpose
Connect the Stryde reasoning kernel to a real model provider without coupling orchestration to a provider SDK or allowing model output to cross authority boundaries.

## Boundary
`Situation + user input → model gateway → validated ModelProposal → deterministic reasoning kernel`

The gateway is responsible for provider transport and structured-output parsing only. The reasoning kernel remains responsible for semantic validation and routing.

## Provider configuration

- `STRYDE_MODEL_PROVIDER` — currently `openrouter`.
- `STRYDE_MODEL_API_KEY` — preferred server-only OpenRouter credential.
- `STRYDE_MODEL_BASE_URL` — optional OpenRouter-compatible base URL; defaults to `https://openrouter.ai/api/v1`.
- `STRYDE_MODEL_NAME` — preferred OpenRouter model id; defaults to `openrouter/free`.

For the initial no-budget validation phase, `openrouter/free` is the default. OpenRouter describes this router as free inference that selects among available free models and filters for requested capabilities such as structured outputs.

Credentials are read only server-side and are never returned to the browser.

## Structured output

The gateway requests a strict JSON-schema `ModelProposal` matching the existing orchestration contract. The proposal can request an intervention but cannot authorize side effects or assign verification.

## Application behavior

`POST /api/v1/pursuits/:id/reason` calls the gateway when `model_proposal` is omitted. A supplied `model_proposal` remains available only as a development/testing override.

The adaptive conversation layer uses the same gateway and structured-output boundary. It treats conversation as bounded working memory rather than canonical domain state.

## Health

`GET /api/health/model` returns provider/model/configuration readiness without exposing credentials or secret material.

## Deliberate non-goals

- No provider SDK dependency in the core orchestration kernel.
- No model-generated tool execution.
- No model-generated authorization.
- No model-generated epistemic upgrades.
- No provider credential persistence.
- No fixed multi-model policy.

## Current first adapter

OpenRouter via its OpenAI-compatible chat completions endpoint. The model id is configuration rather than architecture, allowing Stryde to move from free validation models to paid or self-hosted models without changing the reasoning/control contract.
