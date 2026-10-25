// Trigger engine (Phase 9): evaluates due triggers and turns them into jobs
// on the EXISTING controlled-execution infrastructure. There is no second
// orchestration system here — a trigger that wins its condition window
// merely enqueues the same work the authorization-commit path already
// governs. Triggers never grant authority and never bypass the resource
// plane: the enqueued job's execution reserves budget like any other.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WORKER_TYPES, type WorkerType } from "./actor.ts";
import { checkWorkerDelegation, loadAutonomyPolicy } from "./autonomy-policy.ts";
import { recordNotification } from "./notifications.ts";
import { reserveResources } from "./resource-control.ts";
import { parseWorkerJobArguments, workerToolKey } from "./worker-contract.ts";

export type TriggerRow = {
  id: string;
  owner_user_id: string;
  pursuit_id: string | null;
  name: string;
  trigger_kind: "ONE_TIME" | "RECURRING" | "EVENT" | "STATE" | "MONITOR";
  condition: {
    fire_at?: string;
    interval_minutes?: number;
    event_entity?: string;
    event_type?: string;
    blocked_days?: number;
    watch_uri?: string;
    expect_text?: string;
  } | null;
  action: Record<string, unknown>;
  status: "ACTIVE" | "PAUSED" | "FIRED" | "CANCELLED";
  last_fired_at: string | null;
  next_fire_at: string | null;
  max_fires: number | null;
  fire_count: number;
};

export type DueTrigger = {
  trigger: TriggerRow;
  windowKey: string;
};

export type FiredTriggerOutcome = {
  id: string;
  name: string;
  windowKey: string;
  outcome: "JOB_ENQUEUED" | "NOTIFIED" | "POLICY_REFUSED" | "BUDGET_EXHAUSTED" | "SKIPPED";
  jobId: string | null;
};

// Pure condition evaluation — unit-testable without a database.
export function isDue(
  trigger: TriggerRow,
  now: Date,
  context: { pursuitUpdatedAt?: string | null; inFlightAction?: boolean; recentEvent?: { entity_type: string; event_type: string; occurred_at: string } | null },
): { due: boolean; windowKey: string; reason: string } {
  const dayWindow = now.toISOString().slice(0, 10);
  switch (trigger.trigger_kind) {
    case "ONE_TIME": {
      const fireAt = trigger.next_fire_at ?? trigger.condition?.fire_at ?? null;
      if (!fireAt) return { due: false, windowKey: dayWindow, reason: "no fire time" };
      return {
        due: new Date(fireAt).getTime() <= now.getTime() && trigger.fire_count === 0,
        windowKey: "once",
        reason: "one-time schedule reached",
      };
    }
    case "RECURRING": {
      const interval = Math.max(trigger.condition?.interval_minutes ?? 1440, 1);
      const last = trigger.last_fired_at ? new Date(trigger.last_fired_at).getTime() : 0;
      const next = trigger.next_fire_at ? new Date(trigger.next_fire_at).getTime() : null;
      const due = now.getTime() - last >= interval * 60_000 || (next !== null && now.getTime() >= next);
      return { due, windowKey: dayWindow, reason: `interval ${interval}m` };
    }
    case "EVENT": {
      const event = context.recentEvent;
      const matches = Boolean(
        event
        && (!trigger.condition?.event_entity || event.entity_type === trigger.condition.event_entity)
        && (!trigger.condition?.event_type || event.event_type === trigger.condition.event_type),
      );
      return { due: matches, windowKey: dayWindow, reason: matches ? `event ${event?.entity_type}/${event?.event_type}` : "no matching event" };
    }
    case "STATE": {
      const blockedDays = trigger.condition?.blocked_days ?? 3;
      if (context.inFlightAction) return { due: false, windowKey: dayWindow, reason: "action already in flight" };
      const updated = context.pursuitUpdatedAt ? new Date(context.pursuitUpdatedAt).getTime() : 0;
      const due = now.getTime() - updated >= blockedDays * 86_400_000;
      return { due, windowKey: dayWindow, reason: due ? `no movement for ${blockedDays}d` : "pursuit recently active" };
    }
    case "MONITOR": {
      // Monitoring fires through the normal capability path (a VERIFY_WEB-style
      // check of the watched URI). The cron marks it due once per window; the
      // observation comparison happens in the executing job, not here.
      const last = trigger.last_fired_at ? new Date(trigger.last_fired_at).getTime() : 0;
      const interval = Math.max(trigger.condition?.interval_minutes ?? 1440, 60);
      return { due: now.getTime() - last >= interval * 60_000, windowKey: dayWindow, reason: "monitor interval reached" };
    }
  }
}

