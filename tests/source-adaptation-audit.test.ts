import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adaptAndStoreSource } from "../lib/source-adaptation-store.ts";

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

type AuditUpdatePayload = {
  summary?: string;
  methods?: Array<Record<string, unknown>>;
  provenance?: Record<string, unknown>;
};

test("adaptAndStoreSource: marks adaptation INCOMPLETE with unsubstantiated: true when claims are unlocatable", async (t) => {
  const prevFetch = globalThis.fetch;
  const prevKey = process.env.STRYDE_GEMINI_API_KEY;
  process.env.STRYDE_GEMINI_API_KEY = "test-key";

  t.mock.method(globalThis, "fetch", async () => {
    return json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: "Generated summary",
                  source_claims: [
                    {
                      statement: "Fact that is not in the text at all",
                      basis: "EXPLICIT_SOURCE",
                      confidence: "HIGH",
                    },
                  ],
                  methods: [
                    {
                      title: "Step 1",
                      sequence: 1,
                      description: "Do something",
                      prerequisites: [],
                      expected_change: "Change",
                      actionability: "IMMEDIATE",
                      audit_status: "KEEP",
                    },
                  ],
                  assumptions: [],
                  prerequisites: [],
                  expected_outcomes: [],
                  unknowns: [],
                  fit: { status: "GOOD", reasons: [] },
                  conflicts: [],
                  gaps: [],
                  adapted_strategy: ["Strategy"],
                  goal_candidates: [],
                  provenance: {
                    source_id: "src-1",
                    uri: "https://example.com/guide",
                    content_sha256: "hash123",
                    extraction_status: "SUCCESS",
                  },
                }),
              },
            ],
          },
        },
      ],
    });
  });

  let auditStatusUpdated = false;
  let updatedParams: AuditUpdatePayload | null = null;

  try {
    const mockSupabase = {
      from: (table: string) => {
        if (table === "pursuit") {
          return createChainableBuilder({
            data: { id: "pursuit-test", title: "Test Pursuit", owner_user_id: "user-test" },
            error: null,
          });
        }
        if (table === "pursuit_source_adaptation") {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: "adap-123",
                    source_id: "src-1",
                    version: 1,
                    status: "ACTIVE",
                    summary: "Generated summary",
                    methods: [{ title: "Step 1", sequence: 1, description: "Do something", prerequisites: [], expected_change: "Change", audit_status: "KEEP" }],
                    source_claims: [{ statement: "Fact that is not in the text at all", basis: "EXPLICIT_SOURCE" }],
                    provenance: { source_id: "src-1", extraction_status: "SUCCESS" },
                  },
                  error: null,
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              auditStatusUpdated = true;
              updatedParams = payload;
              return {
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      select: async () => ({ data: [{ id: "adap-123" }], error: null }),
                    }),
                  }),
                }),
              };
            },
          };
        }
        if (table === "pursuit_source_citation") {
          return {
            insert: async () => ({ data: null, error: null }),
          };
        }
        return createChainableBuilder({ data: [], error: null });
      },
    } as unknown as SupabaseClient;

    const result = await adaptAndStoreSource({
      supabase: mockSupabase,
      trustedPlane: mockSupabase,
      ownerUserId: "user-test",
      pursuitId: "pursuit-test",
      source: {
        id: "src-1",
        uri: "https://example.com/guide",
        title: "Test Guide",
        contentText: "Completely unrelated content about something else entirely.",
        contentSha256: "hash123",
        fetchStatus: "FETCHED",
      },
    });

    assert.ok(result.warning, "Must return a warning when claims are unlocatable");
    assert.match(result.warning, /could not be (verified|substantiated)/i);
    assert.equal(auditStatusUpdated, true, "Must call updateAdaptationAuditStatus when claims cannot be substantiated");
    assert.ok(updatedParams, "updatedParams must be set");
    const auditPayload: AuditUpdatePayload = updatedParams;
    assert.equal(
      auditPayload?.provenance?.audit_status,
      "INCOMPLETE",
      "Adaptation audit status must be INCOMPLETE"
    );
    assert.equal(
      auditPayload?.methods?.[0]?.audit_status,
      "UNVERIFIED",
      "Methods must be marked UNVERIFIED"
    );
  } finally {
    globalThis.fetch = prevFetch;
    if (prevKey === undefined) delete process.env.STRYDE_GEMINI_API_KEY;
    else process.env.STRYDE_GEMINI_API_KEY = prevKey;
  }
});

