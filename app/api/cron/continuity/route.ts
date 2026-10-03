import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  continuityTurnKeyToUuid,
  NUDGE_MARKER_KIND,
  NUDGE_MARKER_LOOKBACK_MS,
  NUDGEABLE_ACTION_STATUSES,
  planContinuityNudges,
  type ContinuityAction,
  type ContinuitySession,
} from "@/lib/continuity";
import { reconcileExpiredJob } from "@/lib/execution-control";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

// Proactive continuity cron. Runs with no user session, so its authority is
// deliberately tiny:
//   1. Reconcile worker Jobs whose lease has already expired (safety net for a
//      dead dispatcher; the RPC only flips already-expired leases to UNKNOWN —
//      it grants no new authority and creates nothing).
//   2. Post a SYSTEM-authored continuity message into an existing ACTIVE
//      conversation. Nothing else is written: no working_state changes, no
//      Actions, Decisions, Claims, or capability grants, no model calls.
//
// Idempotent per pursuit per day: the physical turn_key is derived
// deterministically from the pursuit and the UTC day, and the
// conversation_message_assistant_turn_key_idx unique index collapses any
// double-run on the same session (code 23505 is treated as "already nudged").

// Upper bound on the safety net per run. Expired leases are rare when the
// dispatcher is healthy; if the backlog is larger, the next run catches up.
const RECONCILE_BATCH_LIMIT = 100;

// One ACTIVE conversation per pursuit (conversation_session_one_active_idx),
// so the per-session "latest message" lookups stay bounded by pursuit count.
const MAX_SESSION_LOOKUPS = 200;

function isCronAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  // Fail closed: without a configured secret the cron must not exist at all.
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const provided = header.slice(prefix.length);
  // Same timing-safe pattern as lib/internal-worker-auth.ts.
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

async function reconcileExpiredJobs(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("job")
    .select("id")
    .in("status", ["DISPATCHING", "AWAITING_CALLBACK"])
    .lt("lease_expires_at", new Date().toISOString())
    .limit(RECONCILE_BATCH_LIMIT);
  if (error) throw new Error(`Unable to list expired worker leases: ${error.message}`);

  let reconciled = 0;
  for (const job of data ?? []) {
    try {
      await reconcileExpiredJob(supabase, job.id);
      reconciled += 1;
    } catch (reconcileError) {
      // One bad job must not starve the rest, nor the nudges behind it.
      console.error(`[cron/continuity] reconcile failed for job ${job.id}:`, reconcileError);
    }
  }
  return reconciled;
}

