"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Pursuit = {
  id: string;
  title: string | null;
  status: string;
};

type ReasoningResult = {
  run_id: string;
  model?: { provider: string; model: string };
  reasoning: {
    stages: string[];
    terminal_stage: string;
    path: string;
    understanding: string;
    diagnosis: string | null;
    intervention: { kind: string; rationale: string } | null;
    proposed_response: string | null;
    side_effect_authorized: false;
  };
};

export default function PursuitPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [pursuit, setPursuit] = useState<Pursuit | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ReasoningResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const title = useMemo(() => pursuit?.title || "Untitled pursuit", [pursuit]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/");
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("pursuit")
        .select("id, title, status")
        .eq("id", params.id)
        .single();
      if (fetchError || !data) {
        setError("Pursuit not found.");
      } else {
        setPursuit(data as Pursuit);
      }
      setLoading(false);
    }

    void load();
  }, [params.id, router]);

  async function runReasoning() {
    if (!input.trim()) return;
    setWorking(true);
    setError("");
    setResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Session expired. Please sign in again.");

      const response = await fetch(`/api/v1/pursuits/${params.id}/reason`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ input: input.trim() }),
      });

      const body = (await response.json()) as { error?: string } & Partial<ReasoningResult>;
      if (!response.ok) throw new Error(body.error || "Reasoning failed.");
      setResult(body as ReasoningResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reasoning failed.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <main className="min-h-screen p-8">Loading…</main>;
  if (!pursuit) return <main className="min-h-screen p-8">{error || "Not found."}</main>;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-3xl space-y-8">
        <button onClick={() => router.push("/")} className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Back to Stryde
        </button>

        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Pursuit</p>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-zinc-500">Status: {pursuit.status}</p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <p className="text-lg font-medium">What’s going on?</p>
            <p className="mt-1 text-sm text-zinc-500">Describe the current situation, not just a task.</p>
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="I’m stuck because…"
            rows={7}
            className="w-full resize-none rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-950"
          />

          <button
            onClick={runReasoning}
            disabled={working || !input.trim()}
            className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {working ? "Stryde is thinking…" : "Run Stryde"}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>

        {result && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Run</p>
                <p className="mt-1 font-mono text-xs text-zinc-500">{result.run_id}</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium">{result.reasoning.terminal_stage}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {result.reasoning.stages.map((stage) => (
                <span key={stage} className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600">
                  {stage}
                </span>
              ))}
            </div>

            <div className="space-y-4 text-sm">
              <div><p className="font-medium">Understanding</p><p className="mt-1 text-zinc-600">{result.reasoning.understanding}</p></div>
              {result.reasoning.diagnosis && <div><p className="font-medium">Diagnosis</p><p className="mt-1 text-zinc-600">{result.reasoning.diagnosis}</p></div>}
              {result.reasoning.intervention && <div><p className="font-medium">Intervention</p><p className="mt-1 text-zinc-600">{result.reasoning.intervention.kind}: {result.reasoning.intervention.rationale}</p></div>}
              {result.reasoning.proposed_response && <div><p className="font-medium">Proposed response</p><p className="mt-1 text-zinc-600">{result.reasoning.proposed_response}</p></div>}
            </div>

            {result.model && <p className="border-t border-zinc-200 pt-4 text-xs text-zinc-500">Model: {result.model.model}</p>}
            <p className="text-xs text-zinc-500">Side effects authorized: {String(result.reasoning.side_effect_authorized)}</p>
          </section>
        )}
      </div>
    </main>
  );
}