test("adaptAndStoreSource: marks adaptation INCOMPLETE when citation insertion fails", async (t) => {
  const prevFetch = globalThis.fetch;
  const prevKey = process.env.STRYDE_GEMINI_API_KEY;
  process.env.STRYDE_GEMINI_API_KEY = "test-key";

  const contentText = "Specific fact substantiated here in the source document.";

  t.mock.method(globalThis, "fetch", async () => {
    return json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: "Extraction summary",
                  source_claims: [
                    {
                      statement: "Specific fact substantiated here",
                      basis: "EXPLICIT_SOURCE",
                      confidence: "HIGH",
                    },
                  ],
                  methods: [
                    {
                      title: "Step 1",
                      sequence: 1,
                      description: "Do something",
                      prerequisites: [],
                      expected_change: "Change",
                      actionability: "IMMEDIATE",
                      audit_status: "KEEP",
                    },
                  ],
                  assumptions: [],
                  prerequisites: [],
                  expected_outcomes: [],
                  unknowns: [],
                  fit: { status: "GOOD", reasons: [] },
                  conflicts: [],
                  gaps: [],
                  adapted_strategy: ["Strategy"],
                  goal_candidates: [],
                  provenance: {
                    source_id: "src-2",
                    uri: "https://example.com/guide2",
                    content_sha256: "hash456",
                    extraction_status: "SUCCESS",
                  },
                }),
              },
            ],
          },
        },
      ],
    });
  });

  let auditStatusUpdated = false;
  let updatedParams: AuditUpdatePayload | null = null;

  try {
    const mockSupabase = {
      from: (table: string) => {
        if (table === "pursuit") {
          return createChainableBuilder({
            data: { id: "pursuit-test", title: "Test Pursuit", owner_user_id: "user-test" },
            error: null,
          });
        }
        if (table === "pursuit_source_adaptation") {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: "adap-456",
                    source_id: "src-2",
                    version: 1,
                    status: "ACTIVE",
                    summary: "Extraction summary",
                    methods: [{ title: "Step 1", sequence: 1, description: "Do something", prerequisites: [], expected_change: "Change", audit_status: "KEEP" }],
                    source_claims: [{ statement: "Specific fact substantiated here", basis: "EXPLICIT_SOURCE" }],
                    provenance: { source_id: "src-2", extraction_status: "SUCCESS" },
                  },
                  error: null,
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              auditStatusUpdated = true;
              updatedParams = payload;
              return {
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      select: async () => ({ data: [{ id: "adap-456" }], error: null }),
                    }),
                  }),
                }),
              };
            },
          };
        }
        if (table === "pursuit_source_citation") {
          return {
            insert: async () => ({ data: null, error: { message: "Database connection lost during citation insert" } }),
          };
        }
        return createChainableBuilder({ data: [], error: null });
      },
    } as unknown as SupabaseClient;

    const result = await adaptAndStoreSource({
      supabase: mockSupabase,
      trustedPlane: mockSupabase,
      ownerUserId: "user-test",
      pursuitId: "pursuit-test",
      source: {
        id: "src-2",
        uri: "https://example.com/guide2",
        title: "Test Guide 2",
        contentText,
        contentSha256: "hash456",
        fetchStatus: "FETCHED",
      },
    });

    assert.ok(result.warning, "Must return a warning on citation insertion failure");
    assert.match(result.warning, /evidence citations could not be persisted/i);
    assert.equal(auditStatusUpdated, true, "Must call updateAdaptationAuditStatus when citation insertion fails");
    assert.ok(updatedParams, "updatedParams must be set");
    const auditPayload: AuditUpdatePayload = updatedParams;
    assert.equal(
      auditPayload?.provenance?.audit_status,
      "INCOMPLETE",
      "Adaptation audit status must be INCOMPLETE"
    );
    assert.ok(
      auditPayload?.provenance?.citation_error,
      "Provenance must record citation_error"
    );
  } finally {
    globalThis.fetch = prevFetch;
    if (prevKey === undefined) delete process.env.STRYDE_GEMINI_API_KEY;
    else process.env.STRYDE_GEMINI_API_KEY = prevKey;
  }
});