// Pure parser for a trigger's action payload so tests can verify worker job
// construction vs notification fallback without a live database.
export function planTriggerDispatch(
  trigger: TriggerRow,
  windowKey: string,
):
  | { kind: "worker_job"; workerType: WorkerType; toolKey: string; intentSummary: string; jobArgs: ReturnType<typeof parseWorkerJobArguments> }
  | { kind: "notification"; title: string; body: string } {
  const action = trigger.action ?? {};
  const rawWorkerType = typeof action.worker_type === "string" ? action.worker_type.trim().toUpperCase() : "";
  const isWorker = (WORKER_TYPES as readonly string[]).includes(rawWorkerType);

  if (isWorker && trigger.pursuit_id) {
    const workerType = rawWorkerType as WorkerType;
    const rawInstruction = typeof action.instruction === "string" && action.instruction.trim()
      ? action.instruction.trim()
      : trigger.name;
    const rawContext = typeof action.context === "object" && action.context !== null && !Array.isArray(action.context)
      ? (action.context as Record<string, unknown>)
      : {};
    const idempotencyKey = `stryde-trigger-${trigger.id}-${windowKey}`;
    const jobArgs = parseWorkerJobArguments({
      worker_type: workerType,
      instruction: rawInstruction,
      context: {
        ...rawContext,
        pursuit_id: trigger.pursuit_id,
        trigger_id: trigger.id,
        trigger_name: trigger.name,
        window_key: windowKey,
      },
      idempotency_key: idempotencyKey,
    });
    const intentSummary = typeof action.title === "string" && action.title.trim()
      ? action.title.trim().slice(0, 2000)
      : `Triggered work: ${trigger.name}`.slice(0, 2000);
    return {
      kind: "worker_job",
      workerType,
      toolKey: workerToolKey(workerType),
      intentSummary,
      jobArgs,
    };
  }

  const message = typeof action.message === "string" && action.message.trim()
    ? action.message.trim()
    : typeof action.instruction === "string" && action.instruction.trim()
      ? action.instruction.trim()
      : `Scheduled trigger "${trigger.name}" fired.`;
  return {
    kind: "notification",
    title: `Trigger fired: ${trigger.name}`.slice(0, 300),
    body: message.slice(0, 4000),
  };
}

async function resolveTriggerContext(
  service: SupabaseClient,
  trigger: TriggerRow,
  now: Date,
): Promise<{ pursuitUpdatedAt: string | null; inFlightAction: boolean; recentEvent: { entity_type: string; event_type: string; occurred_at: string } | null }> {
  let pursuitUpdatedAt: string | null = null;
  let inFlightAction = false;
  let recentEvent: { entity_type: string; event_type: string; occurred_at: string } | null = null;

  if (trigger.pursuit_id && (trigger.trigger_kind === "STATE" || trigger.trigger_kind === "EVENT")) {
    const { data: pursuit } = await service
      .from("pursuit")
      .select("updated_at")
      .eq("id", trigger.pursuit_id)
      .eq("owner_user_id", trigger.owner_user_id)
      .maybeSingle();
    pursuitUpdatedAt = (pursuit as { updated_at?: string } | null)?.updated_at ?? null;

    const { data: activeAction } = await service
      .from("action")
      .select("id")
      .eq("pursuit_id", trigger.pursuit_id)
      .eq("owner_user_id", trigger.owner_user_id)
      .eq("status", "IN_PROGRESS")
      .limit(1)
      .maybeSingle();
    inFlightAction = Boolean(activeAction);
  }

  if (trigger.trigger_kind === "EVENT") {
    const since = trigger.last_fired_at ?? new Date(now.getTime() - 86_400_000).toISOString();
    let query = service
      .from("event")
      .select("entity_type, event_type, occurred_at")
      .eq("owner_user_id", trigger.owner_user_id)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(1);
    if (trigger.condition?.event_entity) {
      query = query.eq("entity_type", trigger.condition.event_entity);
    }
    if (trigger.condition?.event_type) {
      query = query.eq("event_type", trigger.condition.event_type);
    }
    const { data: ev } = await query.maybeSingle();
    if (ev) {
      recentEvent = ev as { entity_type: string; event_type: string; occurred_at: string };
    }
  }

  return { pursuitUpdatedAt, inFlightAction, recentEvent };
}

