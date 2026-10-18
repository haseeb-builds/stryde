import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  detectDeterministicResearchRequirement,
  detectPastedRoadmapFromText,
} from "../lib/research-orchestration.ts";
import { executeWebResearch } from "../lib/research-execution.ts";
import { assertSourceAdaptation } from "../lib/adaptive-model.ts";
import { readModelProviderConfigs } from "../lib/model-provider.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function fakeSupabase(label: string, log: string[], rows?: Record<string, unknown>[]) {
  const builder = {
    insert: (data: unknown) => {
      log.push(`${label}:insert:${JSON.stringify(data)}`);
      return builder;
    },
    select: () => builder,
    single: async () => ({
      data: rows?.[0] ?? { id: `obs-${label}` },
      error: null,
    }),
  };
  return {
    client: {
      from: (table: string) => {
        log.push(`${label}:${table}`);
        return builder;
      },
    } as unknown as SupabaseClient,
  };
}

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

test("model misclassification: deterministic policy detects research requirement even when model selects a non-research move", () => {
  // Scenario: user asks for a roadmap audit, but model proposal previously chose mode "DECIDE" or "EXECUTE"
  const userMessage =
    "Here is my roadmap for customer acquisition. Step 1: Scrape LinkedIn. Step 2: Send 500 emails daily. Audit this plan and tell me what's wrong.";
  const misclassifiedWorkingState = {
    bottleneck: null,
    next_move: {
      mode: "EXECUTE",
      actor: "STRYDE",
      title: "Proceed with cold outreach",
    },
  };

  const check = detectDeterministicResearchRequirement({
    message: userMessage,
    workingState: misclassifiedWorkingState,
  });

  assert.equal(check.required, true, "Deterministic policy must override model misclassification");
  assert.equal(check.reason, "ROADMAP_AUDIT");
  assert.ok(check.query && check.query.length > 0, "A valid query must be extracted");
});

test("model misclassification: factual and regulatory inquiries trigger research deterministically", () => {
  const factualMessage =
    "What are the official compliance requirements and food safety regulations for selling baked goods online in Texas in 2026?";
  const nonResearchState = {
    bottleneck: null,
    next_move: {
      mode: "DECIDE",
      actor: "HUMAN",
      title: "Decide on food business model",
    },
  };

  const check = detectDeterministicResearchRequirement({
    message: factualMessage,
    workingState: nonResearchState,
  });

  assert.equal(check.required, true);
  assert.equal(check.reason, "FACTUAL_VERIFICATION");
  assert.ok(check.query?.toLowerCase().includes("texas"));
});

