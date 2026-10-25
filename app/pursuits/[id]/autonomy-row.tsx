"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Policy = {
  allow_worker_delegation: boolean;
  allowed_worker_types: string[];
  auto_execute_research: boolean;
};

const DEFAULT_POLICY: Policy = {
  allow_worker_delegation: true,
  allowed_worker_types: ["HERMES", "OPENCODE", "BROWSER"],
  auto_execute_research: true
};

export default function PursuitAutonomyRow(props: {
  sessionActive: boolean;
  pursuitId: string;
}) {
  const { sessionActive } = props;
  const [configured, setConfigured] = useState(false);
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

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

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

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
        setError(body.error ?? "Could not save your permissions");
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

  if (!sessionActive) return null;

  return (
    <details className="group rounded-2xl border border-[#E7E7E4] bg-[#FCFCFB]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 select-none hover:bg-[#F3F2EF] transition-colors rounded-2xl">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs text-[#6B6B6B] transition-transform group-open:rotate-90">
            ▸
          </span>
          <span className="text-sm font-semibold text-[#111111]">
            Automated Execution &amp; Research Permissions
          </span>
          <span className="text-xs text-[#6B6B6B]">
            {configured
              ? policy.allow_worker_delegation
                ? "Background execution enabled"
                : "Asks before background execution"
              : "Default: asks before consequential actions"}
          </span>
        </div>
        <span className="text-xs font-medium text-[#52525B]">Permissions</span>
      </summary>

      <div className="space-y-3.5 border-t border-[#E7E7E4] p-5 text-sm">
        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 font-medium">
            Saved.
          </p>
        ) : null}

        <label className="flex cursor-pointer items-start justify-between gap-3 py-1">
          <div className="space-y-0.5">
            <span className="text-xs sm:text-sm font-medium text-[#111111] block">
              Allow automated background execution
            </span>
            <span className="text-xs text-[#52525B] block">
              Stryde handles routine verification and checks in the background. Each action still displays what is planned and provides an immediate manual completion fallback.
            </span>
          </div>
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
            className="h-4 w-4 accent-[#111111] mt-1"
          />
        </label>

        <label className="flex cursor-pointer items-start justify-between gap-3 border-t border-[#E7E7E4] pt-3.5">
          <div className="space-y-0.5">
            <span className="text-xs sm:text-sm font-medium text-[#111111] block">
              Allow live autonomous web research
            </span>
            <span className="text-xs text-[#52525B] block">
              When a move requires external verification, Stryde fetches real sources and audits their claims against your constraints.
            </span>
          </div>
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
            className="h-4 w-4 accent-[#111111] mt-1"
          />
        </label>
      </div>
    </details>
  );
}
