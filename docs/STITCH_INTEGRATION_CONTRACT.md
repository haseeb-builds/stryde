# Stryde Google Stitch Integration Contract

**Status:** Canonical Implementation & Architecture Boundary for Stitch Exports  
**Author:** Chief of Staff / Principal Software Engineer  
**Target Audience:** Founder / Design Integrator / Engineering Agent  
**Repository:** `haseeb-builds/stryde`  
**Base Ref:** `fix/conversation-turn-reliability`  

---

## 1. Overview & Integration Philosophy

This contract defines the strict engineering boundaries for integrating UI components exported from **Google Stitch** into the Stryde codebase.

Stryde's backend engine, data contracts, security rules, and verification pipelines are frozen and verified (342/342 passing tests). Google Stitch visual exports must serve as **skin, layout, and visual interaction upgrades** to the existing components, preserving 100% of the underlying API contracts, state hooks, and authentication flows.

> [!IMPORTANT]
> **Source of Truth Rules:**
> - All interfaces documented below are ground truth from active TypeScript modules (`lib/work-controller.ts`, `lib/actor.ts`, `lib/model-gateway.ts`, `lib/source-citation.ts`, `lib/pursuit-observations.ts`).
> - Do not reference or introduce fictional helper modules (such as `lib/pursuit-store.ts`, which does not exist in the codebase).

---

## 2. Component & File Boundary Map

| Existing File Path | Component Responsibility | What Stitch CAN Change | What Stitch CANNOT Change |
| :--- | :--- | :--- | :--- |
| `app/page.tsx` | Landing, Auth (Sign-in/Sign-up), Pursuit List & Intake | Layout, typography, card styling, spacing, empty states, error toast visuals | Supabase auth calls (`signInWithPassword`, `signUp`, `signOut`), API calls to `GET /api/v1/pursuits` and `POST /api/v1/pursuits`, form submit logic |
| `app/pursuits/[id]/page.tsx` | Pursuit Workspace Orchestration | Chat stream layout, working state card design, sticky composer styling, drawer containers | SSE reader (`consumeConversationStream`), `POST /conversation`, `POST /actions/start`, `POST /actions/delegate-worker`, `POST /actions/[id]/complete`, `GET /actions?status=IN_PROGRESS` |
| `app/pursuits/[id]/work-panels.tsx` | Working State & Action Cards | Card styling, status chips, badge colors, typography, progress visuals | Action payload schema (`title`, `actor`, `worker_type`, `mode`), `onActionStatusRequest`, manual completion handler, `/sources`, `/research`, and `/work` API calls |
| `app/pursuits/[id]/claims-panel.tsx` | Evidence & Claims Drawer | Drawer styling, claim status badges, quote snippet formatting, dropdown design | `GET /api/v1/claims`, `POST /api/v1/claims`, `GET /api/v1/pursuits/[id]/observations`, `POST /api/v1/claims/[id]/observations`, observation retrieval mapping |
| `app/pursuits/[id]/artifacts-panel.tsx` | Generated Artifacts Panel | Code block styling, markdown formatting, revision history UI | `GET /api/v1/artifacts`, revision selection, diff viewing logic |
| `app/pursuits/[id]/autonomy-row.tsx` | Autonomy Policy Controls | Toggle styling, slider design, visual indicators | `GET /api/v1/autonomy-policy`, `PUT /api/v1/autonomy-policy` |
| `app/pursuits/[id]/memory-panel.tsx` | Memory & Learning Drawer | Memory list styling, category badges, importance score visuals | `GET /api/v1/memory`, candidate confirmation / forget API calls |
| `app/pursuits/[id]/skills-panel.tsx` | Capability Registry & Skills | Tool icon styling, availability chips, description layout | `GET /api/v1/skills` |

---

## 3. Strict State & Data Type Contracts

When updating React JSX and Tailwind classes from Stitch, the following TypeScript interfaces and types from active modules must be preserved without renaming fields:

### A. Working State & Next Move (`lib/work-controller.ts`, `lib/actor.ts`)

```typescript
export type WorkStatus =
  | "DISCOVERING"
  | "READY"
  | "WAITING_USER"
  | "WORKING"
  | "WAITING_EXTERNAL"
  | "COMPLETE"
  | "STALLED";

export type WorkMode =
  | "ASK_USER"
  | "RESEARCH_WEB"
  | "RETRIEVE_SOURCE"
  | "ANALYZE"
  | "DRAFT"
  | "DECIDE"
  | "CREATE_ACTION"
  | "EXECUTE_TOOL"
  | "WAIT"
  | "RECHECK"
  | "STOP"
  | "VERIFY_WEB";

export type ActorType = "HUMAN" | "STRYDE" | "WORKER" | "CONTROLLED_TOOL";
export type WorkerType = "HERMES" | "OPENCODE" | "BROWSER" | "MCP";

export type NextMove = {
  mode: WorkMode;
  actor: ActorType;
  worker_type: WorkerType | null;
  title: string;
  why: string;
  expected_change: string;
  stryde_can_do: string;
  user_needs_to_do: string;
  completion_condition: string;
  verify?: {
    claim_id: string;
    url: string;
    expect_text: string;
  } | null;
  tool_call?: {
    server: string;
    tool: string;
    arguments: Record<string, unknown>;
  } | null;
};

export type WorkingState = {
  version: 1;
  status: WorkStatus;
  objective: string | null;
  understanding: string;
  known: string[];
  unknowns: string[];
  bottleneck: string | null;
  next_move: NextMove | null;
};
```

