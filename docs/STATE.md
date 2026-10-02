# Stryde Current State

Status: canonical current-state record
Reconciliation date: 2026-10-02

## Repository

CONFIRMED:
- Repository: haseeb-builds/stryde
- Active build branch: codex/model-routing-migration-clean
- HEAD: f92aa8a37bffd56ce53b968484acfc3efcbcc6e0
- Previous validated code commit: 9c4132e6d6d9a42a15fb758b72a1f15b6a3e7324
- Main currently points to 6cbfcfe70515bd51b832de60109c4d7a49ad491b.
- Branch is 15 commits ahead and 2 behind main. The missing main commits are the older OpenRouter/Nemotron deployment lineage and must not be blindly reintroduced.

The current branch includes a new Product Constitution and reconciled engineering rules that supersede stale agent assumptions.

## Product direction now locked

- Stryde is a persistent personal pursuit system, not a generic chatbot or AI workspace.
- One universal composer is the primary control surface.
- Users should not operate internal workflow concepts such as Research, Claim, Action, Evidence, Pursuit, or Decision.
- Stryde chooses modes and capabilities from context.
- Stryde should actively challenge weak assumptions and may recommend waiting, changing strategy, changing the goal, or stopping.
- Stryde should perform verification itself whenever a reliable observation path exists.
- User-configurable authority spans suggestion, preparation, delegation, and bounded autonomy.
- Stryde should become more useful as external frontier models improve.
- Longitudinal personal/pursuit state, evidence, outcomes, and learned intervention patterns are candidate compounding assets, not yet proven moats.
- Social/community is a later possibility, not V1.
- Third-party infrastructure may be reused, wrapped, adapted, combined, or reconstructed case-by-case. Stryde owns semantic control, state, authority, evidence, verification, learning, and continuation.

## Deployment

CONFIRMED:
- Current branch preview deployment: dpl_43tq7ZHVLzhkDdtdjNwHGGdJvbYP
- Preview URL: stryde-p6hxjpehu-abdhaseebtech-5772s-projects.vercel.app
- Preview state: READY
- Preview commit: f92aa8a... branch head (the deployment currently observed for the prior 9c4132e code; a new deployment should follow the latest docs commit).
- Current production deployment: dpl_3cPciN3GnkHuV6CeP5CtHWSo4nBd
- Production commit: 6cbfcfe70515bd51b832de60109c4d7a49ad491b
- Production is still the old main/Nemotron/OpenRouter-era deployment.
- Production health currently reports provider=gemini, model=gemini-2.5-flash, configured=false, ready=false.
- Current branch preview health reports no usable model providers configured.

CONCLUSION:
- Release is not complete.
- The validated branch is not yet production.
- Provider credentials/configuration must be reconciled on the deployment before claiming a working production model path.

## Supabase

CONFIRMED:
- Project: pvijrnwdnolvnoibarrj
- Health: ACTIVE_HEALTHY
- Region: ap-southeast-1
- Current counts:
  - pursuits 33
  - conversation_session 37
  - conversation_message 127
  - claim 13
  - observation 36
  - action 37
  - decision 37
  - run 16
  - event 264
  - tool 2
  - capability_grant 0
  - job 0
  - attempt 0
- Run status: FAILED 7, RUNNING 9.

These counts supersede older September documentation snapshots.

## Verified engineering behavior

Local proof executed 2026-09-30 on the pre-constitution branch state:
- npm test 51/51;
- e2e:human 14/14;
- probe:provider -- omniroute PASSED with a real provider and the real ConversationTurn + WorkingState contracts;
- e2e:model PASSED 11 boundaries using the real fallback path: Gemini 429 → OmniRoute served the model turns;
- the vertical loop reached conversation → model turn → persistence → /work → CREATE_ACTION → human action → report → Observation → Claim → evidence link → VERIFIED adjudication → updated next move.

This evidence is local/dev evidence, not production proof.

## Current implementation gaps relative to the new constitution

1. The production deployment is on stale main.
2. Current preview lacks usable model credentials.
3. The main pursuit UI still exposes separate Source material, Bounded research, Execution, and Evidence & claims panels.
4. Research/source behavior is not yet capability-adaptive; Exa and Firecrawl are implemented adapters, not the complete evidence acquisition system.
5. User-facing verification is still too manual in places; the backend must progressively own verification.
6. Personal memory/reality-model semantics are not yet implemented as a full system.
7. Authority/autonomy is not yet a complete user-configurable permission model.
8. Real external worker execution remains unproven.
9. Browser/document/media/MCP/integration capabilities are mostly future primitives.
10. Migration lineage remains divergent: repository has materially more migration files than live history and contains a duplicate 20260915000500 version. Do not reset or blindly db push.

## Security

Current Supabase security advisor reports:
- INFO: public.loops has RLS enabled but no policies.
- WARN: four SECURITY DEFINER functions are executable by authenticated users; function bodies currently enforce ownership/auth but the privilege surface is broader than ideal.
- WARN: leaked-password protection is disabled.

Performance advisor reports many auth.uid() per-row policy optimizations and unused/unindexed index findings. These are not immediate product blockers.

## Next implementation direction

Build the new Stryde in vertical slices:
1. universal control surface;
2. natural-language capability routing;
3. automatic observation/verification where possible;
4. durable personal/pursuit memory and reality model;
5. authority/autonomy policy;
6. evidence-aware adaptive research;
7. real bounded external capability;
8. production promotion and end-to-end proof.

Do not turn this into a giant checklist for its own sake. Each slice must advance the core outcome and preserve the simple user surface.