async function dispatchFiredTrigger(
  service: SupabaseClient,
  trigger: TriggerRow,
  windowKey: string,
): Promise<{ outcome: FiredTriggerOutcome["outcome"]; jobId: string | null }> {
  let plan: ReturnType<typeof planTriggerDispatch>;
  try {
    plan = planTriggerDispatch(trigger, windowKey);
  } catch {
    await service
      .from("trigger_firing")
      .update({ outcome: "SKIPPED" })
      .eq("trigger_id", trigger.id)
      .eq("window_key", windowKey);
    return { outcome: "SKIPPED", jobId: null };
  }

  if (plan.kind === "notification") {
    await recordNotification(service, {
      ownerUserId: trigger.owner_user_id,
      pursuitId: trigger.pursuit_id,
      title: plan.title,
      body: plan.body,
      linkPath: trigger.pursuit_id ? `/pursuits/${trigger.pursuit_id}` : "/",
      dedupeKey: `trigger:${trigger.id}:${windowKey}`,
    });
    await service
      .from("trigger_firing")
      .update({ outcome: "NOTIFIED" })
      .eq("trigger_id", trigger.id)
      .eq("window_key", windowKey);
    return { outcome: "NOTIFIED", jobId: null };
  }

  // Worker job path: verify autonomy policy, active capability grant, in-flight
  // guard, and resource reservation before enqueuing into public.job.
  const policy = await loadAutonomyPolicy(service, trigger.owner_user_id);
  const delegation = checkWorkerDelegation(policy, plan.workerType);
  if (!delegation.allowed) {
    await service
      .from("trigger_firing")
      .update({ outcome: "POLICY_REFUSED" })
      .eq("trigger_id", trigger.id)
      .eq("window_key", windowKey);
    return { outcome: "POLICY_REFUSED", jobId: null };
  }

  const { data: activeControlled } = await service
    .from("action")
    .select("id")
    .eq("owner_user_id", trigger.owner_user_id)
    .eq("pursuit_id", trigger.pursuit_id!)
    .eq("execution_mode", "CONTROLLED")
    .eq("status", "IN_PROGRESS")
    .limit(1)
    .maybeSingle();
  if (activeControlled) {
    await service
      .from("trigger_firing")
      .update({ outcome: "SKIPPED" })
      .eq("trigger_id", trigger.id)
      .eq("window_key", windowKey);
    return { outcome: "SKIPPED", jobId: null };
  }

  const { data: tool } = await service
    .from("tool")
    .select("id, tool_key, tool_version")
    .eq("tool_key", plan.toolKey)
    .eq("tool_version", "v1")
    .maybeSingle();
  if (!tool) {
    await service
      .from("trigger_firing")
      .update({ outcome: "SKIPPED" })
      .eq("trigger_id", trigger.id)
      .eq("window_key", windowKey);
    return { outcome: "SKIPPED", jobId: null };
  }

  // Triggers never fabricate authority: require an active unrestricted
  // capability_grant for this owner and tool (sourced from a prior user
  // approval decision).
  const { data: grant } = await service
    .from("capability_grant")
    .select("id, source_decision_id")
    .eq("owner_user_id", trigger.owner_user_id)
    .eq("tool_id", tool.id)
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("granted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!grant) {
    await service
      .from("trigger_firing")
      .update({ outcome: "POLICY_REFUSED" })
      .eq("trigger_id", trigger.id)
      .eq("window_key", windowKey);
    return { outcome: "POLICY_REFUSED", jobId: null };
  }

  // Reserve 1 worker_jobs unit on the resource control plane before creating the job.
  let reservation: Awaited<ReturnType<typeof reserveResources>>;
  try {
    reservation = await reserveResources(service, {
      ownerUserId: trigger.owner_user_id,
      pursuitId: trigger.pursuit_id,
      operationKey: `trigger:${trigger.id}:${windowKey}`,
      capabilityKey: plan.toolKey,
      requests: [{ resource: "worker_jobs", expected: 1 }],
    });
  } catch {
    await service
      .from("trigger_firing")
      .update({ outcome: "BUDGET_EXHAUSTED" })
      .eq("trigger_id", trigger.id)
      .eq("window_key", windowKey);
    return { outcome: "BUDGET_EXHAUSTED", jobId: null };
  }

  const argsHash = createHash("sha256").update(JSON.stringify(plan.jobArgs)).digest("hex");
  const { data: actionRow, error: actionError } = await service
    .from("action")
    .insert({
      owner_user_id: trigger.owner_user_id,
      pursuit_id: trigger.pursuit_id!,
      execution_mode: "CONTROLLED",
      originating_decision_id: (grant as { source_decision_id?: string | null }).source_decision_id ?? null,
      intent_summary: plan.intentSummary,
      intent_parameters: plan.jobArgs,
      status: "IN_PROGRESS",
      version: 1,
    })
    .select("id")
    .single();
  if (actionError || !actionRow) {
    await reservation.release().catch(() => {});
    await service
      .from("trigger_firing")
      .update({ outcome: "SKIPPED" })
      .eq("trigger_id", trigger.id)
      .eq("window_key", windowKey);
    return { outcome: "SKIPPED", jobId: null };
  }

  const { data: jobRow, error: jobError } = await service
    .from("job")
    .insert({
      owner_user_id: trigger.owner_user_id,
      action_id: actionRow.id,
      tool_id: tool.id,
      tool_version: tool.tool_version,
      frozen_arguments: plan.jobArgs,
      args_hash: argsHash,
      idempotency_key: plan.jobArgs.idempotency_key,
      authorization_basis: {
        authorization_type: "TRIGGER_WITH_CAPABILITY_GRANT",
        trigger_id: trigger.id,
        window_key: windowKey,
        capability_grant_id: grant.id,
        decision_id: (grant as { source_decision_id?: string | null }).source_decision_id ?? null,
        tool_id: tool.id,
        tool_version: tool.tool_version,
        args_hash: argsHash,
      },
      status: "AUTHORIZED",
      retry_count: 0,
      max_retries: 0,
      fencing_token: 0,
    })
    .select("id")
    .single();
  if (jobError || !jobRow) {
    await reservation.release().catch(() => {});
    await service
      .from("trigger_firing")
      .update({ outcome: "SKIPPED" })
      .eq("trigger_id", trigger.id)
      .eq("window_key", windowKey);
    return { outcome: "SKIPPED", jobId: null };
  }

  await service.from("job_authorization").insert({
    owner_user_id: trigger.owner_user_id,
    job_id: jobRow.id,
    action_id: actionRow.id,
    decision_id: (grant as { source_decision_id?: string | null }).source_decision_id ?? null,
    authorization_type: "TRIGGER_WITH_CAPABILITY_GRANT",
    args_hash: argsHash,
    authorized_by_type: "USER",
    authorized_by_id: trigger.owner_user_id,
    authorization_snapshot: {
      trigger_id: trigger.id,
      window_key: windowKey,
      action_id: actionRow.id,
      tool_id: tool.id,
      tool_version: tool.tool_version,
      args_hash: argsHash,
      capability_grant_id: grant.id,
    },
  });

  await reservation.reconcile([{ resource: "worker_jobs", expected: 1 }]).catch(() => {});

  await service
    .from("trigger_firing")
    .update({ job_id: jobRow.id, outcome: "JOB_ENQUEUED" })
    .eq("trigger_id", trigger.id)
    .eq("window_key", windowKey);

  return { outcome: "JOB_ENQUEUED", jobId: jobRow.id };
}

