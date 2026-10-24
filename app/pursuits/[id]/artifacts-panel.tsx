"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MarkdownContent } from "./markdown-content";

type ArtifactSummary = {
  id: string;
  pursuit_id: string;
  title: string;
  artifact_type: "DOCUMENT" | "RESEARCH_DOSSIER" | "CODE" | "DATA" | "REPORT";
  mime_type: "text/markdown" | "text/plain" | "application/json" | "text/csv";
  version: number;
  verification_state: string;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
};

type ArtifactDetail = ArtifactSummary & {
  content_text: string | null;
  provenance: Record<string, unknown>;
};

type ArtifactLineage = {
  head: ArtifactSummary;
  versions: ArtifactSummary[];
};

const TYPE_LABELS: Record<string, string> = {
  DOCUMENT: "Document",
  RESEARCH_DOSSIER: "Research dossier",
  CODE: "Code",
  DATA: "Data",
  REPORT: "Report"
};

const STATE_LABELS: Record<string, string> = {
  UNVERIFIED: "unverified",
  OBSERVED: "evidence linked",
  VERIFIED: "verified",
  CONTRADICTED: "contradicted"
};

function buildArtifactLineages(allRows: ArtifactSummary[]): ArtifactLineage[] {
  const byId = new Map<string, ArtifactSummary>();
  for (const row of allRows) {
    byId.set(row.id, row);
  }

  function findHeadId(startId: string): string {
    const visited = new Set<string>();
    let currId = startId;
    while (!visited.has(currId)) {
      visited.add(currId);
      const curr = byId.get(currId);
      if (!curr || !curr.superseded_by || !byId.has(curr.superseded_by)) {
        return currId;
      }
      currId = curr.superseded_by;
    }
    return currId;
  }

  const groups = new Map<string, ArtifactSummary[]>();
  for (const row of allRows) {
    const headId = findHeadId(row.id);
    const list = groups.get(headId) ?? [];
    list.push(row);
    groups.set(headId, list);
  }

  const lineages: ArtifactLineage[] = [];
  for (const [headId, versions] of groups.entries()) {
    const sorted = [...versions].sort((a, b) => a.version - b.version);
    const head = byId.get(headId) ?? sorted[sorted.length - 1];
    lineages.push({ head, versions: sorted });
  }

  lineages.sort(
    (a, b) =>
      new Date(b.head.updated_at || b.head.created_at).getTime() -
      new Date(a.head.updated_at || a.head.created_at).getTime()
  );
  return lineages;
}

