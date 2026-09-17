"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Pursuit = {
  id: string;
  title: string | null;
  status: string;
};

type ConversationMessage = {
  role: "user" | "stryde";
  content: string;
};

type ConversationOption = {
  label: string;
  value: string;
};

type ConversationTurn = {
  message: string;
  question: string | null;
  options: ConversationOption[];
  ready_for_reasoning: boolean;
  focus: string | null;
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

const STARTING_SIGNALS: ConversationOption[] = [
  { label: "I don't know what to do next", value: "I don't know what to do next." },
  { label: "I know what I want, but I'm stuck", value: "I know what I want, but I'm stuck." },
  { label: "I have too many possible problems", value: "I have too many possible problems and I don't know which matters most." },
  { label: "I need to make a decision", value: "I need to make a decision and I'm not sure how to evaluate the options." },
  { label: "I keep thinking about it, but not moving", value: "I keep thinking about it, but I'm not turning that thinking into enough real progress." },
  { label: "Something changed", value: "Something changed and I'm not sure what that means for the way forward." },
  { label: "I'm waiting on someone or something", value: "I'm waiting on someone or something and progress feels dependent on it." },
  { label: "I'm not sure what's going on", value: "I'm not sure what's actually going on yet." },
];

export default function PursuitPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [pursuit, setPursuit] = useState<Pursuit | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [suggestedOptions, setSuggestedOptions] = useState<ConversationOption[]>([]);
  const [nextQuestion, setNextQuestion] = useState<string | null>(null);
  const [readyForReasoning, setReadyForReasoning] = useState(false);
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReasoningResult | null>(null);

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

  async function sendMessage(message: string) {
    const content = message.trim();
    if (!content || working) return;

    setWorking(true);
    setError("");
    setReadyForReasoning(false);
    setSuggestedOptions([]);
    setNextQuestion(null);

    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Session expired. Please sign in again.");

      const response = await fetch(`/api/v1/pursuits/${params.id}/conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: content, conversation: messages }),
      });

      const body = (await response.json()) as {
        error?: string;
        turn?: ConversationTurn;
      };
      if (!response.ok || !body.turn) throw new Error(body.error || "Stryde couldn't continue the conversation.");

      setMessages((current) => [...current, { role: "stryde", content: body.turn!.message }]);
      setReadyForReasoning(body.turn.ready_for_reasoning);
      setSuggestedOptions(body.turn.options);
      setNextQuestion(body.turn.question);
    } catch (err) {
      setMessages((current) => current.slice(0, -1));
      setError(err instanceof Error ? err.message : "Stryde couldn't continue the conversation.");
      if (messages.length === 0) setSuggestedOptions(STARTING_SIGNALS);
    } finally {
      setWorking(false);
    }
  }

  async function workWithWhatWeHave() {
    if (working) return;
    const transcript = messages.map((message) => `${message.role === "user" ? "USER" : "STRYDE"}: ${message.content}`).join("\n\n");
    await runReasoning(transcript);
  }

  async function runReasoning(reasoningInput: string) {
    if (!reasoningInput.trim()) return;
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
      setReadyForReasoning(false);
      setSuggestedOptions([]);
      setNextQuestion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reasoning failed.");
    } finally {
      setWorking(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  if (loading) return <main className="min-h-screen p-8">Loading…</main>;
  if (!pursuit) return <main className="min-h-screen p-8">{error || "Not found."}</main>;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl flex-col">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button onClick={() => router.push("/")} className="text-sm text-zinc-500 transition hover:text-zinc-950">
            ← Back to Stryde
          </button>
          <span className="text-xs uppercase tracking-[0.18em] text-zinc-400">{pursuit.status}</span>
        </div>

        <header className="mb-8 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Pursuit</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        </header>

        <section className="flex flex-1 flex-col rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
            {messages.length === 0 && (
              <div className="max-w-2xl space-y-6">
                <div className="space-y-2">
                  <p className="text-xl font-medium tracking-tight">What’s going on?</p>
                  <p className="text-sm leading-6 text-zinc-500">
                    You don't need to explain it perfectly. Tell me whatever you know, or start with one of these.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {STARTING_SIGNALS.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => void sendMessage(option.value)}
                      className="rounded-2xl border border-zinc-200 p-4 text-left transition hover:border-zinc-400 hover:bg-zinc-50"
                    >
                      <p className="text-sm font-medium">{option.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={message.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-md bg-zinc-950 px-4 py-3 text-sm leading-6 text-white" : "max-w-[92%] rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-3 text-sm leading-6 text-zinc-800"}>
                  {message.content}
                </div>
              </div>
            ))}

            {working && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-3 text-sm text-zinc-500">Stryde is thinking…</div>
              </div>
            )}

            {!working && nextQuestion && (
              <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-zinc-50 px-4 py-3 text-sm font-medium leading-6 text-zinc-800">
                {nextQuestion}
              </div>
            )}

            {!working && suggestedOptions.length > 0 && (
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">You can choose one, or say it your own way</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedOptions.map((option) => (
                    <button
                      key={`${option.label}-${option.value}`}
                      type="button"
                      onClick={() => void sendMessage(option.value)}
                      className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {readyForReasoning && !working && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <p className="text-sm font-medium">I have enough to work with what you've told me.</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">We can keep talking, or I can turn this into a concrete situation analysis.</p>
                </div>
                <button onClick={() => void workWithWhatWeHave()} className="mt-3 shrink-0 rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white sm:mt-0">
                  Work with this
                </button>
              </div>
            )}

            {result && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">What Stryde thinks is going on</p>
                <p className="mt-3 text-sm leading-6 text-zinc-800">{result.reasoning.understanding}</p>
                {result.reasoning.diagnosis && (
                  <div className="mt-5 border-t border-zinc-100 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Current constraint</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">{result.reasoning.diagnosis}</p>
                  </div>
                )}
                {result.reasoning.intervention && (
                  <div className="mt-5 border-t border-zinc-100 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Suggested way forward</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">{result.reasoning.intervention.rationale}</p>
                  </div>
                )}
                {result.reasoning.proposed_response && (
                  <p className="mt-5 text-sm font-medium leading-6 text-zinc-950">{result.reasoning.proposed_response}</p>
                )}
              </div>
            )}
          </div>

          {!result && (
            <div className="border-t border-zinc-200 p-4 sm:p-5">
              {messages.length > 0 && !working && (
                <div className="mb-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void sendMessage("That's not quite what I mean. Let me explain it differently.")} className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:border-zinc-400">
                    That's not quite it
                  </button>
                  <button type="button" onClick={() => void sendMessage("I don't know. Help me figure out what I mean.")} className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:border-zinc-400">
                    I don't know
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage(input);
                    }
                  }}
                  placeholder="Tell Stryde what's on your mind…"
                  rows={3}
                  className="min-h-20 flex-1 resize-none rounded-2xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-950"
                />
                <button
                  type="submit"
                  disabled={working || !input.trim()}
                  className="rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Send
                </button>
              </form>
              <p className="mt-2 text-center text-[11px] text-zinc-400">Messy is fine. Stryde will help make sense of it.</p>
            </div>
          )}

          {error && <p className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</p>}
        </section>
      </div>
    </main>
  );
}
