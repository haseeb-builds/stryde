import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdaptiveSituation } from "../lib/adaptive-situation.ts";
import { executeResearchAndRoadmapOrchestration } from "../lib/research-orchestration.ts";
import { findSupportingSource, findSupportingPassage } from "../lib/source-citation.ts";

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

function createChainableBuilder(resolveValue: unknown = { data: [], error: null }) {
  const handler: ProxyHandler<object> = {
    get(target, prop) {
      if (prop === "then") {
        return (onFulfilled: (val: unknown) => unknown) => Promise.resolve(resolveValue).then(onFulfilled);
      }
      if (prop === "single" || prop === "maybeSingle") {
        return () => Promise.resolve(resolveValue);
      }
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

test("R-1 passage location: excerpt and locator exactly agree with slice of content", () => {
  const content = "Deep work sessions require 90 minutes of unbroken focus without digital distraction.";
  const passage = findSupportingPassage(content, "90 minutes of unbroken focus");

  assert.ok(passage, "Passage should be found");
  assert.equal(passage.excerpt, "90 minutes of unbroken focus");
  assert.equal(content.slice(passage.start, passage.end), passage.excerpt);
});

test("R-1 unsupported claim: never attaches to an unrelated source", () => {
  const sources = [
    {
      id: "src-sleep",
      title: "Sleep Optimization",
      content_text: "Eight hours of sleep enhances slow-wave recovery.",
      content_sha256: "sha-sleep",
    },
  ];

  const match = findSupportingSource(sources, "Ketogenic diet accelerates fat oxidation.");
  assert.equal(match, null, "Unsupported claim must return null, never fall back to first source");
});

test("R-1 source query failure: persists honest incomplete state via trusted plane", async (t) => {
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
        results: [{ url: "https://example.com/study", title: "Study", highlights: ["text"] }],
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
                    source_claims: [{ statement: "Fact", basis: "EXPLICIT_SOURCE", confidence: "HIGH" }],
                    methods: [{ title: "Step 1", sequence: 1, description: "Step", prerequisites: [], expected_change: "Change", actionability: "IMMEDIATE", audit_status: "KEEP" }],
                    assumptions: [],
                    prerequisites: [],
                    expected_outcomes: [],
                    unknowns: [],
                    fit: { status: "GOOD", reasons: [] },
                    conflicts: [],
                    gaps: [],
                    adapted_strategy: [],
                    goal_candidates: [],
                    provenance: { source_id: "ext-1", extraction_status: "FETCHED" },
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
    const updatedAdaptations: Array<Record<string, unknown>> = [];

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
                                methods: [{ title: "Step 1", audit_status: "UNVERIFIED" }],
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
                    if (sProp === "in") {
                      // Simulate query failure when querying pursuit_source for external sources!
                      return () =>
                        createChainableBuilder({
                          data: null,
                          error: { message: "connection timeout on pursuit_source table" },
                        });
                    }
                    return () => new Proxy({}, sHandler);
                  },
                };
                return new Proxy({}, sHandler);
              };
            }

            if (prop === "insert") {
              return (data: unknown) => ({
                select: () => ({
                  single: async () => ({
                    data: { id: "adapt-v2-inserted", ...(typeof data === "object" && data !== null ? data : {}) },
                    error: null,
                  }),
                }),
              });
            }

            if (prop === "update") {
              return (data: unknown) => {
                if (table === "pursuit_source_adaptation") {
                  updatedAdaptations.push(typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {});
                }
                return createChainableBuilder({ data: [{ id: "adapt-updated" }], error: null });
              };
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
      turnKey: "turn-source-err",
      message: "Audit my roadmap against scientific literature.",
      currentSituation: situation,
      userPolicy: {
        allow_worker_delegation: true,
        allowed_worker_types: ["BROWSER"],
        auto_execute_research: true,
      },
    });

    const errorUpdate = updatedAdaptations.find(
      (u) =>
        (u.provenance as Record<string, unknown> | undefined)?.audit_status === "INCOMPLETE" &&
        (u.provenance as Record<string, unknown> | undefined)?.source_query_error
    );

    assert.ok(errorUpdate, "Source query failure must update adaptation with INCOMPLETE status and source_query_error");
    assert.match(
      String((errorUpdate.provenance as Record<string, unknown>).source_query_error),
      /connection timeout/
    );
    assert.ok(
      Array.isArray(errorUpdate.methods) && errorUpdate.methods.every((m: Record<string, unknown>) => m.audit_status === "UNVERIFIED"),
      "Methods must be marked UNVERIFIED when source query fails"
    );
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("R-1 mixed claims: persists verified citation, marks adaptation INCOMPLETE with partial_evidence, and marks methods UNVERIFIED", async (t) => {
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
        results: [{ url: "https://example.com/deepwork", title: "Deep Work Study", highlights: ["Deep work requires 90 minutes of unbroken focus."] }],
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
                    summary: "Roadmap audit with mixed evidence",
                    source_claims: [
                      { statement: "Deep work requires 90 minutes of unbroken focus.", basis: "EXPLICIT_SOURCE", confidence: "HIGH" },
                      { statement: "Cold plunge instantly boosts productivity by 500 percent.", basis: "EXPLICIT_SOURCE", confidence: "HIGH" },
                    ],
                    methods: [
                      { title: "Schedule 90m blocks", sequence: 1, description: "Unbroken focus blocks", prerequisites: [], expected_change: "Focus", actionability: "IMMEDIATE", audit_status: "KEEP" },
                    ],
                    assumptions: [],
                    prerequisites: [],
                    expected_outcomes: [],
                    unknowns: [],
                    fit: { status: "GOOD", reasons: [] },
                    conflicts: [],
                    gaps: [],
                    adapted_strategy: [],
                    goal_candidates: [],
                    provenance: { source_id: "src-roadmap-pasted", extraction_status: "FETCHED" },
                  }),
                },
              ],
            },
          },
        ],
      });
    }

    if (urlStr === "https://example.com/deepwork") {
      return new Response("Deep work requires 90 minutes of unbroken focus. Without digital distraction, cognitive output peaks.", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }

    return new Response("Some content", { status: 200 });
  });

  try {
    const updatedAdaptations: Array<Record<string, unknown>> = [];
    const insertedCitations: Array<Record<string, unknown>> = [];

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
                                methods: [{ title: "Step 1", audit_status: "UNVERIFIED" }],
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
                    if (sProp === "in") {
                      return () =>
                        createChainableBuilder({
                          data: [
                            {
                              id: "src-deepwork-ext",
                              title: "Deep Work Study",
                              content_text: "Deep work requires 90 minutes of unbroken focus. Without digital distraction, cognitive output peaks.",
                              content_sha256: "sha-deepwork-123",
                              fetch_status: "FETCHED",
                            },
                          ],
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
                if (table === "pursuit_source_citation") {
                  if (Array.isArray(data)) insertedCitations.push(...data);
                  else if (data && typeof data === "object") insertedCitations.push(data as Record<string, unknown>);
                  return Promise.resolve({ data: insertedCitations, error: null });
                }
                return {
                  select: () => ({
                    single: async () => {
                      if (table === "pursuit_source") {
                        return { data: { id: "src-deepwork-ext" }, error: null };
                      }
                      return {
                        data: { id: "adapt-v2-inserted", ...(typeof data === "object" && data !== null ? data : {}) },
                        error: null,
                      };
                    },
                  }),
                };
              };
            }

            if (prop === "update") {
              return (data: unknown) => {
                if (table === "pursuit_source_adaptation") {
                  updatedAdaptations.push(typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {});
                }
                return createChainableBuilder({ data: [{ id: "adapt-updated" }], error: null });
              };
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
      turnKey: "turn-mixed-claims",
      message: "Audit my roadmap against scientific literature.",
      currentSituation: situation,
      userPolicy: {
        allow_worker_delegation: true,
        allowed_worker_types: ["BROWSER"],
        auto_execute_research: true,
      },
    });

    assert.equal(insertedCitations.length, 1, "Only substantiated claim should be persisted as citation");
    assert.equal(
      (insertedCitations[0].locator as Record<string, unknown>).claim_text,
      "Deep work requires 90 minutes of unbroken focus."
    );
    assert.equal(insertedCitations[0].source_id, "src-deepwork-ext");
    assert.equal(insertedCitations[0].excerpt, "Deep work requires 90 minutes of unbroken focus.");

    const partialUpdate = updatedAdaptations.find(
      (u) =>
        (u.provenance as Record<string, unknown> | undefined)?.audit_status === "INCOMPLETE" &&
        (u.provenance as Record<string, unknown> | undefined)?.partial_evidence === true
    );

    assert.ok(partialUpdate, "Adaptation must be updated with INCOMPLETE audit_status and partial_evidence flag");
    assert.equal((partialUpdate.provenance as Record<string, unknown>).substantiated_claims, 1);
    assert.equal((partialUpdate.provenance as Record<string, unknown>).total_claims, 2);
    assert.match(String(partialUpdate.summary), /partial evidence/i);
    assert.ok(
      Array.isArray(partialUpdate.methods) &&
        partialUpdate.methods.every((m: Record<string, unknown>) => m.audit_status === "UNVERIFIED"),
      "Methods must be marked UNVERIFIED when adaptation has only partial evidence"
    );
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("R-1 citation persistence failure: records citation_error, marks adaptation INCOMPLETE, and marks methods UNVERIFIED", async (t) => {
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
        results: [{ url: "https://example.com/deepwork", title: "Deep Work Study", highlights: ["Deep work requires 90 minutes of unbroken focus."] }],
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
                    summary: "Roadmap audit with failing citation insert",
                    source_claims: [
                      { statement: "Deep work requires 90 minutes of unbroken focus.", basis: "EXPLICIT_SOURCE", confidence: "HIGH" },
                    ],
                    methods: [
                      { title: "Schedule 90m blocks", sequence: 1, description: "Unbroken focus blocks", prerequisites: [], expected_change: "Focus", actionability: "IMMEDIATE", audit_status: "KEEP" },
                    ],
                    assumptions: [],
                    prerequisites: [],
                    expected_outcomes: [],
                    unknowns: [],
                    fit: { status: "GOOD", reasons: [] },
                    conflicts: [],
                    gaps: [],
                    adapted_strategy: [],
                    goal_candidates: [],
                    provenance: { source_id: "src-roadmap-pasted", extraction_status: "FETCHED" },
                  }),
                },
              ],
            },
          },
        ],
      });
    }

    if (urlStr === "https://example.com/deepwork") {
      return new Response("Deep work requires 90 minutes of unbroken focus. Without digital distraction, cognitive output peaks.", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }

    return new Response("Some content", { status: 200 });
  });

  try {
    const updatedAdaptations: Array<Record<string, unknown>> = [];

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
                                methods: [{ title: "Step 1", audit_status: "UNVERIFIED" }],
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
                    if (sProp === "in") {
                      return () =>
                        createChainableBuilder({
                          data: [
                            {
                              id: "src-deepwork-ext",
                              title: "Deep Work Study",
                              content_text: "Deep work requires 90 minutes of unbroken focus. Without digital distraction, cognitive output peaks.",
                              content_sha256: "sha-deepwork-123",
                              fetch_status: "FETCHED",
                            },
                          ],
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
                if (table === "pursuit_source_citation") {
                  return Promise.resolve({
                    data: null,
                    error: { message: "violates foreign key constraint on pursuit_source" },
                  });
                }
                return {
                  select: () => ({
                    single: async () => {
                      if (table === "pursuit_source") {
                        return { data: { id: "src-deepwork-ext" }, error: null };
                      }
                      return {
                        data: { id: "adapt-v2-inserted", ...(typeof data === "object" && data !== null ? data : {}) },
                        error: null,
                      };
                    },
                  }),
                };
              };
            }

            if (prop === "update") {
              return (data: unknown) => {
                if (table === "pursuit_source_adaptation") {
                  updatedAdaptations.push(typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {});
                }
                return createChainableBuilder({ data: [{ id: "adapt-updated" }], error: null });
              };
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
      turnKey: "turn-citation-err",
      message: "Audit my roadmap against scientific literature.",
      currentSituation: situation,
      userPolicy: {
        allow_worker_delegation: true,
        allowed_worker_types: ["BROWSER"],
        auto_execute_research: true,
      },
    });

    const errorUpdate = updatedAdaptations.find(
      (u) =>
        (u.provenance as Record<string, unknown> | undefined)?.audit_status === "INCOMPLETE" &&
        (u.provenance as Record<string, unknown> | undefined)?.citation_error
    );

    assert.ok(errorUpdate, "Citation persistence failure must update adaptation with INCOMPLETE status and citation_error");
    assert.match(
      String((errorUpdate.provenance as Record<string, unknown>).citation_error),
      /violates foreign key constraint/
    );
    assert.ok(
      Array.isArray(errorUpdate.methods) &&
        errorUpdate.methods.every((m: Record<string, unknown>) => m.audit_status === "UNVERIFIED"),
      "Methods must be marked UNVERIFIED when citation persistence fails"
    );
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});
