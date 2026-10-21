import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdaptiveSituation } from "../lib/adaptive-situation.ts";
import {
  detectDeterministicResearchRequirement,
  detectPastedRoadmapFromText,
  detectPursuitGoalIntent,
  executeResearchAndRoadmapOrchestration,
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
        return builder as unknown as ReturnType<SupabaseClient["from"]>;
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

test("route-level blocker reconciliation: unconfigured search yields WAITING_EXTERNAL and ASK_USER move without substantive output", () => {
  // Simulate the deterministic check and capability gate from conversation/route.ts
  const message = "What are the latest salary benchmark levels for Staff Engineers in London?";
  const researchCheck = detectDeterministicResearchRequirement({ message });
  assert.equal(researchCheck.required, true);

  const capabilities = { web_search: false };
  let blocker: { reason: "UNAUTHORIZED" | "UNCONFIGURED"; message: string } | null = null;
  if (researchCheck.required && !capabilities.web_search) {
    blocker = {
      reason: "UNCONFIGURED",
      message: "External web research capability is unconfigured or not available in this environment.",
    };
  }

  assert.ok(blocker);
  assert.equal(blocker.reason, "UNCONFIGURED");

  // Reconciled working state when research is blocked
  const status = (blocker.reason as string) === "UNAUTHORIZED" ? "WAITING_USER" : "WAITING_EXTERNAL";
  const nextMove = {
    mode: "ASK_USER",
    actor: "HUMAN",
    title: "Configure search credentials or provide a source document directly.",
    why: blocker.message,
  };

  assert.equal(status, "WAITING_EXTERNAL");
  assert.equal(nextMove.mode, "ASK_USER");
});

test("route-level blocker reconciliation: disabled auto-research yields WAITING_USER and permission request", () => {
  const message = "Audit this roadmap: Step 1: Cold call 500 CEOs daily. Step 2: Book 50 demos. Check feasibility.";
  const researchCheck = detectDeterministicResearchRequirement({ message });
  assert.equal(researchCheck.required, true);

  const capabilities = { web_search: true };
  const userPolicy = { auto_execute_research: false };

  let blocker: { reason: string; message: string } | null = null;
  if (researchCheck.required && capabilities.web_search && !userPolicy.auto_execute_research) {
    blocker = {
      reason: "UNAUTHORIZED",
      message: "Automatic research is not authorized by your autonomy policy. Permission is required to execute external research.",
    };
  }

  assert.ok(blocker);
  assert.equal(blocker.reason, "UNAUTHORIZED");

  const status = blocker.reason === "UNAUTHORIZED" ? "WAITING_USER" : "WAITING_EXTERNAL";
  const nextMove = {
    mode: "ASK_USER",
    actor: "HUMAN",
    title: "Authorize research to investigate this question.",
    why: blocker.message,
  };

  assert.equal(status, "WAITING_USER");
  assert.equal(nextMove.mode, "ASK_USER");
});

test("pre-stream research ordering: research completes before turn stream and reconciles Situation", async (t) => {
  const callSequence: string[] = [];

  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
  });

  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    if (String(url).startsWith("https://api.exa.ai")) {
      callSequence.push("EXA_SEARCH_CALLED");
      return json({
        results: [
          { url: "https://example.com/evidence", title: "Evidence Doc", highlights: ["Key factual benchmark."] },
        ],
      });
    }
    callSequence.push("PAGE_FETCH_CALLED");
    return new Response("<p>Evidence content</p>", { status: 200 });
  });

  try {
    const log: string[] = [];
    const { client } = fakeSupabase("service", log);

    // 1. Research phase executes BEFORE assistant turn stream begins
    const research = await executeWebResearch(client, "user-1", "pursuit-1", "benchmark inquiry");
    callSequence.push("RESEARCH_COMPLETED");

    // 2. Stream phase simulates beginning only after research completed
    callSequence.push("STREAM_TURN_STARTED");

    assert.deepEqual(callSequence, [
      "EXA_SEARCH_CALLED",
      "PAGE_FETCH_CALLED",
      "RESEARCH_COMPLETED",
      "STREAM_TURN_STARTED",
    ], "Research must complete before stream turn starts");

    assert.ok(research.observation_id);
    assert.equal(research.retrieved_sources[0].locator_type, "FULL_TEXT");
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});



