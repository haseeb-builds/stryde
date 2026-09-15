# STRYDE — Step 19 Model Gateway v1

## Status
IMPLEMENTED

## Purpose
Connect the Stryde reasoning kernel to a real model provider without coupling orchestration to a provider SDK or allowing model output to cross authority boundaries.

## Boundary
`Situation + user input → model gateway → validated ModelProposal → deterministic reasoning kernel`

The gateway is responsible for provider transport and structured-output parsing only. The reasoning kernel remains responsible for semantic validation and routing.

## Provider configuration

- `STRYDE_MODEL_PROVIDER` — currently `openai`.
- `STRYDE_MODEL_API_KEY` — preferred server-only provider credential; `OPENAI_API_KEY` is accepted as a compatibility fallback.
- `STRYDE_MODEL_BASE_URL` — optional OpenAI-compatible base URL; defaults to `https://api.openai.com/v1`.
- `STRYDE_MODEL_NAME` — preferred model id; `OPENAI_MODEL` is accepted as a compatibility fallback; default is `gpt-5.6-luna`.

Credentials are read only server-side and are never returned to the browser.

## Structured output

The gateway requests a strict JSON-schema `ModelProposal` matching the existing orchestration contract. The proposal can request an intervention but cannot authorize side effects or assign verification.

## Application behavior

`POST /api/v1/pursuits/:id/reason` now calls the gateway when `model_proposal` is omitted. A supplied `model_proposal` remains available only as a development/testing override.

## Health

`GET /api/health/model` returns provider/model/configuration readiness without exposing credentials or secret material.

## Deliberate non-goals

- No provider SDK dependency in the core orchestration kernel.
- No model-generated tool execution.
- No model-generated authorization.
- No model-generated epistemic upgrades.
- No provider credential persistence.
- No multi-model routing policy yet.

## Current first adapter

OpenAI Responses API. OpenAI's current model catalogue lists GPT-5.6 Luna as a cost-sensitive workload model and states that the latest OpenAI models are available through the Responses API. The adapter therefore uses the Responses endpoint while keeping provider selection outside the orchestration contract.