test("adaptAndStoreSource: marks adaptation INCOMPLETE with partial_evidence: true when citations.length < sourceClaims.length", async (t) => {
  const prevFetch = globalThis.fetch;
  const prevKey = process.env.STRYDE_GEMINI_API_KEY;
  process.env.STRYDE_GEMINI_API_KEY = "test-key";

  const contentText = "First claim is substantiated in this guide. The second claim is absent.";

  t.mock.method(globalThis, "fetch", async () => {
    return json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: "Extraction summary",
                  source_claims: [
                    { statement: "First claim is substantiated", basis: "EXPLICIT_SOURCE", confidence: "HIGH" },
                    { statement: "Completely fictitious second claim", basis: "EXPLICIT_SOURCE", confidence: "HIGH" },
                  ],
                  methods: [
                    {
                      title: "Step 1",
                      sequence: 1,
                      description: "Do something",
                      prerequisites: [],
                      expected_change: "Change",
                      actionability: "IMMEDIATE",
                      audit_status: "KEEP",
                    },
                  ],
                  assumptions: [],
                  prerequisites: [],
                  expected_outcomes: [],
                  unknowns: [],
                  fit: { status: "GOOD", reasons: [] },
                  conflicts: [],
                  gaps: [],
                  adapted_strategy: ["Strategy"],
                  goal_candidates: [],
                  provenance: {
                    source_id: "src-3",
                    uri: "https://example.com/guide3",
                    content_sha256: "hash789",
                    extraction_status: "SUCCESS",
                  },
                }),
              },
            ],
          },
        },
      ],
    });
  });

  let auditStatusUpdated = false;
  let updatedParams: AuditUpdatePayload | null = null;

  try {
    const mockSupabase = {
      from: (table: string) => {
        if (table === "pursuit") {
          return createChainableBuilder({
            data: { id: "pursuit-test", title: "Test Pursuit", owner_user_id: "user-test" },
            error: null,
          });
        }
        if (table === "pursuit_source_adaptation") {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: "adap-789",
                    source_id: "src-3",
                    version: 1,
                    status: "ACTIVE",
                    summary: "Extraction summary",
                    methods: [{ title: "Step 1", sequence: 1, description: "Do something", prerequisites: [], expected_change: "Change", audit_status: "KEEP" }],
                    source_claims: [
                      { statement: "First claim is substantiated", basis: "EXPLICIT_SOURCE" },
                      { statement: "Completely fictitious second claim", basis: "EXPLICIT_SOURCE" },
                    ],
                    provenance: { source_id: "src-3", extraction_status: "SUCCESS" },
                  },
                  error: null,
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              auditStatusUpdated = true;
              updatedParams = payload;
              return {
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      select: async () => ({ data: [{ id: "adap-789" }], error: null }),
                    }),
                  }),
                }),
              };
            },
          };
        }
        if (table === "pursuit_source_citation") {
          return {
            insert: async () => ({ data: null, error: null }),
          };
        }
        return createChainableBuilder({ data: [], error: null });
      },
    } as unknown as SupabaseClient;

    const result = await adaptAndStoreSource({
      supabase: mockSupabase,
      trustedPlane: mockSupabase,
      ownerUserId: "user-test",
      pursuitId: "pursuit-test",
      source: {
        id: "src-3",
        uri: "https://example.com/guide3",
        title: "Test Guide 3",
        contentText,
        contentSha256: "hash789",
        fetchStatus: "FETCHED",
      },
    });

    assert.ok(result.warning, "Must return a warning for partial evidence");
    assert.match(result.warning, /partially verified/i);
    assert.equal(auditStatusUpdated, true, "Must call updateAdaptationAuditStatus when only partial claims substantiated");
    assert.ok(updatedParams, "updatedParams must be set");
    const auditPayload: AuditUpdatePayload = updatedParams;
    assert.equal(
      auditPayload?.provenance?.audit_status,
      "INCOMPLETE",
      "Adaptation audit status must be INCOMPLETE"
    );
    assert.equal(
      auditPayload?.provenance?.partial_evidence,
      true,
      "Provenance must record partial_evidence: true"
    );
    assert.equal(
      auditPayload?.provenance?.substantiated_claims,
      1,
      "Provenance must record substantiated_claims: 1"
    );
    assert.equal(
      auditPayload?.provenance?.total_claims,
      2,
      "Provenance must record total_claims: 2"
    );
  } finally {
    globalThis.fetch = prevFetch;
    if (prevKey === undefined) delete process.env.STRYDE_GEMINI_API_KEY;
    else process.env.STRYDE_GEMINI_API_KEY = prevKey;
  }
});
