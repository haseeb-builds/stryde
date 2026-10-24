"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isSelectableObservationForClaim,
  formatObservationOptionLabel
} from "@/lib/pursuit-observations";

type AddContextTab = "source" | "research" | "evidence";

type ResearchResult = {
  url: string;
  title: string | null;
  rank: number;
  publishedAt: string | null;
  highlights: string[];
};

type PursuitObservation = {
  id: string;
  observation_kind: string;
  observed_at: string;
  source_reference: string | null;
};

export default function AddContextModal(props: {
  isOpen: boolean;
  onClose: () => void;
  pursuitId: string;
  sessionId: string | null;
  sessionActive: boolean;
  onContextAdded?: () => void;
  initialTab?: AddContextTab;
}) {
  const {
    isOpen,
    onClose,
    pursuitId,
    sessionActive,
    onContextAdded,
    initialTab = "source"
  } = props;

  const [tab, setTab] = useState<AddContextTab>(initialTab);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  // Tab 1: Source state
  const [sourceMode, setSourceMode] = useState<"URL" | "PASTED">("URL");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceFeedback, setSourceFeedback] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState("");

  // Tab 2: Research state
  const [researchQuestion, setResearchQuestion] = useState("");
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchResults, setResearchResults] = useState<ResearchResult[]>([]);
  const [materializedUrls, setMaterializedUrls] = useState<string[]>([]);
  const [researchError, setResearchError] = useState("");

  // Tab 3: Evidence / Claim state
  const [claimText, setClaimText] = useState("");
  const [selectedObservation, setSelectedObservation] = useState("");
  const [observations, setObservations] = useState<PursuitObservation[]>([]);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null);
  const [claimError, setClaimError] = useState("");

  const modalRef = useRef<HTMLDivElement | null>(null);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setTab(initialTab);
      setSourceFeedback(null);
      setSourceError("");
      setResearchError("");
      setClaimFeedback(null);
      setClaimError("");
    }
  }

  // Load observations when evidence tab is selected
  useEffect(() => {
    let active = true;
    if (isOpen && tab === "evidence") {
      void (async () => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token || !active) return;
        try {
          const response = await fetch(`/api/v1/pursuits/${pursuitId}/observations`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.ok && active) {
            const body = (await response.json()) as { observations?: PursuitObservation[] };
            setObservations(body.observations ?? []);
          }
        } catch {
          // Ignore observation load errors
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [isOpen, tab, pursuitId]);

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleAddSource() {
    if (
      sourceBusy ||
      !sessionActive ||
      (sourceMode === "URL" ? !sourceUrl.trim() : !sourceText.trim())
    )
      return;

    setSourceBusy(true);
    setSourceError("");
    setSourceFeedback(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired. Please sign in again.");

      const response = await fetch(`/api/v1/pursuits/${pursuitId}/sources`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(
          sourceMode === "URL"
            ? { url: sourceUrl.trim(), title: sourceTitle.trim() || undefined }
            : { content: sourceText.trim(), title: sourceTitle.trim() || undefined }
        )
      });

      const body = (await response.json()) as {
        source?: { id: string; title: string | null; uri: string | null; fetch_status: string };
        warning?: string | null;
        error?: string;
      };

      if (!response.ok || !body.source) {
        throw new Error(body.error || "Unable to add source material.");
      }

      setSourceFeedback(
        `Added "${body.source.title || body.source.uri || "source"}" successfully.${
          body.warning ? ` (${body.warning})` : ""
        }`
      );
      setSourceUrl("");
      setSourceText("");
      setSourceTitle("");
      onContextAdded?.();
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : "Unable to add source.");
    } finally {
      setSourceBusy(false);
    }
  }

  async function handleSearch() {
    if (researchBusy || !researchQuestion.trim()) return;

    setResearchBusy(true);
    setResearchError("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired. Please sign in again.");

      const response = await fetch(`/api/v1/pursuits/${pursuitId}/research`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          question: researchQuestion.trim(),
          max_results: 5
        })
      });

      const body = (await response.json()) as {
        research?: { results: ResearchResult[] };
        error?: string;
      };

      if (!response.ok || !body.research) {
        throw new Error(body.error || "Unable to search.");
      }

      setResearchResults(body.research.results);
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : "Unable to search.");
    } finally {
      setResearchBusy(false);
    }
  }

  async function handleMaterialize(result: ResearchResult) {
    if (researchBusy || materializedUrls.includes(result.url)) return;

    setResearchBusy(true);
    setResearchError("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired. Please sign in again.");

      const response = await fetch(`/api/v1/pursuits/${pursuitId}/research`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: "MATERIALIZE_RESULT",
          url: result.url,
          title: result.title,
          rank: result.rank,
          highlights: result.highlights
        })
      });

      const body = (await response.json()) as {
        source?: unknown;
        warning?: string | null;
        error?: string;
      };

      if (!response.ok || !body.source) {
        throw new Error(body.error || "Unable to materialize research result.");
      }

      setMaterializedUrls((curr) => [...curr, result.url]);
      onContextAdded?.();
    } catch (err) {
      setResearchError(
        err instanceof Error ? err.message : "Unable to materialize research result."
      );
    } finally {
      setResearchBusy(false);
    }
  }

  async function handleRecordClaim() {
    if (claimBusy || !claimText.trim()) return;

    setClaimBusy(true);
    setClaimError("");
    setClaimFeedback(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired. Please sign in again.");

      const response = await fetch("/api/v1/claims", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          scope: "PURSUIT",
          pursuit_id: pursuitId,
          kind: "ASSERTION",
          content: claimText.trim(),
          observation_id: selectedObservation || undefined
        })
      });

      const body = (await response.json()) as { claim?: unknown; error?: string };

      if (!response.ok || !body.claim) {
        throw new Error(body.error || "Unable to record claim.");
      }

      setClaimFeedback(
        selectedObservation
          ? "Recorded claim with linked observation evidence (status: OBSERVED)."
          : "Recorded claim based on user report (status: REPORTED)."
      );
      setClaimText("");
      setSelectedObservation("");
      onContextAdded?.();
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Unable to record claim.");
    } finally {
      setClaimBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-context-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[4px] border border-[var(--rule-strong)] bg-[var(--surface)] shadow-2xl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--rule)] px-5 py-3.5">
          <div>
            <h2
              id="add-context-heading"
              className="text-[15px] font-semibold tracking-tight text-[var(--ink)]"
            >
              Add context to pursuit
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--ink-secondary)]">
              Supply grounded information, search the web, or record verifiable evidence.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add context dialog"
            className="rounded-[4px] p-1 font-mono text-[14px] text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[var(--rule)] bg-[var(--surface-subtle)] px-5 pt-2">
          <button
            type="button"
            onClick={() => setTab("source")}
            className={`border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors ${
              tab === "source"
                ? "border-[var(--ink)] font-semibold text-[var(--ink)]"
                : "border-transparent text-[var(--ink-secondary)] hover:text-[var(--ink)]"
            }`}
          >
            1. Add a source
          </button>
          <button
            type="button"
            onClick={() => setTab("research")}
            className={`border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors ${
              tab === "research"
                ? "border-[var(--ink)] font-semibold text-[var(--ink)]"
                : "border-transparent text-[var(--ink-secondary)] hover:text-[var(--ink)]"
            }`}
          >
            2. Research a question
          </button>
          <button
            type="button"
            onClick={() => setTab("evidence")}
            className={`border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors ${
              tab === "evidence"
                ? "border-[var(--ink)] font-semibold text-[var(--ink)]"
                : "border-transparent text-[var(--ink-secondary)] hover:text-[var(--ink)]"
            }`}
          >
            3. Review &amp; record evidence
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5 text-[13px]">
          {/* TAB 1: ADD A SOURCE */}
          {tab === "source" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
                  Stryde extracts methods, facts, and constraints from material you provide instead of assuming it applies blindly.
                </p>
                <div className="inline-flex shrink-0 rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-0.5 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSourceMode("URL")}
                    className={`rounded-[3px] px-2.5 py-1 ${
                      sourceMode === "URL"
                        ? "bg-[var(--ink)] font-medium text-white"
                        : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                    }`}
                  >
                    Link (URL)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceMode("PASTED")}
                    className={`rounded-[3px] px-2.5 py-1 ${
                      sourceMode === "PASTED"
                        ? "bg-[var(--ink)] font-medium text-white"
                        : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                    }`}
                  >
                    Paste text
                  </button>
                </div>
              </div>

              {sourceFeedback ? (
                <div className="rounded-[4px] border border-[#b7dec9] bg-[var(--verified-Wash)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--verified)]">
                  {sourceFeedback}
                </div>
              ) : null}

              {sourceError ? (
                <div
                  role="alert"
                  className="rounded-[4px] border border-[#efb9b9] bg-[var(--blocked-wash)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--blocked)]"
                >
                  {sourceError}
                </div>
              ) : null}

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                    Title or label (optional)
                  </label>
                  <input
                    value={sourceTitle}
                    onChange={(e) => setSourceTitle(e.target.value)}
                    disabled={sourceBusy || !sessionActive}
                    placeholder="e.g., Enterprise Sales Playbook, Client Requirements Document"
                    className="w-full rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
                  />
                </div>

                {sourceMode === "URL" ? (
                  <div>
                    <label className="mb-1 block font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                      Public URL
                    </label>
                    <input
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleAddSource();
                        }
                      }}
                      disabled={sourceBusy || !sessionActive}
                      placeholder="https://example.com/article, YouTube, roadmap link…"
                      className="w-full rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                      Raw source text or transcript
                    </label>
                    <textarea
                      value={sourceText}
                      onChange={(e) => setSourceText(e.target.value)}
                      disabled={sourceBusy || !sessionActive}
                      rows={5}
                      placeholder="Paste notes, email threads, documentation, or roadmap steps here…"
                      className="w-full resize-y rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-[var(--rule)] pt-3.5">
                <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                  Supports web articles, documentation, pasted text up to 120k chars
                </span>
                <button
                  type="button"
                  onClick={() => void handleAddSource()}
                  disabled={
                    sourceBusy ||
                    !sessionActive ||
                    (sourceMode === "URL" ? !sourceUrl.trim() : !sourceText.trim())
                  }
                  className="rounded-[4px] bg-[var(--ink)] px-4 py-2 text-[12.5px] font-medium text-white hover:bg-[#2a2f2c] disabled:opacity-40"
                >
                  {sourceBusy ? "Ingesting source…" : "Add source"}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: RESEARCH A QUESTION */}
          {tab === "research" && (
            <div className="space-y-4">
              <p className="text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
                Search the web for targeted questions. Results remain external references until you explicitly materialize one as durable source material.
              </p>

              {researchError ? (
                <div
                  role="alert"
                  className="rounded-[4px] border border-[#efb9b9] bg-[var(--blocked-wash)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--blocked)]"
                >
                  {researchError}
                </div>
              ) : null}

              <div className="flex gap-2">
                <input
                  value={researchQuestion}
                  onChange={(e) => setResearchQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSearch();
                    }
                  }}
                  disabled={researchBusy}
                  placeholder="What specific question do you need answered?"
                  className="min-w-0 flex-1 rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleSearch()}
                  disabled={researchBusy || !researchQuestion.trim()}
                  className="shrink-0 rounded-[4px] bg-[var(--ink)] px-4 py-2 text-[12.5px] font-medium text-white hover:bg-[#2a2f2c] disabled:opacity-40"
                >
                  {researchBusy ? "Searching…" : "Search"}
                </button>
              </div>

              {researchResults.length > 0 && (
                <div className="space-y-2 border-t border-[var(--rule)] pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                      Web search references ({researchResults.length})
                    </span>
                    <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                      References only · Click to materialize
                    </span>
                  </div>

                  <div className="divide-y divide-[var(--rule)] overflow-hidden rounded-[4px] border border-[var(--rule)] bg-[var(--surface)]">
                    {researchResults.map((result) => {
                      const isMaterialized = materializedUrls.includes(result.url);
                      return (
                        <div key={`${result.rank}-${result.url}`} className="p-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <a
                                href={result.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[13px] font-semibold text-[var(--ink)] hover:underline"
                              >
                                {result.title || result.url}
                              </a>
                              <p className="mt-0.5 truncate font-mono text-[10.5px] text-[var(--ink-muted)]">
                                {result.url}
                              </p>
                              {result.highlights[0] ? (
                                <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-secondary)]">
                                  {result.highlights[0]}
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleMaterialize(result)}
                              disabled={researchBusy || isMaterialized}
                              className={`shrink-0 rounded-[4px] px-2.5 py-1 font-mono text-[11px] font-medium ${
                                isMaterialized
                                  ? "border border-[#b7dec9] bg-[var(--verified-Wash)] text-[var(--verified)]"
                                  : "border border-[var(--rule-strong)] bg-[var(--surface-subtle)] text-[var(--ink)] hover:border-[var(--ink)]"
                              } disabled:opacity-50`}
                            >
                              {isMaterialized ? "Materialized" : "Materialize as source"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REVIEW & RECORD EVIDENCE */}
          {tab === "evidence" && (
            <div className="space-y-4">
              <p className="text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
                Record an empirical claim for this pursuit. Linking a verified observation grounds the claim as observed truth rather than a self-reported assertion.
              </p>

              {claimFeedback ? (
                <div className="rounded-[4px] border border-[#b7dec9] bg-[var(--verified-Wash)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--verified)]">
                  {claimFeedback}
                </div>
              ) : null}

              {claimError ? (
                <div
                  role="alert"
                  className="rounded-[4px] border border-[#efb9b9] bg-[var(--blocked-wash)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--blocked)]"
                >
                  {claimError}
                </div>
              ) : null}

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                    Claim assertion statement
                  </label>
                  <textarea
                    value={claimText}
                    onChange={(e) => setClaimText(e.target.value)}
                    disabled={claimBusy}
                    rows={3}
                    placeholder="e.g., Client signed standard enterprise DPA with no security objections…"
                    className="w-full resize-y rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                    Supporting observation (optional)
                  </label>
                  <select
                    value={selectedObservation}
                    onChange={(e) => setSelectedObservation(e.target.value)}
                    disabled={claimBusy}
                    className="w-full rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 font-mono text-[11.5px] text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
                  >
                    <option value="">No observation linked · Record as self-reported</option>
                    {observations
                      .filter(isSelectableObservationForClaim)
                      .map((obs) => (
                        <option key={obs.id} value={obs.id}>
                          {formatObservationOptionLabel(obs)}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--rule)] pt-3.5">
                <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                  Status: {selectedObservation ? "OBSERVED (evidence attached)" : "REPORTED (user assertion)"}
                </span>
                <button
                  type="button"
                  onClick={() => void handleRecordClaim()}
                  disabled={claimBusy || !claimText.trim()}
                  className="rounded-[4px] bg-[var(--ink)] px-4 py-2 text-[12.5px] font-medium text-white hover:bg-[#2a2f2c] disabled:opacity-40"
                >
                  {claimBusy ? "Recording…" : "Save claim"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