### B. Conversation Turn & Options (`lib/model-gateway.ts`)

```typescript
export type ConversationOption = {
  label: string;
  value: string;
};

export type ConversationInputClass =
  | "MESSAGE"
  | "QUESTION"
  | "CORRECTION"
  | "PROGRESS"
  | "DECISION";

export type ConversationMemoryCandidate = {
  scope: "USER" | "PURSUIT";
  memory_type:
    | "FACT"
    | "CONSTRAINT"
    | "PREFERENCE"
    | "DECISION"
    | "COMMITMENT"
    | "EXPERIENCE"
    | "PATTERN"
    | "GOAL";
  content: string;
  confidence: number;
  importance: number;
  revises_memory_ids: string[];
};

export type ConversationTurn = {
  message: string;
  question: string | null;
  options: ConversationOption[];
  ready_for_reasoning: boolean;
  focus: string | null;
  input_class: ConversationInputClass;
  memory_candidates: ConversationMemoryCandidate[];
  work: WorkingState;
};
```

### C. Server-Sent Events (SSE) Stream Protocol (`lib/model-gateway.ts`, `lib/conversation-client-stream.ts`)

```typescript
export type ConversationStreamEvent =
  | { type: "message_delta"; content: string }
  | { type: "complete"; turn: ConversationTurn; provider: string; model: string }
  | { type: "error"; message: string };

// Client consumption signature:
export async function consumeConversationStream<T>(
  response: Response,
  onDelta: (content: string) => void,
  onComplete: (turn: T) => void,
): Promise<T>;
```

### D. Observation Retrieval & Claims Selection (`lib/pursuit-observations.ts`)

```typescript
export type PursuitObservationRecord = {
  id: string;
  observation_kind: string; // e.g. "HUMAN_ACTION_RESULT", "WEB_SEARCH_RESULT", "URL_VERIFICATION"
  content: unknown;
  observed_at: string;
  source_type: string | null;
  source_reference: string | null;
  source_metadata?: unknown;
};

// Selection predicate and label formatter for UI dropdowns:
export function isSelectableObservationForClaim(obs: { observation_kind?: string }): boolean;
export function formatObservationOptionLabel(obs: {
  observation_kind: string;
  observed_at: string;
}): string;
```

### E. Source Citation Record (`lib/source-citation.ts`)

```typescript
export type SourceCitation = {
  source_content_sha256: string;
  locator: {
    type: "CHARACTER_RANGE";
    start: number;
    end: number;
    located: boolean;
  };
  excerpt: string;
  basis: "EXPLICIT_SOURCE" | "INFERRED";
};
```

### F. Action Completion Payload (`POST /api/v1/pursuits/[id]/actions/[actionId]/complete`)

```typescript
export type ActionCompletionRequest = {
  session_id: string;
  terminal_status: "COMPLETED" | "FAILED";
  report: string;
  turn_key: string;
};
```

---

## 4. Key Interaction Behaviors that MUST NOT Break

1. **Non-Trapping Worker Action Cards:**  
   The UI must always expose "I'm done" and "I'm blocked" manual completion buttons, even when `next_move.actor === "WORKER"` or move is queued. Never hide completion buttons behind background daemons that may not be running.
2. **Conversation Stream Buffering & Pending State:**  
   The conversation route buffers structured JSON until complete schema validation finishes, then emits SSE chunks. The UI must show *"Stryde is working through it…"* while waiting, and smoothly render the completed message and option chips.
3. **Voice Input Integration:**  
   The microphone icon in the universal composer connects to browser `SpeechRecognition` (`window.webkitSpeechRecognition` or `window.SpeechRecognition`). Preserve the `listening` state toggle and interim transcript accumulation.
4. **Source Ingestion Pipeline:**  
   The source panel supports URL extraction and direct pasted text via `POST /api/v1/pursuits/[id]/sources`. Preserve validation states and error messages.
5. **Keyboard Accessibility:**  
   The composer must support `Enter` to send (when not holding `Shift`) and accessible button focus rings (`focus-visible:ring-2`).

---

## 5. Post-Import Verification & Diff Process

Immediately after integrating Stitch UI exports into the repository, execute this exact mechanical verification sequence:

```bash
# 1. Inspect git diff to ensure no backend files, routes, or tests were accidentally touched
git diff --stat app/api/ lib/ tests/ supabase/

# 2. Run TypeScript compilation to verify all prop and state types match
npx tsc --noEmit

# 3. Run ESLint to verify style and syntax compliance
npm run lint

# 4. Run the full unit & regression test suite (342+ tests must remain green)
node --experimental-strip-types --test tests/**/*.test.ts

# 5. Verify clean Next.js Turbopack production build
npm run build
```

Any compilation error or broken test indicates an inadvertent contract change that must be reverted to match this specification before proceeding to release.
