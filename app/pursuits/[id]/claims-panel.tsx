"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isSelectableObservationForClaim,
  formatObservationOptionLabel
} from "@/lib/pursuit-observations";

type LinkedObservation = {
  id: string;
  relation_type: string;
  observation_kind?: string;
  observed_at?: string;
  content?: {
    terminal_status?: string;
    result?: Record<string, unknown>;
    note?: string | null;
  } | null;
};

type Claim = {
  id: string;
  scope: string;
  kind: string;
  content: string;
  epistemic_status: string;
  created_at: string;
  observations?: LinkedObservation[];
};

type PursuitObservation = {
  id: string;
  observation_kind: string;
  observed_at: string;
  source_reference: string | null;
};

const STATUS_META: Record<
  string,
  { label: string; detail: string; dotClass: string; badgeClass: string }
> = {
  REPORTED: {
    label: "reported",
    detail: "Self-reported · not independently verified",
    dotClass: "bg-[var(--waiting)]",
    badgeClass:
      "border-[#ead2a2] bg-[var(--waiting-wash)] text-[var(--waiting)]"
  },
  OBSERVED: {
    label: "evidence linked",
    detail: "Evidence observation attached",
    dotClass: "bg-[var(--signal)]",
    badgeClass: "border-[#f0c5ba] bg-[var(--signal-wash)] text-[var(--signal)]"
  },
  VERIFIED: {
    label: "verified",
    detail: "Independently verified with evidence",
    dotClass: "bg-[var(--verified)]",
    badgeClass:
      "border-[#b7dec9] bg-[var(--verified-Wash)] text-[var(--verified)]"
  },
  CONTRADICTED: {
    label: "contradicted",
    detail: "Contradicted by evidence",
    dotClass: "bg-[var(--blocked)]",
    badgeClass:
      "border-[#efb9b9] bg-[var(--blocked-wash)] text-[var(--blocked)]"
  },
  UNVERIFIABLE: {
    label: "unverifiable",
    detail: "Marked unverifiable",
    dotClass: "bg-[var(--ink-muted)]",
    badgeClass:
      "border-[var(--rule)] bg-[var(--surface-subtle)] text-[var(--ink-secondary)]"
  }
};

const ADJUDICATIONS: Array<{ to: string; label: string }> = [
  { to: "VERIFIED", label: "Verified" },
  { to: "CONTRADICTED", label: "Contradicted" },
  { to: "UNVERIFIABLE", label: "Can't verify" }
];

function observationSummary(o: LinkedObservation): string {
  const parts: string[] = [];
  if (o.content?.terminal_status)
    parts.push(o.content.terminal_status.toLowerCase());
  if (typeof o.content?.note === "string" && o.content.note)
    parts.push(o.content.note);
  else if (o.content?.result && typeof o.content.result.summary === "string")
    parts.push(o.content.result.summary);
  return parts.join(" — ") || o.observation_kind || o.id;
}

