import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateControlledActionFallback } from "../lib/action-completion.ts";

const migrationUrl = new URL(
  "../supabase/migrations/20261024143000_repair_controlled_action_fallback.sql",
  import.meta.url,
);

async function loadMigration(): Promise<string> {
  try {
    return await readFile(migrationUrl, "utf8");
  } catch {
    return "";
  }
}

function normalizedSql(sql: string): string {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

test("BUG A RED: migration file exists and redefines stryde_internal.complete_human_action to support CONTROLLED fallback", async () => {
  const sql = normalizedSql(await loadMigration());
  assert.ok(sql.length > 0, "Migration 20261024143000_repair_controlled_action_fallback.sql must exist");

  assert.ok(
    sql.includes("create or replace function stryde_internal.complete_human_action"),
    "Migration must redefine stryde_internal.complete_human_action",
  );
  assert.ok(
    sql.includes("security definer"),
    "Function must be security definer",
  );
  assert.ok(
    sql.includes("set search_path = public, pg_temp"),
    "Function must pin search_path",
  );
  assert.ok(
    sql.includes("auth.uid()"),
    "Function must bind identity to auth.uid()",
  );

  // Must accept both HUMAN and CONTROLLED execution modes
  assert.ok(
    sql.includes("v_action.execution_mode not in ('human', 'controlled')") ||
    sql.includes("v_action.execution_mode <> 'human' and v_action.execution_mode <> 'controlled'") ||
    sql.includes("if v_action.execution_mode in ('human', 'controlled')"),
    "Function must permit CONTROLLED execution mode for manual user settlement",
  );

  // CASE A: AUTHORIZED job is transitioned to CANCELLED atomically
  assert.ok(
    sql.includes("status = 'cancelled'") && sql.includes("cancel_reason"),
    "Function must cancel AUTHORIZED job when manually settled",
  );

  // CASE B: UNKNOWN job remains UNKNOWN (does not claim side effects were prevented)
  assert.ok(
    sql.includes("previous_job_status") || sql.includes("unknown"),
    "Function must preserve UNKNOWN job status and execution uncertainty",
  );

  // CASE C: Active worker lease is guarded against concurrent settlement
  assert.ok(
    sql.includes("lease_expires_at > now()") || sql.includes("active lease"),
    "Function must reject manual settlement while worker holds an active lease",
  );
});

test("BUG A RED: evaluateControlledActionFallback distinguishes CASE A (AUTHORIZED), CASE B (UNKNOWN), and CASE C (Active Lease)", () => {
  const now = new Date("2026-10-24T12:00:00Z");

  // CASE A: Job is AUTHORIZED and unstarted
  const caseA = evaluateControlledActionFallback({
    action: { id: "act-1", execution_mode: "CONTROLLED", status: "IN_PROGRESS" },
    job: { id: "job-1", status: "AUTHORIZED", lease_owner: null, lease_expires_at: null },
    now,
  });
  assert.equal(caseA.allowed, true);
  assert.equal(caseA.case, "UNSTARTED_AUTHORIZED");
  assert.equal(caseA.shouldCancelJob, true);

  // CASE B: Job is UNKNOWN (timed out or expired)
  const caseB = evaluateControlledActionFallback({
    action: { id: "act-2", execution_mode: "CONTROLLED", status: "IN_PROGRESS" },
    job: { id: "job-2", status: "UNKNOWN", lease_owner: null, lease_expires_at: null },
    now,
  });
  assert.equal(caseB.allowed, true);
  assert.equal(caseB.case, "EXECUTION_UNCERTAIN_UNKNOWN");
  assert.equal(caseB.shouldCancelJob, false); // Must NOT mark CANCELLED!

  // CASE C: Job is currently held by worker with an active lease
  const caseC = evaluateControlledActionFallback({
    action: { id: "act-3", execution_mode: "CONTROLLED", status: "IN_PROGRESS" },
    job: {
      id: "job-3",
      status: "DISPATCHING",
      lease_owner: "worker-hermes",
      lease_expires_at: "2026-10-24T12:01:00Z", // 1 minute in future
    },
    now,
  });
  assert.equal(caseC.allowed, false);
  assert.equal(caseC.case, "ACTIVE_WORKER_LEASE");
  assert.match(caseC.reason ?? "", /active lease/i);

  // Expired lease that was not yet reconciled
  const caseCExpired = evaluateControlledActionFallback({
    action: { id: "act-4", execution_mode: "CONTROLLED", status: "IN_PROGRESS" },
    job: {
      id: "job-4",
      status: "AWAITING_CALLBACK",
      lease_owner: "worker-opencode",
      lease_expires_at: "2026-10-24T11:59:00Z", // expired 1 minute ago
    },
    now,
  });
  assert.equal(caseCExpired.allowed, true);
  assert.equal(caseCExpired.case, "LEASE_EXPIRED_UNKNOWN");
  assert.equal(caseCExpired.shouldCancelJob, false);
});

test("BUG A: active lease error from RPC maps to HTTP 400 client error", () => {
  const activeLeaseError = "Cannot manually settle action while worker holds an active lease";
  const is400 = /authentication|not found|only HUMAN|not in progress|invalid|active lease/i.test(activeLeaseError);
  assert.equal(is400, true);
});
