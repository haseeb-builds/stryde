"use client";

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
  auto_execute_research: true
};

const WORKER_LABELS: Record<string, string> = {
  HERMES: "Hermes",
  OPENCODE: "OpenCode",
  BROWSER: "Browser"
};

export default function PursuitAutonomyRow(props: {
  sessionActive: boolean;
  pursuitId: string;
}) {
  const { sessionActive, pursuitId } = props;
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
    const r = await fetch("/api/v1/autonomy-policy", {
      headers: { Authorization: `Bearer ${token}` }
    });
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
    const r = await fetch(`/api/v1/agent-preference?pursuit_id=${pursuitId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return;
    const body = (await r.json()) as { preferred_worker_type: string | null };
    setAgent(body.preferred_worker_type ?? "");
  }, [sessionActive, pursuitId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
      void loadAgent();
    }, 0);
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          preferred_worker_type: next || null,
          pursuit_id: pursuitId
        })
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(next)
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
    <details className="group rounded-[4px] border border-[var(--rule)] bg-[var(--surface)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none hover:bg-[var(--surface-subtle)]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[11px] text-[var(--ink-muted)] transition-transform group-open:rotate-90">
            ▸
          </span>
          <span className="text-[13.5px] font-semibold text-[var(--ink)]">
            What Stryde may do on its own
          </span>
          <span className="font-mono text-[11px] text-[var(--ink-muted)]">
            {configured
              ? policy.allow_worker_delegation
                ? "Delegation enabled"
                : "Asks before delegating"
              : "Default: asks before anything consequential"}
          </span>
        </div>
        <span className="font-mono text-[11px] text-[var(--ink-muted)]">
          Autonomy &amp; runner policy
        </span>
      </summary>

      <div className="space-y-3 border-t border-[var(--rule)] p-4 text-[13px]">
        {error ? (
          <p
            role="alert"
            className="rounded-[4px] border border-[#efb9b9] bg-[var(--blocked-wash)] px-3 py-2 text-[12.5px] font-medium text-[var(--blocked)]"
          >
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="rounded-[4px] border border-[#b7dec9] bg-[var(--verified-Wash)] px-3 py-1.5 font-mono text-[11.5px] text-[var(--verified)]">
            Saved.
          </p>
        ) : null}

        <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
          <span className="text-[13px] text-[var(--ink)]">
            Let Stryde delegate real work to its runner agent (each task still shows you what will run, and runs only after you approve it)
          </span>
          <input
            type="checkbox"
            disabled={busy}
            checked={policy.allow_worker_delegation}
            onChange={(event) =>
              void save({
                ...policy,
                allow_worker_delegation: event.target.checked
              })
            }
            className="h-4 w-4 accent-[var(--ink)]"
          />
        </label>

        {policy.allow_worker_delegation ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-2.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">
              Runners allowed:
            </span>
            {Object.entries(WORKER_LABELS).map(([workerType, label]) => (
              <button
                key={workerType}
                type="button"
                disabled={busy}
                onClick={() => toggleWorkerType(workerType)}
                className={
                  policy.allowed_worker_types.includes(workerType)
                    ? "rounded-[4px] bg-[var(--ink)] px-2.5 py-1 font-mono text-[11px] font-medium text-white"
                    : "rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-2.5 py-1 font-mono text-[11px] font-medium text-[var(--ink-secondary)]"
                }
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rule)] pt-2.5">
          <span className="text-[13px] text-[var(--ink)]">
            Agent for delegated work on this pursuit
          </span>
          <span className="flex items-center gap-2">
            {agentSaved ? (
              <span className="font-mono text-[11px] text-[var(--verified)]">
                Saved.
              </span>
            ) : null}
            <select
              disabled={busy}
              value={agent}
              onChange={(event) => void saveAgent(event.target.value)}
              aria-label="Agent for delegated work"
              className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-2.5 py-1 font-mono text-[11.5px] text-[var(--ink)]"
            >
              <option value="">Stryde chooses</option>
              {Object.entries(WORKER_LABELS).map(([workerType, label]) => (
                <option key={workerType} value={workerType}>
                  {label}
                </option>
              ))}
            </select>
          </span>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-[var(--rule)] pt-2.5">
          <span className="text-[13px] text-[var(--ink)]">
            Let Stryde look things up on the web on its own when the situation needs it
          </span>
          <input
            type="checkbox"
            disabled={busy}
            checked={policy.auto_execute_research}
            onChange={(event) =>
              void save({
                ...policy,
                auto_execute_research: event.target.checked
              })
            }
            className="h-4 w-4 accent-[var(--ink)]"
          />
        </label>
      </div>
    </details>
  );
}
