# STRYDE — Step 19 Model Gateway v1

Status: HISTORICAL IMPLEMENTATION RECORD — current runtime configuration is in docs/RUNTIME.md

The provider abstraction remains current: orchestration is not coupled to a single model vendor.

Current correction:
- Repository code supports Gemini, Groq, and OpenRouter.
- Source default is Gemini when STRYDE_MODEL_PROVIDER is absent.
- Live Run records from 2026-09-18 contain OpenRouter-specific 429/404 failures, proving OpenRouter was used by a live runtime at that time.
- Current deployed provider/model is UNKNOWN because Vercel environment access is unavailable.

Therefore the historical statement that OpenRouter/openrouter-free is the current provider must not be treated as current truth.
