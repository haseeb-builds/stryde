"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Pursuit = {
  id: string;
  title: string | null;
  status: string;
};

type SubscriptionDetails = {
  planId: string;
  status: string;
  provider: string;
  managementUrls: {
    updatePaymentMethod?: string | null;
    cancel?: string | null;
  } | null;
};

const SCENARIOS = {
  saas: {
    goal: "Sign our first 5 paying design-partner teams for our workflow SaaS within 30 days",
    understanding: "Product MVP is deployed and functional, but outbound messages are pitching broad features instead of a measurable operational pain.",
    bottleneck: "Zero verified buyer conversations scheduled this week; pricing page has no self-serve qualification path.",
    moveTitle: "Send 10 targeted teardown notes to operations leads who posted workflow roles in the last 14 days",
    moveWhy: "Instead of rebuilding the landing page first, test whether a concrete teardown earns 3 replies. Stryde has prepared the qualification criteria and tracks replies separately from verified bookings."
  },
  revenue: {
    goal: "Recover 18% checkout drop-off after migrating international SaaS billing",
    understanding: "Checkout sessions initiate properly, but non-US cards fail or abandon on the tax/currency confirmation step.",
    bottleneck: "Webhook handler was dropping unrecognized price IDs without surfacing a fallback checkout link.",
    moveTitle: "Verify Paddle sandbox checkout & fail-closed webhook normalization across 3 currencies",
    moveWhy: "Confirms whether abandonment is caused by payment method rejection or webhook state delay before changing pricing."
  },
  migration: {
    goal: "Complete full production readiness & security audit before opening customer access",
    understanding: "368 automated tests pass and preview build is live, but external research and merchant credentials need live probe verification.",
    bottleneck: "Production worker container needs live fly.io health check confirmation alongside API credentials.",
    moveTitle: "Run live provider probes (probe-research & probe-paddle) and record verified exit codes",
    moveWhy: "Separates passing unit tests from verified external API connectivity so nothing ships on assumptions."
  }
};

function describePursuitStatus(status: string): {
  code: string;
  summary: string;
  dotClass: string;
  badgeClass: string;
} {
  switch (status) {
    case "COMPLETED":
      return {
        code: "COMPLETED",
        summary: "Outcome reached",
        dotClass: "bg-emerald-600",
        badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-900"
      };
    case "PAUSED":
      return {
        code: "PAUSED",
        summary: "Paused",
        dotClass: "bg-amber-600",
        badgeClass: "border-amber-200 bg-amber-50 text-amber-900"
      };
    case "DISCOVERING":
      return {
        code: "DISCOVERING",
        summary: "Clarifying situation & bottleneck",
        dotClass: "bg-[#111111]",
        badgeClass: "border-[#E7E7E4] bg-[#F3F2EF] text-[#111111]"
      };
    case "IN_PROGRESS":
      return {
        code: "IN_PROGRESS",
        summary: "Executing next move",
        dotClass: "bg-emerald-600",
        badgeClass: "border-[#E7E7E4] bg-[#F3F2EF] text-[#111111]"
      };
    case "ACTIVE":
    default:
      return {
        code: status || "ACTIVE",
        summary: "Active pursuit",
        dotClass: "bg-[#111111]",
        badgeClass: "border-[#E7E7E4] bg-[#F3F2EF] text-[#111111]"
      };
  }
}

