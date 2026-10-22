import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdaptiveSituation } from "../lib/adaptive-situation.ts";
import {
  supersedeAdaptation,
  updateAdaptationAuditStatus,
  executeResearchAndRoadmapOrchestration,
} from "../lib/research-orchestration.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function setEnv(overrides: Record<string, string | undefined>) {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(overrides)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function createMockSupabase(handler: {
  update?: (data: unknown, filters: Record<string, unknown>) => { data: unknown; error: unknown };
}) {
  return {
    from: () => {
      let updatedData: unknown = null;
      const filters: Record<string, unknown> = {};
      const builder: Record<string, unknown> = {
        update: (data: unknown) => {
          updatedData = data;
          return builder;
        },
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return builder;
        },
        select: () => {
          if (handler.update) {
            return Promise.resolve(handler.update(updatedData, filters));
          }
          return Promise.resolve({ data: [{ id: "mock-id" }], error: null });
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

type CapturedData = {
  status?: string;
  summary?: string;
  methods?: Array<{ title: string; audit_status: string }>;
  provenance?: { audit_status: string; error?: string };
};

test("R-2 supersession: successfully marks target adaptation as SUPERSEDED scoped to owner and pursuit", async () => {
  const captured: { data: CapturedData | null; filters: Record<string, unknown> } = {
    data: null,
    filters: {},
  };

  const client = createMockSupabase({
    update: (data, filters) => {
      captured.data = data as CapturedData;
      captured.filters = filters;
      return { data: [{ id: "adapt-123" }], error: null };
    },
  });

  const res = await supersedeAdaptation(client, {
    adaptationId: "adapt-123",
    ownerUserId: "user-456",
    pursuitId: "pursuit-789",
  });

  assert.equal(res.success, true);
  assert.equal(res.affectedCount, 1);
  assert.equal(res.error, null);
  assert.deepEqual(captured.data, { status: "SUPERSEDED" });
  assert.equal(captured.filters.id, "adapt-123");
  assert.equal(captured.filters.owner_user_id, "user-456");
  assert.equal(captured.filters.pursuit_id, "pursuit-789");
});

test("R-2 supersession failure: zero matching rows (e.g. wrong owner or wrong pursuit) returns error and affectedCount 0", async () => {
  const client = createMockSupabase({
    update: () => ({ data: [], error: null }),
  });

  const res = await supersedeAdaptation(client, {
    adaptationId: "adapt-nonexistent",
    ownerUserId: "user-456",
    pursuitId: "pursuit-789",
  });

  assert.equal(res.success, false);
  assert.equal(res.affectedCount, 0);
  assert.match(res.error ?? "", /No matching adaptation found to supersede/);
});

test("R-2 supersession failure: database error is caught and not represented as success", async () => {
  const client = createMockSupabase({
    update: () => ({ data: null, error: { message: "database connection lost" } }),
  });

  const res = await supersedeAdaptation(client, {
    adaptationId: "adapt-123",
    ownerUserId: "user-456",
    pursuitId: "pursuit-789",
  });

  assert.equal(res.success, false);
  assert.equal(res.affectedCount, 0);
  assert.equal(res.error, "database connection lost");
});

test("R-2 audit status update: updates summary, methods, and provenance scoped to owner and pursuit", async () => {
  const captured: { data: CapturedData | null; filters: Record<string, unknown> } = {
    data: null,
    filters: {},
  };

  const client = createMockSupabase({
    update: (data, filters) => {
      captured.data = data as CapturedData;
      captured.filters = filters;
      return { data: [{ id: "adapt-audit-1" }], error: null };
    },
  });

  const res = await updateAdaptationAuditStatus(client, {
    adaptationId: "adapt-audit-1",
    ownerUserId: "user-456",
    pursuitId: "pursuit-789",
    summary: "Audit incomplete due to source error",
    methods: [{ title: "Step 1", audit_status: "UNVERIFIED" }],
    provenance: { audit_status: "INCOMPLETE", error: "Source timeout" },
  });

  assert.equal(res.success, true);
  assert.equal(res.affectedCount, 1);
  assert.equal(res.error, null);
  assert.equal(captured.data?.summary, "Audit incomplete due to source error");
  assert.equal(captured.data?.methods?.[0]?.audit_status, "UNVERIFIED");
  assert.equal(captured.data?.provenance?.audit_status, "INCOMPLETE");
  assert.equal(captured.filters.id, "adapt-audit-1");
  assert.equal(captured.filters.owner_user_id, "user-456");
  assert.equal(captured.filters.pursuit_id, "pursuit-789");
});

test("R-2 audit status update failure: zero rows updated returns error", async () => {
  const client = createMockSupabase({
    update: () => ({ data: [], error: null }),
  });

  const res = await updateAdaptationAuditStatus(client, {
    adaptationId: "adapt-missing",
    ownerUserId: "user-456",
    pursuitId: "pursuit-789",
    summary: "Audit update",
    methods: [],
    provenance: {},
  });

  assert.equal(res.success, false);
  assert.equal(res.affectedCount, 0);
  assert.match(res.error ?? "", /No matching adaptation found to update/);
});

test("R-2 orchestration aborts adaptation insertion when supersedeAdaptation returns affectedCount 0", async (t) => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
    STRYDE_MODEL_PROVIDER: "gemini",
    STRYDE_MODEL_API_KEY: "mock-gemini-key",
  });

  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    const urlStr = String(url);
    if (urlStr.startsWith("https://api.exa.ai")) {
      return json({
        results: [{ url: "https://example.com/deepwork", title: "Study", highlights: ["Deep work"] }],
      });
    }

    if (urlStr.includes("generativelanguage.googleapis.com") || urlStr.includes("openrouter.ai")) {
      return json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: "Roadmap audit",
                    source_claims: [],
                    methods: [],
                    assumptions: [],
                    prerequisites: [],
                    expected_outcomes: [],
                    unknowns: [],
                    fit: { status: "GOOD", reasons: [] },
                    conflicts: [],
                    gaps: [],
                    adapted_strategy: [],
                    goal_candidates: [],
                    provenance: {},
                  }),
                },
              ],
            },
          },
        ],
      });
    }

    return new Response("Some content", { status: 200 });
  });

  try {
    let adaptationInsertAttempted = false;

    const mockSupabase = {
      from: (table: string) => {
        const handler: ProxyHandler<object> = {
          get(target, prop) {
            if (prop === "select") {
              return () => {
                const sHandler: ProxyHandler<object> = {
                  get(sTarget, sProp) {
                    if (sProp === "then") {
                      if (table === "pursuit_source_adaptation") {
                        return (resolve: (val: unknown) => unknown) =>
                          Promise.resolve({
                            data: [
                              {
                                id: "adapt-v1",
                                source_id: "src-roadmap-pasted",
                                version: 1,
                                status: "ADVISED",
                                summary: "Initial roadmap",
                                methods: [],
                                source_claims: [],
                                assumptions: [],
                                prerequisites: [],
                                expected_outcomes: [],
                                unknowns: [],
                                fit: { status: "GOOD", reasons: [] },
                                conflicts: [],
                                gaps: [],
                                adapted_strategy: [],
                                goal_candidates: [],
                                provenance: {},
                              },
                            ],
                            error: null,
                          }).then(resolve);
                      }
                      return (resolve: (val: unknown) => unknown) =>
                        Promise.resolve({ data: [], error: null }).then(resolve);
                    }
                    if (sProp === "maybeSingle") {
                      return async () => ({
                        data: {
                          id: "src-roadmap-pasted",
                          title: "Roadmap",
                          content_text: "Roadmap text",
                          content_sha256: "hash-pasted",
                          fetch_status: "FETCHED",
                        },
                        error: null,
                      });
                    }
                    return () => new Proxy({}, sHandler);
                  },
                };
                return new Proxy({}, sHandler);
              };
            }

            if (prop === "insert") {
              return (data: unknown) => {
                if (table === "pursuit_source_adaptation") {
                  adaptationInsertAttempted = true;
                }
                return {
                  select: () => ({
                    single: async () => ({ data: { id: "inserted-id", ...(typeof data === "object" && data !== null ? data : {}) }, error: null }),
                  }),
                };
              };
            }

            if (prop === "update") {
              // Simulate superseding returning 0 affected rows (e.g. wrong tenant or race condition)!
              return () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      select: async () => ({ data: [], error: null }),
                    }),
                  }),
                }),
              });
            }

            return () => new Proxy({}, handler);
          },
        };
        return new Proxy({}, handler) as unknown as ReturnType<SupabaseClient["from"]>;
      },
    } as unknown as SupabaseClient;

    const mockTrustedPlane = {
      rpc: async (method: string) => {
        if (method === "stryde_reserve_resources") return { data: "grp-test", error: null };
        return { data: null, error: null };
      },
      from: (table: string) => mockSupabase.from(table),
    } as unknown as SupabaseClient;

    const situation = {
      capabilities: { web_search: true },
      observations: [],
      sources: [],
    } as unknown as AdaptiveSituation;

    await executeResearchAndRoadmapOrchestration({
      supabase: mockSupabase,
      trustedPlane: mockTrustedPlane,
      ownerUserId: "user-test",
      pursuitId: "pursuit-test",
      turnKey: "turn-abort-test",
      message: "Audit my roadmap against scientific literature.",
      currentSituation: situation,
      userPolicy: {
        allow_worker_delegation: true,
        allowed_worker_types: ["BROWSER"],
        auto_execute_research: true,
      },
    });

    assert.equal(adaptationInsertAttempted, false, "When superseding fails (0 affected rows), a new adaptation MUST NOT be inserted");
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("R-2 orchestration aborts incomplete adaptation insertion when model fails and supersedeAdaptation returns affectedCount 0", async (t) => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
    STRYDE_MODEL_PROVIDER: "gemini",
    STRYDE_MODEL_API_KEY: "mock-gemini-key",
  });

  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    const urlStr = String(url);
    if (urlStr.startsWith("https://api.exa.ai")) {
      return json({
        results: [{ url: "https://example.com/deepwork", title: "Study", highlights: ["Deep work"] }],
      });
    }

    if (urlStr.includes("generativelanguage.googleapis.com") || urlStr.includes("openrouter.ai")) {
      // Simulate model failure throwing error
      return new Response("Service Unavailable", { status: 503 });
    }

    return new Response("Some content", { status: 200 });
  });

  try {
    let adaptationInsertAttempted = false;

    const mockSupabase = {
      from: (table: string) => {
        const handler: ProxyHandler<object> = {
          get(target, prop) {
            if (prop === "select") {
              return () => {
                const sHandler: ProxyHandler<object> = {
                  get(sTarget, sProp) {
                    if (sProp === "then") {
                      if (table === "pursuit_source_adaptation") {
                        return (resolve: (val: unknown) => unknown) =>
                          Promise.resolve({
                            data: [
                              {
                                id: "adapt-v1",
                                source_id: "src-roadmap-pasted",
                                version: 1,
                                status: "ADVISED",
                                summary: "Initial roadmap",
                                methods: [],
                                source_claims: [],
                                assumptions: [],
                                prerequisites: [],
                                expected_outcomes: [],
                                unknowns: [],
                                fit: {},
                                conflicts: [],
                                gaps: [],
                                adapted_strategy: [],
                                goal_candidates: [],
                                provenance: {},
                              },
                            ],
                            error: null,
                          }).then(resolve);
                      }
                      return (resolve: (val: unknown) => unknown) =>
                        Promise.resolve({ data: [], error: null }).then(resolve);
                    }
                    if (sProp === "maybeSingle") {
                      return async () => ({
                        data: {
                          id: "src-roadmap-pasted",
                          title: "Roadmap",
                          content_text: "Roadmap text",
                          content_sha256: "hash-pasted",
                          fetch_status: "FETCHED",
                        },
                        error: null,
                      });
                    }
                    return () => new Proxy({}, sHandler);
                  },
                };
                return new Proxy({}, sHandler);
              };
            }

            if (prop === "insert") {
              return (data: unknown) => {
                if (table === "pursuit_source_adaptation") {
                  adaptationInsertAttempted = true;
                }
                return {
                  select: () => ({
                    single: async () => ({ data: { id: "inserted-id", ...(typeof data === "object" && data !== null ? data : {}) }, error: null }),
                  }),
                };
              };
            }

            if (prop === "update") {
              // Return 0 affected rows
              return () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      select: async () => ({ data: [], error: null }),
                    }),
                  }),
                }),
              });
            }

            return () => new Proxy({}, handler);
          },
        };
        return new Proxy({}, handler) as unknown as ReturnType<SupabaseClient["from"]>;
      },
    } as unknown as SupabaseClient;

    const mockTrustedPlane = {
      rpc: async (method: string) => {
        if (method === "stryde_reserve_resources") return { data: "grp-test", error: null };
        return { data: null, error: null };
      },
      from: (table: string) => mockSupabase.from(table),
    } as unknown as SupabaseClient;

    const situation = {
      capabilities: { web_search: true },
      observations: [],
      sources: [],
    } as unknown as AdaptiveSituation;

    await executeResearchAndRoadmapOrchestration({
      supabase: mockSupabase,
      trustedPlane: mockTrustedPlane,
      ownerUserId: "user-test",
      pursuitId: "pursuit-test",
      turnKey: "turn-abort-on-error-test",
      message: "Audit my roadmap against scientific literature.",
      currentSituation: situation,
      userPolicy: {
        allow_worker_delegation: true,
        allowed_worker_types: ["BROWSER"],
        auto_execute_research: true,
      },
    });

    assert.equal(adaptationInsertAttempted, false, "When model fails and superseding fails, an orphan adaptation MUST NOT be inserted");
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});