export default function PursuitArtifactsPanel(props: {
  pursuitId: string;
  sessionActive: boolean;
}) {
  const { pursuitId, sessionActive } = props;
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<ArtifactDetail | null>(null);
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");
  const [revising, setRevising] = useState(false);
  const [revisionContent, setRevisionContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] =
    useState<ArtifactSummary["artifact_type"]>("DOCUMENT");
  const [newContent, setNewContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const lineages = useMemo(
    () => buildArtifactLineages(artifacts),
    [artifacts]
  );

  const load = useCallback(async () => {
    if (!sessionActive) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const r = await fetch(`/api/v1/artifacts?pursuit_id=${pursuitId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return;
    const body = (await r.json()) as { artifacts?: ArtifactSummary[] };
    setArtifacts(body.artifacts ?? []);
    setLoaded(true);
  }, [pursuitId, sessionActive]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function inspectArtifact(id: string) {
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const r = await fetch(`/api/v1/artifacts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Unable to load artifact.");
        return;
      }
      const body = (await r.json()) as { artifact?: ArtifactDetail };
      if (body.artifact) {
        setSelected(body.artifact);
        setRevisionContent(body.artifact.content_text ?? "");
        setRevising(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function createArtifact() {
    if (busy || !newTitle.trim() || !newContent.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const r = await fetch("/api/v1/artifacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pursuit_id: pursuitId,
          title: newTitle.trim(),
          artifact_type: newType,
          mime_type: "text/markdown",
          content: newContent
        })
      });
      const body = (await r.json().catch(() => ({}))) as {
        artifact?: { id: string };
        error?: string;
      };
      if (!r.ok || !body.artifact) {
        setError(body.error ?? "Unable to save artifact.");
        return;
      }
      setNewTitle("");
      setNewContent("");
      setCreating(false);
      await load();
      await inspectArtifact(body.artifact.id);
    } finally {
      setBusy(false);
    }
  }

  async function saveRevision() {
    if (busy || !selected || !revisionContent.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const r = await fetch(`/api/v1/artifacts/${selected.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: revisionContent })
      });
      const body = (await r.json().catch(() => ({}))) as {
        artifact_id?: string;
        error?: string;
      };
      if (!r.ok || !body.artifact_id) {
        setError(body.error ?? "Unable to save revision.");
        return;
      }
      setRevising(false);
      await load();
      await inspectArtifact(body.artifact_id);
    } finally {
      setBusy(false);
    }
  }

  async function copySelected() {
    if (!selected?.content_text) return;
    try {
      await navigator.clipboard.writeText(selected.content_text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard permission errors
    }
  }

  if (!sessionActive) return null;

  const activeArtifacts = artifacts.filter((a) => !a.superseded_by);

  return (
    <details
      open={activeArtifacts.length > 0 ? true : undefined}
      className="group rounded-[4px] border border-[var(--rule)] bg-[var(--surface)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none hover:bg-[var(--surface-subtle)]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[11px] text-[var(--ink-muted)] transition-transform group-open:rotate-90">
            ▸
          </span>
          <span className="text-[13.5px] font-semibold text-[var(--ink)]">
            Working artifacts
          </span>
          <span className="font-mono text-[11px] text-[var(--ink-muted)]">
            {loaded
              ? `${activeArtifacts.length} ${
                  activeArtifacts.length === 1 ? "deliverable" : "deliverables"
                }`
              : "loading…"}
          </span>
        </div>
        <span className="font-mono text-[11px] text-[var(--ink-muted)]">
          Versioned deliverables & dossiers
        </span>
      </summary>

      <div className="space-y-4 border-t border-[var(--rule)] p-4">
        {error ? (
          <div
            role="alert"
            className="rounded-[4px] border border-[#efb9b9] bg-[var(--blocked-wash)] px-3 py-2 text-[12.5px] font-medium text-[var(--blocked)]"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] text-[var(--ink-secondary)]">
            Versioned drafts, research dossiers, and reports attached to this pursuit. Revisions preserve prior versions.
          </p>
          <button
            type="button"
            onClick={() => {
              setCreating((v) => !v);
              setSelected(null);
            }}
            className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-3 py-1 text-[12px] font-medium text-[var(--ink)] hover:border-[var(--rule-strong)]"
          >
            {creating ? "Cancel" : "New artifact"}
          </button>
        </div>

        {creating ? (
          <div className="space-y-2.5 rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-3.5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title (e.g. Landing page copy)"
                className="min-w-0 flex-1 rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
              />
              <select
                value={newType}
                onChange={(e) =>
                  setNewType(e.target.value as ArtifactSummary["artifact_type"])
                }
                className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-2.5 py-2 font-mono text-[11.5px] text-[var(--ink)]"
              >
                <option value="DOCUMENT">Document</option>
                <option value="RESEARCH_DOSSIER">Research dossier</option>
                <option value="REPORT">Report</option>
                <option value="CODE">Code</option>
                <option value="DATA">Data</option>
              </select>
            </div>
            <textarea
              rows={5}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write or paste the artifact content…"
              className="w-full resize-y rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy || !newTitle.trim() || !newContent.trim()}
                onClick={() => void createArtifact()}
                className="rounded-[4px] bg-[var(--ink)] px-3.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#2a2f2c] disabled:opacity-45"
              >
                {busy ? "Saving…" : "Save artifact"}
              </button>
            </div>
          </div>
        ) : null}

        {!loaded ? (
          <p className="text-[12.5px] text-[var(--ink-muted)]">Loading…</p>
        ) : lineages.length === 0 ? (
          <p className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-3.5 py-3 text-[12.5px] text-[var(--ink-secondary)]">
            No artifacts saved for this pursuit yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--rule)] overflow-hidden rounded-[4px] border border-[var(--rule)] bg-[var(--surface)]">
            {lineages.map(({ head, versions }) => {
              const isSelectedLineage =
                selected && versions.some((v) => v.id === selected.id);

              return (
                <li key={head.id} className="p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-semibold text-[var(--ink)]">
                        {head.title}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-[var(--ink-muted)]">
                        {TYPE_LABELS[head.artifact_type] ?? head.artifact_type}{" "}
                        · v{head.version}
                        {versions.length > 1
                          ? ` (${versions.length} versions)`
                          : ""}{" "}
                        ·{" "}
                        {STATE_LABELS[head.verification_state] ??
                          head.verification_state.toLowerCase()}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        isSelectedLineage
                          ? setSelected(null)
                          : void inspectArtifact(head.id)
                      }
                      className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[12px] font-medium text-[var(--ink)] hover:border-[var(--rule-strong)] disabled:opacity-45"
                    >
                      {isSelectedLineage ? "Close" : "Open"}
                    </button>
                  </div>

                  {isSelectedLineage && selected ? (
                    <div className="mt-3 space-y-3 border-t border-[var(--rule)] pt-3">
                      {/* Reader toolbar + version selector */}
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-muted)]">
                            Version:
                          </span>
                          {versions.map((ver) => {
                            const isCurrentVer = ver.id === selected.id;
                            const isHeadVer = ver.id === head.id;
                            return (
                              <button
                                key={ver.id}
                                type="button"
                                disabled={busy}
                                onClick={() => void inspectArtifact(ver.id)}
                                className={`rounded-[3px] border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                                  isCurrentVer
                                    ? "border-[var(--ink)] bg-[var(--ink)] font-medium text-white"
                                    : "border-[var(--rule)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:border-[var(--rule-strong)]"
                                }`}
                              >
                                v{ver.version}
                                {isHeadVer ? "" : " (prior)"}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <div className="inline-flex rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] p-0.5 font-mono text-[10.5px]">
                            <button
                              type="button"
                              onClick={() => setViewMode("formatted")}
                              className={`rounded-[3px] px-2 py-0.5 ${
                                viewMode === "formatted"
                                  ? "bg-[var(--ink)] text-white"
                                  : "text-[var(--ink-secondary)]"
                              }`}
                            >
                              Reader
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewMode("raw")}
                              className={`rounded-[3px] px-2 py-0.5 ${
                                viewMode === "raw"
                                  ? "bg-[var(--ink)] text-white"
                                  : "text-[var(--ink-secondary)]"
                              }`}
                            >
                              Raw
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => void copySelected()}
                            className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-2 py-0.5 font-mono text-[10.5px] text-[var(--ink-secondary)] hover:border-[var(--rule-strong)]"
                          >
                            {copied ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>

                      {selected.superseded_by ? (
                        <div className="rounded-[4px] border border-[#ead2a2] bg-[var(--waiting-wash)] px-3 py-1.5 font-mono text-[11px] text-[var(--waiting)]">
                          Viewing historical version v{selected.version}. Select v{head.version} above to revise the current version.
                        </div>
                      ) : null}

                      {revising ? (
                        <div className="space-y-2.5">
                          <textarea
                            rows={8}
                            value={revisionContent}
                            onChange={(e) => setRevisionContent(e.target.value)}
                            className="w-full resize-y rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-3 font-mono text-[12.5px] leading-relaxed text-[var(--ink)] focus:border-[var(--ink)] focus:bg-[var(--surface)] focus:outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setRevising(false)}
                              className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-1 text-[12px] text-[var(--ink-secondary)]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={busy || !revisionContent.trim()}
                              onClick={() => void saveRevision()}
                              className="rounded-[4px] bg-[var(--ink)] px-3.5 py-1 text-[12px] font-medium text-white hover:bg-[#2a2f2c] disabled:opacity-45"
                            >
                              {busy
                                ? "Saving v" + (selected.version + 1) + "…"
                                : `Save v${selected.version + 1}`}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {viewMode === "formatted" ? (
                            <div className="max-h-96 overflow-y-auto rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-4">
                              <MarkdownContent
                                content={selected.content_text ?? ""}
                              />
                            </div>
                          ) : (
                            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-3.5 font-mono text-[12px] leading-relaxed text-[var(--ink)]">
                              {selected.content_text ?? ""}
                            </pre>
                          )}
                          <div className="mt-2.5 flex items-center justify-between">
                            <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                              Updated{" "}
                              {new Date(selected.updated_at).toLocaleString()}
                            </span>
                            {!selected.superseded_by ? (
                              <button
                                type="button"
                                onClick={() => setRevising(true)}
                                className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[12px] font-medium text-[var(--ink)] hover:border-[var(--rule-strong)]"
                              >
                                Revise (new version)
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
