"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkingState } from "@/lib/work-controller";
import { supabase } from "@/lib/supabase";

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Session expired. Please sign in again.");
  return data.session.access_token;
}

type Source = {
  id: string;
  source_kind: "URL" | "PASTED";
  uri: string | null;
  title: string | null;
  fetch_status: string;
  content_sha256?: string | null;
  source_metadata?: { ingestion?: string } | null;
};

type Adaptation = {
  id: string;
  source_id: string;
  summary: string;
  methods: Array<{
    title: string;
    sequence: number;
    description: string;
    expected_change: string;
    audit_status?: string;
  }>;
  fit: { status: string };
  gaps: string[];
  conflicts: string[];
  goal_candidates: Array<{ goal: string; why: string; conditions: string[] }>;
  provenance?: {
    audit_status?: string;
    partial_evidence?: boolean;
    substantiated_claims?: number;
    total_claims?: number;
  };
};

type Citation = {
  id: string;
  source_id: string;
  adaptation_id: string | null;
  source_content_sha256: string;
  locator: { start_char?: number; end_char?: number } | null;
  excerpt: string;
  basis: string;
};

type Action = {
  id: string;
  intent_summary: string;
  status: string;
  execution_mode: "HUMAN" | "CONTROLLED";
};

type ResearchResult = {
  url: string;
  title: string | null;
  rank: number;
  publishedAt: string | null;
  highlights: string[];
};

