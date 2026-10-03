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

## Evidence

2026-09-30 (earlier pass):
- npm test 51/51;
- e2e:human 14/14;
- probe:provider -- omniroute PASSED;
- e2e:model PASSED 11 boundaries via Gemini 429 → OmniRoute fallback;
- browser verification showed real model working-state UI locally.

2026-10-03 (live-system pass):
- npm test 64/64 (4 new tests pin the working-state normalization boundary);
- typecheck, lint, and production build all clean;
- e2e:human PASSED 14/14 against the LIVE Supabase project (pvijrnwdnolvnoibarrj)
  — pursuit creation, working-state seeding, action start, exactly-once replay,
  completion, FAILED cycle, claim creation, evidence linking, human
  adjudication to VERIFIED. This is live-database evidence, not local-only;
- probe:provider -- gemini PASSED both live contracts (ConversationTurn and
  WorkingState) against a real provider;
- migration parity 30/30, zero divergence;
- RLS tenant isolation and RPC privilege posture verified empirically.

2026-10-03 (later): CONTROLLED worker plane
- three defects that made the worker plane unreachable were found and fixed:
  the dispatcher crashed on start (TypeScript parameter properties are not
  supported by `node --experimental-strip-types`), never loaded .env.local, and
  read an empty queue as a leased job (a NULL composite row is a non-null JS
  object), failing every poll with 22P02 and stalling the whole queue;
- npm run e2e:controlled PASSED 18/18 boundaries against live Supabase:
  approval required, trusted-plane capability grant provisioned and tool-scoped
  and time-bounded, authorization bound to the argument hash, job freezes a
  validated worker contract, attempt leases and finishes SUCCEEDED with the
  worker's correlation id, CONTROLLED action finalized COMPLETED, result
  recorded as a CONTROLLED_EXECUTION Observation, and no worker-only claim
  reaches VERIFIED without human adjudication;
- live job/attempt counts moved from 0 to 12 SUCCEEDED, and
  MECHANICAL_ATTEMPT_RESULT observations from 0 to 15;
- 67/67 unit tests (3 new pin the empty-queue regression), typecheck, lint, and
  build clean.

Still NOT established by any of the above:
- production (Vercel) verification — the deployment URL is known
  (https://stryde-oafog1qrx-abdhaseebtech-5772s-projects.vercel.app, Preview for
  the verified commit) and Vercel reports success, but every route returns 401
  "Protected deployment" with vercel_auth_enabled: true. No runtime behavior,
  environment variable, or user flow can be inspected without an authenticated
  Vercel account;
- a REAL worker agent executing a real job. The CONTROLLED plane around it is
  proven end to end; the executor behind it is a contract stub
  (scripts/worker-stub.ts) implementing the lib/worker-gateway.ts HTTP contract;
- model quality under sustained production load: the only usable provider in
  this environment is rate-limited or unfunded.

## Verification rule

Stryde should progressively remove verification work from the user when a reliable observation path exists. User reporting is a reality input, not an obligation to manually adjudicate facts that the system can establish itself.

