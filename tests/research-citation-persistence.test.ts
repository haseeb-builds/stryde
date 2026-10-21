import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdaptiveSituation } from "../lib/adaptive-situation.ts";
import { executeResearchAndRoadmapOrchestration } from "../lib/research-orchestration.ts";
import { validatePursuitSourceCitationRow, type PursuitSourceCitationInsert } from "../lib/source-citation.ts";

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

test("R-1 schema contract validation: rejects missing fields and invalid legacy column names", () => {
  // Missing required fields
  assert.throws(
    () => validatePursuitSourceCitationRow({}),
    /owner_user_id/
  );
  assert.throws(
    () => validatePursuitSourceCitationRow({ owner_user_id: "user-1" }),
    /pursuit_id/
  );
  assert.throws(
    () => validatePursuitSourceCitationRow({ owner_user_id: "user-1", pursuit_id: "pursuit-1" }),
    /source_id/
  );
  assert.throws(
    () => validatePursuitSourceCitationRow({ owner_user_id: "user-1", pursuit_id: "pursuit-1", source_id: "src-1" }),
    /source_content_sha256/
  );
  assert.throws(
    () => validatePursuitSourceCitationRow({
      owner_user_id: "user-1",
      pursuit_id: "pursuit-1",
      source_id: "src-1",
      source_content_sha256: "hash-1",
    }),
    /locator/
  );
  assert.throws(
    () => validatePursuitSourceCitationRow({
      owner_user_id: "user-1",
      pursuit_id: "pursuit-1",
      source_id: "src-1",
      source_content_sha256: "hash-1",
      locator: { type: "CHARACTER_RANGE" },
    }),
    /excerpt/
  );
  assert.throws(
    () => validatePursuitSourceCitationRow({
      owner_user_id: "user-1",
      pursuit_id: "pursuit-1",
      source_id: "src-1",
      source_content_sha256: "hash-1",
      locator: { type: "CHARACTER_RANGE" },
      excerpt: "Sample excerpt",
      basis: "INVALID_BASIS",
    }),
    /basis must be EXPLICIT_SOURCE or INFERRED/
  );

  // Rejection of legacy incompatible columns that caused defect R-1
  const validBase = {
    owner_user_id: "user-1",
    pursuit_id: "pursuit-1",
    source_id: "src-1",
    source_content_sha256: "hash-1",
    locator: { type: "CHARACTER_RANGE", start: 0, end: 10, located: true },
    excerpt: "Sample excerpt",
    basis: "EXPLICIT_SOURCE" as const,
  };

  assert.throws(
    () => validatePursuitSourceCitationRow({ ...validBase, quote: "some quote" }),
    /quote is invalid/
  );
  assert.throws(
    () => validatePursuitSourceCitationRow({ ...validBase, content_sha256: "hash-1" }),
    /content_sha256 is invalid/
  );
  assert.throws(
    () => validatePursuitSourceCitationRow({ ...validBase, locator_type: "FULL_TEXT" }),
    /locator_type is not a column/
  );
  assert.throws(
    () => validatePursuitSourceCitationRow({ ...validBase, metadata: {} }),
    /metadata is not a column/
  );

  // Valid row passes without error
  const validated = validatePursuitSourceCitationRow(validBase);
  assert.equal(validated.owner_user_id, "user-1");
  assert.equal(validated.source_content_sha256, "hash-1");
});

