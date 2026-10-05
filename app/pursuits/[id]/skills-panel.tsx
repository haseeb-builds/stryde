"use client";

// Skills as a contextual disclosure (docs/PRODUCT.md UX law): procedural
// memory Stryde learned from solved workflows, shown where it matters — the
// pursuit workspace's panel strip — never as a settings dashboard. The user
// can approve a proposed skill, reject it, or retire it; every action stays
// within Stryde's authority model (a skill never grants permissions).
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

const STATUS_LABELS: Record<string, string> = {
  PROPOSED: "Needs your review",
  ACTIVE: "Active",
  REJECTED: "Rejected",
  STALE: "Outdated",
  ARCHIVED: "Archived",
};

export default function PursuitSkillsPanel(props: { pursuitId: string; sessionActive: boolean }) {
  const { pursuitId, sessionActive } = props;
  const [open, setOpen] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!sessionActive) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const r = await fetch(`/api/v1/skills?pursuit_id=${pursuitId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const body = (await r.json()) as { skills?: Skill[] };
    setSkills(body.skills ?? []);
    setLoaded(true);
  }, [sessionActive, pursuitId]);

  useEffect(() => {
    const t = window.setTimeout(() => { if (open) void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [open, load]);

  async function act(skillId: string, action: string) {
    setBusyId(skillId);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const r = await fetch(`/api/v1/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "That action did not go through.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!sessionActive) return null;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="bg-transparent border-0 p-0 text-[13px] text-zinc-500 cursor-pointer"
      >
        {open ? "▾" : "▸"} Learned procedures
        {loaded && skills.length ? ` (${skills.filter((s) => s.status === "PROPOSED").length} to review)` : ""}
      </button>
      {open ? (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
          {error ? <p className="mb-2 text-[13px] text-red-700">{error}</p> : null}
          {!loaded ? (
            <p className="text-[13px] text-zinc-500">Loading…</p>
          ) : skills.length === 0 ? (
            <p className="text-[13px] text-zinc-500">
              When Stryde solves a repeatable workflow, it saves the procedure here so next time it just works.
            </p>
          ) : (
            <ul className="space-y-3">
              {skills.map((skill) => (
                <li key={skill.id} className="rounded-lg border border-zinc-200 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{skill.title}</p>
                      {skill.description ? <p className="mt-0.5 text-[13px] text-zinc-500">{skill.description}</p> : null}
                      <p className="mt-1 text-xs text-zinc-400">
                        {STATUS_LABELS[skill.status] ?? skill.status} · v{skill.version} · used {skill.usage_count}×
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {skill.status === "PROPOSED" ? (
                        <>
                          <button type="button" disabled={busyId === skill.id} onClick={() => void act(skill.id, "approve")} className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40">Approve</button>
                          <button type="button" disabled={busyId === skill.id} onClick={() => void act(skill.id, "reject")} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-500 disabled:opacity-40">Reject</button>
                        </>
                      ) : skill.status === "ACTIVE" ? (
                        <button type="button" disabled={busyId === skill.id} onClick={() => void act(skill.id, "archive")} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-500 disabled:opacity-40">Retire</button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
