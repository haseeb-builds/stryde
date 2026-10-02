# Stryde Verification Matrix

Status: canonical verification matrix
Reconciliation date: 2026-10-02

IMPLEMENTED = machinery exists.
TESTED = relevant execution evidence exists.
DEPLOYED = deployment evidence exists.
PRODUCTION VERIFIED = demonstrated on the deployed system.
END-TO-END VERIFIED = the complete intended loop was demonstrated.

| Capability | Implemented | Tested | Deployed | Production Verified | E2E Verified |
|---|---|---|---|---|---|
| Auth/server boundary | YES | YES local | YES | UNKNOWN | NO |
| Pursuit creation/listing | YES | YES local | YES | UNKNOWN | NO |
| Persistent conversation | YES | YES local | YES | UNKNOWN | NO |
| Conversation SSE | YES | PARTIAL | YES | UNKNOWN | NO |
| Adaptive conversation | YES | PARTIAL | YES | UNKNOWN | NO |
| Situation assembly | YES | PARTIAL | YES | UNKNOWN | NO |
| Model routing/fallback | YES | YES local | YES | NO current-branch proof | YES local |
| Real model conversation | YES | YES via OmniRoute locally | YES | NO | YES local |
| Human action approval/start | YES | YES local E2E | YES | UNKNOWN | YES local |
| Human action report → Observation | YES | YES local E2E | YES | UNKNOWN | YES local |
| Claim + evidence link + adjudication | YES | YES local E2E | YES | UNKNOWN | YES local |
| Source ingestion: URL/paste | YES | tests + partial local | YES | UNKNOWN | PARTIAL |
| Source adaptation/citation | YES | partial local | YES | UNKNOWN | PARTIAL |
| Capability registry/worker gateway | YES | partial | YES | NO | NO |
| Hermes worker execution | CONTRACT ONLY | NO real execution proof | YES | NO | NO |
| OpenCode worker execution | CONTRACT ONLY | NO real execution proof | YES | NO | NO |
| Universal composer | PARTIAL | current composer works | YES | UNKNOWN | NO |
| Natural-language source/capability routing | NO | NO | NO | NO | NO |
| Automatic verification where observable | PARTIAL | partial | YES | NO | NO |
| Personal memory/reality model | NO | NO | NO | NO | NO |
| User-configurable authority/autonomy policy | NO | NO | NO | NO | NO |
| Multi-provider adaptive evidence acquisition | PARTIAL | no full proof | YES | UNKNOWN | NO |
| Browser capability | NO | NO | NO | NO | NO |
| Document/media ingestion | NO | NO | NO | NO | NO |
| General MCP runtime | NO | NO | NO | NO | NO |
| Proactive continuity | NO | NO | NO | NO | NO |
| Social/community | NO | NO | NO | NO | NO |

## Local evidence

2026-09-30:
- npm test 51/51;
- e2e:human 14/14;
- probe:provider -- omniroute PASSED;
- e2e:model PASSED 11 boundaries via Gemini 429 → OmniRoute fallback;
- browser verification showed real model working-state UI locally.

These do not establish production verification.

## Verification rule

Stryde should progressively remove verification work from the user when a reliable observation path exists. User reporting is a reality input, not an obligation to manually adjudicate facts that the system can establish itself.