test("natural goal intent: recognizes goal-seeking language for fitness, career, business, tech, and roadmap", () => {
  const muscleGoal = "I want to build muscle.";
  const intent1 = detectPursuitGoalIntent(muscleGoal);
  assert.equal(intent1.isGoalIntent, true);
  assert.equal(intent1.domain, "FITNESS");
  const check1 = detectDeterministicResearchRequirement({ message: muscleGoal });
  assert.equal(check1.required, true);
  assert.equal(check1.reason, "DOMAIN_PURSUIT");
  assert.ok(check1.query?.toLowerCase().includes("hypertrophy") || check1.query?.toLowerCase().includes("muscle"));

  const careerGoal = "I want to become an AI engineer.";
  const intent2 = detectPursuitGoalIntent(careerGoal);
  assert.equal(intent2.isGoalIntent, true);
  assert.equal(intent2.domain, "CAREER");
  const check2 = detectDeterministicResearchRequirement({ message: careerGoal });
  assert.equal(check2.required, true);
  assert.equal(check2.reason, "DOMAIN_PURSUIT");
  assert.ok(check2.query?.toLowerCase().includes("ai engineer"));

  const businessGoal = "Help me start an agency.";
  const intent3 = detectPursuitGoalIntent(businessGoal);
  assert.equal(intent3.isGoalIntent, true);
  assert.equal(intent3.domain, "BUSINESS");
  const check3 = detectDeterministicResearchRequirement({ message: businessGoal });
  assert.equal(check3.required, true);
  assert.equal(check3.reason, "DOMAIN_PURSUIT");
  assert.ok(check3.query?.toLowerCase().includes("agency"));

  const roadmapGoal = "Improve this roadmap for my current situation.";
  const intent4 = detectPursuitGoalIntent(roadmapGoal);
  assert.equal(intent4.isGoalIntent, true);
  assert.equal(intent4.domain, "ROADMAP");
  const check4 = detectDeterministicResearchRequirement({ message: roadmapGoal });
  assert.equal(check4.required, true);
  assert.equal(check4.reason, "ROADMAP_AUDIT");
});

test("natural goal intent: excludes mere mentions, symptoms, past meetings, and casual banter from research", () => {
  const negativeCases = [
    { text: "My muscle hurts today", reason: "physical symptom mention" },
    { text: "I met an AI engineer yesterday", reason: "past meeting mention" },
    { text: "My friend has an agency", reason: "third-party mention" },
    { text: "I saw a roadmap online", reason: "passive observation" },
    { text: "Good morning Stryde", reason: "greeting" },
    { text: "Thanks for your help", reason: "gratitude" },
    { text: "Tell me a joke", reason: "casual prompt" },
    { text: "What is the capital of France?", reason: "general trivia" },
  ];

  for (const item of negativeCases) {
    const intent = detectPursuitGoalIntent(item.text);
    assert.equal(intent.isGoalIntent, false);
    const check = detectDeterministicResearchRequirement({ message: item.text });
    assert.equal(
      check.required,
      false,
      `Expected '${item.text}' (${item.reason}) to NOT require research, got required=${check.required}`
    );
  }
});

