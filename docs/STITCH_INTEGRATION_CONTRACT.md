# Stryde Google Stitch Integration Contract

**Status:** Canonical Implementation & Architecture Boundary for Stitch Exports  
**Author:** Chief of Staff / Principal Software Engineer  
**Target Audience:** Founder / Design Integrator / Engineering Agent  
**Repository:** `haseeb-builds/stryde`  
**Base Commit / Ref:** `fix/conversation-turn-reliability`  

---

## 1. Overview & Integration Philosophy

This contract defines the strict engineering boundaries for integrating UI components exported from **Google Stitch** into the Stryde codebase.

Stryde's backend engine, data contracts, security rules, and verification pipelines are completely frozen and verified (342/342 passing tests). Google Stitch visual exports must serve as **skin and interaction upgrades** to the existing components, preserving 100% of the underlying API contracts, state hooks, and authentication flows.

---

## 2. Component & File Boundary Map

| Existing File Path | Component Responsibility | What Stitch CAN Change | What Stitch CANNOT Change |
| :--- | :--- | :--- | :--- |
| `app/page.tsx` | Landing, Auth (Sign-in/Sign-up), Pursuit List & Intake | Layout, typography, card styling, spacing, error toast design | Supabase auth calls (`signInWithPassword`, `signUp`), API call to `POST /api/v1/pursuits`, form submit logic |
| `app/pursuits/[id]/page.tsx` | Pursuit Workspace Orchestration | Chat stream layout, working state card design, sticky composer styling | SSE reader (`consumeConversationStream`), `POST /conversation`, `POST /actions/start`, `POST /actions/[id]/complete` |
| `app/pursuits/[id]/work-panels.tsx` | Working State & Action Cards | Card styling, status chips, badge colors, typography, progress visuals | Action payload schema (`title`, `actor`, `execution_mode`), `onActionStatusRequest`, manual completion handler |
| `app/pursuits/[id]/claims-panel.tsx` | Evidence & Claims Drawer | Drawer styling, claim status badges, quote snippet formatting | `POST /api/v1/claims`, `POST /api/v1/claims/[id]/observations`, observation retrieval mapping |
| `app/pursuits/[id]/artifacts-panel.tsx` | Generated Artifacts Panel | Code block styling, markdown formatting, revision history UI | `GET /api/v1/artifacts`, revision selection, diff viewing logic |

---

## 3. Strict State & Data Type Contracts

When updating React JSX and Tailwind classes from Stitch, the following TypeScript interfaces (from `lib/work-controller.ts`, `lib/pursuit-store.ts`, and `lib/source-citation.ts`) must be preserved without renaming fields:

### A. Working State (`WorkingState`)
```typescript
interface WorkingState {
  status: "WAITING_USER" | "WAITING_EXTERNAL" | "IN_PROGRESS" | "RESOLVED" | "BLOCKED" | "ARCHIVED";
  understanding: string;
  bottleneck: string | null;
  known: string[];
  unknowns: string[];
  next_move: {
    title: string;
    description: string;
    actor: "HUMAN" | "WORKER" | "SYSTEM";
    execution_mode: "MANUAL" | "CONTROLLED" | "SUPERVISED" | "AUTOMATIC";
    mode: "CREATE_ACTION" | "RESEARCH_WEB" | "VERIFY_WEB" | "ASK_USER" | "WAIT_EXTERNAL";
    action_type?: string;
    params?: Record<string, unknown>;
  } | null;
}
```

### B. Conversation Turn Payload (`ConversationTurn`)
```typescript
interface ConversationTurn {
  message: string;
  question: string | null;
  options: Array<{
    label: string;
    description?: string;
    value: string;
  }>;
  ready_for_reasoning: boolean;
  focus: string | null;
  work: WorkingState;
  autonomous_research?: {
    query: string;
    provider: string;
    results: unknown[];
  } | null;
}
```

### C. Observation Option Format (`PursuitObservationRecord`)
```typescript
interface PursuitObservationRecord {
  id: string;
  observation_kind: string; // e.g., "HUMAN_ACTION_RESULT", "WEB_SEARCH_RESULT", "URL_VERIFICATION"
  content: unknown;
  observed_at: string;
  source_type: string | null;
  source_reference: string | null;
  source_metadata?: unknown;
}
```

---

## 4. Key Interaction Behaviors that MUST NOT Break

1. **Non-Trapping Worker Action Cards:**  
   The UI must always expose "I'm done" and "I'm blocked" manual completion buttons, even when `execution_mode === "CONTROLLED"`. Never hide completion buttons behind background daemons that may not be running.
2. **Conversation Stream Buffering:**  
   The conversation route buffers structured JSON until complete schema validation finishes, then emits SSE chunks. The UI must show *"Stryde is working through it…"* while waiting, and smoothly render the completed message and option chips.
3. **Voice Input Integration:**  
   The microphone icon in the universal composer connects to browser `SpeechRecognition` (`window.webkitSpeechRecognition`). Preserve the `listening` state toggle and interim transcript accumulation.
4. **File Attachment Pipeline:**  
   File uploads dispatch a `multipart/form-data` POST to `/api/v1/pursuits/[id]/sources`. Preserve the file size boundary (10MB) and progress feedback.
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
