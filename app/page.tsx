"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Pursuit = {
  id: string;
  title: string | null;
  status: string;
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
        dotClass: "bg-[var(--verified)]",
        badgeClass:
          "border-[#b7dec9] bg-[var(--verified-Wash)] text-[var(--verified)]"
      };
    case "PAUSED":
      return {
        code: "PAUSED",
        summary: "Paused",
        dotClass: "bg-[var(--waiting)]",
        badgeClass:
          "border-[#ead2a2] bg-[var(--waiting-wash)] text-[var(--waiting)]"
      };
    case "DISCOVERING":
      return {
        code: "DISCOVERING",
        summary: "Clarifying situation & bottleneck",
        dotClass: "bg-[var(--signal)]",
        badgeClass:
          "border-[#f0c5ba] bg-[var(--signal-wash)] text-[var(--signal)]"
      };
    case "IN_PROGRESS":
      return {
        code: "IN_PROGRESS",
        summary: "Executing next move",
        dotClass: "bg-[var(--signal)]",
        badgeClass:
          "border-[#f0c5ba] bg-[var(--signal-wash)] text-[var(--signal)]"
      };
    case "ACTIVE":
    default:
      return {
        code: status || "ACTIVE",
        summary: "Active pursuit",
        dotClass: "bg-[var(--signal)]",
        badgeClass:
          "border-[var(--rule)] bg-[var(--surface-subtle)] text-[var(--ink-secondary)]"
      };
  }
}

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [initialInput, setInitialInput] = useState("");
  const [showIntake, setShowIntake] = useState(false);
  const [pursuits, setPursuits] = useState<Pursuit[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED">(
    "ALL"
  );
  const [sessionReady, setSessionReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPursuits = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setSessionReady(false);
      return;
    }
    setSessionReady(true);
    const response = await fetch("/api/v1/pursuits?limit=30", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return;
    const body = (await response.json()) as { pursuits?: Pursuit[] };
    setPursuits(body.pursuits ?? []);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadPursuits);
    const { data } = supabase.auth.onAuthStateChange(() => {
      void loadPursuits();
    });
    return () => data.subscription.unsubscribe();
  }, [loadPursuits]);

  function validateCredentials() {
    if (!email.trim()) return "Enter your email address.";
    if (!password) return "Enter a password.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    return null;
  }

  async function signIn(event: FormEvent) {
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
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (authError) {
      setError(authError.message);
    } else {
      setMessage("Signed in.");
      await loadPursuits();
    }
    setLoading(false);
  }

  async function signUp() {
    setLoading(true);
    setError("");
    setMessage("");
    const validationError = validateCredentials();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password
    });
    if (authError) {
      setError(authError.message);
    } else {
      setMessage(
        data.session
          ? "Account created."
          : "Account created. Check your email to confirm it."
      );
      if (data.session) {
        void fetch("/api/v1/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`
          },
          body: JSON.stringify({ event_type: "SIGNUP" })
        });
      }
    }
    setLoading(false);
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
      setShowIntake(false);
      setPursuits((current) => [body.pursuit!, ...current]);
      router.push(`/pursuits/${body.pursuit.id}`);
    }
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setPursuits([]);
    setSessionReady(false);
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
      setMessage(
        body.error ?? "Founding access is not open for payment yet."
      );
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

  if (!sessionReady) {
    return (
      <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
        <header className="border-b border-[var(--rule)] bg-[var(--surface)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[16px] font-bold tracking-tight text-[var(--ink)]">
                stryde<span className="text-[var(--signal)]">.</span>
              </span>
              <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">
                Pursuit Operator
              </span>
            </div>
            <span className="hidden font-mono text-[11px] text-[var(--ink-muted)] sm:inline">
              Intention → Bottleneck → Next Move → Verified Outcome
            </span>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-12">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.95fr] lg:items-start lg:gap-12">
            {/* Left column: Operational thesis & loop trace */}
            <section className="space-y-5">
              <div className="space-y-2.5">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--signal)]">
                  Outcome-Driven Execution
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl sm:leading-[1.12]">
                  What are you trying to make happen?
                </h1>
                <p className="max-w-xl text-[14.5px] leading-relaxed text-[var(--ink-secondary)]">
                  Stryde keeps a persistent operational record of your pursuit. Instead of generating endless advice, it isolates the current bottleneck, commits to one concrete next move, and separates self-reported progress from verified results.
                </p>
              </div>

              <div className="hidden rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] sm:block">
                <div className="flex items-center justify-between border-b border-[var(--rule)] bg-[var(--surface-subtle)] px-3.5 py-2">
                  <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--ink-secondary)]">
                    How a pursuit operates
                  </span>
                  <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                    Truthful state model
                  </span>
                </div>
                <div className="divide-y divide-[var(--rule)] text-[13px]">
                  <div className="grid grid-cols-[120px_1fr] gap-3 px-3.5 py-2.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">
                      1. Bottleneck
                    </span>
                    <span className="text-[var(--ink-secondary)]">
                      Diagnose what is actually blocking the outcome right now before proposing work.
                    </span>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-3 border-l-[3px] border-l-[var(--signal)] bg-[var(--signal-wash)] px-3.5 py-2.5">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--signal)]">
                      2. Next Move
                    </span>
                    <span className="font-medium text-[var(--ink)]">
                      Choose one concrete action to execute or delegate—never a wall of unprioritized tasks.
                    </span>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-3 px-3.5 py-2.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">
                      3. Verification
                    </span>
                    <span className="text-[var(--ink-secondary)]">
                      Keep user-reported updates distinct from source-backed or independently verified outcomes.
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Right column: Authentication panel */}
            <section className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] p-5 sm:p-6">
              <div className="mb-4 border-b border-[var(--rule)] pb-3">
                <h2 className="text-[16px] font-semibold text-[var(--ink)]">
                  Access your pursuit workspace
                </h2>
                <p className="mt-0.5 text-[12.5px] text-[var(--ink-muted)]">
                  Sign in with your account credentials or create a new workspace.
                </p>
              </div>

              <form onSubmit={signIn} noValidate className="space-y-3.5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--ink-secondary)]"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="w-full rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--ink-secondary)]"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="At least 6 characters"
                    autoComplete="current-password"
                    required
                    minLength={6}
                    className="w-full rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
                  />
                </div>

                {error ? (
                  <p
                    role="alert"
                    className="rounded-[4px] border border-[#efb9b9] bg-[var(--blocked-wash)] px-3 py-2 text-[13px] font-medium text-[var(--blocked)]"
                  >
                    {error}
                  </p>
                ) : null}

                {message ? (
                  <p className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-3 py-2 text-[13px] text-[var(--ink-secondary)]">
                    {message}
                  </p>
                ) : null}

                <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-[4px] bg-[var(--ink)] px-4 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-[#2a2f2c] disabled:opacity-45"
                  >
                    {loading ? "Working…" : "Sign in"}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void signUp()}
                    className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-4 py-2.5 text-[13.5px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--rule-strong)] hover:bg-[#e4e7e2] disabled:opacity-45"
                  >
                    Create account
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      {/* Top operational bar */}
      <header className="border-b border-[var(--rule)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="text-[16px] font-bold tracking-tight text-[var(--ink)]">
              stryde<span className="text-[var(--signal)]">.</span>
            </span>
            <span className="hidden h-3.5 w-[1px] bg-[var(--rule)] sm:inline-block" />
            <span className="hidden font-mono text-[11px] uppercase tracking-wider text-[var(--ink-muted)] sm:inline-block">
              Pursuit Index
            </span>
          </div>

          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-2.5 py-1 text-[12px] font-medium text-[var(--ink-secondary)] transition-colors hover:border-[var(--rule-strong)] hover:text-[var(--ink)]"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
        {/* New Pursuit Intake */}
        <section
          aria-labelledby="new-pursuit-heading"
          className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)]"
        >
          <div className="border-b border-[var(--rule)] bg-[var(--surface-subtle)] px-4 py-2.5 sm:px-5">
            <div className="flex items-center justify-between">
              <h1
                id="new-pursuit-heading"
                className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--ink-secondary)]"
              >
                What needs to move?
              </h1>
              <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                Starts an operational record
              </span>
            </div>
          </div>

          <form onSubmit={createPursuit} className="space-y-3 p-4 sm:p-5">
            <div>
              <label
                htmlFor="pursuit-title-input"
                className="mb-1.5 block text-[15px] font-semibold text-[var(--ink)]"
              >
                Start with a real outcome. Stryde will help you work the situation.
              </label>
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <input
                  id="pursuit-title-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Land my first AI-native operations client"
                  className="min-w-0 flex-1 rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3.5 py-2.5 text-[14.5px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading || !title.trim()}
                  className="shrink-0 rounded-[4px] bg-[var(--ink)] px-4 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-[#2a2f2c] disabled:opacity-45"
                >
                  Start pursuit
                </button>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowIntake((v) => !v)}
                className="font-mono text-[11.5px] font-medium text-[var(--ink-secondary)] underline decoration-[var(--rule-strong)] underline-offset-2 hover:text-[var(--ink)]"
              >
                {showIntake
                  ? "− Hide context"
                  : "+ Add a roadmap or notes (optional)"}
              </button>

              {showIntake ? (
                <div className="mt-2.5">
                  <textarea
                    value={initialInput}
                    onChange={(e) => setInitialInput(e.target.value)}
                    rows={5}
                    maxLength={120000}
                    placeholder="Paste an existing roadmap from another AI, your own notes, or one big messy brain-dump. Stryde will read it, find what matters, and ask only what it needs to."
                    className="w-full rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-3 py-2 text-[13.5px] leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:bg-[var(--surface)] focus:outline-none"
                  />
                </div>
              ) : null}
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-[4px] border border-[#efb9b9] bg-[var(--blocked-wash)] px-3 py-2 text-[13px] font-medium text-[var(--blocked)]"
              >
                {error}
              </p>
            ) : null}

            {message ? (
              <p className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-3 py-2 text-[13px] text-[var(--ink-secondary)]">
                {message}
              </p>
            ) : null}
          </form>
        </section>

        {/* Active Pursuits Ledger */}
        <section aria-labelledby="pursuits-ledger-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rule)] pb-2.5">
            <div className="flex items-center gap-2.5">
              <h2
                id="pursuits-ledger-heading"
                className="text-[15px] font-semibold tracking-tight text-[var(--ink)]"
              >
                Active pursuits
              </h2>
              <span className="rounded-[3px] border border-[var(--rule)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink-secondary)]">
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
                    className="w-40 rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-2.5 py-1 text-[12.5px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none sm:w-48"
                  />
                ) : null}
                <div className="inline-flex rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] p-0.5 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ALL")}
                    className={`rounded-[3px] px-2 py-0.5 transition-colors ${
                      statusFilter === "ALL"
                        ? "bg-[var(--ink)] font-medium text-white"
                        : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                    }`}
                  >
                    All ({pursuits.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ACTIVE")}
                    className={`rounded-[3px] px-2 py-0.5 transition-colors ${
                      statusFilter === "ACTIVE"
                        ? "bg-[var(--ink)] font-medium text-white"
                        : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                    }`}
                  >
                    Active ({activeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("COMPLETED")}
                    className={`rounded-[3px] px-2 py-0.5 transition-colors ${
                      statusFilter === "COMPLETED"
                        ? "bg-[var(--ink)] font-medium text-white"
                        : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                    }`}
                  >
                    Done ({completedCount})
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {pursuits.length === 0 ? (
            <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] p-6">
              <p className="text-[14px] font-medium text-[var(--ink)]">
                No pursuits yet. Start with something real.
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-secondary)]">
                Enter the outcome you want to reach above. Stryde will open a persistent workspace to diagnose your current bottleneck and identify the first concrete move.
              </p>
            </div>
          ) : filteredPursuits.length === 0 ? (
            <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] p-5 text-[13.5px] text-[var(--ink-secondary)]">
              No pursuits match the current filter.
            </div>
          ) : (
            <div className="divide-y divide-[var(--rule)] overflow-hidden rounded-[4px] border border-[var(--rule)] bg-[var(--surface)]">
              {filteredPursuits.map((pursuit, index) => {
                const statusMeta = describePursuitStatus(pursuit.status);
                const isPrimaryActive =
                  index === 0 &&
                  pursuit.status !== "COMPLETED" &&
                  statusFilter !== "COMPLETED";
                return (
                  <button
                    key={pursuit.id}
                    type="button"
                    onClick={() => router.push(`/pursuits/${pursuit.id}`)}
                    className={`group flex w-full items-start justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-[var(--surface-subtle)] sm:items-center sm:px-5 ${
                      isPrimaryActive
                        ? "border-l-[3px] border-l-[var(--signal)]"
                        : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[14.5px] font-semibold text-[var(--ink)] group-hover:text-[var(--signal)]">
                          {pursuit.title || "Untitled pursuit"}
                        </span>
                        {isPrimaryActive ? (
                          <span className="font-mono text-[10.5px] font-medium uppercase tracking-wider text-[var(--signal)]">
                            · Continue
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-[12.5px] text-[var(--ink-secondary)]">
                        {statusMeta.summary}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider ${statusMeta.badgeClass}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                        />
                        {statusMeta.code}
                      </span>
                      <span
                        aria-hidden="true"
                        className="font-mono text-[13px] text-[var(--ink-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ink)]"
                      >
                        →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {pursuits.length >= 30 ? (
            <p className="font-mono text-[11.5px] text-[var(--ink-muted)]">
              Showing your 30 most recent pursuits.
            </p>
          ) : null}
        </section>

        {/* Quiet Founding Access Footer */}
        <section className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-4 py-4 sm:px-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                Founding access
              </p>
              <p className="max-w-xl text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
                Support Stryde early and lock in the founding rate. Payments are handled by Stripe when billing is switched on — until then nothing is charged and nothing pretends to be.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void foundingAccess()}
              disabled={loading}
              className="shrink-0 rounded-[4px] border border-[var(--rule-strong)] bg-[var(--surface-subtle)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--ink)] transition-colors hover:bg-[#e4e7e2] disabled:opacity-45"
            >
              Request founding access
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