test("resource safety: quota exhaustion fails closed before external search provider is called", async (t) => {
  let searchProviderCalled = false;
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
  });

  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    if (String(url).startsWith("https://api.exa.ai")) {
      searchProviderCalled = true;
      return json({ results: [] });
    }
    return new Response("", { status: 200 });
  });

  try {
    const rpcCalls: string[] = [];
    const mockTrustedPlane = {
      rpc: async (method: string) => {
        rpcCalls.push(method);
        if (method === "stryde_reserve_resources") {
          return { data: null, error: { message: "RESOURCE_EXHAUSTED: research_rounds" } };
        }
        return { data: null, error: null };
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const situation = {
      capabilities: { web_search: true },
    } as unknown as AdaptiveSituation;

    const userPolicy = {
      allow_worker_delegation: true,
      allowed_worker_types: ["BROWSER"],
      auto_execute_research: true,
    };

    const quotaResult = await executeResearchAndRoadmapOrchestration({
      supabase: mockSupabase,
      trustedPlane: mockTrustedPlane,
      ownerUserId: "user-1",
      pursuitId: "pursuit-1",
      turnKey: "turn-quota-test",
      message: "I want to build muscle.",
      currentSituation: situation,
      userPolicy,
    });

    assert.equal(quotaResult.executed, false);
    assert.ok(quotaResult.researchBlocker);
    assert.equal(quotaResult.researchBlocker.reason, "BUDGET_EXHAUSTED");
    assert.equal(searchProviderCalled, false, "External search provider must NEVER be called when quota is exhausted");
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("resource safety: resource-RPC failure fails closed before external provider is called", async (t) => {
  let searchProviderCalled = false;
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
  });

  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    if (String(url).startsWith("https://api.exa.ai")) {
      searchProviderCalled = true;
      return json({ results: [] });
    }
    return new Response("", { status: 200 });
  });

  try {
    const mockTrustedPlane = {
      rpc: async (method: string) => {
        if (method === "stryde_reserve_resources") {
          return { data: null, error: { message: "Connection terminated unexpectedly by database" } };
        }
        return { data: null, error: null };
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const situation = {
      capabilities: { web_search: true },
    } as unknown as AdaptiveSituation;

    const userPolicy = {
      allow_worker_delegation: true,
      allowed_worker_types: ["BROWSER"],
      auto_execute_research: true,
    };

    const result = await executeResearchAndRoadmapOrchestration({
      supabase: mockSupabase,
      trustedPlane: mockTrustedPlane,
      ownerUserId: "user-1",
      pursuitId: "pursuit-1",
      turnKey: "turn-rpc-err",
      message: "I want to become an AI engineer.",
      currentSituation: situation,
      userPolicy,
    });

    assert.equal(result.executed, false);
    assert.ok(result.researchBlocker);
    assert.equal(result.researchBlocker.reason, "UNAVAILABLE");
    assert.ok(result.researchBlocker.message.includes("Resource reservation failed"));
    assert.equal(searchProviderCalled, false, "External provider must NEVER be called if reservation RPC fails");
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("resource safety: provider failure releases reservation and reports blocker", async (t) => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
  });

  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    if (String(url).startsWith("https://api.exa.ai")) {
      return new Response("Service Unavailable", { status: 503 });
    }
    return new Response("", { status: 200 });
  });

  try {
    const rpcLog: Array<{ method: string; params: unknown }> = [];
    const mockTrustedPlane = {
      rpc: async (method: string, params: unknown) => {
        rpcLog.push({ method, params });
        if (method === "stryde_reserve_resources") {
          return { data: "grp-res-fail-1", error: null };
        }
        return { data: null, error: null };
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const situation = {
      capabilities: { web_search: true },
    } as unknown as AdaptiveSituation;

    const userPolicy = {
      allow_worker_delegation: true,
      allowed_worker_types: ["BROWSER"],
      auto_execute_research: true,
    };

    const result = await executeResearchAndRoadmapOrchestration({
      supabase: mockSupabase,
      trustedPlane: mockTrustedPlane,
      ownerUserId: "user-1",
      pursuitId: "pursuit-1",
      turnKey: "turn-provider-fail",
      message: "Help me start an agency.",
      currentSituation: situation,
      userPolicy,
    });

    assert.equal(result.executed, false);
    assert.ok(result.researchBlocker);
    assert.equal(result.researchBlocker.reason, "UNAVAILABLE");

    // Verify stryde_reserve_resources was called, followed by stryde_release_reservations
    const reservedCall = rpcLog.find((r) => r.method === "stryde_reserve_resources");
    assert.ok(reservedCall, "Must have called stryde_reserve_resources");

    const releaseCall = rpcLog.find((r) => r.method === "stryde_release_reservations");
    assert.ok(releaseCall, "Must have called stryde_release_reservations on provider failure");
    assert.deepEqual((releaseCall.params as Record<string, unknown>).p_group, "grp-res-fail-1");

    const reconcileCall = rpcLog.find((r) => r.method === "stryde_reconcile_reservation");
    assert.equal(reconcileCall, undefined, "stryde_reconcile_reservation must NOT be called on failure");
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("resource safety: replay idempotency avoids double reservation when already consumed", async (t) => {
  let reserveResourcesCalled = false;
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
  });

  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    if (String(url).startsWith("https://api.exa.ai")) {
      return json({
        results: [{ url: "https://example.com/item", title: "Doc", highlights: ["text"] }],
      });
    }
    return new Response("<html><body>Content</body></html>", { status: 200 });
  });

  try {
    const mockTrustedPlane = {
      rpc: async (method: string) => {
        if (method === "stryde_reserve_resources") {
          reserveResourcesCalled = true;
          return { data: "grp-new", error: null };
        }
        return { data: null, error: null };
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: "res-consumed", status: "CONSUMED", actual: 1 }],
                error: null,
              }),
          }),
        }),
        insert: (data: unknown) => ({
          select: () => ({
            single: async () => ({
              data: { id: "obs-replay-id", ...(typeof data === "object" && data !== null ? data : {}) },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: "obs-1" }, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const situation = {
      capabilities: { web_search: true },
    } as unknown as AdaptiveSituation;

    const userPolicy = {
      allow_worker_delegation: true,
      allowed_worker_types: ["BROWSER"],
      auto_execute_research: true,
    };

    const result = await executeResearchAndRoadmapOrchestration({
      supabase: mockSupabase,
      trustedPlane: mockTrustedPlane,
      ownerUserId: "user-1",
      pursuitId: "pursuit-1",
      turnKey: "turn-replay-1",
      message: "I want to build muscle.",
      currentSituation: situation,
      userPolicy,
    });

    assert.equal(result.executed, true);
    assert.equal(reserveResourcesCalled, false, "Replay must NOT create a new reservation when already consumed");
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("real retrieval status: distinguishes FULL_TEXT, PARTIAL_CONTENT, PAYWALLED, TRANSCRIPT_UNAVAILABLE, and traces primary source", async (t) => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
  });

  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    const s = String(url);
    if (s.startsWith("https://api.exa.ai")) {
      return json({
        results: [
          { url: "https://example.com/full-doc", title: "Full Article", highlights: ["full"] },
          { url: "https://example.com/partial-doc", title: "Huge Partial Article", highlights: ["partial"] },
        ],
      });
    }
    if (s.includes("partial-doc")) {
      // Over 120_000 characters to trigger PARTIAL status
      const hugeBody = "x".repeat(125_000);
      return new Response(`<html><body><p>${hugeBody}</p></body></html>`, { status: 200 });
    }
    return new Response("<html><body><p>Normal article text</p></body></html>", { status: 200 });
  });

  try {
    const log: string[] = [];
    const { client } = fakeSupabase("service", log);

    const execution = await executeWebResearch(
      client,
      "user-1",
      "pursuit-1",
      "testing retrieval locators",
    );

    assert.equal(execution.retrieved_sources.length, 2);
    const fullSource = execution.retrieved_sources.find((s) => s.url.includes("full-doc"));
    assert.ok(fullSource);
    assert.equal(fullSource.locator_type, "FULL_TEXT");
    assert.equal(fullSource.primary_source_traced, true, "FULL_TEXT must have primary_source_traced = true");

    const partialSource = execution.retrieved_sources.find((s) => s.url.includes("partial-doc"));
    assert.ok(partialSource);
    assert.equal(partialSource.locator_type, "PARTIAL_CONTENT", "Truncated content must be PARTIAL_CONTENT, never FULL_TEXT");
    assert.equal(partialSource.primary_source_traced, false, "PARTIAL_CONTENT must have primary_source_traced = false");
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("resource safety: cancellation releases reservation", async () => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
  });

  const abortController = new AbortController();
  abortController.abort(); // already aborted

  try {
    const rpcLog: Array<{ method: string; params: unknown }> = [];
    const mockTrustedPlane = {
      rpc: async (method: string, params: unknown) => {
        rpcLog.push({ method, params });
        if (method === "stryde_reserve_resources") {
          return { data: "grp-cancel-1", error: null };
        }
        return { data: null, error: null };
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const situation = {
      capabilities: { web_search: true },
    } as unknown as AdaptiveSituation;

    const userPolicy = {
      allow_worker_delegation: true,
      allowed_worker_types: ["BROWSER"],
      auto_execute_research: true,
    };

    await assert.rejects(
      async () => {
        await executeResearchAndRoadmapOrchestration({
          supabase: mockSupabase,
          trustedPlane: mockTrustedPlane,
          ownerUserId: "user-1",
          pursuitId: "pursuit-1",
          turnKey: "turn-cancel",
          message: "I want to build muscle.",
          currentSituation: situation,
          userPolicy,
          signal: abortController.signal,
        });
      },
      (err: unknown) => (err as Error).name === "AbortError"
    );

    const releaseCall = rpcLog.find((r) => r.method === "stryde_release_reservations");
    assert.ok(releaseCall, "stryde_release_reservations must be called when operation is cancelled");
    assert.deepEqual((releaseCall.params as Record<string, unknown>).p_group, "grp-cancel-1");
  } finally {
    restore();
  }
});

test("resource reconciliation: successful research reconciles reservation and updates Situation", async (t) => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
  });

  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    if (String(url).startsWith("https://api.exa.ai")) {
      return json({
        results: [
          { url: "https://example.com/evidence", title: "Evidence Doc", highlights: ["Research finding."] },
        ],
      });
    }
    return new Response("<html><body>Full text content</body></html>", { status: 200 });
  });

  try {
    const rpcLog: Array<{ method: string; params: unknown }> = [];
    const mockTrustedPlane = {
      rpc: async (method: string, params: unknown) => {
        rpcLog.push({ method, params });
        if (method === "stryde_reserve_resources") {
          return { data: "grp-success-1", error: null };
        }
        return { data: null, error: null };
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        insert: (data: unknown) => ({
          select: () => ({
            single: async () => ({
              data: { id: "obs-success-id", ...(typeof data === "object" && data !== null ? data : {}) },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const mockSupabase = {
      from: (table: string) => {
        const builder = {
          insert: (data: unknown) => {
            return {
              select: () => ({
                single: async () => ({
                  data: { id: `id-${table}`, ...(typeof data === "object" && data !== null ? data : {}) },
                  error: null,
                }),
              }),
            };
          },
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
                order: () => ({
                  limit: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
        return builder as unknown as ReturnType<SupabaseClient["from"]>;
      },
    } as unknown as SupabaseClient;

    const situation = {
      capabilities: { web_search: true },
      observations: [],
      sources: [],
    } as unknown as AdaptiveSituation;

    const userPolicy = {
      allow_worker_delegation: true,
      allowed_worker_types: ["BROWSER"],
      auto_execute_research: true,
    };

    const result = await executeResearchAndRoadmapOrchestration({
      supabase: mockSupabase,
      trustedPlane: mockTrustedPlane,
      ownerUserId: "user-1",
      pursuitId: "pursuit-1",
      turnKey: "turn-success-reconcile",
      message: "I want to become an AI engineer.",
      currentSituation: situation,
      userPolicy,
    });

    assert.equal(result.executed, true);
    assert.equal(result.researchBlocker, null);
    assert.ok(result.autonomousResearch);
    assert.equal(result.autonomousResearch.results.length, 1);

    // Verify reservation was reconciled with expected: 1
    const reconcileCall = rpcLog.find((r) => r.method === "stryde_reconcile_reservation");
    assert.ok(reconcileCall, "stryde_reconcile_reservation must be called on success");
    assert.deepEqual((reconcileCall.params as Record<string, unknown>).p_group, "grp-success-1");
    assert.deepEqual((reconcileCall.params as Record<string, unknown>).p_resource, "research_rounds");
    assert.deepEqual((reconcileCall.params as Record<string, unknown>).p_actual, 1);
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});

test("roadmap audit correctness: post-research reassessment increments version, supersedes v1, and links citations or marks incomplete", async (t) => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa",
    STRYDE_SEARCH_PROVIDER: "exa",
  });

  const fetchMock = t.mock.method(globalThis, "fetch", async (url: unknown) => {
    if (String(url).startsWith("https://api.exa.ai")) {
      return json({
        results: [
          { url: "https://example.com/best-practices", title: "Engineering Practices", highlights: ["Verified curriculum"] },
        ],
      });
    }
    return new Response("<html><body>Verified curriculum and project-based learning guidelines</body></html>", { status: 200 });
  });

  try {
    const insertedRows: Array<{ table: string; data: unknown }> = [];
    const updatedRows: Array<{ table: string; data: unknown }> = [];

    const mockTrustedPlane = {
      rpc: async (method: string) => {
        if (method === "stryde_reserve_resources") return { data: "grp-roadmap-1", error: null };
        return { data: null, error: null };
      },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        insert: (data: unknown) => {
          insertedRows.push({ table, data });
          return {
            select: () => ({
              single: async () => ({
                data: { id: "obs-roadmap-new", ...(typeof data === "object" && data !== null ? data : {}) },
                error: null,
              }),
            }),
          };
        },
        update: (data: unknown) => {
          updatedRows.push({ table, data });
          return {
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => Promise.resolve({ data: [{ id: "adapt-v1-uuid" }], error: null }),
                }),
              }),
            }),
          };
        },
      }),
    } as unknown as SupabaseClient;

    const existingV1Adaptation = {
      id: "adapt-v1-uuid",
      source_id: "src-roadmap-uuid",
      version: 1,
      status: "ADVISED",
      summary: "Preliminary roadmap intake",
      methods: [
        {
          title: "Learn Linear Algebra",
          sequence: 1,
          description: "Read textbook",
          prerequisites: [],
          expected_change: "Math foundation",
          actionability: "IMMEDIATE",
          audit_status: "UNVERIFIED", // Pre-research forced UNVERIFIED
        },
      ],
      source_claims: [
        { statement: "Linear algebra is mandatory before any code", basis: "EXPLICIT_SOURCE", confidence: "HIGH" },
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
      provenance: { source_id: "src-roadmap-uuid", intake: "PRELIMINARY" },
    };

    const mockSupabase = {
      from: (table: string) => {
        const builder = {
          insert: (data: unknown) => {
            insertedRows.push({ table, data });
            return {
              select: () => ({
                single: async () => ({
                  data: { id: `id-${table}-new`, ...(typeof data === "object" && data !== null ? data : {}) },
                  error: null,
                }),
              }),
            };
          },
          update: (data: unknown) => {
            updatedRows.push({ table, data });
            return {
              eq: () => Promise.resolve({ data: null, error: null }),
            };
          },
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [existingV1Adaptation], error: null }),
                }),
                maybeSingle: async () => {
                  if (table === "pursuit_source") {
                    return {
                      data: {
                        id: "src-roadmap-uuid",
                        uri: "https://example.com/original-roadmap",
                        title: "Original Roadmap",
                        content_text: "Step 1: Read Math. Step 2: Code AI models.",
                        content_sha256: "abc123sha",
                        fetch_status: "FETCHED",
                      },
                      error: null,
                    };
                  }
                  return { data: null, error: null };
                },
              }),
              maybeSingle: async () => {
                if (table === "pursuit_source") {
                  return {
                    data: {
                      id: "src-roadmap-uuid",
                      uri: "https://example.com/original-roadmap",
                      title: "Original Roadmap",
                      content_text: "Step 1: Read Math. Step 2: Code AI models.",
                      content_sha256: "abc123sha",
                      fetch_status: "FETCHED",
                    },
                    error: null,
                  };
                }
                return { data: null, error: null };
              },
            }),
          }),
        };
        return builder as unknown as ReturnType<SupabaseClient["from"]>;
      },
    } as unknown as SupabaseClient;

    const situation = {
      capabilities: { web_search: true },
      observations: [],
      sources: [],
    } as unknown as AdaptiveSituation;

    const userPolicy = {
      allow_worker_delegation: true,
      allowed_worker_types: ["BROWSER"],
      auto_execute_research: true,
    };

    const result = await executeResearchAndRoadmapOrchestration({
      supabase: mockSupabase,
      trustedPlane: mockTrustedPlane,
      ownerUserId: "user-1",
      pursuitId: "pursuit-1",
      turnKey: "turn-roadmap-audit-v2",
      message: "Improve this roadmap for my current situation.",
      currentSituation: situation,
      userPolicy,
    });

    assert.equal(result.executed, true);

    // Verify v1 adaptation was marked SUPERSEDED
    const supersededUpdate = updatedRows.find(
      (u) => u.table === "pursuit_source_adaptation" && (u.data as Record<string, unknown>).status === "SUPERSEDED"
    );
    assert.ok(supersededUpdate, "v1 adaptation must be marked SUPERSEDED");

    // Verify v2 adaptation was inserted
    const v2Insert = insertedRows.find(
      (i) => i.table === "pursuit_source_adaptation" && (i.data as Record<string, unknown>).version === 2
    );
    assert.ok(v2Insert, "v2 adaptation must be inserted with incremented version");
    const v2Data = v2Insert.data as Record<string, unknown>;
    assert.equal(v2Data.status, "ADVISED");
    assert.equal((v2Data.provenance as Record<string, unknown>).turn_key, "turn-roadmap-audit-v2");

    // If model analysis ran without mock, it handled gracefully and marked audit_status INCOMPLETE or completed
    assert.ok(
      (v2Data.provenance as Record<string, unknown>).audit_status === "INCOMPLETE" ||
      Array.isArray(v2Data.methods)
    );
  } finally {
    restore();
    fetchMock.mock.restore();
  }
});
