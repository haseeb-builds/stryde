// Trigger engine + notification semantics (Phases 9, 11) — pure logic.
import test from "node:test";
import assert from "node:assert/strict";
import { isDue, type TriggerRow } from "../lib/trigger-engine.ts";
import { configuredChannels } from "../lib/notifications.ts";

function trigger(overrides: Partial<TriggerRow>): TriggerRow {
  return {
    id: "t-1",
    owner_user_id: "u-1",
    pursuit_id: null,
    name: "test",
    trigger_kind: "RECURRING",
    condition: {},
    action: {},
    status: "ACTIVE",
    last_fired_at: null,
    next_fire_at: null,
    max_fires: null,
    fire_count: 0,
    ...overrides,
  };
}

test("trigger: ONE_TIME fires once at its time and never again", () => {
  const t = trigger({ trigger_kind: "ONE_TIME", condition: { fire_at: "2026-10-06T00:00:00Z" }, fire_count: 0 });
  const after = isDue(t, new Date("2026-10-07T00:00:00Z"), {});
  assert.equal(after.due, true);
  assert.equal(after.windowKey, "once");
  const fired = isDue({ ...t, fire_count: 1 }, new Date("2026-10-07T00:00:00Z"), {});
  assert.equal(fired.due, false, "a fired one-time trigger must not fire again");
});

test("trigger: RECURRING respects its interval", () => {
  const t = trigger({ trigger_kind: "RECURRING", condition: { interval_minutes: 60 } });
  const fresh = isDue(t, new Date("2026-10-06T12:00:00Z"), {});
  assert.equal(fresh.due, true, "never-fired recurring is due");
  const recent = isDue({ ...t, last_fired_at: "2026-10-06T11:30:00Z" }, new Date("2026-10-06T12:00:00Z"), {});
  assert.equal(recent.due, false, "30 minutes into a 60-minute interval is not due");
  const due = isDue({ ...t, last_fired_at: "2026-10-06T10:00:00Z" }, new Date("2026-10-06T12:00:00Z"), {});
  assert.equal(due.due, true);
});

test("trigger: STATE does not double-fire while action is in flight", () => {
  const t = trigger({ trigger_kind: "STATE", condition: { blocked_days: 3 } });
  const stalled = isDue(t, new Date("2026-10-06T00:00:00Z"), { pursuitUpdatedAt: "2026-10-01T00:00:00Z", inFlightAction: true });
  assert.equal(stalled.due, false, "waiting on external reality is not a second decision");
  const blocked = isDue(t, new Date("2026-10-06T00:00:00Z"), { pursuitUpdatedAt: "2026-10-01T00:00:00Z", inFlightAction: false });
  assert.equal(blocked.due, true);
});

test("trigger: EVENT matches entity and type", () => {
  const t = trigger({ trigger_kind: "EVENT", condition: { event_entity: "claim", event_type: "CONTRADICTED" } });
  const miss = isDue(t, new Date(), { recentEvent: { entity_type: "claim", event_type: "VERIFIED", occurred_at: new Date().toISOString() } });
  assert.equal(miss.due, false);
  const hit = isDue(t, new Date(), { recentEvent: { entity_type: "claim", event_type: "CONTRADICTED", occurred_at: new Date().toISOString() } });
  assert.equal(hit.due, true);
});

test("notification channels: unconfigured providers stay pending, in-app is always deliverable", () => {
  const channels = configuredChannels({} as NodeJS.ProcessEnv);
  assert.equal(channels.IN_APP, true);
  assert.equal(channels.EMAIL, false, "email without credentials must not claim delivery");
  assert.equal(channels.WEBHOOK, false);
  const withWebhook = configuredChannels({ STRYDE_NOTIFICATION_WEBHOOK_URL: "https://example.com/hook" } as unknown as NodeJS.ProcessEnv);
  assert.equal(withWebhook.WEBHOOK, true);
});