// Evaluate all ACTIVE triggers for due-ness, fire the due ones (idempotent per
// window via stryde_fire_trigger), and dispatch each winning firing into either
// an authorized worker job on the existing queue or an in-app notification.
export async function evaluateTriggers(
  service: SupabaseClient,
  now: Date,
): Promise<{ evaluated: number; fired: FiredTriggerOutcome[] }> {
  const { data: triggers, error } = await service
    .from("trigger")
    .select("*")
    .eq("status", "ACTIVE");
  if (error) throw new Error(`Unable to list triggers: ${error.message}`);

  const fired: FiredTriggerOutcome[] = [];
  for (const raw of (triggers ?? []) as TriggerRow[]) {
    const context = await resolveTriggerContext(service, raw, now);
    const verdict = isDue(raw, now, context);
    if (!verdict.due) continue;
    const { data: won, error: fireError } = await service
      .rpc("stryde_fire_trigger", { p_trigger: raw.id, p_window_key: verdict.windowKey });
    if (fireError || !won) continue;

    const dispatched = await dispatchFiredTrigger(service, raw, verdict.windowKey);
    fired.push({
      id: raw.id,
      name: raw.name,
      windowKey: verdict.windowKey,
      outcome: dispatched.outcome,
      jobId: dispatched.jobId,
    });
  }
  return { evaluated: (triggers ?? []).length, fired };
}
