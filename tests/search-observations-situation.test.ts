import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assembleAdaptiveSituation } from "../lib/adaptive-situation.ts";
import { compileForSituation } from "../lib/context-compiler.ts";

function createMockSupabase(observations: Array<Record<string, unknown>>) {
  return {
    from: (table: string) => {
      const handler: ProxyHandler<object> = {
        get(target, prop) {
          if (prop === "select") {
            return () => {
              const sHandler: ProxyHandler<object> = {
                get(sTarget, sProp) {
                  if (sProp === "then") {
                    if (table === "observation") {
                      return (resolve: (val: unknown) => unknown) =>
                        Promise.resolve({ data: observations, error: null }).then(resolve);
                    }
                    if (table === "pursuit") {
                      return (resolve: (val: unknown) => unknown) =>
                        Promise.resolve({
                          data: { id: "pursuit-1", title: "Run Marathon", status: "ACTIVE" },
                          error: null,
                        }).then(resolve);
                    }
                    return (resolve: (val: unknown) => unknown) =>
                      Promise.resolve({ data: [], error: null }).then(resolve);
                  }
                  if (sProp === "single" || sProp === "maybeSingle") {
                    if (table === "pursuit") {
                      return async () => ({
                        data: { id: "pursuit-1", title: "Run Marathon", status: "ACTIVE" },
                        error: null,
                      });
                    }
                    return async () => ({ data: null, error: null });
                  }
                  return () => new Proxy({}, sHandler);
                },
              };
              return new Proxy({}, sHandler);
            };
          }
          return () => new Proxy({}, handler);
        },
      };
      return new Proxy({}, handler) as unknown as ReturnType<SupabaseClient["from"]>;
    },
  } as unknown as SupabaseClient;
}

test("R-3 search observations: preserves source-less WEB_SEARCH_RESULT observations in situation and context compiler", async () => {
  const pursuitId = "pursuit-1";
  const ownerUserId = "user-1";

  const searchObservation = {
    id: "obs-web-search-1",
    owner_user_id: ownerUserId,
    observation_kind: "WEB_SEARCH_RESULT",
    content: {
      pursuit_id: pursuitId,
      query: "marathon heart rate zones",
      provider: "exa",
      results: [
        {
          url: "https://example.com/hr-zones",
          title: "Aerobic Threshold and Heart Rate Zones",
        },
      ],
      retrieved_sources: [
        {
          content_locator: "https://example.com/hr-zones",
          locator_type: "FULL_TEXT",
        },
      ],
    },
    observed_at: new Date().toISOString(),
    source_type: "WEB_SEARCH",
    source_reference: "req-12345",
    source_uri: null, // Source-less on the observation table
    source_metadata: {
      pursuit_id: pursuitId,
      query: "marathon heart rate zones",
      provider: "exa",
      result_count: 1,
    },
    created_at: new Date().toISOString(),
  };

  const unrelatedObservation = {
    id: "obs-other-pursuit",
    owner_user_id: ownerUserId,
    observation_kind: "WEB_SEARCH_RESULT",
    content: {
      pursuit_id: "other-pursuit-999",
      query: "unrelated query",
    },
    observed_at: new Date().toISOString(),
    source_type: "WEB_SEARCH",
    source_uri: null,
    source_metadata: {
      pursuit_id: "other-pursuit-999",
    },
  };

  const client = createMockSupabase([searchObservation, unrelatedObservation]);

  const { situation, error } = await assembleAdaptiveSituation(client, ownerUserId, pursuitId);
  assert.equal(error, null);
  assert.ok(situation, "Situation must be assembled");

  // Verify that the search observation was NOT dropped
  const preservedObs = (situation.observations as Array<Record<string, unknown>>).find(
    (o) => o.id === "obs-web-search-1"
  );
  assert.ok(preservedObs, "Search observation must be retained in situation.observations");
  assert.equal(preservedObs.observation_kind, "WEB_SEARCH_RESULT");

  // Verify that unrelated observation is excluded
  const excludedObs = (situation.observations as Array<Record<string, unknown>>).find(
    (o) => o.id === "obs-other-pursuit"
  );
  assert.equal(excludedObs, undefined, "Observations belonging to another pursuit must not leak into context");

  // Compile context packet and verify it reaches model context
  const compiled = compileForSituation(situation, { userMessage: "What heart rate zone should I train in?" });
  const compiledObs = compiled.packet.observations.find((o) => o.id === "obs-web-search-1");
  assert.ok(compiledObs, "Observation must flow into the compiled ContextPacket");
  assert.equal(compiledObs.observation_kind, "WEB_SEARCH_RESULT");
});