test("provider failure: executeWebResearch reports failure cleanly when all search legs fail", async (t) => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    FIRECRAWL_API_KEY: "mock-fc",
    STRYDE_SEARCH_PROVIDER: "exa",
  });
  const fetchMock = t.mock.method(globalThis, "fetch", async () => json({ error: "Upstream rate limit" }, 429));

  try {
    const log: string[] = [];
    const { client } = fakeSupabase("service", log);

    await assert.rejects(
      executeWebResearch(client, "user-1", "pursuit-1", "market research query"),
      /failed \(429\)/,
      "Provider failure should throw an informative error rather than inventing fake evidence",
    );
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("empty results: zero search results record an honest observation with result_count 0", async (t) => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    FIRECRAWL_API_KEY: undefined,
    STRYDE_SEARCH_PROVIDER: "exa",
  });
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    json({ requestId: "empty-req-1", results: [] }),
  );

  try {
    const log: string[] = [];
    const { client } = fakeSupabase("service", log);

    const execution = await executeWebResearch(
      client,
      "user-1",
      "pursuit-1",
      "obscure unindexed query that produces no hits",
    );

    assert.equal(execution.provider, "exa");
    assert.equal(execution.results.length, 0, "Must return zero results honestly without inventing citations");
    assert.ok(execution.observation_id);

    // Verify observation table received result_count: 0
    const observationInsert = log.find((l) => l.includes("result_count"));
    assert.ok(observationInsert?.includes('"result_count":0'));
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("contradictory results: conflicting evidence is captured in source adaptation with CHANGE or REMOVE", () => {
  const auditedAdaptation = {
    summary: "Audit of outbound roadmap based on contradictory empirical evidence.",
    source_claims: [
      {
        statement: "Blasting 1,000 cold emails daily from a new domain yields high conversions.",
        basis: "EXPLICIT_SOURCE",
        confidence: "HIGH",
      },
    ],
    methods: [
      {
        title: "Cold blast from unverified domain",
        sequence: 1,
        description: "Send 1,000 emails per day without warming DNS or SPF/DKIM.",
        prerequisites: [],
        expected_change: "Immediate leads.",
        actionability: "NOT_ACTIONABLE_YET",
        audit_status: "REMOVE",
      },
      {
        title: "Gradual domain warmup with DMARC/SPF",
        sequence: 2,
        description: "Ramp sending volume over 4 weeks with authenticated DNS records.",
        prerequisites: ["Custom domain"],
        expected_change: "Deliverability reaches 95%.",
        actionability: "IMMEDIATE",
        audit_status: "KEEP",
      },
    ],
    assumptions: [],
    prerequisites: [],
    expected_outcomes: [],
    unknowns: [],
    fit: {
      status: "LOW",
      reasons: ["Original claim directly contradicts ISP spam-filtering policies."],
    },
    conflicts: [
      "Evidence proves that unverified bulk emailing results in domain blacklisting within 48 hours.",
    ],
    gaps: ["No warmup protocol in original plan."],
    adapted_strategy: [
      "Remove unverified blasting; replace with authenticated warmup protocol.",
    ],
    goal_candidates: [],
    provenance: {
      source_id: "src-contra",
      uri: null,
      content_sha256: "hash123",
      extraction_status: "COMPLETED",
    },
  };

  const parsed = assertSourceAdaptation(auditedAdaptation);
  assert.equal(parsed.fit.status, "LOW");
  assert.equal(parsed.conflicts.length, 1);
  assert.equal(parsed.methods[0].audit_status, "REMOVE");
  assert.equal(parsed.methods[1].audit_status, "KEEP");
});

test("retry: executeWebResearch falls through failing first provider and serves from second", async (t) => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    FIRECRAWL_API_KEY: "mock-fc",
    STRYDE_SEARCH_PROVIDER: "exa",
  });
  let attempt = 0;
  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    attempt += 1;
    if (String(url).startsWith("https://api.exa.ai")) {
      return json({ error: "Transient server error" }, 500);
    }
    return json({
      success: true,
      data: [{ url: "https://verified-source.example", title: "Verified Guide" }],
    });
  });

  try {
    const log: string[] = [];
    const { client } = fakeSupabase("service", log);

    const execution = await executeWebResearch(
      client,
      "user-1",
      "pursuit-1",
      "multi provider retry test",
    );

    assert.equal(attempt, 2, "Should attempt both providers");
    assert.equal(execution.provider, "firecrawl", "Should failover to Firecrawl");
    assert.equal(execution.results[0].url, "https://verified-source.example");
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("interrupted research: AbortSignal is respected before and during research execution", async (t) => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
  });

  const controller = new AbortController();
  controller.abort(); // Pre-aborted signal

  const log: string[] = [];
  const { client } = fakeSupabase("service", log);

  await assert.rejects(
    executeWebResearch(client, "user-1", "pursuit-1", "aborted query", undefined, controller.signal),
    /Aborted/,
    "Should immediately abort and throw without calling network",
  );

  assert.equal(log.length, 0, "No database operations should occur when signal is aborted");

  // In-flight abort
  const inFlightController = new AbortController();
  const fetchMock = t.mock.method(globalThis, "fetch", async (_url: unknown, init: unknown) => {
    inFlightController.abort();
    const sig = (init as { signal?: AbortSignal })?.signal;
    if (sig?.aborted) throw new DOMException("Aborted", "AbortError");
    return json({ results: [] });
  });

  try {
    await assert.rejects(
      executeWebResearch(client, "user-1", "pursuit-1", "in-flight query", undefined, inFlightController.signal),
      /Aborted/,
    );
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("pasted roadmap detection identifies structured multi-step plans for canonical source ingestion", () => {
  const sampleRoadmap = `
# B2B SaaS Growth Roadmap
Phase 1: Customer Discovery
Interview 20 potential design partners.
Phase 2: MVP Prototype
Build core workflow with Next.js and Supabase.
Phase 3: Launch
Onboard 5 paying pilot customers.
  `.trim();

  const detected = detectPastedRoadmapFromText(sampleRoadmap);
  assert.equal(detected.isRoadmap, true);
  assert.equal(detected.title, "B2B SaaS Growth Roadmap");
  assert.ok(detected.content.includes("Phase 1"));

  const nonRoadmap = "Hey Stryde, how are you doing today? Can we talk about my idea?";
  const notDetected = detectPastedRoadmapFromText(nonRoadmap);
  assert.equal(notDetected.isRoadmap, false);
});

test("domain intent: fitness, career, technical, and business goals trigger research deterministically", () => {
  const fitness = detectDeterministicResearchRequirement({
    message: "What is the optimal hypertrophy volume and periodization protocol according to recent studies?",
  });
  assert.equal(fitness.required, true);
  assert.equal(fitness.reason, "DOMAIN_PURSUIT");

  const career = detectDeterministicResearchRequirement({
    message: "What are the latest salary benchmark levels and compensation data for Staff Engineers in London?",
  });
  assert.equal(career.required, true);
  assert.equal(career.reason, "DOMAIN_PURSUIT");

  const tech = detectDeterministicResearchRequirement({
    message: "What are the database tradeoffs and scalability comparison between CockroachDB and PostgreSQL for high write throughput?",
  });
  assert.equal(tech.required, true);
  assert.equal(tech.reason, "DOMAIN_PURSUIT");

  const business = detectDeterministicResearchRequirement({
    message: "What are standard B2B SaaS CAC and LTV benchmarks and churn rate industry average for seed stage startups?",
  });
  assert.equal(business.required, true);
  assert.equal(business.reason, "DOMAIN_PURSUIT");
});

test("casual chat: ordinary greetings and banter are excluded from deep research", () => {
  const greetings = ["hi", "hello!", "good morning", "thanks", "ok cool", "sounds good", "who are you?"];
  for (const msg of greetings) {
    const check = detectDeterministicResearchRequirement({ message: msg });
    assert.equal(check.required, false, `Message '${msg}' should not trigger research`);
  }
});

test("safe page retrieval: executeWebResearch attaches retrieved sources with honest locators", async (t) => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
  });

  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    if (String(url).startsWith("https://api.exa.ai")) {
      return json({
        results: [
          {
            url: "https://example.com/research-doc",
            title: "Empirical Analysis of Hypertrophy",
            highlights: ["Hypertrophy is maximized at 10-20 sets per muscle group per week."],
          },
          {
            url: "https://youtube.com/watch?v=12345",
            title: "Video Lecture on Periodization",
            highlights: [],
          },
        ],
      });
    }
    // Direct page fetch for example.com
    return new Response("<html><body><h1>Empirical Analysis</h1><p>Full study text on hypertrophy training volume...</p></body></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  });

  try {
    const log: string[] = [];
    const { client } = fakeSupabase("service", log);

    const execution = await executeWebResearch(
      client,
      "user-1",
      "pursuit-1",
      "hypertrophy volume studies",
    );

    assert.equal(execution.results.length, 2);
    assert.equal(execution.retrieved_sources.length, 2);

    const docSource = execution.retrieved_sources.find((s) => s.url === "https://example.com/research-doc");
    assert.ok(docSource);
    assert.equal(docSource.locator_type, "FULL_TEXT");
    assert.ok(docSource.content_locator.includes("#sha256:"));

    const videoSource = execution.retrieved_sources.find((s) => s.url.includes("youtube.com"));
    assert.ok(videoSource);
    assert.equal(videoSource.locator_type, "TRANSCRIPT_UNAVAILABLE");
    assert.equal(videoSource.content_locator, "https://youtube.com/watch?v=12345#media");
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("gemini env var reconciliation: GEMINI_API_KEY and GOOGLE_AI_STUDIO_API_KEY configure Gemini leg", () => {
  const envWithGemini = { GEMINI_API_KEY: "test-gemini-key" } as unknown as NodeJS.ProcessEnv;
  const configs1 = readModelProviderConfigs(envWithGemini);
  assert.equal(configs1[0].provider, "gemini");
  assert.equal(configs1[0].apiKey, "test-gemini-key");

  const envWithGoogle = { GOOGLE_AI_STUDIO_API_KEY: "test-google-key" } as unknown as NodeJS.ProcessEnv;
  const configs2 = readModelProviderConfigs(envWithGoogle);
  assert.equal(configs2[0].provider, "gemini");
  assert.equal(configs2[0].apiKey, "test-google-key");
});

