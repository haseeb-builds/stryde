"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type MemoryRow = {
  id: string;
  memory_scope: string;
  memory_type: string;
  status: string;
  content: string;
  provenance_type: string;
  confidence: number;
  importance: number;
  last_confirmed_at: string | null;
  updated_at: string;
};

const PROVENANCE_META: Record<
  string,
  { label: string; badgeClass: string }
> = {
  USER_REPORTED: {
    label: "You reported",
    badgeClass:
      "border-[var(--rule)] bg-[var(--surface-subtle)] text-[var(--ink)]"
  },
  VERIFIED: {
    label: "Verified fact",
    badgeClass:
      "border-[#b7dec9] bg-[var(--verified-Wash)] text-[var(--verified)]"
  },
  OBSERVED: {
    label: "Observed outcome",
    badgeClass:
      "border-[#f0c5ba] bg-[var(--signal-wash)] text-[var(--signal)]"
  },
  SOURCE: {
    label: "From source",
    badgeClass:
      "border-[#b7dec9] bg-[var(--verified-Wash)] text-[var(--verified)]"
  },
  MODEL_INFERENCE: {
    label: "Stryde inference",
    badgeClass:
      "border-[#ead2a2] bg-[var(--waiting-wash)] text-[var(--waiting)]"
  },
  SYSTEM_DERIVED: {
    label: "System context",
    badgeClass:
      "border-[var(--rule)] bg-[var(--surface-subtle)] text-[var(--ink-secondary)]"
  }
};

function formatTimestamp(isoString: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return "";
  }
}

export default function PursuitMemoryPanel(props: {
  pursuitId?: string;
  sessionActive: boolean;
}) {
  const { pursuitId, sessionActive } = props;
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionActive) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const query = pursuitId ? `?pursuit_id=${pursuitId}&limit=50` : "?limit=50";
    const r = await fetch(`/api/v1/memory${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return;
    const payload = (await r.json()) as { memories?: MemoryRow[] };
    setMemories(payload.memories ?? []);
  }, [pursuitId, sessionActive]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function act(memoryId: string, action: "confirm" | "forget") {
    setBusy(true);
    setError("");
    setNotice(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired. Please sign in again.");
      const r = await fetch(`/api/v1/memory/${memoryId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      if (!r.ok) {
        const payload = (await r.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Failed to update memory.");
      }
      setNotice(
        action === "confirm"
          ? "Confirmed as verified knowledge for this pursuit."
          : "Memory removed from pursuit context."
      );
      await load();
      window.setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update memory.");
    } finally {
      setBusy(false);
    }
  }

  if (!sessionActive) return null;

  const active = memories.filter(
    (m) => m.status === "ACTIVE" || m.status === "CANDIDATE"
  );
  const candidateCount = active.filter((m) => m.status === "CANDIDATE").length;

  return (
    <details className="group rounded-[4px] border border-[var(--rule)] bg-[var(--surface)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none hover:bg-[var(--surface-subtle)]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[11px] text-[var(--ink-muted)] transition-transform group-open:rotate-90">
            ▸
          </span>
          <span className="text-[13.5px] font-semibold text-[var(--ink)]">
            What Stryde remembers
          </span>
          <span className="font-mono text-[11px] text-[var(--ink-muted)]">
            {active.length} {active.length === 1 ? "entry" : "entries"}
            {candidateCount > 0 ? ` (${candidateCount} tentative)` : ""}
          </span>
        </div>
        <span className="font-mono text-[11px] text-[var(--ink-muted)]">
          Durable facts &amp; context
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
          className="rounded-[4px] border border-[#efb9b9] bg-[var(--blocked-wash)] px-3 py-2 text-[12px] font-medium text-[var(--blocked)]"
        >
          {error}
        </div>
      ) : null}

      {active.length === 0 ? (
        <p className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-3.5 py-3 text-[12.5px] text-[var(--ink-secondary)]">
          No durable memories recorded yet. As you converse and make progress, Stryde saves key constraints, user preferences, and confirmed facts here.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--rule)] overflow-hidden rounded-[4px] border border-[var(--rule)] bg-[var(--surface)]">
          {active.map((memory) => {
            const prov = PROVENANCE_META[memory.provenance_type] ?? {
              label: memory.provenance_type.toLowerCase().replaceAll("_", " "),
              badgeClass:
                "border-[var(--rule)] bg-[var(--surface-subtle)] text-[var(--ink-secondary)]"
            };

            const updatedDate = formatTimestamp(memory.updated_at);

            return (
              <li
                key={memory.id}
                className="flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-start"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[10.5px] font-medium ${prov.badgeClass}`}
                    >
                      {prov.label}
                    </span>
                    {memory.status === "CANDIDATE" ? (
                      <span className="rounded-[3px] border border-[#ead2a2] bg-[var(--waiting-wash)] px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-[var(--waiting)]">
                        Tentative
                      </span>
                    ) : null}
                    <span className="font-mono text-[10.5px] text-[var(--ink-muted)]">
                      Scope: {memory.memory_scope.toLowerCase()}
                    </span>
                    {updatedDate ? (
                      <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                        · {updatedDate}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[13px] leading-relaxed text-[var(--ink)]">
                    {memory.content}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 pt-1 sm:pt-0">
                  {memory.status === "CANDIDATE" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act(memory.id, "confirm")}
                      className="rounded-[4px] border border-[#b7dec9] bg-[var(--verified-Wash)] px-2.5 py-1 font-mono text-[11px] font-medium text-[var(--verified)] hover:bg-[#d8efe3] disabled:opacity-45"
                    >
                      Confirm as true
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act(memory.id, "forget")}
                    className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-2.5 py-1 font-mono text-[11px] text-[var(--ink-secondary)] hover:border-[#efb9b9] hover:bg-[var(--blocked-wash)] hover:text-[var(--blocked)] disabled:opacity-45"
                  >
                    Forget
                  </button>
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
