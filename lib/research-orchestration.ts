// Deterministic research requirement, goal-intent policy, and roadmap audit orchestration.
//
// Mandate rule: Research-dependent goals and roadmap-audit requests must trigger
// research through deterministic policy/orchestration, NOT rely solely on the
// model choosing RESEARCH_WEB. No substantive research-dependent recommendation
// is streamed or shown before required research completes.
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeWebResearch, type ResearchExecution } from "./research-execution.ts";
import { reserveResources, ResourceExhaustedError, type ReservationGroup } from "./resource-control.ts";
import { assembleAdaptiveSituation, type AdaptiveSituation } from "./adaptive-situation.ts";
import { runSourceAdaptation } from "./adaptive-model.ts";
import { checkAutoResearch, type AutonomyPolicy } from "./autonomy-policy.ts";

export type GoalDomain = "FITNESS" | "CAREER" | "BUSINESS" | "TECH" | "ROADMAP" | "GENERAL";

export type PursuitGoalIntent = {
  isGoalIntent: boolean;
  domain: GoalDomain | null;
  targetGoal: string | null;
  rawIntentMatch: string | null;
};

export type ResearchRequirementReason =
  | "ROADMAP_AUDIT"
  | "FACTUAL_VERIFICATION"
  | "BOTTLENECK_INVESTIGATION"
  | "EXPLICIT_RESEARCH"
  | "DOMAIN_PURSUIT";

export type ResearchRequirement = {
  required: boolean;
  query: string | null;
  reason: ResearchRequirementReason | null;
  confidence: number;
};

const CASUAL_OR_ORDINARY_CHAT_REGEX =
  /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening)|howdy|sup|thanks|thank you|ok|okay|cool|sounds good|got it|sure|nope|no|yes|bye|goodbye|see ya|who are you|what can you do)[\s!.?]*$/i;

const ROADMAP_AUDIT_REGEX =
  /(\b(audit|critique|evaluate|review|inspect|check|improve|assess|rate)\b[^\n.?!]{0,60}\b(roadmap|plan|curriculum|syllabus|strategy|playbook|steps|milestones)\b)|(\b(roadmap|plan|curriculum|syllabus|strategy|playbook)\b[^\n.?!]{0,60}\b(audit|critique|review|flaws|gaps|improve|assess|evaluation|feedback)\b)/i;

const ROADMAP_STEP_MARKERS_REGEX =
  /(step\s*[1-9]|phase\s*[1-9]|week\s*[1-9]|milestone\s*[1-9]|stage\s*[1-9]|\b1\.\s+[^\n]+\n+\s*2\.\s+)/i;

const FACTUAL_INQUIRY_REGEX =
  /(\b(research|find out|look up|search for|verify whether|check whether|investigate|fact-check)\b)|(\b(current price|latest docs|competitor analysis|market size|market data|pricing of|regulations for|legal requirements for|compliance requirements for)\b)|(\bis it true that\b)|(\bwhat are the (latest|current|official)\b)/i;

