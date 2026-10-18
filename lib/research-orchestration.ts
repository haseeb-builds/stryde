// Deterministic research requirement and roadmap audit detection.
//
// Mandate rule: Research-dependent goals and roadmap-audit requests must trigger
// research through deterministic policy/orchestration, NOT rely solely on the
// model choosing RESEARCH_WEB. No substantive research-dependent recommendation
// is streamed or shown before required research completes.

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

// Domain-dependent pursuit goals requiring empirical evidence, benchmarks, or real standards:
// Fitness/Health: programming protocols, nutritional timing, hypertrophy volume, injury rehab standards
// Career: salary benchmarks, compensation bands, interview loops, job market requirements, certification value
// Tech/Architecture: framework comparisons, library evaluation, API deprecations, scalability limits, database sizing
// Business/Economics: unit economics, CAC/LTV benchmarks, conversion rate benchmarks, supplier terms, licensing
const DOMAIN_PURSUIT_RESEARCH_REGEX =
  /(\b(salary|compensation|pay\s+band|interview\s+process|hiring\s+bar|job\s+market)\b[^\n.?!]{0,50}\b(benchmark|standards|levels|expectations|range|data)\b)|(\b(hypertrophy|periodization|heart\s+rate\s+zone|training\s+split|VO2\s+max|caloric\s+deficit|deload)\b[^\n.?!]{0,50}\b(protocol|evidence|studies|optimal|volume|guidelines)\b)|(\b(architecture|database|framework|tech\s+stack|library|api|migration)\b[^\n.?!]{0,50}\b(tradeoffs|benchmarks|scalability|comparison|best\s+practices|performance)\b)|(\b(unit\s+economics|cac|ltv|churn\s+rate|pricing\s+model|gross\s+margin|market\s+rate)\b[^\n.?!]{0,50}\b(benchmarks|industry\s+average|standards|ratios)\b)/i;

function cleanExtractedQuery(raw: string): string {
  return raw
    .replace(/^(can you|please|could you|i want to|help me)?\s*(audit|critique|review|check|research|find out|look up|verify|investigate)\s*(this|the|my)?\s*/i, "")
    .replace(/[?!.]+$/g, "")
    .trim()
    .slice(0, 300);
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
  if (ROADMAP_STEP_MARKERS_REGEX.test(text) && /(\b(audit|critique|review|check|viable|feasible|realistic|flaws|gaps|improve|thoughts)\b)/i.test(text)) {
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

  // 3. Domain goal-intent policy: fitness, careers, technical projects, business economics
  if (DOMAIN_PURSUIT_RESEARCH_REGEX.test(text)) {
    const query = cleanExtractedQuery(text) || text.slice(0, 200);
    return {
      required: true,
      query,
      reason: "DOMAIN_PURSUIT",
      confidence: 0.9,
    };
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
