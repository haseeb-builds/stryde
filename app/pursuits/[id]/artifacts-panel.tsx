"use client";

// Artifacts as a contextual disclosure (docs/PRODUCT.md UX law): durable,
// versioned outputs (dossiers, documents, reports, code, structured data)
// attached to this pursuit. Revisions go through the append-only
// stryde_revise_artifact RPC (PUT /api/v1/artifacts/[id]) so prior versions
// are never overwritten in place.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

const TYPE_LABELS: Record<string, string> = {
  DOCUMENT: "Document",
  RESEARCH_DOSSIER: "Research dossier",
  CODE: "Code",
  DATA: "Data",
  REPORT: "Report",
};

const STATE_LABELS: Record<string, string> = {
  UNVERIFIED: "unverified",
  OBSERVED: "evidence linked",
  VERIFIED: "verified",
  CONTRADICTED: "contradicted",
};

export default function PursuitArtifactsPanel(props: { pursuitId: string; sessionActive: boolean }) {
  const { pursuitId, sessionActive } = props;
  const [open, setOpen] = useState(false);
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<ArtifactDetail | null>(null);
  const [revising, setRevising] = useState(false);
  const [revisionContent, setRevisionContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<ArtifactSummary["artifact_type"]>("DOCUMENT");
  const [newContent, setNewContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!sessionActive) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const r = await fetch(`/api/v1/artifacts?pursuit_id=${pursuitId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return;
    const body = (await r.json()) as { artifacts?: ArtifactSummary[] };
    setArtifacts(body.artifacts ?? []);
    setLoaded(true);
  }, [pursuitId, sessionActive]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (open) void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, load]);

  async function inspectArtifact(id: string) {
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const r = await fetch(`/api/v1/artifacts/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pursuit_id: pursuitId,
          title: newTitle.trim(),
          artifact_type: newType,
          mime_type: "text/markdown",
          content: newContent,
        }),
      });
      const body = (await r.json().catch(() => ({}))) as { artifact?: { id: string }; error?: string };
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: revisionContent }),
      });
      const body = (await r.json().catch(() => ({}))) as { artifact_id?: string; error?: string };
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

  if (!sessionActive) return null;

  const activeArtifacts = artifacts.filter((a) => !a.superseded_by);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="bg-transparent border-0 p-0 text-[13px] text-zinc-500 cursor-pointer"
      >
        {open ? "▾" : "▸"} Working artifacts
        {loaded && activeArtifacts.length ? ` (${activeArtifacts.length})` : ""}
      </button>

      {open ? (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
          {error ? <p className="mb-2 text-[13px] text-red-700">{error}</p> : null}

          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              Versioned drafts, research dossiers, and reports attached to this pursuit.
            </p>
            <button
              type="button"
              onClick={() => {
                setCreating((v) => !v);
                setSelected(null);
              }}
              className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-300"
            >
              {creating ? "Cancel" : "New artifact"}
            </button>
          </div>

          {creating ? (
            <div className="mb-4 space-y-2 rounded-lg border border-zinc-200 p-3">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title (e.g. Landing page copy)"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none"
                />
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ArtifactSummary["artifact_type"])}
                  className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 outline-none"
                >
                  <option value="DOCUMENT">Document</option>
                  <option value="RESEARCH_DOSSIER">Research dossier</option>
                  <option value="REPORT">Report</option>
                  <option value="CODE">Code</option>
                  <option value="DATA">Data</option>
                </select>
              </div>
              <textarea
                rows={4}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Write or paste the artifact content…"
                className="w-full resize-y rounded-lg border border-zinc-200 px-3 py-2 text-sm leading-6 outline-none"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy || !newTitle.trim() || !newContent.trim()}
                  onClick={() => void createArtifact()}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  {busy ? "Saving…" : "Save artifact"}
                </button>
              </div>
            </div>
          ) : null}

          {!loaded ? (
            <p className="text-[13px] text-zinc-500">Loading…</p>
          ) : activeArtifacts.length === 0 ? (
            <p className="text-[13px] text-zinc-500">
              No artifacts saved for this pursuit yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {activeArtifacts.map((artifact) => (
                <li
                  key={artifact.id}
                  className="rounded-lg border border-zinc-200 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {artifact.title}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {TYPE_LABELS[artifact.artifact_type] ?? artifact.artifact_type} · v{artifact.version} ·{" "}
                        {STATE_LABELS[artifact.verification_state] ?? artifact.verification_state.toLowerCase()}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        selected?.id === artifact.id
                          ? setSelected(null)
                          : void inspectArtifact(artifact.id)
                      }
                      className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-300 disabled:opacity-40"
                    >
                      {selected?.id === artifact.id ? "Close" : "Open"}
                    </button>
                  </div>

                  {selected?.id === artifact.id ? (
                    <div className="mt-3 border-t border-zinc-100 pt-3">
                      {revising ? (
                        <div className="space-y-2">
                          <textarea
                            rows={6}
                            value={revisionContent}
                            onChange={(e) => setRevisionContent(e.target.value)}
                            className="w-full resize-y rounded-lg border border-zinc-200 px-3 py-2 text-sm leading-6 outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setRevising(false)}
                              className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={busy || !revisionContent.trim()}
                              onClick={() => void saveRevision()}
                              className="rounded-lg bg-zinc-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                            >
                              {busy ? "Saving v" + (selected.version + 1) + "…" : `Save v${selected.version + 1}`}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 font-sans text-sm leading-6 text-zinc-800">
                            {selected.content_text ?? ""}
                          </pre>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[11px] text-zinc-400">
                              Updated {new Date(selected.updated_at).toLocaleString()}
                            </span>
                            {!selected.superseded_by ? (
                              <button
                                type="button"
                                onClick={() => setRevising(true)}
                                className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-300"
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
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