export default function PursuitClaimsPanel(props: {
  pursuitId: string;
  sessionActive: boolean;
}) {
  const { pursuitId, sessionActive } = props;
  const [claims, setClaims] = useState<Claim[]>([]);
  const [observations, setObservations] = useState<PursuitObservation[]>([]);
  const [draft, setDraft] = useState("");
  const [selectedObservation, setSelectedObservation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const [cr, or] = await Promise.all([
      fetch(`/api/v1/claims?pursuit_id=${pursuitId}`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(`/api/v1/pursuits/${pursuitId}/observations`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);
    if (cr.ok)
      setClaims(((await cr.json()) as { claims: Claim[] }).claims ?? []);
    if (or.ok)
      setObservations(
        ((await or.json()) as { observations: PursuitObservation[] })
          .observations ?? []
      );
  }, [pursuitId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const createClaim = async () => {
    if (busy || !draft.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired. Please sign in again.");
      const r = await fetch("/api/v1/claims", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          scope: "PURSUIT",
          kind: "OUTCOME",
          pursuit_id: pursuitId,
          content: draft.trim()
        })
      });
      const b = (await r.json()) as { claim?: Claim; error?: string };
      if (!r.ok || !b.claim)
        throw new Error(b.error || "Unable to record the claim.");
      const created = b.claim;
      setDraft("");
      if (selectedObservation) {
        const lr = await fetch(`/api/v1/claims/${created.id}/observations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            observation_id: selectedObservation,
            relation_type: "SUPPORTS"
          })
        });
        if (!lr.ok) {
          const lb = (await lr.json()) as { error?: string };
          setError(
            lb.error || "Claim recorded, but linking the evidence failed."
          );
        }
        setSelectedObservation("");
      }
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to record the claim."
      );
    } finally {
      setBusy(false);
    }
  };

  const linkObservation = async (claimId: string) => {
    if (busy || !selectedObservation) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired. Please sign in again.");
      const r = await fetch(`/api/v1/claims/${claimId}/observations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          observation_id: selectedObservation,
          relation_type: "SUPPORTS"
        })
      });
      const b = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(b.error || "Unable to link the evidence.");
      setSelectedObservation("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to link the evidence.");
    } finally {
      setBusy(false);
    }
  };

  const adjudicate = async (claimId: string, to: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired. Please sign in again.");
      const claim = claims.find((c) => c.id === claimId);
      const evidence = claim?.observations?.length
        ? `Adjudicated against ${claim.observations.length} linked observation(s).`
        : "Adjudicated without linked evidence.";
      const r = await fetch(`/api/v1/claims/${claimId}/adjudicate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ to_status: to, reason: evidence })
      });
      const b = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(b.error || "Unable to adjudicate the claim.");
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to adjudicate the claim."
      );
    } finally {
      setBusy(false);
    }
  };

  const selectableObservations = observations.filter(
    isSelectableObservationForClaim
  );
  const verifiedCount = claims.filter(
    (c) => c.epistemic_status === "VERIFIED"
  ).length;
  const reportedCount = claims.filter(
    (c) => c.epistemic_status === "REPORTED"
  ).length;

  return (
    <details className="group rounded-[4px] border border-[var(--rule)] bg-[var(--surface)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none hover:bg-[var(--surface-subtle)]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[11px] text-[var(--ink-muted)] transition-transform group-open:rotate-90">
            ▸
          </span>
          <span className="text-[13.5px] font-semibold text-[var(--ink)]">
            Evidence &amp; claims
          </span>
          <span className="font-mono text-[11px] text-[var(--ink-muted)]">
            {verifiedCount} verified · {reportedCount} reported
          </span>
        </div>
        <span className="font-mono text-[11px] text-[var(--ink-muted)]">
          Reported vs. verified ledger
        </span>
      </summary>

      <div className="space-y-4 border-t border-[var(--rule)] p-4">
        <p className="text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
          What you achieve stays grounded in verified evidence. Self-reported outcomes remain marked as{" "}
          <strong className="font-semibold text-[var(--ink)]">reported</strong>{" "}
          until linked to an observation or verified source.
        </p>

        <div className="space-y-2 rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy || !sessionActive}
            rows={2}
            placeholder='State an outcome as a claim, e.g. "I finished the first study session"'
            className="w-full resize-y rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
          />

          {selectableObservations.length > 0 ? (
            <select
              value={selectedObservation}
              onChange={(e) => setSelectedObservation(e.target.value)}
              disabled={busy}
              aria-label="Select supporting observation"
              className="w-full rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 font-mono text-[11.5px] text-[var(--ink)]"
            >
              <option value="">
                Optionally link evidence (action, research, or URL verification)…
              </option>
              {selectableObservations.map((o) => (
                <option key={o.id} value={o.id}>
                  {formatObservationOptionLabel(o)}
                </option>
              ))}
            </select>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void createClaim()}
              disabled={busy || !sessionActive || !draft.trim()}
              className="rounded-[4px] bg-[var(--ink)] px-3.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#2a2f2c] disabled:opacity-45"
            >
              {busy ? "Recording…" : "Record claim"}
            </button>
          </div>
        </div>

        {claims.length > 0 ? (
          <div className="divide-y divide-[var(--rule)] overflow-hidden rounded-[4px] border border-[var(--rule)] bg-[var(--surface)]">
            {claims.map((c) => {
              const meta = STATUS_META[c.epistemic_status] ?? {
                label: c.epistemic_status.toLowerCase(),
                detail: c.epistemic_status,
                dotClass: "bg-[var(--ink-muted)]",
                badgeClass:
                  "border-[var(--rule)] bg-[var(--surface-subtle)] text-[var(--ink-secondary)]"
              };

              return (
                <div key={c.id} className="space-y-2 p-3.5 text-[13px]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="font-medium leading-relaxed text-[var(--ink)]">
                        {c.content}
                      </p>
                      <p className="font-mono text-[11px] text-[var(--ink-muted)]">
                        {meta.detail}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-[3px] border px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider ${meta.badgeClass}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`}
                      />
                      {meta.label}
                    </span>
                  </div>

                  {c.observations && c.observations.length > 0 ? (
                    <div className="space-y-1 rounded-[3px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-2.5">
                      {c.observations.map((o) => (
                        <p
                          key={o.id}
                          className="font-mono text-[11.5px] leading-5 text-[var(--ink-secondary)]"
                        >
                          · {o.relation_type.toLowerCase()}:{" "}
                          {observationSummary(o)}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {c.observations?.length === 0 &&
                    selectableObservations.length > 0 &&
                    c.epistemic_status !== "VERIFIED" &&
                    c.epistemic_status !== "CONTRADICTED" ? (
                      <button
                        type="button"
                        onClick={() => void linkObservation(c.id)}
                        disabled={busy || !selectedObservation}
                        className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[12px] text-[var(--ink)] hover:border-[var(--rule-strong)] disabled:opacity-45"
                      >
                        Link selected evidence
                      </button>
                    ) : null}

                    {c.epistemic_status === "REPORTED" ||
                    c.epistemic_status === "OBSERVED"
                      ? ADJUDICATIONS.map((a) => (
                          <button
                            key={a.to}
                            type="button"
                            onClick={() => void adjudicate(c.id, a.to)}
                            disabled={busy || !sessionActive}
                            className={`rounded-[4px] px-2.5 py-1 text-[12px] font-medium disabled:opacity-45 ${
                              a.to === "VERIFIED"
                                ? "bg-[var(--ink)] text-white hover:bg-[#2a2f2c]"
                                : "border border-[var(--rule)] bg-[var(--surface-subtle)] text-[var(--ink-secondary)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)]"
                            }`}
                          >
                            {a.label}
                          </button>
                        ))
                      : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-3.5 py-3 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
            No claims recorded for this pursuit yet. As you complete actions or gather research, state your outcome and attach the evidence.
          </p>
        )}

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