export default function PursuitWorkPanels(props: {
  pursuitId: string;
  sessionId: string | null;
  sessionActive: boolean;
  workingState: WorkingState | null;
  onWorkingStateChange: (state: WorkingState) => void;
  onActionStatusRequest: (
    actionId: string,
    status: "COMPLETED" | "FAILED"
  ) => void;
  completedActionId?: string | null;
  showExecutionSection?: boolean;
}) {
  const {
    pursuitId,
    sessionId,
    sessionActive,
    workingState,
    onWorkingStateChange,
    onActionStatusRequest,
    completedActionId,
    showExecutionSection = true
  } = props;

  const [sources, setSources] = useState<Source[]>([]);
  const [adaptations, setAdaptations] = useState<Adaptation[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [mode, setMode] = useState<"URL" | "PASTED">("URL");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [researchResults, setResearchResults] = useState<ResearchResult[]>([]);
  const [researchBusy, setResearchBusy] = useState(false);
  const [materializedUrls, setMaterializedUrls] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const access = await getAuthToken();
    const [sr, ar] = await Promise.all([
      fetch(`/api/v1/pursuits/${pursuitId}/sources`, {
        headers: { Authorization: `Bearer ${access}` }
      }),
      fetch(`/api/v1/pursuits/${pursuitId}/actions?status=IN_PROGRESS`, {
        headers: { Authorization: `Bearer ${access}` }
      })
    ]);
    if (!sr.ok || !ar.ok) throw new Error("Unable to refresh work state.");
    const sb = (await sr.json()) as {
      sources?: Source[];
      adaptations?: Adaptation[];
      citations?: Citation[];
    };
    const ab = (await ar.json()) as { actions?: Action[] };
    setSources(sb.sources ?? []);
    setAdaptations(sb.adaptations ?? []);
    setCitations(sb.citations ?? []);
    setActiveAction(ab.actions?.[0] ?? null);
  }, [pursuitId, sessionId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch((e) =>
        setError(
          e instanceof Error ? e.message : "Unable to refresh work state."
        )
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const reassess = async (access: string) => {
    if (!sessionId) return;
    const r = await fetch(`/api/v1/pursuits/${pursuitId}/work`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access}`
      },
      body: JSON.stringify({ session_id: sessionId })
    });
    const b = (await r.json()) as {
      working_state?: WorkingState;
      error?: string;
    };
    if (!r.ok || !b.working_state)
      throw new Error(b.error || "Stryde could not reassess the Pursuit.");
    onWorkingStateChange(b.working_state);
  };

  const addSource = async () => {
    if (
      busy ||
      !sessionActive ||
      (mode === "URL" ? !url.trim() : !text.trim())
    )
      return;
    setBusy(true);
    setError("");
    try {
      const access = await getAuthToken();
      const r = await fetch(`/api/v1/pursuits/${pursuitId}/sources`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`
        },
        body: JSON.stringify(
          mode === "URL"
            ? { url: url.trim(), title: title.trim() || undefined }
            : { content: text.trim(), title: title.trim() || undefined }
        )
      });
      const b = (await r.json()) as {
        source?: Source;
        adaptation?: Adaptation | null;
        warning?: string | null;
        error?: string;
      };
      if (!r.ok || !b.source)
        throw new Error(b.error || "Unable to add source.");
      setSources((v) => [b.source!, ...v.filter((x) => x.id !== b.source!.id)]);
      if (b.adaptation)
        setAdaptations((v) => [
          b.adaptation!,
          ...v.filter((x) => x.source_id !== b.adaptation!.source_id)
        ]);
      setUrl("");
      setText("");
      setTitle("");
      if (b.warning) setError(b.warning);
      if (sessionId) await reassess(access);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add source.");
    } finally {
      setBusy(false);
    }
  };

  const research = async () => {
    if (researchBusy || !researchQuestion.trim()) return;
    setResearchBusy(true);
    setError("");
    try {
      const access = await getAuthToken();
      const r = await fetch(`/api/v1/pursuits/${pursuitId}/research`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`
        },
        body: JSON.stringify({
          question: researchQuestion.trim(),
          max_results: 5
        })
      });
      const b = (await r.json()) as {
        research?: { results: ResearchResult[] };
        error?: string;
      };
      if (!r.ok || !b.research)
        throw new Error(b.error || "Unable to search.");
      setResearchResults(b.research.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to search.");
    } finally {
      setResearchBusy(false);
    }
  };

  const materialize = async (result: ResearchResult) => {
    if (researchBusy || materializedUrls.includes(result.url)) return;
    setResearchBusy(true);
    setError("");
    try {
      const access = await getAuthToken();
      const r = await fetch(`/api/v1/pursuits/${pursuitId}/research`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`
        },
        body: JSON.stringify({
          action: "MATERIALIZE_RESULT",
          url: result.url,
          title: result.title,
          rank: result.rank,
          highlights: result.highlights
        })
      });
      const b = (await r.json()) as {
        source?: Source;
        adaptation?: Adaptation | null;
        warning?: string | null;
        error?: string;
      };
      if (!r.ok || !b.source)
        throw new Error(b.error || "Unable to materialize result.");
      setMaterializedUrls((v) => [...v, result.url]);
      if (b.adaptation)
        setAdaptations((v) => [
          b.adaptation!,
          ...v.filter((x) => x.source_id !== b.adaptation!.source_id)
        ]);
      if (b.warning) setError(b.warning);
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to materialize result."
      );
    } finally {
      setResearchBusy(false);
    }
  };

  const adoptGoal = async (sourceId: string, goal: string) => {
    if (busy || !sessionId || !sessionActive) return;
    setBusy(true);
    setError("");
    try {
      const access = await getAuthToken();
      const r = await fetch(`/api/v1/pursuits/${pursuitId}/objective`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`
        },
        body: JSON.stringify({ content: goal, source_id: sourceId })
      });
      const b = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(b.error || "Unable to set the goal.");
      await reassess(access);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to set the goal.");
    } finally {
      setBusy(false);
    }
  };

  const delegateWorker = async () => {
    if (
      busy ||
      !sessionId ||
      !sessionActive ||
      move?.actor !== "WORKER" ||
      !move.worker_type
    )
      return;
    setBusy(true);
    setError("");
    try {
      const access = await getAuthToken();
      const r = await fetch(
        `/api/v1/pursuits/${pursuitId}/actions/delegate-worker`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access}`
          },
          body: JSON.stringify({ session_id: sessionId, approved: true })
        }
      );
      const b = (await r.json()) as {
        action?: Action;
        job?: unknown;
        error?: string;
      };
      if (!r.ok || !b.action)
        throw new Error(b.error || "Unable to delegate the move.");
      setActiveAction(b.action);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delegate the move.");
    } finally {
      setBusy(false);
    }
  };

  const startAction = async () => {
    const currentAction =
      completedActionId && activeAction?.id === completedActionId
        ? null
        : activeAction;
    if (busy || !sessionId || !sessionActive || currentAction) return;
    setBusy(true);
    setError("");
    try {
      const access = await getAuthToken();
      const r = await fetch(`/api/v1/pursuits/${pursuitId}/actions/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`
        },
        body: JSON.stringify({ session_id: sessionId, approved: true })
      });
      const b = (await r.json()) as {
        action?: Action;
        working_state?: WorkingState;
        error?: string;
      };
      if (!r.ok || !b.action)
        throw new Error(b.error || "Unable to start the Action.");
      setActiveAction(b.action);
      if (b.working_state) onWorkingStateChange(b.working_state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start the Action.");
    } finally {
      setBusy(false);
    }
  };

  const move = workingState?.next_move;
  const label = (v: string) => v.replaceAll("_", " ").toLowerCase();
  const auditBadgeColor = (status?: string) => {
    switch (status) {
      case "KEEP":
        return "border-[#b7dec9] bg-[var(--verified-Wash)] text-[var(--verified)]";
      case "CHANGE":
        return "border-[#ead2a2] bg-[var(--waiting-wash)] text-[var(--waiting)]";
      case "REMOVE":
        return "border-[#efb9b9] bg-[var(--blocked-wash)] text-[var(--blocked)]";
      case "NEEDS_EXPERIMENT":
        return "border-[#f0c5ba] bg-[var(--signal-wash)] text-[var(--signal)]";
      default:
        return "border-[var(--rule)] bg-[var(--surface-subtle)] text-[var(--ink-secondary)]";
    }
  };

  const visibleActiveAction =
    completedActionId && activeAction?.id === completedActionId
      ? null
      : activeAction;

  return (
    <details className="group rounded-[4px] border border-[var(--rule)] bg-[var(--surface)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none hover:bg-[var(--surface-subtle)]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[11px] text-[var(--ink-muted)] transition-transform group-open:rotate-90">
            ▸
          </span>
          <span className="text-[13.5px] font-semibold text-[var(--ink)]">
            Source material
          </span>
          <span className="font-mono text-[11px] text-[var(--ink-muted)]">
            {sources.length} {sources.length === 1 ? "source" : "sources"}
            {citations.length > 0 ? ` · ${citations.length} citations` : ""}
          </span>
        </div>
        <span className="font-mono text-[11px] text-[var(--ink-muted)]">
          Sources, adaptations & bounded research
        </span>
      </summary>

      <div className="space-y-5 border-t border-[var(--rule)] p-4">
        {/* Source ingestion */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-semibold text-[var(--ink)]">
                Add source material
              </h3>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-secondary)]">
                Add a useful course, roadmap, video, article, or paste. Stryde extracts the method and checks it against your situation instead of copying it blindly.
              </p>
            </div>
            <div className="inline-flex rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-0.5 font-mono text-[11px]">
              <button
                type="button"
                onClick={() => setMode("URL")}
                className={`rounded-[3px] px-2.5 py-1 transition-colors ${
                  mode === "URL"
                    ? "bg-[var(--ink)] font-medium text-white"
                    : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                }`}
              >
                Link
              </button>
              <button
                type="button"
                onClick={() => setMode("PASTED")}
                className={`rounded-[3px] px-2.5 py-1 transition-colors ${
                  mode === "PASTED"
                    ? "bg-[var(--ink)] font-medium text-white"
                    : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                }`}
              >
                Paste
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!sessionActive || busy}
              placeholder="Optional title"
              className="w-full rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
            />
            {mode === "URL" ? (
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addSource();
                  }
                }}
                disabled={!sessionActive || busy}
                placeholder="YouTube, course, roadmap, article, or other public link"
                className="w-full rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
              />
            ) : (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!sessionActive || busy}
                rows={4}
                placeholder="Paste the material, excerpt, transcript, or roadmap"
                className="w-full resize-y rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
              />
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void addSource()}
                disabled={
                  !sessionActive ||
                  busy ||
                  (mode === "URL" ? !url.trim() : !text.trim())
                }
                className="rounded-[4px] bg-[var(--ink)] px-3.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#2a2f2c] disabled:opacity-45"
              >
                {busy ? "Working…" : "Add source"}
              </button>
            </div>
          </div>

          {sources.length > 0 ? (
            <div className="divide-y divide-[var(--rule)] overflow-hidden rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)]">
              {sources.map((s) => {
                const a = adaptations.find((x) => x.source_id === s.id);
                const sourceCitations = citations.filter(
                  (c) => c.source_id === s.id
                );
                return (
                  <details key={s.id} className="group/src">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 hover:bg-[var(--surface)]">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[var(--ink)]">
                          {s.title || s.uri || "Pasted source"}
                        </p>
                        <p className="truncate font-mono text-[11px] text-[var(--ink-muted)]">
                          {s.uri ||
                            (s.source_metadata?.ingestion === "FILE"
                              ? "uploaded file"
                              : "pasted material")}{" "}
                          · {label(s.fetch_status)}
                          {sourceCitations.length > 0
                            ? ` · ${sourceCitations.length} verified excerpts`
                            : ""}
                        </p>
                      </div>
                      {a ? (
                        <span className="shrink-0 rounded-[3px] border border-[var(--rule)] bg-[var(--surface)] px-2 py-0.5 font-mono text-[10.5px] uppercase text-[var(--ink-secondary)]">
                          fit {label(a.fit.status)}
                        </span>
                      ) : null}
                    </summary>

                    <div className="space-y-3 border-t border-[var(--rule)] bg-[var(--surface)] px-4 py-3.5 text-[13px]">
                      {!a ? (
                        <p className="text-[var(--ink-secondary)]">
                          Stryde has the source reference but no usable extraction yet; it will not treat the source as established truth.
                        </p>
                      ) : (
                        <>
                          <div>
                            <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                              What Stryde extracted
                            </p>
                            <p className="mt-1 leading-relaxed text-[var(--ink)]">
                              {a.summary}
                            </p>
                          </div>

                          {a.methods.length > 0 ? (
                            <div className="space-y-2">
                              <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                                Extracted method steps
                              </p>
                              {a.methods.map((m) => (
                                <div
                                  key={`${m.sequence}-${m.title}`}
                                  className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-3"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-semibold text-[var(--ink)]">
                                      {m.title}
                                    </p>
                                    {m.audit_status ? (
                                      <span
                                        className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${auditBadgeColor(
                                          m.audit_status
                                        )}`}
                                      >
                                        {m.audit_status.replaceAll("_", " ")}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
                                    {m.description}
                                  </p>
                                  <p className="mt-1 font-mono text-[11px] text-[var(--ink-muted)]">
                                    Expected change: {m.expected_change}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {sourceCitations.length > 0 ? (
                            <div className="space-y-1.5 rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-3">
                              <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                                Source citations ({sourceCitations.length})
                              </p>
                              {sourceCitations.slice(0, 3).map((cit) => (
                                <div
                                  key={cit.id}
                                  className="border-l-2 border-[var(--rule-strong)] pl-2.5 text-[12px]"
                                >
                                  <p className="italic text-[var(--ink)]">
                                    &ldquo;{cit.excerpt}&rdquo;
                                  </p>
                                  <p className="mt-0.5 font-mono text-[10.5px] text-[var(--ink-muted)]">
                                    Basis: {cit.basis} · sha256:
                                    {cit.source_content_sha256.slice(0, 8)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {a.gaps.length > 0 || a.conflicts.length > 0 ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                              {a.gaps.length > 0 ? (
                                <div>
                                  <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                                    Gaps
                                  </p>
                                  {a.gaps.map((x) => (
                                    <p
                                      key={x}
                                      className="mt-1 text-[12.5px] text-[var(--ink-secondary)]"
                                    >
                                      • {x}
                                    </p>
                                  ))}
                                </div>
                              ) : null}
                              {a.conflicts.length > 0 ? (
                                <div>
                                  <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                                    Conflicts
                                  </p>
                                  {a.conflicts.map((x) => (
                                    <p
                                      key={x}
                                      className="mt-1 text-[12.5px] text-[var(--ink-secondary)]"
                                    >
                                      • {x}
                                    </p>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {a.goal_candidates.length > 0 ? (
                            <div className="space-y-2">
                              <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                                Candidate goals from source
                              </p>
                              {a.goal_candidates.map((g) => (
                                <div
                                  key={g.goal}
                                  className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-3"
                                >
                                  <p className="font-semibold text-[var(--ink)]">
                                    {g.goal}
                                  </p>
                                  <p className="mt-1 text-[12.5px] text-[var(--ink-secondary)]">
                                    {g.why}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => void adoptGoal(s.id, g.goal)}
                                    disabled={busy || !sessionActive || !sessionId}
                                    className="mt-2 rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-2.5 py-1 text-[12px] font-medium text-[var(--ink)] hover:border-[var(--rule-strong)] disabled:opacity-45"
                                  >
                                    Use as current goal
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : null}
        </section>

        {/* Bounded research */}
        <section className="space-y-3 border-t border-[var(--rule)] pt-4">
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--ink)]">
              Bounded research
            </h3>
            <p className="mt-0.5 text-[12px] text-[var(--ink-secondary)]">
              Search the web for a specific question. Results are references only until you materialize one as source material.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={researchQuestion}
              onChange={(e) => setResearchQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void research();
                }
              }}
              disabled={researchBusy}
              placeholder="What do you need to find out?"
              className="min-w-0 flex-1 rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void research()}
              disabled={researchBusy || !researchQuestion.trim()}
              className="shrink-0 rounded-[4px] bg-[var(--ink)] px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-[#2a2f2c] disabled:opacity-45"
            >
              {researchBusy ? "Searching…" : "Search"}
            </button>
          </div>

          {researchResults.length > 0 ? (
            <div className="divide-y divide-[var(--rule)] rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)]">
              {researchResults.map((result) => (
                <div
                  key={`${result.rank}-${result.url}`}
                  className="p-3 text-[12.5px]"
                >
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--ink)] underline decoration-[var(--rule-strong)] underline-offset-2 hover:text-[var(--signal)]"
                  >
                    {result.title || result.url}
                  </a>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-[var(--ink-muted)]">
                    {result.url}
                  </p>
                  {result.highlights[0] ? (
                    <p className="mt-1.5 leading-relaxed text-[var(--ink-secondary)]">
                      {result.highlights[0]}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void materialize(result)}
                    disabled={
                      researchBusy || materializedUrls.includes(result.url)
                    }
                    className="mt-2 rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-2.5 py-1 text-[12px] font-medium text-[var(--ink)] hover:border-[var(--rule-strong)] disabled:opacity-45"
                  >
                    {materializedUrls.includes(result.url)
                      ? "Materialized"
                      : "Use as source"}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* Optional Execution Section */}
        {showExecutionSection &&
        (visibleActiveAction ||
          move?.mode === "CREATE_ACTION" ||
          move?.actor === "WORKER") ? (
          <section className="space-y-2 border-t border-[var(--rule)] pt-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                Execution
              </p>
              {visibleActiveAction ? (
                <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                  {visibleActiveAction.execution_mode === "CONTROLLED"
                    ? "Assigned runner"
                    : "In progress · You"}{" "}
                  · {label(visibleActiveAction.status)}
                </span>
              ) : null}
            </div>
            {visibleActiveAction ? (
              <>
                <h3 className="text-[14.5px] font-semibold text-[var(--ink)]">
                  {visibleActiveAction.intent_summary}
                </h3>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      onActionStatusRequest(visibleActiveAction.id, "COMPLETED")
                    }
                    disabled={busy || !sessionActive}
                    className="rounded-[4px] bg-[var(--ink)] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-45"
                  >
                    I&apos;m done
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onActionStatusRequest(visibleActiveAction.id, "FAILED")
                    }
                    disabled={busy || !sessionActive}
                    className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink)] disabled:opacity-45"
                  >
                    I&apos;m blocked
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-[14.5px] font-semibold text-[var(--ink)]">
                  {move?.title}
                </h3>
                <div className="flex justify-end pt-1">
                  {move?.actor === "WORKER" ? (
                    <button
                      type="button"
                      onClick={() => void delegateWorker()}
                      disabled={busy || !sessionActive || !sessionId}
                      className="rounded-[4px] bg-[var(--ink)] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-45"
                    >
                      {busy ? "Assigning…" : "Delegate this move"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startAction()}
                      disabled={busy || !sessionActive || !sessionId}
                      className="rounded-[4px] bg-[var(--ink)] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-45"
                    >
                      {busy ? "Starting…" : "Start this action"}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="rounded-[4px] border border-[#efb9b9] bg-[var(--blocked-wash)] px-3 py-2 text-[12.5px] font-medium text-[var(--blocked)]"
          >
            {error}
          </div>
        ) : null}
      </div>
    </details>
  );
}
