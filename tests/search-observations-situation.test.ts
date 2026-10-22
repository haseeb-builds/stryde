import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assembleAdaptiveSituation } from "../lib/adaptive-situation.ts";
import { compileForSituation } from "../lib/context-compiler.ts";
import { executeWebResearch } from "../lib/research-execution.ts";

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

test("R-3 search observations: assembleAdaptiveSituation rejects observations with conflicting pursuit IDs", async () => {
  const pursuitId = "pursuit-1";
  const ownerUserId = "user-1";

  // Conflicting observation: content has active pursuitId, but source_metadata has conflicting foreign ID
  const conflictingObservation = {
    id: "obs-conflicting-meta",
    owner_user_id: ownerUserId,
    observation_kind: "WEB_SEARCH_RESULT",
    content: {
      pursuit_id: pursuitId,
      query: "marathon heart rate zones",
      provider: "exa",
      results: [{ url: "https://example.com/hr-zones" }],
    },
    observed_at: new Date().toISOString(),
    source_type: "WEB_SEARCH",
    source_metadata: {
      pursuit_id: "other-pursuit-conflict",
    },
    created_at: new Date().toISOString(),
  };

  const client = createMockSupabase([conflictingObservation]);
  const { situation, error } = await assembleAdaptiveSituation(client, ownerUserId, pursuitId);
  assert.equal(error, null);
  assert.ok(situation);

  const leakedObs = (situation.observations as Array<Record<string, unknown>>).find(
    (o) => o.id === "obs-conflicting-meta"
  );
  assert.equal(leakedObs, undefined, "Conflicting observation must be dropped from situation");
});

test("R-3 research execution: executeWebResearch writes pursuit_id to observation content and source_metadata", async (t) => {
  const savedKey = process.env.EXA_API_KEY;
  const savedProvider = process.env.STRYDE_SEARCH_PROVIDER;
  process.env.EXA_API_KEY = "mock-exa-key";
  process.env.STRYDE_SEARCH_PROVIDER = "exa";

  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    const urlStr = String(url);
    if (urlStr.startsWith("https://api.exa.ai")) {
      return new Response(
        JSON.stringify({
          results: [{ url: "https://example.com/marathon-guide", title: "Marathon Guide", highlights: ["Pacing guide"] }],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (urlStr === "https://example.com/marathon-guide") {
      return new Response("Marathon Guide full content text for training.", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    return new Response("Not found", { status: 404 });
  });

  try {
    let capturedObservation: Record<string, unknown> | null = null;

    const mockObservationClient = {
      from: (table: string) => ({
        insert: (data: Record<string, unknown>) => {
          if (table === "observation") {
            capturedObservation = data;
          }
          return {
            select: () => ({
              single: async () => ({ data: { id: "obs-inserted-123" }, error: null }),
            }),
          };
        },
      }),
    } as unknown as SupabaseClient;

    const mockSupabase = {
      from: () => ({
        insert: (data: Record<string, unknown>) => ({
          select: () => ({
            single: async () => ({ data: { id: "src-saved-1", ...(typeof data === "object" ? data : {}) }, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const execution = await executeWebResearch(
      mockSupabase,
      "user-alpha",
      "pursuit-target-42",
      "marathon training pacing",
      mockObservationClient
    );

    assert.ok(execution);
    assert.ok(capturedObservation, "executeWebResearch must insert an observation row");
    assert.equal((capturedObservation as Record<string, unknown>).owner_user_id, "user-alpha");
    assert.equal((capturedObservation as Record<string, unknown>).observation_kind, "WEB_SEARCH_RESULT");

    const content = (capturedObservation as Record<string, unknown>).content as Record<string, unknown>;
    assert.equal(content.pursuit_id, "pursuit-target-42", "content.pursuit_id must match active pursuitId");

    const rawPayload = (capturedObservation as Record<string, unknown>).raw_payload as Record<string, unknown>;
    assert.equal(rawPayload.pursuit_id, "pursuit-target-42", "raw_payload.pursuit_id must match active pursuitId");

    const meta = (capturedObservation as Record<string, unknown>).source_metadata as Record<string, unknown>;
    assert.equal(meta.pursuit_id, "pursuit-target-42", "source_metadata.pursuit_id must match active pursuitId");
  } finally {
    process.env.EXA_API_KEY = savedKey;
    process.env.STRYDE_SEARCH_PROVIDER = savedProvider;
    fetchMock.mock.restore();
  }
});

test("R-3 cross-pursuit isolation: observation sharing source_uri is excluded when explicit pursuit_id is different", async () => {
  const pursuitId = "pursuit-alpha";
  const ownerUserId = "user-1";
  const sharedUri = "https://example.com/shared-marathon-guide";

  // Pursuit Alpha has this URI in its sources
  const alphaSource = {
    id: "src-alpha-1",
    uri: sharedUri,
    title: "Shared Guide",
  };

  // But the observation was created under Pursuit Beta with explicit pursuit_id
  const betaObservation = {
    id: "obs-beta-1",
    owner_user_id: ownerUserId,
    observation_kind: "WEB_SEARCH_RESULT",
    source_uri: sharedUri, // Shares the same URI as Pursuit Alpha's source!
    content: {
      pursuit_id: "pursuit-beta", // Explicitly belongs to Pursuit Beta!
      query: "beta query",
    },
    source_metadata: {
      pursuit_id: "pursuit-beta",
    },
    observed_at: new Date().toISOString(),
    source_type: "WEB_SEARCH",
    created_at: new Date().toISOString(),
  };

  const client = {
    from: (table: string) => {
      const handler: ProxyHandler<object> = {
        get(target, prop) {
          if (prop === "select") {
            return () => {
              const sHandler: ProxyHandler<object> = {
                get(sTarget, sProp) {
                  if (sProp === "then") {
                    if (table === "pursuit_source") {
                      return (resolve: (val: unknown) => unknown) =>
                        Promise.resolve({ data: [alphaSource], error: null }).then(resolve);
                    }
                    if (table === "observation") {
                      return (resolve: (val: unknown) => unknown) =>
                        Promise.resolve({ data: [betaObservation], error: null }).then(resolve);
                    }
                    if (table === "pursuit") {
                      return (resolve: (val: unknown) => unknown) =>
                        Promise.resolve({ data: { id: pursuitId, title: "Alpha", status: "ACTIVE" }, error: null }).then(resolve);
                    }
                    return (resolve: (val: unknown) => unknown) =>
                      Promise.resolve({ data: [], error: null }).then(resolve);
                  }
                  if (sProp === "single" || sProp === "maybeSingle") {
                    return async () => ({
                      data: { id: pursuitId, title: "Alpha", status: "ACTIVE" },
                      error: null,
                    });
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

  const { situation, error } = await assembleAdaptiveSituation(client, ownerUserId, pursuitId);
  assert.equal(error, null);
  assert.ok(situation);

  const leakedObs = (situation.observations as Array<Record<string, unknown>>).find(
    (o) => o.id === "obs-beta-1"
  );
  assert.equal(leakedObs, undefined, "Cross-pursuit observation must NEVER leak even when sharing source_uri");
});
