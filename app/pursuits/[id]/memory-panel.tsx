"use client";

// Memory inspectability, kept contextual per the UX law: a collapsible
// "what Stryde remembers" section, not a settings dashboard. The user can
// confirm a tentative memory, forget it, or delete it outright.
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

const PROVENANCE_LABEL: Record<string, string> = {
  USER_REPORTED: "you said",
  VERIFIED: "verified",
  OBSERVED: "observed",
  SOURCE: "from a source",
  MODEL_INFERENCE: "Stryde's guess",
  SYSTEM_DERIVED: "system",
};

export default function PursuitMemoryPanel(props: { pursuitId?: string; sessionActive: boolean }) {
  const { pursuitId, sessionActive } = props;
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!sessionActive) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const query = pursuitId ? `?pursuit_id=${pursuitId}&limit=50` : "?limit=50";
    const r = await fetch(`/api/v1/memory${query}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const payload = (await r.json()) as { memories?: MemoryRow[] };
    setMemories(payload.memories ?? []);
  }, [pursuitId, sessionActive]);

  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function act(memoryId: string, action: "confirm" | "forget") {
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const r = await fetch(`/api/v1/memory/${memoryId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) {
        const payload = (await r.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "That didn't work");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!sessionActive) return null;

  const active = memories.filter((m) => m.status === "ACTIVE" || m.status === "CANDIDATE");

  return (
    <section style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 13, padding: 0 }}
      >
        {open ? "▾" : "▸"} What Stryde remembers{active.length ? ` (${active.length})` : ""}
      </button>
      {open ? (
        <div style={{ marginTop: 8 }}>
          {error ? <p style={{ color: "#b00", fontSize: 13 }}>{error}</p> : null}
          {active.length === 0 ? (
            <p style={{ color: "#888", fontSize: 13 }}>Nothing yet. As you work on this, Stryde remembers what matters.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {active.map((memory) => (
                <li
                  key={memory.id}
                  style={{ alignItems: "baseline", borderBottom: "1px solid #eee", display: "flex", gap: 8, justifyContent: "space-between", padding: "6px 0" }}
                >
                  <span style={{ fontSize: 13 }}>
                    <span style={{ color: "#888", marginRight: 6 }}>
                      [{PROVENANCE_LABEL[memory.provenance_type] ?? memory.provenance_type.toLowerCase()}
                      {memory.status === "CANDIDATE" ? " · tentative" : ""}]
                    </span>
                    {memory.content}
                  </span>
                  <span style={{ display: "flex", flexShrink: 0, gap: 6 }}>
                    {memory.status === "CANDIDATE" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(memory.id, "confirm")}
                        style={{ fontSize: 12 }}
                      >
                        True
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act(memory.id, "forget")}
                      style={{ fontSize: 12 }}
                    >
                      Forget
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