export default function HomePage() {
  const router = useRouter();

  // Auth & Session State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Home Intake & Pursuits State
  const [title, setTitle] = useState("");
  const [initialInput, setInitialInput] = useState("");
  const [showIntakeNotes, setShowIntakeNotes] = useState(false);
  const [pursuits, setPursuits] = useState<Pursuit[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED">("ALL");
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);

  // Landing Page Interactive "Try-Before-Sign-Up" Stage State
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<"saas" | "revenue" | "migration">("saas");
  const [stageGoalInput, setStageGoalInput] = useState(SCENARIOS.saas.goal);
  const [stageUnderstanding, setStageUnderstanding] = useState(SCENARIOS.saas.understanding);
  const [stageBottleneck, setStageBottleneck] = useState(SCENARIOS.saas.bottleneck);
  const [stageMoveTitle, setStageMoveTitle] = useState(SCENARIOS.saas.moveTitle);
  const [stageMoveWhy, setStageMoveWhy] = useState(SCENARIOS.saas.moveWhy);

  const loadSubscription = useCallback(async (token: string) => {
    try {
      const response = await fetch("/api/v1/billing/portal", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;
      const body = (await response.json()) as {
        plan_id?: string;
        status?: string;
        provider?: string;
        management_urls?: {
          updatePaymentMethod?: string | null;
          cancel?: string | null;
        } | null;
      };
      setSubscription({
        planId: body.plan_id ?? "free",
        status: body.status ?? "ACTIVE",
        provider: body.provider ?? "none",
        managementUrls: body.management_urls ?? null
      });
    } catch {
      // Non-critical fallback
    }
  }, []);

  const loadPursuits = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setSessionReady(false);
      return;
    }
    setSessionReady(true);
    void loadSubscription(token);
    const response = await fetch("/api/v1/pursuits?limit=30", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return;
    const body = (await response.json()) as { pursuits?: Pursuit[] };
    setPursuits(body.pursuits ?? []);
  }, [loadSubscription]);

  useEffect(() => {
    void Promise.resolve().then(loadPursuits);
    const { data } = supabase.auth.onAuthStateChange(() => {
      void loadPursuits();
    });
    return () => data.subscription.unsubscribe();
  }, [loadPursuits]);

  function handleScenarioSelect(key: "saas" | "revenue" | "migration") {
    setSelectedScenarioKey(key);
    const item = SCENARIOS[key];
    setStageGoalInput(item.goal);
    setStageUnderstanding(item.understanding);
    setStageBottleneck(item.bottleneck);
    setStageMoveTitle(item.moveTitle);
    setStageMoveWhy(item.moveWhy);
  }

  function handleStageGoalChange(val: string) {
    setStageGoalInput(val);
    const trimmed = val.trim();
    if (!trimmed) return;
    setStageUnderstanding(
      `Goal captured: "${trimmed}". Stryde structures known constraints vs. open unknowns before advising work.`
    );
    setStageBottleneck(
      "Identifying the single highest-friction operational hurdle preventing progress on this goal."
    );
    setStageMoveTitle("Execute a 48-hour validation move and record observable feedback");
    setStageMoveWhy(
      "Rather than drafting unprioritized checklists, commit to one concrete move to change reality."
    );
  }

  function openAuthWithGoal(mode: "signin" | "signup" = "signup") {
    setAuthMode(mode);
    setError("");
    setMessage("");
    setAuthModalOpen(true);
  }

  function validateCredentials() {
    if (!email.trim()) return "Enter your email address.";
    if (!password) return "Enter a password.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    return null;
  }

  async function handleAuthSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const validationError = validateCredentials();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    if (authMode === "signin") {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }
      setAuthModalOpen(false);
      await handlePostAuth(data.session?.access_token);
    } else {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password
      });
      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }
      if (data.session) {
        void fetch("/api/v1/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`
          },
          body: JSON.stringify({ event_type: "SIGNUP" })
        });
        setAuthModalOpen(false);
        await handlePostAuth(data.session.access_token);
      } else {
        setMessage("Account created. Check your email to confirm it.");
        setLoading(false);
      }
    }
  }

  async function handlePostAuth(token?: string) {
    if (!token) {
      await loadPursuits();
      setLoading(false);
      return;
    }
    const preservedGoal = stageGoalInput.trim();
    if (preservedGoal && preservedGoal !== SCENARIOS.saas.goal) {
      try {
        const response = await fetch("/api/v1/pursuits", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            title: preservedGoal.slice(0, 80),
            initial_input: preservedGoal
          })
        });
        if (response.ok) {
          const body = (await response.json()) as { pursuit?: Pursuit };
          if (body.pursuit) {
            router.push(`/pursuits/${body.pursuit.id}`);
            return;
          }
        }
      } catch {
        // Fallback to pursuits home
      }
    }
    await loadPursuits();
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setPursuits([]);
    setSubscription(null);
    setSessionReady(false);
  }

  async function createPursuit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Please sign in first.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/v1/pursuits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: title.trim(),
        ...(initialInput.trim() ? { initial_input: initialInput.trim() } : {})
      })
    });

    const body = (await response.json()) as {
      pursuit?: Pursuit;
      error?: string;
    };

    if (!response.ok || !body.pursuit) {
      setError(body.error || "Unable to create pursuit.");
    } else {
      setTitle("");
      setInitialInput("");
      setShowIntakeNotes(false);
      setPursuits((current) => [body.pursuit!, ...current]);
      router.push(`/pursuits/${body.pursuit.id}`);
    }
    setLoading(false);
  }

  async function foundingAccess() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Please sign in first.");
        setLoading(false);
        return;
      }
      void fetch("/api/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ event_type: "PAID_CTA_CLICK" })
      });
      const response = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      const body = (await response.json()) as {
        checkout_url?: string;
        error?: string;
      };
      if (response.ok && body.checkout_url) {
        window.location.href = body.checkout_url;
        return;
      }
      setMessage(body.error ?? "Founding access is not open for payment yet.");
    } catch {
      setError("Could not request founding access.");
    } finally {
      setLoading(false);
    }
  }

  const filteredPursuits = useMemo(() => {
    return pursuits.filter((p) => {
      if (statusFilter === "COMPLETED" && p.status !== "COMPLETED") return false;
      if (statusFilter === "ACTIVE" && p.status === "COMPLETED") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (p.title ?? "Untitled pursuit").toLowerCase().includes(q);
      }
      return true;
    });
  }, [pursuits, statusFilter, searchQuery]);

  const activeCount = useMemo(
    () => pursuits.filter((p) => p.status !== "COMPLETED").length,
    [pursuits]
  );
  const completedCount = useMemo(
    () => pursuits.filter((p) => p.status === "COMPLETED").length,
    [pursuits]
  );

  // =========================================================================
  // VIEW 1: UNAUTHENTICATED PUBLIC LANDING PAGE (Approved Stitch Design)
  // =========================================================================
  if (!sessionReady) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F7F5] text-[#111111]">
        {/* Top Translucent Navbar (Stitch Export 2 style) */}
        <header className="sticky top-0 left-0 right-0 z-40 bg-[#F7F7F5]/85 backdrop-blur-md border-b border-[#E7E7E4]">
          <div className="max-w-[1440px] mx-auto px-6 md:px-12 h-[72px] flex items-center justify-between">
            <div className="flex items-center gap-10">
              <a href="#top" className="text-xl font-semibold tracking-tight text-[#111111] flex items-center gap-2">
                <span>Stryde</span>
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#EBEAE6] text-[#52525B]">
                  Pursuit System
                </span>
              </a>
              <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#52525B]">
                <a href="#truth-loop" className="hover:text-[#111111] transition-colors">
                  How it works
                </a>
                <a href="#execution" className="hover:text-[#111111] transition-colors">
                  Execution &amp; Proof
                </a>
                <a href="#pricing" className="hover:text-[#111111] transition-colors">
                  Pricing
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => openAuthWithGoal("signin")}
                className="text-sm font-medium text-[#52525B] hover:text-[#111111] transition-colors px-3 py-2"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => openAuthWithGoal("signup")}
                className="text-sm font-medium bg-[#111111] text-white px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity"
              >
                Start a pursuit
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 pt-12 md:pt-20 pb-24">
          {/* 1. ASYMMETRIC 12-COLUMN EDITORIAL HERO */}
          <section id="top" className="max-w-[1440px] mx-auto px-6 md:px-12 mb-16 md:mb-28">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end mb-12 md:mb-16">
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBEAE6] text-[#111111] text-xs font-semibold uppercase tracking-wider mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#111111]"></span>
                  Persistent Pursuit &amp; Execution System
                </div>
                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[84px] font-semibold text-[#111111] tracking-[-0.04em] leading-[0.96] mb-8">
                  Turn intention into verified reality.
                </h1>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="#interactive-stage"
                    className="bg-[#111111] text-white px-6 py-3.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Try with your goal below
                  </a>
                  <button
                    type="button"
                    onClick={() => openAuthWithGoal("signin")}
                    className="bg-[#FCFCFB] border border-[#E7E7E4] text-[#111111] px-6 py-3.5 rounded-full text-sm font-medium hover:bg-[#F3F2EF] transition-colors"
                  >
                    Open your workspace →
                  </button>
                </div>
              </div>
              <div className="lg:col-span-4 lg:col-start-9">
                <p className="text-base md:text-lg text-[#52525B] leading-relaxed mb-4">
                  Ordinary AI chat leaves you with walls of advice and forgotten threads. Stryde keeps a living operational record of your pursuit—isolating the real bottleneck, committing to one next move, and separating what you reported from what is verified.
                </p>
                <div className="flex items-center gap-4 text-xs font-medium text-[#6B6B6B] pt-2 border-t border-[#E7E7E4]">
                  <span>Intention</span>
                  <span>→</span>
                  <span>Situation</span>
                  <span>→</span>
                  <span>Next Move</span>
                  <span>→</span>
                  <span className="text-[#111111] font-semibold">Verified Outcome</span>
                </div>
              </div>
            </div>

            {/* 2. CENTERPIECE INTERACTIVE STAGE ("Try-Before-Sign-Up") */}
            <div
              id="interactive-stage"
              className="max-w-[1280px] mx-auto bg-[#F3F2EF] rounded-3xl p-5 sm:p-8 md:p-10 border border-[#E7E7E4] shadow-xs flex flex-col justify-between"
            >
              {/* Stage Top Bar: Scenario Switcher Pills + Status Indicator */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Sample pursuit scenarios">
                  <button
                    type="button"
                    onClick={() => handleScenarioSelect("saas")}
                    className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                      selectedScenarioKey === "saas"
                        ? "bg-[#111111] text-white shadow-xs"
                        : "bg-[#FCFCFB] border border-[#E7E7E4] text-[#52525B] hover:text-[#111111]"
                    }`}
                  >
                    Launch B2B SaaS
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScenarioSelect("revenue")}
                    className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                      selectedScenarioKey === "revenue"
                        ? "bg-[#111111] text-white shadow-xs"
                        : "bg-[#FCFCFB] border border-[#E7E7E4] text-[#52525B] hover:text-[#111111]"
                    }`}
                  >
                    Fix Conversion Drop
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScenarioSelect("migration")}
                    className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                      selectedScenarioKey === "migration"
                        ? "bg-[#111111] text-white shadow-xs"
                        : "bg-[#FCFCFB] border border-[#E7E7E4] text-[#52525B] hover:text-[#111111]"
                    }`}
                  >
                    Ship Production Audit
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-[#52525B] bg-[#FCFCFB] px-3.5 py-1.5 rounded-full border border-[#E7E7E4]">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  <span>Interactive Preview · Type your own goal</span>
                </div>
              </div>

              {/* Stage Center: Live Goal Input + Real-Time Structured Breakdown */}
              <div className="space-y-6 my-2">
                <div className="bg-[#FCFCFB] rounded-2xl p-4 sm:p-5 border border-[#E7E7E4] shadow-xs">
                  <label htmlFor="hero-goal-input" className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] mb-2">
                    What are you trying to make happen?
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      id="hero-goal-input"
                      type="text"
                      value={stageGoalInput}
                      onChange={(e) => handleStageGoalChange(e.target.value)}
                      placeholder="Type your real goal or paste a messy plan…"
                      className="flex-1 bg-[#F7F7F5] border border-[#E7E7E4] rounded-xl px-4 py-3 text-sm sm:text-base text-[#111111] placeholder:text-[#6B6B6B] focus:border-[#111111] focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => openAuthWithGoal("signup")}
                      className="bg-[#111111] text-white px-6 py-3 rounded-full text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
                    >
                      Save &amp; continue pursuit →
                    </button>
                  </div>
                </div>

                {/* 3-Part Operational Breakdown inside Stage */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
                  {/* Left 5 Cols: Current Reality & Active Bottleneck */}
                  <div className="lg:col-span-5 bg-[#FCFCFB] rounded-2xl p-6 border border-[#E7E7E4] flex flex-col justify-between space-y-5">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
                          1 · Current Reality
                        </span>
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#EBEAE6] text-[#111111]">
                          Grounded
                        </span>
                      </div>
                      <p className="text-sm sm:text-[15px] text-[#111111] leading-relaxed font-medium">
                        {stageUnderstanding}
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#FFFBEB] border border-amber-200/80 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-900 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                        <span>2 · Active Bottleneck</span>
                      </div>
                      <p className="text-sm text-amber-950 leading-relaxed font-medium">
                        {stageBottleneck}
                      </p>
                    </div>
                  </div>

                  {/* Right 7 Cols: Single Committed Next Move & Proof Requirement */}
                  <div className="lg:col-span-7 bg-[#FCFCFB] rounded-2xl p-6 border border-[#E7E7E4] flex flex-col justify-between space-y-5">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#111111]">
                          3 · Single Recommended Next Move
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-[#F3F2EF] border border-[#E7E7E4] text-[#111111]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#111111]"></span>
                          Assigned to You · Ready to start
                        </span>
                      </div>
                      <h2 className="text-lg sm:text-xl font-semibold text-[#111111] tracking-tight mb-2">
                        {stageMoveTitle}
                      </h2>
                      <p className="text-sm text-[#52525B] leading-relaxed">
                        {stageMoveWhy}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[#E7E7E4] flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-[#6B6B6B]">
                        <span className="font-semibold text-[#111111]">Completion proof:</span> Observable result (self-reports marked <em>Reported</em> until verified).
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openAuthWithGoal("signup")}
                          className="bg-[#111111] text-white px-4 py-2 rounded-full text-xs font-medium hover:opacity-90 transition-opacity"
                        >
                          Start this move
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage Bottom Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 mt-4 border-t border-[#E7E7E4]">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#52525B]">
                  <span className="font-medium text-[#111111]">Included in workspace:</span>
                  <span className="bg-[#FCFCFB] border border-[#E7E7E4] px-3 py-1 rounded-full">Source &amp; File Audit</span>
                  <span className="bg-[#FCFCFB] border border-[#E7E7E4] px-3 py-1 rounded-full">Live Web Research</span>
                  <span className="bg-[#FCFCFB] border border-[#E7E7E4] px-3 py-1 rounded-full">Honest State Tracking</span>
                </div>
                <button
                  type="button"
                  onClick={() => openAuthWithGoal("signup")}
                  className="text-xs font-semibold text-[#111111] hover:underline"
                >
                  Open full workspace with this pursuit →
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 01: THE 5-STAGE TRUTH LOOP */}
          <section id="truth-loop" className="max-w-[1440px] mx-auto px-6 md:px-12 mb-24 md:mb-32">
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 rounded-full bg-[#EBEAE6] text-[#111111] text-xs font-semibold uppercase tracking-wider">
                01 · The Truth Loop
              </span>
              <div className="h-px bg-[#E7E7E4] flex-grow"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-12 md:mb-16">
              <div className="lg:col-span-5">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#111111] tracking-[-0.03em] leading-[1.06]">
                  Built for progress in reality, not endless chat.
                </h2>
              </div>
              <div className="lg:col-span-6 lg:col-start-7 flex flex-col justify-center">
                <p className="text-base md:text-lg text-[#52525B] leading-relaxed">
                  Every turn in Stryde updates a persistent operational model of your pursuit. You never have to dig through a 200-message transcript to remember what is true, what is blocking you, or what to do next.
                </p>
              </div>
            </div>

            {/* 5-Stage Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
              <div className="bg-[#FCFCFB] rounded-2xl p-6 border border-[#E7E7E4] flex flex-col justify-between">
                <div>
                  <span className="inline-block text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#F3F2EF] text-[#111111] mb-4">
                    Stage 01
                  </span>
                  <h3 className="text-lg font-semibold text-[#111111] mb-2">Intention</h3>
                  <p className="text-sm text-[#52525B] leading-relaxed">
                    Bring a concrete goal, a messy brain-dump, or an existing roadmap from another tool.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#E7E7E4] text-xs text-[#6B6B6B]">
                  Natural language or file upload
                </div>
              </div>

              <div className="bg-[#FCFCFB] rounded-2xl p-6 border border-[#E7E7E4] flex flex-col justify-between">
                <div>
                  <span className="inline-block text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#F3F2EF] text-[#111111] mb-4">
                    Stage 02
                  </span>
                  <h3 className="text-lg font-semibold text-[#111111] mb-2">Situation &amp; Blocker</h3>
                  <p className="text-sm text-[#52525B] leading-relaxed">
                    Stryde separates what is known from what is uncertain and isolates the single active bottleneck.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#E7E7E4] text-xs text-[#6B6B6B]">
                  Explicit known vs. unknown ledger
                </div>
              </div>

              <div className="bg-[#FCFCFB] rounded-2xl p-6 border border-[#E7E7E4] flex flex-col justify-between">
                <div>
                  <span className="inline-block text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#F3F2EF] text-[#111111] mb-4">
                    Stage 03
                  </span>
                  <h3 className="text-lg font-semibold text-[#111111] mb-2">Grounded Evidence</h3>
                  <p className="text-sm text-[#52525B] leading-relaxed">
                    Uploaded docs and live web research are audited against your constraints with exact quote provenance.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#E7E7E4] text-xs text-[#6B6B6B]">
                  Zero hallucinated citations
                </div>
              </div>

              <div className="bg-[#111111] text-white rounded-2xl p-6 border border-[#111111] flex flex-col justify-between">
                <div>
                  <span className="inline-block text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 text-white mb-4">
                    Stage 04
                  </span>
                  <h3 className="text-lg font-semibold text-white mb-2">One Next Move</h3>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    Commits to one highest-leverage action at a time—either for you to execute or for Stryde&apos;s runner.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/15 text-xs text-zinc-300">
                  Always includes manual fallback
                </div>
              </div>

              <div className="bg-[#FCFCFB] rounded-2xl p-6 border border-[#E7E7E4] flex flex-col justify-between">
                <div>
                  <span className="inline-block text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 mb-4">
                    Stage 05
                  </span>
                  <h3 className="text-lg font-semibold text-[#111111] mb-2">Verified Learning</h3>
                  <p className="text-sm text-[#52525B] leading-relaxed">
                    Report what happened in plain words. Stryde updates the brief and distinguishes reported claims from verified proof.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#E7E7E4] text-xs text-emerald-800 font-medium">
                  ● Reported ≠ Verified
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 02: EXECUTION & HONESTY */}
          <section id="execution" className="max-w-[1440px] mx-auto px-6 md:px-12 mb-24 md:mb-32">
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 rounded-full bg-[#EBEAE6] text-[#111111] text-xs font-semibold uppercase tracking-wider">
                02 · Execution &amp; Honesty
              </span>
              <div className="h-px bg-[#E7E7E4] flex-grow"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-12 md:mb-16">
              <div className="lg:col-span-5">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#111111] tracking-[-0.03em] leading-[1.06]">
                  One unified intelligence. Zero plumbing clutter.
                </h2>
              </div>
              <div className="lg:col-span-6 lg:col-start-7 flex flex-col justify-center">
                <p className="text-base md:text-lg text-[#52525B] leading-relaxed">
                  You never have to pick models, wire up sub-agents, or wonder whether a background task actually ran. Stryde handles research, artifacts, and execution behind one calm interface.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Card A: Honest Action Lifecycle */}
              <div className="bg-[#F3F2EF] rounded-3xl p-8 border border-[#E7E7E4] flex flex-col justify-between">
                <div className="mb-8">
                  <span className="inline-block text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] mb-2">
                    Truthful State Model
                  </span>
                  <h3 className="text-2xl font-semibold text-[#111111] mb-3">
                    A queued task is never called &ldquo;complete&rdquo;
                  </h3>
                  <p className="text-sm sm:text-base text-[#52525B] leading-relaxed">
                    Every action clearly shows whether it is <strong className="text-[#111111]">Proposed</strong>, <strong className="text-[#111111]">In Progress</strong>, <strong className="text-[#111111]">Queued for Runner</strong>, <strong className="text-[#111111]">Self-Reported</strong>, or <strong className="text-[#111111]">Verified</strong>. And if a background task is waiting, you can always complete or report it manually in one click.
                  </p>
                </div>
                <div className="bg-[#FCFCFB] rounded-2xl p-5 border border-[#E7E7E4] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#111111]">Verify production webhook endpoint</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      Verified via HTTP 200 probe
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#E7E7E4]">
                    <span className="text-xs font-semibold text-[#111111]">Customer discovery call #3</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                      Reported by you · Awaiting notes
                    </span>
                  </div>
                </div>
              </div>

              {/* Card B: Grounded Context & Deliverables */}
              <div className="bg-[#F3F2EF] rounded-3xl p-8 border border-[#E7E7E4] flex flex-col justify-between">
                <div className="mb-8">
                  <span className="inline-block text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] mb-2">
                    Quiet Context Drawer
                  </span>
                  <h3 className="text-2xl font-semibold text-[#111111] mb-3">
                    Sources, memory, and deliverables on demand
                  </h3>
                  <p className="text-sm sm:text-base text-[#52525B] leading-relaxed">
                    Your workspace stays focused on your current situation and next move. When you want to inspect web citations, edit what Stryde remembers, or review versioned deliverables, everything opens in one clean side drawer.
                  </p>
                </div>
                <div className="bg-[#FCFCFB] rounded-2xl p-5 border border-[#E7E7E4] flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">Versioned Deliverable</div>
                    <div className="text-sm font-semibold text-[#111111] mt-0.5">30-Day Design Partner Outbound Playbook</div>
                    <div className="text-xs text-[#52525B] mt-1">Revision 3 · Grounded in 4 verified sources</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAuthWithGoal("signin")}
                    className="bg-[#111111] text-white px-4 py-2 rounded-full text-xs font-medium shrink-0"
                  >
                    Open in workspace
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 03: PRICING & ACCESS */}
          <section id="pricing" className="max-w-[1440px] mx-auto px-6 md:px-12 mb-20">
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 rounded-full bg-[#EBEAE6] text-[#111111] text-xs font-semibold uppercase tracking-wider">
                03 · Pricing &amp; Access
              </span>
              <div className="h-px bg-[#E7E7E4] flex-grow"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-12">
              <div className="lg:col-span-5">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#111111] tracking-[-0.03em] leading-[1.06]">
                  Start free. Upgrade when pursuits scale.
                </h2>
              </div>
              <div className="lg:col-span-6 lg:col-start-7 flex flex-col justify-center">
                <p className="text-base md:text-lg text-[#52525B] leading-relaxed">
                  Transparent plans with global checkout and merchant compliance handled by Paddle as Merchant of Record (supporting Pakistani and international software businesses with direct payouts).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
              {/* Free Plan */}
              <div className="bg-[#FCFCFB] rounded-3xl p-8 border border-[#E7E7E4] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold uppercase tracking-wider text-[#52525B]">Free Workspace</span>
                    <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#F3F2EF] text-[#111111]">Always available</span>
                  </div>
                  <div className="text-4xl font-semibold text-[#111111] tracking-tight mb-2">$0</div>
                  <p className="text-sm text-[#52525B] mb-6">Everything needed to structure and run your first active pursuits.</p>
                  <ul className="space-y-2.5 text-sm text-[#111111] mb-8">
                    <li className="flex items-center gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-[#111111]"></span> Persistent pursuit brief &amp; next-move engine</li>
                    <li className="flex items-center gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-[#111111]"></span> Source upload, method extraction &amp; memory</li>
                    <li className="flex items-center gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-[#111111]"></span> Honest action tracking &amp; outcome verification</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => openAuthWithGoal("signup")}
                  className="w-full bg-[#F3F2EF] hover:bg-[#EBEAE6] text-[#111111] py-3.5 rounded-full text-sm font-medium transition-colors"
                >
                  Start free workspace
                </button>
              </div>

              {/* Pro Plan */}
              <div className="bg-[#FCFCFB] rounded-3xl p-8 border-2 border-[#111111] flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold uppercase tracking-wider text-[#111111]">Stryde Pro</span>
                    <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#111111] text-white">Full Capacity</span>
                  </div>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-4xl font-semibold text-[#111111] tracking-tight">$29</span>
                    <span className="text-sm text-[#52525B]">/ month</span>
                  </div>
                  <p className="text-sm text-[#52525B] mb-6">For founders and operators running multiple high-stakes pursuits.</p>
                  <ul className="space-y-2.5 text-sm text-[#111111] mb-8">
                    <li className="flex items-center gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Unlimited active pursuits &amp; versioned deliverables</li>
                    <li className="flex items-center gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Deep web research &amp; automated verification runs</li>
                    <li className="flex items-center gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Priority background execution &amp; continuity checks</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => openAuthWithGoal("signup")}
                  className="w-full bg-[#111111] text-white py-3.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Get started with Pro
                </button>
              </div>
            </div>
          </section>
        </main>

        {/* WARM-STONE AUTH MODAL */}
        {authModalOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setAuthModalOpen(false);
            }}
          >
            <div className="bg-[#FCFCFB] border border-[#E7E7E4] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-block text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#EBEAE6] text-[#111111] mb-2">
                    {authMode === "signin" ? "Sign In" : "Save & Continue Pursuit"}
                  </span>
                  <h2 id="auth-modal-title" className="text-2xl font-semibold tracking-tight text-[#111111]">
                    {authMode === "signin" ? "Welcome back to Stryde" : "Open your Stryde workspace"}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#52525B] mt-1">
                    {authMode === "signin"
                      ? "Sign in to access your persistent pursuits and active moves."
                      : "Your pursuit goal is preserved and will open immediately inside your workspace."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(false)}
                  aria-label="Close dialog"
                  className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#F3F2EF] text-[#52525B] hover:text-[#111111]"
                >
                  ✕
                </button>
              </div>

              {stageGoalInput.trim() ? (
                <div className="bg-[#F3F2EF] rounded-2xl p-3.5 border border-[#E7E7E4]">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">Preserved Goal</div>
                  <div className="text-xs sm:text-sm font-medium text-[#111111] mt-0.5 line-clamp-2">
                    {stageGoalInput}
                  </div>
                </div>
              ) : null}

              <form onSubmit={handleAuthSubmit} noValidate className="space-y-3.5">
                <div>
                  <label htmlFor="auth-email" className="block text-xs font-medium text-[#111111] mb-1">
                    Email address
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                    className="w-full bg-[#F7F7F5] border border-[#E7E7E4] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#6B6B6B] focus:border-[#111111] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="auth-password" className="block text-xs font-medium text-[#111111] mb-1">
                    Password
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="At least 6 characters"
                    autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                    required
                    minLength={6}
                    className="w-full bg-[#F7F7F5] border border-[#E7E7E4] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#6B6B6B] focus:border-[#111111] focus:bg-white focus:outline-none"
                  />
                </div>

                {error ? (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {error}
                  </p>
                ) : null}

                {message ? (
                  <p className="rounded-xl border border-[#E7E7E4] bg-[#F3F2EF] px-3 py-2 text-xs text-[#52525B]">
                    {message}
                  </p>
                ) : null}

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#111111] text-white py-3 rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-45 transition-opacity"
                  >
                    {loading ? "Working…" : authMode === "signin" ? "Sign in to workspace →" : "Continue to workspace →"}
                  </button>

                  <div className="text-center pt-2">
                    {authMode === "signin" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("signup");
                          setError("");
                        }}
                        className="text-xs text-[#52525B] hover:text-[#111111]"
                      >
                        New to Stryde? <span className="font-semibold underline">Create account</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("signin");
                          setError("");
                        }}
                        className="text-xs text-[#52525B] hover:text-[#111111]"
                      >
                        Already have an account? <span className="font-semibold underline">Sign in</span>
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: AUTHENTICATED PURSUITS HOME (Approved Stitch Design)
  // =========================================================================
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F5] text-[#111111]">
      {/* Top Operational Bar */}
      <header className="sticky top-0 z-30 bg-[#F7F7F5]/85 backdrop-blur-md border-b border-[#E7E7E4]">
        <div className="max-w-5xl mx-auto px-6 h-[68px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold tracking-tight text-[#111111]">Stryde</span>
            <span className="text-[#D4D4D0]">/</span>
            <span className="text-sm font-medium text-[#52525B]">Pursuits Home</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#EBEAE6] text-[#111111]">
              {subscription?.planId === "pro" || subscription?.planId === "max" ? (
                <span className="text-emerald-700">● {subscription.planId.toUpperCase()}</span>
              ) : (
                <span>Free Plan</span>
              )}
            </span>
            {subscription?.managementUrls?.updatePaymentMethod ? (
              <a
                href={subscription.managementUrls.updatePaymentMethod}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-[#52525B] hover:text-[#111111] px-3 py-1.5 rounded-full border border-[#E7E7E4] bg-[#FCFCFB]"
              >
                Manage
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-xs font-medium text-[#52525B] hover:text-[#111111] px-3 py-1.5 rounded-full border border-[#E7E7E4] bg-[#FCFCFB] hover:border-[#111111] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl w-full mx-auto px-6 py-10 space-y-10">
        {/* Top "Start a New Pursuit" Stage (#F3F2EF rounded-3xl) */}
        <section aria-labelledby="new-pursuit-heading" className="bg-[#F3F2EF] rounded-3xl p-6 sm:p-8 border border-[#E7E7E4]">
          <div className="flex items-center justify-between mb-3">
            <span id="new-pursuit-heading" className="text-xs font-semibold uppercase tracking-wider text-[#52525B]">
              New Pursuit
            </span>
            <span className="text-xs text-[#6B6B6B]">Starts a persistent operational record</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111111] mb-4">
            What do you want to move forward today?
          </h1>

          <form onSubmit={createPursuit} className="space-y-3">
            <div className="bg-[#FCFCFB] rounded-2xl p-3 border border-[#E7E7E4] flex flex-col sm:flex-row gap-3 shadow-xs">
              <input
                id="pursuit-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sign our first 5 paying design-partner teams within 30 days…"
                className="flex-1 bg-transparent px-3 py-2 text-sm sm:text-base text-[#111111] placeholder:text-[#6B6B6B] focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="bg-[#111111] text-white px-6 py-3 rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-45 shrink-0 transition-opacity"
              >
                {loading ? "Starting…" : "Start pursuit →"}
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowIntakeNotes((v) => !v)}
                className="text-xs font-medium text-[#52525B] hover:text-[#111111] underline underline-offset-4"
              >
                {showIntakeNotes ? "− Hide context notes" : "+ Add a roadmap or messy notes (optional)"}
              </button>

              {showIntakeNotes ? (
                <div className="mt-3">
                  <textarea
                    value={initialInput}
                    onChange={(e) => setInitialInput(e.target.value)}
                    rows={4}
                    maxLength={120000}
                    placeholder="Paste notes, an existing roadmap, or constraints. Stryde reads it, extracts facts, and asks only what is needed."
                    className="w-full bg-[#FCFCFB] border border-[#E7E7E4] rounded-2xl p-4 text-sm text-[#111111] placeholder:text-[#6B6B6B] focus:border-[#111111] focus:outline-none"
                  />
                </div>
              ) : null}
            </div>

            {error ? (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                {error}
              </p>
            ) : null}

            {message ? (
              <p className="rounded-xl border border-[#E7E7E4] bg-[#FCFCFB] p-3 text-xs text-[#52525B]">
                {message}
              </p>
            ) : null}
          </form>
        </section>

        {/* Active Pursuits Ledger */}
        <section aria-labelledby="pursuits-ledger-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7E7E4] pb-3">
            <div className="flex items-center gap-2.5">
              <h2 id="pursuits-ledger-heading" className="text-lg font-semibold tracking-tight text-[#111111]">
                Active Pursuits
              </h2>
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-[#EBEAE6] text-[#111111]">
                {pursuits.length}
              </span>
            </div>

            {pursuits.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {pursuits.length > 3 ? (
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter pursuits…"
                    aria-label="Filter pursuits"
                    className="bg-[#FCFCFB] border border-[#E7E7E4] rounded-full px-3.5 py-1 text-xs text-[#111111] placeholder:text-[#6B6B6B] focus:border-[#111111] focus:outline-none"
                  />
                ) : null}
                <div className="inline-flex rounded-full bg-[#EBEAE6] p-1 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ALL")}
                    className={`px-3 py-1 rounded-full transition-colors ${
                      statusFilter === "ALL" ? "bg-[#111111] text-white" : "text-[#52525B] hover:text-[#111111]"
                    }`}
                  >
                    All ({pursuits.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ACTIVE")}
                    className={`px-3 py-1 rounded-full transition-colors ${
                      statusFilter === "ACTIVE" ? "bg-[#111111] text-white" : "text-[#52525B] hover:text-[#111111]"
                    }`}
                  >
                    Active ({activeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("COMPLETED")}
                    className={`px-3 py-1 rounded-full transition-colors ${
                      statusFilter === "COMPLETED" ? "bg-[#111111] text-white" : "text-[#52525B] hover:text-[#111111]"
                    }`}
                  >
                    Done ({completedCount})
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {pursuits.length === 0 ? (
            <div className="bg-[#FCFCFB] rounded-2xl p-8 border border-[#E7E7E4] text-center space-y-2">
              <p className="text-base font-semibold text-[#111111]">No pursuits yet. Start with something real.</p>
              <p className="text-sm text-[#52525B] max-w-md mx-auto">
                Type the goal you want to make happen above. Stryde will open a persistent workspace to isolate your bottleneck and guide the first concrete move.
              </p>
            </div>
          ) : filteredPursuits.length === 0 ? (
            <div className="bg-[#FCFCFB] rounded-2xl p-6 border border-[#E7E7E4] text-sm text-[#52525B]">
              No pursuits match the current filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredPursuits.map((p) => {
                const meta = describePursuitStatus(p.status);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => router.push(`/pursuits/${p.id}`)}
                    className="cursor-pointer group text-left bg-[#FCFCFB] hover:border-[#111111] transition-all rounded-2xl p-6 border border-[#E7E7E4] flex flex-col justify-between space-y-5 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${meta.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                          {meta.summary}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-[#111111] group-hover:underline mb-2 line-clamp-2">
                        {p.title || "Untitled pursuit"}
                      </h3>
                    </div>
                    <div className="pt-4 border-t border-[#E7E7E4] flex items-center justify-between text-xs">
                      <span className="text-[#6B6B6B]">Operational Record</span>
                      <span className="font-semibold text-[#111111] group-hover:translate-x-0.5 transition-transform">
                        Open workspace →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Commercial Access / Founding Membership */}
        <section className="bg-[#FCFCFB] rounded-3xl p-6 sm:p-7 border border-[#E7E7E4]">
          <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#52525B]">
                  Founding Membership &amp; Access
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EBEAE6] text-[#111111]">
                  Tier: {subscription?.planId ? subscription.planId.toUpperCase() : "FREE"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#52525B] max-w-xl leading-relaxed">
                Global and Pakistan billing is processed securely by Paddle as Merchant of Record (supporting Pakistani software businesses with direct SWIFT and Payoneer payouts).
              </p>
            </div>
            {subscription?.managementUrls?.updatePaymentMethod ? (
              <a
                href={subscription.managementUrls.updatePaymentMethod}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 bg-[#F3F2EF] hover:bg-[#EBEAE6] text-[#111111] px-5 py-2.5 rounded-full text-xs font-medium transition-colors"
              >
                Manage subscription
              </a>
            ) : (
              <button
                type="button"
                onClick={() => void foundingAccess()}
                disabled={loading}
                className="shrink-0 bg-[#111111] text-white px-5 py-2.5 rounded-full text-xs font-medium hover:opacity-90 disabled:opacity-45 transition-opacity"
              >
                {subscription?.planId === "pro" || subscription?.planId === "max"
                  ? "Manage Pro tier"
                  : "Request founding access"}
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
