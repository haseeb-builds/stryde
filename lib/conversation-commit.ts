import type { ConversationTurn } from "@/lib/model-gateway";
import type { WorkingState } from "@/lib/work-controller";

export function createConversationCommitter(input: {
  commit: (turn: ConversationTurn, work: WorkingState) => Promise<void>;
}) {
  let committed = false;
  let inFlight = false;

  return async (turn: ConversationTurn, work: WorkingState): Promise<boolean> => {
    if (committed || inFlight) return false;
    inFlight = true;
    try {
      await input.commit(turn, work);
      committed = true;
    } finally {
      inFlight = false;
    }
    return true;
  };
}