async function latestMessageAt(supabase: SupabaseClient, sessionId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("conversation_message")
    .select("created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Unable to read conversation history: ${error.message}`);
  return (data?.[0]?.created_at as string | undefined) ?? null;
}

async function nextSequenceNo(supabase: SupabaseClient, sessionId: string): Promise<number> {
  // Same generation rule as the conversation RPCs (migration 20260926180000):
  // max(sequence_no) + 1 per session, guarded by unique (session_id, sequence_no).
  const { data, error } = await supabase
    .from("conversation_message")
    .select("sequence_no")
    .eq("session_id", sessionId)
    .order("sequence_no", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Unable to read conversation sequence: ${error.message}`);
  const highest = data?.[0]?.sequence_no;
  return (typeof highest === "number" ? highest : 0) + 1;
}

async function nudgePursuits(supabase: SupabaseClient, now: Date): Promise<{ count: number; pursuitIds: string[] }> {
  const [actionsResult, sessionsResult, nudgesResult] = await Promise.all([
    supabase
      .from("action")
      // No started_at exists on action (v1 persistence migration); updated_at
      // is the freshness reference the planner falls back to.
      .select("id, pursuit_id, execution_mode, status, updated_at")
      // WAITING_EXTERNAL cannot occur in action.status today (the column check
      // allows PROPOSED/IN_PROGRESS/COMPLETED/FAILED/CANCELLED); including it
      // keeps the query honest with the planning rule at zero cost.
      .in("status", [...NUDGEABLE_ACTION_STATUSES]),
    supabase
      .from("conversation_session")
      .select("id, pursuit_id, owner_user_id, working_state, updated_at")
      .eq("status", "ACTIVE"),
    supabase
      .from("conversation_message")
      .select("session_id, created_at")
      .contains("metadata", { kind: NUDGE_MARKER_KIND })
      .gte("created_at", new Date(now.getTime() - NUDGE_MARKER_LOOKBACK_MS).toISOString()),
  ]);

  if (actionsResult.error) throw new Error(`Unable to list in-flight tasks: ${actionsResult.error.message}`);
  if (sessionsResult.error) throw new Error(`Unable to list conversations: ${sessionsResult.error.message}`);
  if (nudgesResult.error) throw new Error(`Unable to list earlier nudges: ${nudgesResult.error.message}`);

  const sessions = (sessionsResult.data ?? []) as Array<{
    id: string;
    pursuit_id: string;
    owner_user_id: string;
    working_state: unknown;
    updated_at: string;
  }>;

  const pursuitBySession = new Map<string, string>();
  const sessionInputs: ContinuitySession[] = [];
  for (const session of sessions.slice(0, MAX_SESSION_LOOKUPS)) {
    pursuitBySession.set(session.id, session.pursuit_id);
    sessionInputs.push({
      id: session.id,
      pursuitId: session.pursuit_id,
      lastMessageAt: await latestMessageAt(supabase, session.id),
      workingState: (session.working_state ?? null) as ContinuitySession["workingState"],
    });
  }

  const actionInputs: ContinuityAction[] = (actionsResult.data ?? []).map((row) => {
    const action = row as {
      id: string;
      pursuit_id: string;
      execution_mode: string;
      status: string;
      updated_at: string;
    };
    return {
      id: action.id,
      pursuitId: action.pursuit_id,
      kind: action.execution_mode === "CONTROLLED" ? "CONTROLLED" : "HUMAN",
      status: action.status,
      updatedAt: action.updated_at,
    };
  });

  const recentNudges = (nudgesResult.data ?? [])
    .map((row) => {
      const nudge = row as { session_id: string; created_at: string };
      const pursuitId = pursuitBySession.get(nudge.session_id);
      return pursuitId ? { pursuitId, createdAt: nudge.created_at } : null;
    })
    .filter((nudge): nudge is { pursuitId: string; createdAt: string } => nudge !== null);

  const plans = planContinuityNudges({ now, actions: actionInputs, sessions: sessionInputs, recentNudges });

  const nudgedPursuitIds: string[] = [];
  for (const plan of plans) {
    const session = sessions.find((candidate) => candidate.id === plan.sessionId);
    if (!session) continue;
    try {
      const { error: insertError } = await supabase.from("conversation_message").insert({
        session_id: plan.sessionId,
        owner_user_id: session.owner_user_id,
        role: "STRYDE",
        content: plan.message,
        sequence_no: await nextSequenceNo(supabase, plan.sessionId),
        turn_key: continuityTurnKeyToUuid(plan.turnKey),
        metadata: { kind: NUDGE_MARKER_KIND, turn_key: plan.turnKey, author: "SYSTEM" },
      });
      if (insertError) {
        // 23505 = unique_violation. On (session_id, turn_key) that is a same-day
        // re-run: the nudge already exists, which is success for idempotency.
        if (insertError.code === "23505") continue;
        throw new Error(`Unable to post continuity message: ${insertError.message}`);
      }
      nudgedPursuitIds.push(plan.pursuitId);
    } catch (nudgeError) {
      console.error(`[cron/continuity] nudge failed for pursuit ${plan.pursuitId}:`, nudgeError);
    }
  }

  return { count: nudgedPursuitIds.length, pursuitIds: nudgedPursuitIds };
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const supabase = getSupabaseServiceClient();
    const now = new Date();
    const reconciled = await reconcileExpiredJobs(supabase);
    const nudged = await nudgePursuits(supabase, now);
    return NextResponse.json({ nudged: nudged.count, pursuits: nudged.pursuitIds, reconciled });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Continuity run failed";
    console.error("[cron/continuity]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
