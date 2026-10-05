"use client";

// Autonomy policy as a contextual disclosure, not a settings dashboard
// (docs/PRODUCT.md UX law). It only appears in the pursuit workspace's panel
// strip and controls what Stryde may do on the user's behalf. The policy can
// only tighten behavior: every delegation still needs explicit per-action
// approval, and nothing here can grant authority.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Policy = {
  allow_worker_delegation: boolean;
  allowed_worker_types: string[];
  auto_execute_research: boolean;
};

const DEFAULT_POLICY: Policy = {
  allow_worker_delegation: false,
  allowed_worker_types: ["HERMES", "OPENCODE", "BROWSER"],
  auto_execute_research: true,
};

const WORKER_LABELS: Record<string, string> = { HERMES: "Hermes", OPENCODE: "OpenCode", BROWSER: "Browser" };

export default function PursuitAutonomyRow(props: { sessionActive: boolean; pursuitId: string }) {
  const { sessionActive, pursuitId } = props;
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [agent, setAgent] = useState<string>("");
  const [agentSaved, setAgentSaved] = useState(false);

  const load = useCallback(async () => {
    if (!sessionActive) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const r = await fetch("/api/v1/autonomy-policy", { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const body = (await r.json()) as { configured: boolean; policy: Policy };
    setConfigured(body.configured);
    setPolicy(body.policy);
  }, [sessionActive]);

  const loadAgent = useCallback(async () => {
    if (!sessionActive) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const r = await fetch(`/api/v1/agent-preference?pursuit_id=${pursuitId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const body = (await r.json()) as { preferred_worker_type: string | null };
    setAgent(body.preferred_worker_type ?? "");
  }, [sessionActive, pursuitId]);

  useEffect(() => {
    const t = window.setTimeout(() => { void load(); void loadAgent(); }, 0);
    return () => window.clearTimeout(t);
  }, [load, loadAgent]);

  async function saveAgent(next: string) {
    setBusy(true);
    setError("");
    setAgentSaved(false);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const r = await fetch("/api/v1/agent-preference", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ preferred_worker_type: next || null, pursuit_id: pursuitId }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not save the agent choice");
        return;
      }
      setAgent(next);
      setAgentSaved(true);
      window.setTimeout(() => setAgentSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  async function save(next: Policy) {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const r = await fetch("/api/v1/autonomy-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(next),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not save your autonomy settings");
        return;
      }
      setPolicy(next);
      setConfigured(true);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  function toggleWorkerType(workerType: string) {
    const has = policy.allowed_worker_types.includes(workerType);
    const nextTypes = has
      ? policy.allowed_worker_types.filter((t) => t !== workerType)
      : [...policy.allowed_worker_types, workerType];
    void save({ ...policy, allowed_worker_types: nextTypes });
  }

  if (!sessionActive) return null;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="bg-transparent border-0 p-0 text-[13px] text-zinc-500 cursor-pointer"
      >
        {open ? "▾" : "▸"} What Stryde may do on its own
        {configured ? "" : " (default: asks before anything consequential)"}
      </button>
      {open ? (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
          {error ? <p className="mb-2 text-[13px] text-red-700">{error}</p> : null}
          {saved ? <p className="mb-2 text-[13px] text-emerald-700">Saved.</p> : null}
          <label className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-sm text-zinc-700">Let Stryde delegate real work to its worker agent (each task still shows you what will run, and runs only after you approve it)</span>
            <input
              type="checkbox"
              disabled={busy}
              checked={policy.allow_worker_delegation}
              onChange={(event) =>
                void save({ ...policy, allow_worker_delegation: event.target.checked })
              }
            />
          </label>
          {policy.allow_worker_delegation ? (
            <div className="flex flex-wrap items-center gap-2 py-1.5">
              <span className="text-[13px] text-zinc-500">Workers allowed:</span>
              {Object.entries(WORKER_LABELS).map(([workerType, label]) => (
                <button
                  key={workerType}
                  type="button"
                  disabled={busy}
                  onClick={() => toggleWorkerType(workerType)}
                  className={
                    policy.allowed_worker_types.includes(workerType)
                      ? "rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white"
                      : "rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-500"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-sm text-zinc-700">Agent for delegated work on this pursuit</span>
            <span className="flex items-center gap-2">
              {agentSaved ? <span className="text-[13px] text-emerald-700">Saved.</span> : null}
              <select
                disabled={busy}
                value={agent}
                onChange={(event) => void saveAgent(event.target.value)}
                className="rounded-lg border border-zinc-300 px-2 py-1 text-xs"
              >
                <option value="">Stryde chooses</option>
                {Object.entries(WORKER_LABELS).map(([workerType, label]) => (
                  <option key={workerType} value={workerType}>{label}</option>
                ))}
              </select>
            </span>
          </div>
          <label className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-sm text-zinc-700">Let Stryde look things up on the web on its own when the situation needs it</span>
            <input
              type="checkbox"
              disabled={busy}
              checked={policy.auto_execute_research}
              onChange={(event) =>
                void save({ ...policy, auto_execute_research: event.target.checked })
              }
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}