test("R-1 post-research roadmap reassessment: persists valid schema-conforming citations linked to external retrieved source, not roadmap", async (t) => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
    STRYDE_MODEL_PROVIDER: "gemini",
    STRYDE_MODEL_API_KEY: "mock-gemini-key",
  });

  const externalArticleContent = "Peer-reviewed study establishes that sprint interval training improves VO2max by 12% in 4 weeks.";
  const externalSha256 = "ext-sha256-abc123456789";
  const externalSourceId = "ext-src-uuid-999";

  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    const urlStr = String(url);
    if (urlStr.startsWith("https://api.exa.ai")) {
      return json({
        results: [
          {
            url: "https://example.com/sprint-study",
            title: "Sprint Interval Training Study",
            highlights: ["sprint interval training improves VO2max"],
          },
        ],
      });
    }

    // Mock Gemini API for runSourceAdaptation
    if (urlStr.includes("generativelanguage.googleapis.com") || urlStr.includes("openrouter.ai")) {
      return json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: "Re-assessed roadmap based on sprint study",
                    source_claims: [
                      {
                        statement: "sprint interval training improves VO2max by 12% in 4 weeks.",
                        basis: "EXPLICIT_SOURCE",
                        confidence: "HIGH",
                      },
                    ],
                    methods: [
                      {
                        title: "Sprint Intervals",
                        sequence: 1,
                        description: "Run 4x400m sprints twice weekly",
                        prerequisites: [],
                        expected_change: "Increase VO2max",
                        actionability: "IMMEDIATE",
                        audit_status: "KEEP",
                      },
                    ],
                    assumptions: [],
                    prerequisites: [],
                    expected_outcomes: ["VO2max increase"],
                    unknowns: [],
                    fit: { status: "GOOD", reasons: ["Direct match"] },
                    conflicts: [],
                    gaps: [],
                    adapted_strategy: ["Follow 4-week protocol"],
                    goal_candidates: [],
                    provenance: {
                      source_id: externalSourceId,
                      uri: "https://example.com/sprint-study",
                      content_sha256: externalSha256,
                      extraction_status: "FETCHED",
                    },
                  }),
                },
              ],
            },
          },
        ],
      });
    }

    // Return external article HTML
    return new Response(
      `<html><body><article>${externalArticleContent}</article></body></html>`,
      { status: 200 }
    );
  });

  try {
    const mockTrustedPlane = {
      rpc: async (method: string) => {
        if (method === "stryde_reserve_resources") return { data: "grp-r1-test", error: null };
        return { data: null, error: null };
      },
      from: () => createChainableBuilder({ data: [], error: null }),
    } as unknown as SupabaseClient;

    const insertedCitations: PursuitSourceCitationInsert[] = [];
    const insertedRows: Array<{ table: string; data: unknown }> = [];
    const updatedRows: Array<{ table: string; data: unknown }> = [];

    const existingV1Adaptation = {
      id: "adapt-v1-roadmap",
      source_id: "src-roadmap-pasted-id",
      version: 1,
      status: "ADVISED",
      summary: "User's preliminary marathon roadmap",
      methods: [
        {
          title: "Sprint Intervals",
          sequence: 1,
          description: "Run 4x400m sprints twice weekly",
          prerequisites: [],
          expected_change: "Increase VO2max",
          actionability: "IMMEDIATE",
          audit_status: "UNVERIFIED",
        },
      ],
      source_claims: [
        {
          statement: "sprint interval training improves VO2max by 12% in 4 weeks.",
          basis: "EXPLICIT_SOURCE",
          confidence: "HIGH",
        },
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
      provenance: { source_id: "src-roadmap-pasted-id", intake: "PRELIMINARY" },
    };

    const mockSupabase = {
      from: (table: string) => {
        const handler: ProxyHandler<object> = {
          get(target, prop) {
            if (prop === "insert") {
              return (data: unknown) => {
                insertedRows.push({ table, data });

                if (table === "pursuit_source_citation") {
                  const rows = Array.isArray(data) ? data : [data];
                  for (const row of rows) {
                    // Strictly validate schema contract!
                    const validated = validatePursuitSourceCitationRow(row);
                    insertedCitations.push(validated);
                  }
                  return Promise.resolve({ data: rows, error: null });
                }

                if (table === "pursuit_source") {
                  return {
                    select: () => ({
                      single: async () => ({
                        data: {
                          id: externalSourceId,
                          ...(typeof data === "object" && data !== null ? data : {}),
                        },
                        error: null,
                      }),
                    }),
                  };
                }

                return {
                  select: () => ({
                    single: async () => ({
                      data: {
                        id: `id-${table}-v2`,
                        ...(typeof data === "object" && data !== null ? data : {}),
                      },
                      error: null,
                    }),
                  }),
                };
              };
            }

            if (prop === "update") {
              return (data: unknown) => {
                updatedRows.push({ table, data });
                return createChainableBuilder({ data: null, error: null });
              };
            }

            if (prop === "select") {
              return () => {
                const selectHandler: ProxyHandler<object> = {
                  get(sTarget, sProp) {
                    if (sProp === "then") {
                      if (table === "pursuit_source_adaptation") {
                        return (resolve: (val: unknown) => unknown) =>
                          Promise.resolve({ data: [existingV1Adaptation], error: null }).then(resolve);
                      }
                      return (resolve: (val: unknown) => unknown) =>
                        Promise.resolve({ data: [], error: null }).then(resolve);
                    }

                    if (sProp === "single" || sProp === "maybeSingle") {
                      return async () => {
                        if (table === "pursuit_source") {
                          return {
                            data: {
                              id: "src-roadmap-pasted-id",
                              uri: null,
                              title: "My Training Plan",
                              content_text: "My training plan text",
                              content_sha256: "roadmap-sha-original",
                              fetch_status: "FETCHED",
                            },
                            error: null,
                          };
                        }
                        return { data: null, error: null };
                      };
                    }

                    if (sProp === "in") {
                      return () =>
                        createChainableBuilder({
                          data: [
                            {
                              id: externalSourceId,
                              uri: "https://example.com/sprint-study",
                              title: "Sprint Interval Training Study",
                              content_text: externalArticleContent,
                              content_sha256: externalSha256,
                              fetch_status: "FETCHED",
                            },
                          ],
                          error: null,
                        });
                    }

                    return () => new Proxy({}, selectHandler);
                  },
                };
                return new Proxy({}, selectHandler);
              };
            }

            return () => new Proxy({}, handler);
          },
        };
        return new Proxy({}, handler) as unknown as ReturnType<SupabaseClient["from"]>;
      },
    } as unknown as SupabaseClient;

    const situation = {
      capabilities: { web_search: true },
      observations: [],
      sources: [],
    } as unknown as AdaptiveSituation;

    const result = await executeResearchAndRoadmapOrchestration({
      supabase: mockSupabase,
      trustedPlane: mockTrustedPlane,
      ownerUserId: "user-123",
      pursuitId: "pursuit-456",
      turnKey: "turn-r1-verify",
      message: "Please audit my marathon training roadmap against scientific evidence.",
      currentSituation: situation,
      userPolicy: {
        allow_worker_delegation: true,
        allowed_worker_types: ["BROWSER"],
        auto_execute_research: true,
      },
    });

    assert.equal(result.executed, true);

    // Citations MUST have been persisted and validated against the schema contract
    assert.ok(insertedCitations.length > 0, "At least one citation must be persisted");

    for (const citation of insertedCitations) {
      // Must link to the actual retrieved EXTERNAL source, NOT the pasted roadmap
      assert.notEqual(
        citation.source_id,
        "src-roadmap-pasted-id",
        "Must NOT cite the pasted roadmap as external evidence"
      );
      assert.equal(
        citation.source_id,
        externalSourceId,
        "Must link citation to the retrieved external pursuit_source row"
      );

      // Must have actual external source content hash
      assert.equal(
        citation.source_content_sha256,
        externalSha256,
        "Must carry the external retrieved source content hash"
      );

      // Foreign key / ownership check
      assert.equal(citation.owner_user_id, "user-123");
      assert.equal(citation.pursuit_id, "pursuit-456");
      assert.equal(citation.adaptation_id, "id-pursuit_source_adaptation-v2");

      // Locator must be jsonb object with character offsets or locator details
      assert.equal(typeof citation.locator, "object");
      assert.ok(citation.locator !== null);
      assert.ok("type" in citation.locator);

      // Excerpt and basis
      assert.ok(citation.excerpt.length > 0);
      assert.ok(["EXPLICIT_SOURCE", "INFERRED"].includes(citation.basis));
    }
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("R-1 multiple citations: accurately maps multiple claims to retrieved source citations with locators and claim_text", async (t) => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
    STRYDE_MODEL_PROVIDER: "gemini",
    STRYDE_MODEL_API_KEY: "mock-gemini-key",
  });

  const externalArticleContent =
    "Claim One: Morning hydration optimizes cognitive clarity. " +
    "Claim Two: Zone 2 cardio improves mitochondrial efficiency by 15%. " +
    "Claim Three: Protein distribution throughout the day maximizes muscle synthesis.";
  const externalSha256 = "ext-sha256-multi-test-hash";
  const externalSourceId = "ext-src-multi-123";

  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    const urlStr = String(url);
    if (urlStr.startsWith("https://api.exa.ai")) {
      return json({
        results: [
          {
            url: "https://example.com/multi-study",
            title: "Multi-factor Physiology Study",
            highlights: ["hydration optimizes", "Zone 2 cardio", "Protein distribution"],
          },
        ],
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
                    summary: "Multi-claim roadmap re-assessment",
                    source_claims: [
                      {
                        statement: "Morning hydration optimizes cognitive clarity.",
                        basis: "EXPLICIT_SOURCE",
                        confidence: "HIGH",
                      },
                      {
                        statement: "Zone 2 cardio improves mitochondrial efficiency by 15%.",
                        basis: "EXPLICIT_SOURCE",
                        confidence: "HIGH",
                      },
                      {
                        statement: "Protein distribution throughout the day maximizes muscle synthesis.",
                        basis: "EXPLICIT_SOURCE",
                        confidence: "HIGH",
                      },
                    ],
                    methods: [
                      {
                        title: "Morning Protocol",
                        sequence: 1,
                        description: "Hydrate immediately upon waking",
                        prerequisites: [],
                        expected_change: "Clarity",
                        actionability: "IMMEDIATE",
                        audit_status: "KEEP",
                      },
                    ],
                    assumptions: [],
                    prerequisites: [],
                    expected_outcomes: [],
                    unknowns: [],
                    fit: { status: "GOOD", reasons: ["Matches goals"] },
                    conflicts: [],
                    gaps: [],
                    adapted_strategy: [],
                    goal_candidates: [],
                    provenance: {
                      source_id: externalSourceId,
                      uri: "https://example.com/multi-study",
                      content_sha256: externalSha256,
                      extraction_status: "FETCHED",
                    },
                  }),
                },
              ],
            },
          },
        ],
      });
    }

    return new Response(externalArticleContent, { status: 200 });
  });

  try {
    const mockTrustedPlane = {
      rpc: async (method: string) => {
        if (method === "stryde_reserve_resources") return { data: "grp-multi-test", error: null };
        return { data: null, error: null };
      },
      from: () => createChainableBuilder({ data: [], error: null }),
    } as unknown as SupabaseClient;

    const insertedCitations: PursuitSourceCitationInsert[] = [];

    const existingV1Adaptation = {
      id: "adapt-v1-multi",
      source_id: "src-roadmap-multi-id",
      version: 1,
      status: "ADVISED",
      summary: "Multi-step roadmap intake",
      methods: [
        {
          title: "Step 1",
          sequence: 1,
          description: "Preliminary step",
          prerequisites: [],
          expected_change: "Init",
          actionability: "IMMEDIATE",
          audit_status: "UNVERIFIED",
        },
      ],
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
      provenance: { source_id: "src-roadmap-multi-id", intake: "PRELIMINARY" },
    };

    const mockSupabase = {
      from: (table: string) => {
        const handler: ProxyHandler<object> = {
          get(target, prop) {
            if (prop === "insert") {
              return (data: unknown) => {
                if (table === "pursuit_source_citation") {
                  const rows = Array.isArray(data) ? data : [data];
                  for (const row of rows) {
                    const validated = validatePursuitSourceCitationRow(row);
                    insertedCitations.push(validated);
                  }
                  return Promise.resolve({ data: rows, error: null });
                }

                if (table === "pursuit_source") {
                  return {
                    select: () => ({
                      single: async () => ({
                        data: {
                          id: externalSourceId,
                          ...(typeof data === "object" && data !== null ? data : {}),
                        },
                        error: null,
                      }),
                    }),
                  };
                }

                return {
                  select: () => ({
                    single: async () => ({
                      data: {
                        id: `id-${table}-multi-v2`,
                        ...(typeof data === "object" && data !== null ? data : {}),
                      },
                      error: null,
                    }),
                  }),
                };
              };
            }

            if (prop === "update") {
              return () => createChainableBuilder({ data: null, error: null });
            }

            if (prop === "select") {
              return () => {
                const selectHandler: ProxyHandler<object> = {
                  get(sTarget, sProp) {
                    if (sProp === "then") {
                      if (table === "pursuit_source_adaptation") {
                        return (resolve: (val: unknown) => unknown) =>
                          Promise.resolve({ data: [existingV1Adaptation], error: null }).then(resolve);
                      }
                      return (resolve: (val: unknown) => unknown) =>
                        Promise.resolve({ data: [], error: null }).then(resolve);
                    }

                    if (sProp === "single" || sProp === "maybeSingle") {
                      return async () => ({
                        data: {
                          id: "src-roadmap-multi-id",
                          uri: null,
                          title: "Multi Roadmap",
                          content_text: "Multi roadmap text",
                          content_sha256: "roadmap-sha-multi",
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
                              id: externalSourceId,
                              uri: "https://example.com/multi-study",
                              title: "Multi-factor Physiology Study",
                              content_text: externalArticleContent,
                              content_sha256: externalSha256,
                              fetch_status: "FETCHED",
                            },
                          ],
                          error: null,
                        });
                    }

                    return () => new Proxy({}, selectHandler);
                  },
                };
                return new Proxy({}, selectHandler);
              };
            }

            return () => new Proxy({}, handler);
          },
        };
        return new Proxy({}, handler) as unknown as ReturnType<SupabaseClient["from"]>;
      },
    } as unknown as SupabaseClient;

    const situation = {
      capabilities: { web_search: true },
      observations: [],
      sources: [],
    } as unknown as AdaptiveSituation;

    await executeResearchAndRoadmapOrchestration({
      supabase: mockSupabase,
      trustedPlane: mockTrustedPlane,
      ownerUserId: "user-multi",
      pursuitId: "pursuit-multi",
      turnKey: "turn-multi-test",
      message: "Audit my full wellness plan against empirical studies.",
      currentSituation: situation,
      userPolicy: {
        allow_worker_delegation: true,
        allowed_worker_types: ["BROWSER"],
        auto_execute_research: true,
      },
    });

    // Exactly 3 citations must be persisted
    assert.equal(insertedCitations.length, 3, "All 3 claims must produce valid citations");

    // All must link to external source, not the roadmap
    for (const citation of insertedCitations) {
      assert.equal(citation.source_id, externalSourceId);
      assert.equal(citation.source_content_sha256, externalSha256);
      assert.equal(citation.owner_user_id, "user-multi");
      assert.equal(citation.pursuit_id, "pursuit-multi");
      assert.equal(citation.adaptation_id, "id-pursuit_source_adaptation-multi-v2");
      assert.equal(typeof citation.locator, "object");
      assert.ok(citation.locator !== null);
      assert.equal(citation.locator.located, true, "Each exact claim must be located in content");
      assert.ok(citation.locator.claim_text, "claim_text must be preserved in locator");
    }

    assert.equal(insertedCitations[0].excerpt, "Morning hydration optimizes cognitive clarity.");
    assert.equal(insertedCitations[1].excerpt, "Zone 2 cardio improves mitochondrial efficiency by 15%.");
    assert.equal(insertedCitations[2].excerpt, "Protein distribution throughout the day maximizes muscle synthesis.");
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("R-1 insert failure handling: does not swallow citation failure, updates adaptation status honestly", async (t) => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
    STRYDE_MODEL_PROVIDER: "gemini",
    STRYDE_MODEL_API_KEY: "mock-gemini-key",
  });

  const externalArticleContent = "Research paper content.";
  const externalSha256 = "ext-sha256-failure-test";
  const externalSourceId = "ext-src-fail-1";

  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    const urlStr = String(url);
    if (urlStr.startsWith("https://api.exa.ai")) {
      return json({
        results: [
          { url: "https://example.com/paper", title: "Paper", highlights: ["research findings"] },
        ],
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
                    summary: "Roadmap re-assessment",
                    source_claims: [
                      { statement: "research findings", basis: "EXPLICIT_SOURCE", confidence: "HIGH" },
                    ],
                    methods: [
                      { title: "Step 1", sequence: 1, description: "Do step 1", prerequisites: [], expected_change: "Done", actionability: "IMMEDIATE", audit_status: "KEEP" },
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
                    provenance: {
                      source_id: externalSourceId,
                      uri: "https://example.com/paper",
                      content_sha256: externalSha256,
                      extraction_status: "FETCHED",
                    },
                  }),
                },
              ],
            },
          },
        ],
      });
    }

    return new Response(externalArticleContent, { status: 200 });
  });

  try {
    const mockTrustedPlane = {
      rpc: async (method: string) => {
        if (method === "stryde_reserve_resources") return { data: "grp-fail-test", error: null };
        return { data: null, error: null };
      },
      from: () => createChainableBuilder({ data: [], error: null }),
    } as unknown as SupabaseClient;

    const updatedAdaptations: Array<Record<string, unknown>> = [];

    const mockSupabase = {
      from: (table: string) => {
        const handler: ProxyHandler<object> = {
          get(target, prop) {
            if (prop === "insert") {
              return (data: unknown) => {
                if (table === "pursuit_source_citation") {
                  // Simulate database error on citation insertion (e.g. FK violation, DB down)
                  return Promise.resolve({
                    data: null,
                    error: { message: "violates foreign key constraint pursuit_source_citation_source_id_fkey" },
                  });
                }
                if (table === "pursuit_source") {
                  return {
                    select: () => ({
                      single: async () => ({
                        data: { id: externalSourceId, ...(typeof data === "object" && data !== null ? data : {}) },
                        error: null,
                      }),
                    }),
                  };
                }
                return {
                  select: () => ({
                    single: async () => ({
                      data: { id: "adapt-v2-inserted", ...(typeof data === "object" && data !== null ? data : {}) },
                      error: null,
                    }),
                  }),
                };
              };
            }

            if (prop === "update") {
              return (data: unknown) => {
                if (table === "pursuit_source_adaptation") {
                  updatedAdaptations.push(typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {});
                }
                return createChainableBuilder({ data: null, error: null });
              };
            }

            if (prop === "select") {
              return () => {
                const selectHandler: ProxyHandler<object> = {
                  get(sTarget, sProp) {
                    if (sProp === "then") {
                      if (table === "pursuit_source_adaptation") {
                        return (resolve: (val: unknown) => unknown) =>
                          Promise.resolve({
                            data: [
                              {
                                id: "adapt-v1-roadmap",
                                source_id: "src-roadmap-pasted-id",
                                version: 1,
                                status: "ADVISED",
                                summary: "Roadmap intake",
                                methods: [{ title: "Step 1", sequence: 1, description: "Do step 1", prerequisites: [], expected_change: "Done", actionability: "IMMEDIATE", audit_status: "UNVERIFIED" }],
                                source_claims: [{ statement: "research findings", basis: "EXPLICIT_SOURCE", confidence: "HIGH" }],
                                assumptions: [],
                                prerequisites: [],
                                expected_outcomes: [],
                                unknowns: [],
                                fit: { status: "GOOD", reasons: [] },
                                conflicts: [],
                                gaps: [],
                                adapted_strategy: [],
                                goal_candidates: [],
                                provenance: { source_id: "src-roadmap-pasted-id", intake: "PRELIMINARY" },
                              },
                            ],
                            error: null,
                          }).then(resolve);
                      }
                      return (resolve: (val: unknown) => unknown) =>
                        Promise.resolve({ data: [], error: null }).then(resolve);
                    }

                    if (sProp === "single" || sProp === "maybeSingle") {
                      return async () => ({
                        data: {
                          id: "src-roadmap-pasted-id",
                          uri: null,
                          title: "Roadmap",
                          content_text: "Roadmap content",
                          content_sha256: "roadmap-sha",
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
                              id: externalSourceId,
                              uri: "https://example.com/paper",
                              title: "Paper",
                              content_text: externalArticleContent,
                              content_sha256: externalSha256,
                              fetch_status: "FETCHED",
                            },
                          ],
                          error: null,
                        });
                    }

                    return () => new Proxy({}, selectHandler);
                  },
                };
                return new Proxy({}, selectHandler);
              };
            }

            return () => new Proxy({}, handler);
          },
        };
        return new Proxy({}, handler) as unknown as ReturnType<SupabaseClient["from"]>;
      },
    } as unknown as SupabaseClient;

    const situation = {
      capabilities: { web_search: true },
      observations: [],
      sources: [],
    } as unknown as AdaptiveSituation;

    await executeResearchAndRoadmapOrchestration({
      supabase: mockSupabase,
      trustedPlane: mockTrustedPlane,
      ownerUserId: "user-fail",
      pursuitId: "pursuit-fail",
      turnKey: "turn-citation-fail",
      message: "Audit my roadmap against scientific literature.",
      currentSituation: situation,
      userPolicy: {
        allow_worker_delegation: true,
        allowed_worker_types: ["BROWSER"],
        auto_execute_research: true,
      },
    });

    // An update MUST have occurred marking the adaptation incomplete or warning about citation failure
    const honestUpdate = updatedAdaptations.find(
      (u) =>
        (u.provenance as Record<string, unknown> | undefined)?.audit_status === "INCOMPLETE" ||
        (u.provenance as Record<string, unknown> | undefined)?.citation_error ||
        (Array.isArray(u.methods) && u.methods.every((m: Record<string, unknown>) => m.audit_status === "UNVERIFIED"))
    );

    assert.ok(
      honestUpdate,
      "When citation insertion fails, adaptation must honestly record failure rather than claiming evidence was persisted"
    );
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});
