"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Skill = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  version: number;
  usage_count: number;
  security_scan: { verdict?: string } & Record<string, unknown>;
};

const STATUS_LABELS: Record<string, { label: string; badgeClass: string }> = {
  PROPOSED: {
    label: "Needs your review",
    badgeClass: "border-[#ead2a2] bg-[var(--waiting-wash)] text-[var(--waiting)]"
  },
  ACTIVE: {
    label: "Active & saved",
    badgeClass: "border-[#b7dec9] bg-[var(--verified-Wash)] text-[var(--verified)]"
  },
  REJECTED: {
    label: "Rejected",
    badgeClass: "border-[#efb9b9] bg-[var(--blocked-wash)] text-[var(--blocked)]"
  },
  STALE: {
    label: "Outdated",
    badgeClass: "border-[var(--rule)] bg-[var(--surface-subtle)] text-[var(--ink-secondary)]"
  },
  ARCHIVED: {
    label: "Archived",
    badgeClass: "border-[var(--rule)] bg-[var(--surface-subtle)] text-[var(--ink-muted)]"
  }
};

export default function PursuitSkillsPanel(props: {
  pursuitId: string;
  sessionActive: boolean;
}) {
  const { pursuitId, sessionActive } = props;
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionActive) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const r = await fetch(`/api/v1/skills?pursuit_id=${pursuitId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return;
    const body = (await r.json()) as { skills?: Skill[] };
    setSkills(body.skills ?? []);
    setLoaded(true);
  }, [sessionActive, pursuitId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function act(skillId: string, action: string) {
    setBusyId(skillId);
    setError("");
    setNotice(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired. Please sign in again.");
      const r = await fetch(`/api/v1/skills/${skillId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to perform action.");
      }
      setNotice(
        action === "approve"
          ? "Workflow approved and marked active for reuse."
          : action === "reject"
          ? "Workflow rejected."
          : "Workflow retired and archived."
      );
      await load();
      window.setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action did not go through.");
    } finally {
      setBusyId(null);
    }
  }

  if (!sessionActive) return null;

  const proposedCount = skills.filter((s) => s.status === "PROPOSED").length;

  return (
    <details className="group rounded-[4px] border border-[var(--rule)] bg-[var(--surface)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none hover:bg-[var(--surface-subtle)]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[11px] text-[var(--ink-muted)] transition-transform group-open:rotate-90">
            ▸
          </span>
          <span className="text-[13.5px] font-semibold text-[var(--ink)]">
            Saved workflows &amp; reusable steps
          </span>
          <span className="font-mono text-[11px] text-[var(--ink-muted)]">
            {loaded
              ? proposedCount > 0
                ? `${proposedCount} to review · ${skills.length} total`
                : `${skills.length} saved`
              : "loading…"}
          </span>
        </div>
        <span className="font-mono text-[11px] text-[var(--ink-muted)]">
          Procedures &amp; reuse
        </span>
      </summary>

      <div className="space-y-3 border-t border-[var(--rule)] p-4 text-[13px]">

      {notice ? (
        <div className="rounded-[4px] border border-[#b7dec9] bg-[var(--verified-Wash)] px-3 py-1.5 font-mono text-[11.5px] font-medium text-[var(--verified)]">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-[4px] border border-[#efb9b9] bg-[var(--blocked-wash)] px-3 py-2 text-[12.5px] font-medium text-[var(--blocked)]"
        >
          {error}
        </div>
      ) : null}

      {!loaded ? (
        <p className="font-mono text-[12px] text-[var(--ink-muted)]">Loading workflows…</p>
      ) : skills.length === 0 ? (
        <p className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-3.5 py-3 text-[12.5px] text-[var(--ink-secondary)]">
          No saved workflows yet. When Stryde solves a repeatable workflow or multi-step execution, it proposes a reusable procedure here so future runs execute reliably.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--rule)] overflow-hidden rounded-[4px] border border-[var(--rule)] bg-[var(--surface)]">
          {skills.map((skill) => {
            const meta = STATUS_LABELS[skill.status] ?? {
              label: skill.status,
              badgeClass: "border-[var(--rule)] bg-[var(--surface-subtle)] text-[var(--ink-secondary)]"
            };

            return (
              <li key={skill.id} className="p-3.5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13.5px] font-semibold text-[var(--ink)]">
                        {skill.title}
                      </p>
                      <span
                        className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                    </div>

                    {skill.description ? (
                      <p className="text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
                        {skill.description}
                      </p>
                    ) : null}

                    <p className="font-mono text-[11px] text-[var(--ink-muted)]">
                      Version {skill.version} · Used {skill.usage_count}×
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 pt-1 sm:pt-0">
                    {skill.status === "PROPOSED" ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === skill.id}
                          onClick={() => void act(skill.id, "approve")}
                          className="rounded-[4px] bg-[var(--ink)] px-2.5 py-1 font-mono text-[11px] font-medium text-white hover:bg-[#2a2f2c] disabled:opacity-45"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === skill.id}
                          onClick={() => void act(skill.id, "reject")}
                          className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-2.5 py-1 font-mono text-[11px] text-[var(--ink-secondary)] hover:border-[var(--rule-strong)] disabled:opacity-45"
                        >
                          Reject
                        </button>
                      </>
                    ) : skill.status === "ACTIVE" ? (
                      <button
                        type="button"
                        disabled={busyId === skill.id}
                        onClick={() => void act(skill.id, "archive")}
                        className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-2.5 py-1 font-mono text-[11px] text-[var(--ink-secondary)] hover:border-[var(--rule-strong)] disabled:opacity-45"
                      >
                        Retire
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </details>
  );
}