// Goal-seeking intent markers (verbs / phrases showing active pursuit, NOT mere mentions)
const INTENT_MARKER_REGEX =
  /^(?:can you\s+|could you\s+|please\s+)?(?:i\s+(?:really\s+)?(?:want|need|wish|hope|plan|aim)\s+to|help\s+me(?:\s+to)?|how\s+(?:can|do|should)\s+i|looking\s+to|i(?:'m|\s+am)\s+(?:trying|hoping|looking|planning)\s+to|my\s+goal\s+is\s+to|my\s+objective\s+is\s+to|i\s+would\s+like\s+to)\s+([^.?!]+)/i;

// Domain-specific active goal patterns:
// 1. Fitness: active muscle building, fat loss, marathon training, hypertrophy
const FITNESS_GOAL_REGEX =
  /(?:build|gain|grow|develop|pack\s+on)\s+(?:more\s+)?muscle|\b(become|get)\s+(?:stronger|shredded|fit|lean)\b|(?:lose|cut|burn|drop)\s+(?:body\s+)?fat|(?:run|train\s+for)\s+(?:a\s+)?(?:marathon|triathlon|half\s+marathon|5k|10k)|(?:hypertrophy|periodization|training\s+split|progressive\s+overload)\s+(?:protocol|program|plan|routine)/i;

// 2. Career: active career transition, becoming an AI engineer, landing tech roles
const CAREER_GOAL_REGEX =
  /(?:become|transition\s+into|break\s+into|land\s+a\s+job\s+as|work\s+as|switch\s+to)\s+(?:an?\s+)?([a-z0-9_\s-]+(?:engineer|developer|scientist|manager|designer|architect|analyst|practitioner))|(?:become|be)\s+an?\s+ai\s+engineer|(?:learn|master)\s+(?:machine\s+learning|deep\s+learning|artificial\s+intelligence|system\s+design)/i;

// 3. Business: starting an agency, launching SaaS, business creation
const BUSINESS_GOAL_REGEX =
  /(?:start|launch|scale|build|grow|create|open|found)\s+(?:an?\s+)?(?:agency|saas|business|startup|firm|consultancy|e-?commerce)|(?:get|find|acquire)\s+(?:first\s+)?(?:clients|customers)\s+for\s+(?:my\s+)?(?:agency|business)|(?:client\s+acquisition|lead\s+generation)\s+for\s+(?:my\s+)?(?:agency|business)/i;

// 4. Roadmap improvement
const ROADMAP_GOAL_REGEX =
  /(?:improve|audit|critique|review|evaluate|assess|check|refine)\s+(?:this|my|the)?\s*(?:roadmap|plan|curriculum|syllabus|strategy|playbook)\s*(?:for|to|with)?/i;

// 5. Tech architecture / project decisions
const TECH_GOAL_REGEX =
  /(?:build|architect|design|scale|migrate)\s+(?:a\s+)?(?:distributed\s+system|backend|microservice|database|infrastructure|tech\s+stack)|(?:evaluate|choose|compare)\s+(?:between\s+)?(?:frameworks|databases|libraries|architectures)/i;

// Domain-dependent empirical evidence inquiries (benchmarks, protocols, compensation, tradeoffs)
const FITNESS_EMPIRICAL_REGEX =
  /(\b(hypertrophy|periodization|heart\s+rate\s+zone|training\s+split|VO2\s+max|caloric\s+deficit|deload)\b[^\n.?!]{0,50}\b(protocol|evidence|studies|optimal|volume|guidelines)\b)/i;

const CAREER_EMPIRICAL_REGEX =
  /(\b(salary|compensation|pay\s+band|interview\s+process|hiring\s+bar|job\s+market)\b[^\n.?!]{0,50}\b(benchmark|standards|levels|expectations|range|data)\b)/i;

const BUSINESS_EMPIRICAL_REGEX =
  /(\b(unit\s+economics|cac|ltv|churn\s+rate|pricing\s+model|gross\s+margin|market\s+rate)\b[^\n.?!]{0,50}\b(benchmarks|industry\s+average|standards|ratios)\b)/i;

const TECH_EMPIRICAL_REGEX =
  /(\b(architecture|database|framework|tech\s+stack|library|api|migration)\b[^\n.?!]{0,50}\b(tradeoffs|benchmarks|scalability|comparison|best\s+practices|performance)\b)/i;

// Mere mentions / side conversation indicators that should NOT trigger research
const MERE_MENTION_INDICATORS =
  /^(?:my\s+muscle\s+hurts|pulled\s+a\s+muscle|met\s+an?\s+|my\s+friend\s+|i\s+saw\s+a\s+roadmap|read\s+an?\s+article|saw\s+on\s+twitter|someone\s+told\s+me)/i;

export function detectPursuitGoalIntent(message: string): PursuitGoalIntent {
  const text = message.trim();

  // Exclude greetings and casual banter
  if (CASUAL_OR_ORDINARY_CHAT_REGEX.test(text)) {
    return { isGoalIntent: false, domain: null, targetGoal: null, rawIntentMatch: null };
  }

  // Exclude known mere mentions (e.g. "My muscle hurts today", "I met an AI engineer yesterday")
  if (MERE_MENTION_INDICATORS.test(text)) {
    return { isGoalIntent: false, domain: null, targetGoal: null, rawIntentMatch: null };
  }

  // Check explicit intent marker prefix ("I want to...", "Help me...", "My goal is to...")
  const markerMatch = INTENT_MARKER_REGEX.exec(text);
  const coreIntent = markerMatch ? markerMatch[1].trim() : text;

  // Domain checks
  if (ROADMAP_GOAL_REGEX.test(text)) {
    return {
      isGoalIntent: true,
      domain: "ROADMAP",
      targetGoal: "improve roadmap for current situation",
      rawIntentMatch: text,
    };
  }

  if (FITNESS_GOAL_REGEX.test(text) || FITNESS_EMPIRICAL_REGEX.test(text)) {
    // Ensure it's not a mere physical symptom ("my muscle hurts")
    if (/\b(hurts?|sore|sprained|pulled|torn|injured|cramp)\b/i.test(text)) {
      return { isGoalIntent: false, domain: null, targetGoal: null, rawIntentMatch: null };
    }
    const match = FITNESS_GOAL_REGEX.exec(text);
    return {
      isGoalIntent: true,
      domain: "FITNESS",
      targetGoal: match ? match[0] : "fitness and hypertrophy protocol",
      rawIntentMatch: text,
    };
  }

  if (CAREER_GOAL_REGEX.test(text) || CAREER_EMPIRICAL_REGEX.test(text)) {
    // Ensure it's active intent, not past meeting/observation
    if (/\b(met|talked to|spoke with|saw|visited|hired)\b/i.test(text)) {
      return { isGoalIntent: false, domain: null, targetGoal: null, rawIntentMatch: null };
    }
    const match = CAREER_GOAL_REGEX.exec(text);
    return {
      isGoalIntent: true,
      domain: "CAREER",
      targetGoal: match ? match[0] : "career progression and skills",
      rawIntentMatch: text,
    };
  }

  if (BUSINESS_GOAL_REGEX.test(text) || BUSINESS_EMPIRICAL_REGEX.test(text)) {
    if (/\b(friend has|visited|bought from|hired)\b/i.test(text)) {
      return { isGoalIntent: false, domain: null, targetGoal: null, rawIntentMatch: null };
    }
    const match = BUSINESS_GOAL_REGEX.exec(text);
    return {
      isGoalIntent: true,
      domain: "BUSINESS",
      targetGoal: match ? match[0] : "business launch and client acquisition",
      rawIntentMatch: text,
    };
  }

  if (TECH_GOAL_REGEX.test(text) || TECH_EMPIRICAL_REGEX.test(text)) {
    const match = TECH_GOAL_REGEX.exec(text);
    return {
      isGoalIntent: true,
      domain: "TECH",
      targetGoal: match ? match[0] : "technical architecture",
      rawIntentMatch: text,
    };
  }

  if (markerMatch && coreIntent.length > 3) {
    return {
      isGoalIntent: true,
      domain: "GENERAL",
      targetGoal: coreIntent.slice(0, 150),
      rawIntentMatch: text,
    };
  }

  return { isGoalIntent: false, domain: null, targetGoal: null, rawIntentMatch: null };
}

function cleanExtractedQuery(raw: string): string {
  return raw
    .replace(/^(can you|please|could you|i want to|help me|my goal is to|how do i|how can i)?\s*(audit|critique|review|check|research|find out|look up|verify|investigate)\s*(this|the|my)?\s*/i, "")
    .replace(/[?!.]+$/g, "")
    .trim()
    .slice(0, 300);
}

function generateDomainQuery(domain: GoalDomain, targetGoal: string | null, rawMessage: string): string {
  const goal = (targetGoal ?? rawMessage).toLowerCase();
  switch (domain) {
    case "FITNESS":
      if (goal.includes("muscle") || goal.includes("hypertrophy")) {
        return "hypertrophy training volume nutrition protocols build muscle";
      }
      if (goal.includes("fat") || goal.includes("cut")) {
        return "fat loss evidence-based deficit rate training retention";
      }
      if (goal.includes("marathon") || goal.includes("triathlon")) {
        return "marathon training periodization weekly mileage long run protocol";
      }
      return `${cleanExtractedQuery(rawMessage)} evidence-based protocols guidelines`;

    case "CAREER":
      if (goal.includes("ai engineer") || goal.includes("machine learning")) {
        return "AI engineer career path skills curriculum requirements 2026";
      }
      if (goal.includes("software engineer") || goal.includes("developer")) {
        return "software engineer hiring bar competencies portfolio interview";
      }
      return `${cleanExtractedQuery(rawMessage)} career requirements skills benchmarks`;

    case "BUSINESS":
      if (goal.includes("agency")) {
        return "how to start an agency business model client acquisition pricing";
      }
      if (goal.includes("saas")) {
        return "b2b saas launch validation go-to-market benchmarks";
      }
      return `${cleanExtractedQuery(rawMessage)} business launch client acquisition benchmarks`;

    case "ROADMAP":
      return `${cleanExtractedQuery(rawMessage)} roadmap audit feasibility benchmarks best practices`;

    case "TECH":
      return `${cleanExtractedQuery(rawMessage)} architecture tradeoffs benchmarks best practices`;

    default:
      return cleanExtractedQuery(rawMessage) || rawMessage.slice(0, 200);
  }
}

export function detectDeterministicResearchRequirement(input: {
  message: string;
  pursuitTitle?: string | null;
  situation?: {
    working_state?: {
      bottleneck?: string | null;
      next_move?: { mode?: string | null; title?: string | null; actor?: string | null } | null;
    } | null;
    open_loops?: Array<{ loop_type?: string; summary?: string }> | null;
    source_adaptations?: unknown[] | null;
  } | null;
  workingState?: {
    bottleneck?: string | null;
    next_move?: { mode?: string | null; title?: string | null; actor?: string | null } | null;
  } | null;
}): ResearchRequirement {
  const text = input.message.trim();

  // 0. Exclude ordinary conversational banter and greetings
  if (CASUAL_OR_ORDINARY_CHAT_REGEX.test(text)) {
    return {
      required: false,
      query: null,
      reason: null,
      confidence: 0,
    };
  }

  // 1. Explicit roadmap audit requests
  if (ROADMAP_AUDIT_REGEX.test(text)) {
    const query = cleanExtractedQuery(text) || "roadmap audit feasibility benchmarks best practices";
    return {
      required: true,
      query,
      reason: "ROADMAP_AUDIT",
      confidence: 0.95,
    };
  }

  // 2. Structured plan / roadmap markers submitted with review/critique intent
  if (
    ROADMAP_STEP_MARKERS_REGEX.test(text) &&
    /(\b(audit|critique|review|check|viable|feasible|realistic|flaws|gaps|improve|thoughts)\b)/i.test(text)
  ) {
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    const firstLine = lines[0]?.slice(0, 150) ?? "";
    const query = cleanExtractedQuery(firstLine) || "roadmap plan audit feasibility validation";
    return {
      required: true,
      query,
      reason: "ROADMAP_AUDIT",
      confidence: 0.9,
    };
  }

  // 3. Natural goal intent policy: fitness, career, business, tech, roadmap
  // Separates goal recognition from the decision about how much research is materially necessary.
  const goalIntent = detectPursuitGoalIntent(text);
  if (goalIntent.isGoalIntent && goalIntent.domain) {
    if (goalIntent.domain === "ROADMAP") {
      const query = generateDomainQuery("ROADMAP", goalIntent.targetGoal, text);
      return {
        required: true,
        query,
        reason: "ROADMAP_AUDIT",
        confidence: 0.95,
      };
    }

    if (
      goalIntent.domain === "FITNESS" ||
      goalIntent.domain === "CAREER" ||
      goalIntent.domain === "BUSINESS" ||
      goalIntent.domain === "TECH"
    ) {
      const query = generateDomainQuery(goalIntent.domain, goalIntent.targetGoal, text);
      return {
        required: true,
        query,
        reason: "DOMAIN_PURSUIT",
        confidence: 0.9,
      };
    }
  }

  // 4. Factual verification / market / regulatory / technical inquiries
  if (FACTUAL_INQUIRY_REGEX.test(text)) {
    const query = cleanExtractedQuery(text) || text.slice(0, 200);
    return {
      required: true,
      query,
      reason: "FACTUAL_VERIFICATION",
      confidence: 0.85,
    };
  }

  // 5. Working state bottleneck explicitly requiring research
  const nextMove = input.workingState?.next_move ?? input.situation?.working_state?.next_move;
  if (nextMove?.mode === "RESEARCH_WEB" && nextMove.title?.trim()) {
    return {
      required: true,
      query: nextMove.title.trim(),
      reason: "BOTTLENECK_INVESTIGATION",
      confidence: 0.9,
    };
  }

  const bottleneck = input.workingState?.bottleneck ?? input.situation?.working_state?.bottleneck;
  if (bottleneck && /(\b(research|evidence|unverified|verify|factual|market data|pricing|documentation)\b)/i.test(bottleneck)) {
    return {
      required: true,
      query: bottleneck.slice(0, 200),
      reason: "BOTTLENECK_INVESTIGATION",
      confidence: 0.8,
    };
  }

  return {
    required: false,
    query: null,
    reason: null,
    confidence: 0,
  };
}

export function detectPastedRoadmapFromText(text: string): {
  isRoadmap: boolean;
  title: string;
  content: string;
} {
  const trimmed = text.trim();
  if (trimmed.length < 80) return { isRoadmap: false, title: "", content: "" };

  const hasStepMarkers = ROADMAP_STEP_MARKERS_REGEX.test(trimmed);
  const hasRoadmapWords = /(\broadmap\b|\bplan\b|\bcurriculum\b|\bsyllabus\b|\bplaybook\b)/i.test(trimmed);

  if (hasStepMarkers && (hasRoadmapWords || trimmed.includes("\n"))) {
    const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
    const candidateTitle = lines[0]?.slice(0, 100) || "Pasted Roadmap";
    return {
      isRoadmap: true,
      title: candidateTitle.startsWith("#") ? candidateTitle.replace(/^#+\s*/, "") : candidateTitle,
      content: trimmed,
    };
  }

  return { isRoadmap: false, title: "", content: "" };
}

export type OrchestrationResult = {
  executed: boolean;
  autonomousResearch: ResearchExecution | null;
  researchBlocker: {
    reason: "UNCONFIGURED" | "UNAUTHORIZED" | "BUDGET_EXHAUSTED" | "UNAVAILABLE";
    message: string;
  } | null;
  updatedSituation: AdaptiveSituation;
};

// Cleanly extracted orchestration service fulfilling the entire research-first
// and roadmap reassessment lifecycle. Called directly by the HTTP conversation
// route and exercised end to end in test suites.
export async function executeResearchAndRoadmapOrchestration(input: {
  supabase: SupabaseClient;
  trustedPlane: SupabaseClient;
  ownerUserId: string;
  pursuitId: string;
  turnKey: string;
  message: string;
  pursuitTitle?: string | null;
  currentSituation: AdaptiveSituation;
  workingState?: Parameters<typeof detectDeterministicResearchRequirement>[0]["workingState"];
  userPolicy?: AutonomyPolicy | null;
  signal?: AbortSignal;
}): Promise<OrchestrationResult> {
  const check = detectDeterministicResearchRequirement({
    message: input.message,
    pursuitTitle: input.pursuitTitle,
    situation: input.currentSituation,
    workingState: input.workingState,
  });

  if (!check.required || !check.query) {
    return {
      executed: false,
      autonomousResearch: null,
      researchBlocker: null,
      updatedSituation: input.currentSituation,
    };
  }

  // 1. Capability check
  if (!input.currentSituation.capabilities.web_search) {
    return {
      executed: false,
      autonomousResearch: null,
      researchBlocker: {
        reason: "UNCONFIGURED",
        message: "External web research capability is unconfigured or not available in this environment.",
      },
      updatedSituation: input.currentSituation,
    };
  }

  // 2. Autonomy policy check
  if (!checkAutoResearch(input.userPolicy ?? null)) {
    return {
      executed: false,
      autonomousResearch: null,
      researchBlocker: {
        reason: "UNAUTHORIZED",
        message: "Automatic research is not authorized by your autonomy policy. Permission is required to execute external research.",
      },
      updatedSituation: input.currentSituation,
    };
  }

  // 3. Resource safety lifecycle:
  // Replay/retry safety: check if an existing reservation for this turn is already CONSUMED
  const operationKey = `research:${input.turnKey}`;
  const { data: existingReservations } = await input.trustedPlane
    .from("budget_reservation")
    .select("id, group_id, status, actual")
    .eq("owner_user_id", input.ownerUserId)
    .eq("operation_key", operationKey);

  const alreadyConsumed = existingReservations?.some((r) => r.status === "CONSUMED");

  let reservation: ReservationGroup | null = null;
  if (!alreadyConsumed) {
    try {
      reservation = await reserveResources(input.trustedPlane, {
        ownerUserId: input.ownerUserId,
        pursuitId: input.pursuitId,
        operationKey,
        capabilityKey: "research.web",
        requests: [{ resource: "research_rounds", expected: 1 }],
        ttlSeconds: 900,
      });
    } catch (reserveError) {
      if (
        (reserveError instanceof ResourceExhaustedError && reserveError.resource !== null) ||
        (reserveError instanceof Error && /RESOURCE_EXHAUSTED/i.test(reserveError.message))
      ) {
        return {
          executed: false,
          autonomousResearch: null,
          researchBlocker: {
            reason: "BUDGET_EXHAUSTED",
            message: "Daily plan limit reached for research rounds. Your quota resets tomorrow.",
          },
          updatedSituation: input.currentSituation,
        };
      }
      // Resource-RPC failure: fail closed honestly without calling provider
      return {
        executed: false,
        autonomousResearch: null,
        researchBlocker: {
          reason: "UNAVAILABLE",
          message: reserveError instanceof Error
            ? `Resource reservation failed: ${reserveError.message}`
            : "Resource reservation failed.",
        },
        updatedSituation: input.currentSituation,
      };
    }
  }

  // 4. Upstream web research execution
  let execution: ResearchExecution;
  try {
    if (input.signal?.aborted) {
      if (reservation) await reservation.release().catch(() => {});
      throw new DOMException("Aborted", "AbortError");
    }

    execution = await executeWebResearch(
      input.supabase,
      input.ownerUserId,
      input.pursuitId,
      check.query,
      input.trustedPlane,
      input.signal,
    );

    // Reconcile actual usage on completion
    if (reservation) {
      await reservation.reconcile([{ resource: "research_rounds", expected: 1 }]);
    }
  } catch (researchError) {
    // Release reservation on failure/abort so operations that did not run are not charged
    if (reservation) {
      await reservation.release().catch(() => {});
    }
    if (input.signal?.aborted) throw researchError;

    return {
      executed: false,
      autonomousResearch: {
        query: check.query,
        provider: "unavailable",
        results: [],
        retrieved_sources: [],
        observation_id: null,
      },
      researchBlocker: {
        reason: "UNAVAILABLE",
        message: researchError instanceof Error
          ? researchError.message
          : "The external research provider failed or was unreachable.",
      },
      updatedSituation: input.currentSituation,
    };
  }

  // 5. Refresh Situation with the newly recorded observation and sources
  let refreshedSituation = input.currentSituation;
  try {
    const refreshedResult = await assembleAdaptiveSituation(input.supabase, input.ownerUserId, input.pursuitId);
    if (!refreshedResult.error && refreshedResult.situation) {
      refreshedSituation = refreshedResult.situation;
    }
  } catch {
    // Keep currentSituation if situation re-assembly fails
  }

  // 6. Post-research roadmap assessment:
  // Re-run roadmap assessment against the fresh evidence and persist a new versioned adaptation
  const { data: existingTurnAdaptations } = await input.supabase
    .from("pursuit_source_adaptation")
    .select("id, version, provenance")
    .eq("owner_user_id", input.ownerUserId)
    .eq("pursuit_id", input.pursuitId);

  const alreadyAdaptedForTurn = existingTurnAdaptations?.some(
    (a) => (a.provenance as Record<string, unknown> | null)?.turn_key === input.turnKey
  );

  if (!alreadyAdaptedForTurn) {
    const { data: latestAdaptations } = await input.supabase
      .from("pursuit_source_adaptation")
      .select("*")
      .eq("owner_user_id", input.ownerUserId)
      .eq("pursuit_id", input.pursuitId)
      .order("version", { ascending: false })
      .limit(1);

    const latestAdaptation = latestAdaptations?.[0];
    if (latestAdaptation) {
      const { data: sourceRow } = await input.supabase
        .from("pursuit_source")
        .select("*")
        .eq("id", latestAdaptation.source_id)
        .maybeSingle();

      if (sourceRow && sourceRow.content_text) {
        try {
          const reAdapted = await runSourceAdaptation({
            source: {
              id: sourceRow.id,
              uri: sourceRow.uri,
              title: sourceRow.title,
              content_text: sourceRow.content_text,
              content_sha256: sourceRow.content_sha256,
              fetch_status: sourceRow.fetch_status,
            },
            situation: refreshedSituation,
          });

          const nextVersion = (latestAdaptation.version ?? 1) + 1;
          await input.supabase
            .from("pursuit_source_adaptation")
            .update({ status: "SUPERSEDED" })
            .eq("id", latestAdaptation.id);

          const retrievedLocators = execution.retrieved_sources
            .filter((s) => s.locator_type === "FULL_TEXT" || s.locator_type === "PARTIAL_CONTENT")
            .map((s) => s.content_locator);

          const { data: newAdaptation } = await input.supabase
            .from("pursuit_source_adaptation")
            .insert({
              owner_user_id: input.ownerUserId,
              pursuit_id: input.pursuitId,
              source_id: sourceRow.id,
              version: nextVersion,
              status: "ADVISED",
              ...reAdapted.adaptation,
              provenance: {
                ...reAdapted.adaptation.provenance,
                turn_key: input.turnKey,
                reassessed_from: latestAdaptation.id,
                retrieved_locators: retrievedLocators,
              },
            })
            .select("id, source_id, version, status, summary, source_claims, methods, assumptions, prerequisites, expected_outcomes, unknowns, fit, conflicts, gaps, adapted_strategy, goal_candidates, provenance, created_at")
            .single();

          if (newAdaptation) {
            const claims = Array.isArray(reAdapted.adaptation.source_claims) ? reAdapted.adaptation.source_claims : [];
            if (claims.length && sourceRow.content_sha256) {
              const citations = claims.map((item) => ({
                owner_user_id: input.ownerUserId,
                pursuit_id: input.pursuitId,
                source_id: sourceRow.id,
                adaptation_id: newAdaptation.id,
                quote: item.statement,
                content_sha256: sourceRow.content_sha256!,
                locator_type: "FULL_TEXT",
                locator: sourceRow.uri ? `${sourceRow.uri}#quote` : "source#quote",
                exact_match: false,
                verification_status: "VERIFIED",
                metadata: {
                  turn_key: input.turnKey,
                  basis: item.basis,
                  confidence: item.confidence,
                  retrieved_locators: retrievedLocators,
                },
              }));
              await input.supabase.from("pursuit_source_citation").insert(citations);
            }

            const finalRefreshed = await assembleAdaptiveSituation(input.supabase, input.ownerUserId, input.pursuitId);
            if (!finalRefreshed.error && finalRefreshed.situation) {
              refreshedSituation = finalRefreshed.situation;
            }
          }
        } catch (reAdaptError) {
          // If post-research reassessment fails, label incomplete rather than verified
          const nextVersion = (latestAdaptation.version ?? 1) + 1;
          await input.supabase
            .from("pursuit_source_adaptation")
            .update({ status: "SUPERSEDED" })
            .eq("id", latestAdaptation.id);

          const incompleteMethods = (Array.isArray(latestAdaptation.methods) ? latestAdaptation.methods : []).map(
            (m: Record<string, unknown>) => ({
              ...m,
              audit_status: "UNVERIFIED",
            })
          );

          await input.supabase
            .from("pursuit_source_adaptation")
            .insert({
              owner_user_id: input.ownerUserId,
              pursuit_id: input.pursuitId,
              source_id: latestAdaptation.source_id,
              version: nextVersion,
              status: "ADVISED",
              summary: `Post-research roadmap audit incomplete: ${reAdaptError instanceof Error ? reAdaptError.message : "Model analysis failed"}`,
              source_claims: latestAdaptation.source_claims ?? [],
              methods: incompleteMethods,
              assumptions: latestAdaptation.assumptions ?? [],
              prerequisites: latestAdaptation.prerequisites ?? [],
              expected_outcomes: latestAdaptation.expected_outcomes ?? [],
              unknowns: [
                ...(Array.isArray(latestAdaptation.unknowns) ? latestAdaptation.unknowns : []),
                "Roadmap reassessment was incomplete due to model error; steps remain unverified.",
              ],
              fit: latestAdaptation.fit ?? { status: "UNKNOWN", reasons: ["Reassessment incomplete"] },
              conflicts: latestAdaptation.conflicts ?? [],
              gaps: latestAdaptation.gaps ?? [],
              adapted_strategy: latestAdaptation.adapted_strategy ?? [],
              goal_candidates: latestAdaptation.goal_candidates ?? [],
              provenance: {
                turn_key: input.turnKey,
                audit_status: "INCOMPLETE",
                error: reAdaptError instanceof Error ? reAdaptError.message : String(reAdaptError),
              },
            });

          const finalRefreshed = await assembleAdaptiveSituation(input.supabase, input.ownerUserId, input.pursuitId);
          if (!finalRefreshed.error && finalRefreshed.situation) {
            refreshedSituation = finalRefreshed.situation;
          }
        }
      }
    }
  }

  return {
    executed: true,
    autonomousResearch: execution,
    researchBlocker: null,
    updatedSituation: refreshedSituation,
  };
}
