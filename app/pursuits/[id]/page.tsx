"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

type EntryOption = {
  id: string;
  label: string;
  description: string;
};

const ENTRY_OPTIONS: EntryOption[] = [
  { id: "next", label: "I don't know what to do next", description: "I want to move, but the next step isn't clear." },
  { id: "stuck", label: "I know what I want, but I'm stuck", description: "The outcome is clear; something is getting in the way." },
  { id: "too_many", label: "There are too many possible problems", description: "I can't tell which issue matters most." },
  { id: "decision", label: "I need to make a decision", description: "I'm choosing between paths and don't know which to take." },
  { id: "thinking", label: "I keep thinking about it, but not moving", description: "I've spent time on it without enough real progress." },
  { id: "changed", label: "Something changed", description: "New information or circumstances changed the situation." },
  { id: "waiting", label: "I'm waiting on someone or something", description: "Progress depends on another person, system, or event." },
  { id: "not_sure", label: "I'm not sure what's going on", description: "That's okay. Stryde will help you figure it out." },
];

const GUIDED_QUESTIONS = [
  { id: "outcome", prompt: "What are you trying to make happen?", hint: "It doesn't need to be perfectly worded." },
  { id: "friction", prompt: "What seems to be making that difficult right now?", hint: "A feeling, obstacle, uncertainty, person, or pattern is enough." },
  { id: "attempted", prompt: "What have you tried or been doing so far?", hint: "Include things that haven't worked. They are useful evidence." },
] as const;

export default function PursuitPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [pursuit, setPursuit] = useState<Pursuit | null>(null);
  const [input, setInput] = useState("");
  const [entryMode, setEntryMode] = useState<"guided" | "freeform">("guided");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedAnswers, setGuidedAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReasoningResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const title = useMemo(() => pursuit?.title || "Untitled pursuit", [pursuit]);
  const selectedEntry = useMemo(() => ENTRY_OPTIONS.find((option) => option.id === selectedOption) ?? null, [selectedOption]);
  const currentQuestion = GUIDED_QUESTIONS[guidedStep];

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

  function chooseOption(option: EntryOption) {
    setSelectedOption(option.id);
    setGuidedAnswers({});
    setGuidedStep(0);
    setInput("");
    setError("");

    if (option.id === "not_sure" || option.id === "next" || option.id === "too_many" || option.id === "thinking") {
      setEntryMode("guided");
    } else {
      setEntryMode("guided");
    }
  }

  function switchToFreeform() {
    setEntryMode("freeform");
    setSelectedOption(null);
    setGuidedAnswers({});
    setGuidedStep(0);
    setError("");
  }

  function switchToGuided() {
    setEntryMode("guided");
    setSelectedOption(null);
    setInput("");
    setError("");
  }

  function saveGuidedAnswer(event: FormEvent) {
    event.preventDefault();
    const answer = input.trim();
    if (!answer) return;

    const updatedAnswers = { ...guidedAnswers, [currentQuestion.id]: answer };
    setGuidedAnswers(updatedAnswers);
    setInput("");
    if (guidedStep < GUIDED_QUESTIONS.length - 1) {
      setGuidedStep((step) => step + 1);
      return;
    }

    void runReasoning(formatGuidedSituation(updatedAnswers));
  }

  function formatGuidedSituation(answers: Record<string, string>): string {
    const optionContext = selectedEntry
      ? `Starting signal: ${selectedEntry.label}. ${selectedEntry.description}`
      : "Starting signal: user chose guided discovery.";
    return [
      optionContext,
      "",
      `What I'm trying to make happen: ${answers.outcome ?? ""}`,
      `What seems to be making it difficult: ${answers.friction ?? ""}`,
      `What I've tried or been doing: ${answers.attempted ?? ""}`,
    ].join("\n");
  }

  async function runReasoning(reasoningInput = input.trim()) {
    if (!reasoningInput) return;
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
        body: JSON.stringify({ input: reasoningInput }),
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

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <p className="text-lg font-medium">What’s going on?</p>
            <p className="text-sm leading-6 text-zinc-500">You don't need to explain it perfectly. Start with whatever you know.</p>
          </div>

          <div className="mt-6">
            <p className="text-sm font-medium">What best describes where you are?</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {ENTRY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => chooseOption(option)}
                  className={`rounded-xl border p-4 text-left transition ${selectedOption === option.id ? "border-zinc-950 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"}`}
                >
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {entryMode === "guided" && selectedOption && (
            <form onSubmit={saveGuidedAnswer} className="mt-7 border-t border-zinc-200 pt-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Step {guidedStep + 1} of {GUIDED_QUESTIONS.length}</p>
                  <p className="mt-2 text-lg font-medium">{currentQuestion.prompt}</p>
                  <p className="mt-1 text-sm text-zinc-500">{currentQuestion.hint}</p>
                </div>
                <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
                  <div className="h-full rounded-full bg-zinc-950 transition-all" style={{ width: `${((guidedStep + 1) / GUIDED_QUESTIONS.length) * 100}%` }} />
                </div>
              </div>
              <textarea
                autoFocus
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Just say it the way you would say it out loud."
                rows={5}
                className="mt-5 w-full resize-none rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-950"
              />
              <button
                type="submit"
                disabled={working || !input.trim()}
                className="mt-3 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {working ? "Stryde is thinking…" : guidedStep === GUIDED_QUESTIONS.length - 1 ? "Run Stryde" : "Continue"}
              </button>
            </form>
          )}

          {entryMode === "freeform" && (
            <form onSubmit={(event) => { event.preventDefault(); void runReasoning(); }} className="mt-7 border-t border-zinc-200 pt-6">
              <p className="text-lg font-medium">Tell Stryde in your own words</p>
              <p className="mt-1 text-sm text-zinc-500">Messy is fine. Give it the situation as it exists in your head.</p>
              <textarea
                autoFocus
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="I don't really know how to explain this, but…"
                rows={8}
                className="mt-5 w-full resize-none rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-950"
              />
              <button
                type="submit"
                disabled={working || !input.trim()}
                className="mt-3 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {working ? "Stryde is thinking…" : "Run Stryde"}
              </button>
            </form>
          )}

          <div className="mt-6 border-t border-zinc-100 pt-4 text-center">
            {entryMode === "guided" ? (
              <button type="button" onClick={switchToFreeform} className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-950">
                I'll tell Stryde myself
              </button>
            ) : (
              <button type="button" onClick={switchToGuided} className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-950">
                Help me figure it out instead
              </button>
            )}
          </div>

          {error && <p className="mt-5 text-sm text-red-600">{error}</p>}
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
