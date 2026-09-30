"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type LinkedObservation = {
  id: string;
  relation_type: string;
  observation_kind?: string;
  observed_at?: string;
  content?: { terminal_status?: string; result?: Record<string, unknown>; note?: string | null } | null;
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

const STATUS_LABEL: Record<string, string> = {
  REPORTED: "reported",
  OBSERVED: "evidence linked",
  VERIFIED: "verified",
  CONTRADICTED: "contradicted",
  UNVERIFIABLE: "unverifiable",
};

const ADJUDICATIONS: Array<{ to: string; label: string }> = [
  { to: "VERIFIED", label: "Verified" },
  { to: "CONTRADICTED", label: "Contradicted" },
  { to: "UNVERIFIABLE", label: "Can't verify" },
];

function observationSummary(o: LinkedObservation): string {
  const parts: string[] = [];
  if (o.content?.terminal_status) parts.push(o.content.terminal_status.toLowerCase());
  if (typeof o.content?.note === "string" && o.content.note) parts.push(o.content.note);
  else if (o.content?.result && typeof o.content.result.summary === "string") parts.push(o.content.result.summary);
  return parts.join(" — ") || o.observation_kind || o.id;
}

export default function PursuitClaimsPanel(props: { pursuitId: string; sessionActive: boolean }) {
  const { pursuitId, sessionActive } = props;
  const [claims, setClaims] = useState<Claim[]>([]);
  const [observations, setObservations] = useState<PursuitObservation[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [selectedObservation, setSelectedObservation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const [cr, or] = await Promise.all([
      fetch(`/api/v1/claims?pursuit_id=${pursuitId}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/v1/pursuits/${pursuitId}/observations`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (cr.ok) setClaims(((await cr.json()) as { claims: Claim[] }).claims ?? []);
    if (or.ok) setObservations(((await or.json()) as { observations: PursuitObservation[] }).observations ?? []);
  }, [pursuitId]);

  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const createClaim = async () => {
    if (busy || !draft.trim()) return;
    setBusy(true); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired. Please sign in again.");
      const r = await fetch("/api/v1/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scope: "PURSUIT", kind: "OUTCOME", pursuit_id: pursuitId, content: draft.trim() }),
      });
      const b = await r.json() as { claim?: Claim; error?: string };
      if (!r.ok || !b.claim) throw new Error(b.error || "Unable to record the claim.");
      const created = b.claim;
      setDraft("");
      if (selectedObservation) {
        const lr = await fetch(`/api/v1/claims/${created.id}/observations`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ observation_id: selectedObservation, relation_type: "SUPPORTS" }),
        });
        if (!lr.ok) {
          const lb = await lr.json() as { error?: string };
          setError(lb.error || "Claim recorded, but linking the evidence failed.");
        }
        setSelectedObservation("");
      }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to record the claim."); }
    finally { setBusy(false); }
  };

  const linkObservation = async (claimId: string) => {
    if (busy || !selectedObservation) return;
    setBusy(true); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired. Please sign in again.");
      const r = await fetch(`/api/v1/claims/${claimId}/observations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ observation_id: selectedObservation, relation_type: "SUPPORTS" }),
      });
      const b = await r.json() as { error?: string };
      if (!r.ok) throw new Error(b.error || "Unable to link the evidence.");
      setSelectedObservation("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to link the evidence."); }
    finally { setBusy(false); }
  };

  const adjudicate = async (claimId: string, to: string) => {
    if (busy) return;
    setBusy(true); setError("");
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to_status: to, reason: evidence }),
      });
      const b = await r.json() as { error?: string };
      if (!r.ok) throw new Error(b.error || "Unable to adjudicate the claim.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to adjudicate the claim."); }
    finally { setBusy(false); }
  };

  const pending = observations.filter((o) => o.observation_kind === "HUMAN_ACTION_RESULT");

  return <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
    <div className="px-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Evidence &amp; claims</p>
          <p className="mt-1 text-sm leading-6 text-zinc-600">What you say happened stays separate from what has evidence. Link your action results to claims, then judge them.</p>
        </div>
        <button onClick={() => setOpen(v => !v)} className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-700">{open ? "Hide" : "Review"}</button>
      </div>

      {open && <>
        <div className="mt-4 space-y-2">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} disabled={busy || !sessionActive} rows={2}
            placeholder="State an outcome as a claim, e.g. &quot;I finished the first study session&quot;"
            className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none" />
          {pending.length > 0 && <select value={selectedObservation} onChange={e => setSelectedObservation(e.target.value)} disabled={busy}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none">
            <option value="">Optionally link an action result as evidence…</option>
            {pending.map(o => <option key={o.id} value={o.id}>Action result · {new Date(o.observed_at).toLocaleString()}</option>)}
          </select>}
          <div className="flex justify-end">
            <button onClick={() => void createClaim()} disabled={busy || !sessionActive || !draft.trim()}
              className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white disabled:opacity-30">{busy ? "Recording…" : "Record claim"}</button>
          </div>
        </div>

        {claims.length > 0 && <div className="mt-4 space-y-3">
          {claims.map(c => <div key={c.id} className="rounded-xl border border-zinc-200 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-6">{c.content}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                c.epistemic_status === "VERIFIED" ? "bg-emerald-50 text-emerald-700"
                : c.epistemic_status === "CONTRADICTED" ? "bg-red-50 text-red-700"
                : "bg-zinc-100 text-zinc-600"}`}>{STATUS_LABEL[c.epistemic_status] ?? c.epistemic_status.toLowerCase()}</span>
            </div>
            {c.observations && c.observations.length > 0 && <div className="mt-2 space-y-1">
              {c.observations.map(o => <p key={o.id} className="text-xs leading-5 text-zinc-500">
                · {o.relation_type.toLowerCase()}: {observationSummary(o)}
              </p>)}
            </div>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {c.observations?.length === 0 && pending.length > 0 && c.epistemic_status !== "VERIFIED" && c.epistemic_status !== "CONTRADICTED" &&
                <button onClick={() => void linkObservation(c.id)} disabled={busy || !selectedObservation}
                  className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-700 disabled:opacity-30">Link selected result</button>}
              {c.epistemic_status === "REPORTED" || c.epistemic_status === "OBSERVED" ? ADJUDICATIONS.map(a =>
                <button key={a.to} onClick={() => void adjudicate(c.id, a.to)} disabled={busy || !sessionActive}
                  className={`rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-30 ${a.to === "VERIFIED" ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-700"}`}>{a.label}</button>)
                : null}
            </div>
          </div>)}
        </div>}

        {claims.length === 0 && <p className="mt-4 text-sm leading-6 text-zinc-500">No claims recorded for this pursuit yet. As you finish actions, state what you achieved and attach the result as evidence.</p>}
      </>}

      {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    </div>
  </section>;
}
