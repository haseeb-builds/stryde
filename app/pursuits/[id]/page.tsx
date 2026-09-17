"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Pursuit = {
  id: string;
  title: string | null;
  status: string;
};

type ConversationOption = {
  label: string;
  value: string;
};

type ConversationMetadata = {
  question?: string | null;
  options?: ConversationOption[];
  ready_for_reasoning?: boolean;
  focus?: string | null;
};

type ConversationMessage = {
  id?: string;
  role: "user" | "stryde";
  content: string;
  metadata?: ConversationMetadata | null;
  created_at?: string;
};

type ConversationSession = {
  id: string;
  pursuit_id: string;
  title: string | null;
  status: "ACTIVE" | "ARCHIVED";
  created_at: string;
  updated_at: string;
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
  { label: "I'm stuck on something", value: "I know what I want, but I'm stuck on something." },
  { label: "I need to make a decision", value: "I need to make a decision and I'm not sure how to evaluate the options." },
  { label: "I'm not sure what's going on", value: "I'm not sure what's actually going on yet." },
];

function formatSessionTitle(session: ConversationSession): string {
  if (session.title?.trim()) return session.title.trim();
  return session.status === "ACTIVE" ? "Current conversation" : "Untitled conversation";
}

function parseStreamFrames(buffer: string): { frames: string[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const frames: string[] = [];
  let remainder = normalized;
  while (true) {
    const separator = remainder.indexOf("\n\n");
    if (separator < 0) break;
    frames.push(remainder.slice(0, separator));
    remainder = remainder.slice(separator + 2);
  }
  return { frames, remainder };
}

function frameToEvent(frame: string): { event: string; data: unknown } | null {
  const lines = frame.split("\n");
  const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() ?? "message";
  const dataLine = lines.find((line) => line.startsWith("data:"));
  if (!dataLine) return null;
  try {
    return { event, data: JSON.parse(dataLine.slice(5).trim()) };
  } catch {
    return null;
  }
}

export default function PursuitPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const [pursuit, setPursuit] = useState<Pursuit | null>(null);
  const [pursuits, setPursuits] = useState<Pursuit[]>([]);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [activeSession, setActiveSession] = useState<ConversationSession | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [suggestedOptions, setSuggestedOptions] = useState<ConversationOption[]>([]);
  const [readyForReasoning, setReadyForReasoning] = useState(false);
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReasoningResult | null>(null);

  const title = useMemo(() => pursuit?.title || "Untitled pursuit", [pursuit]);
  const archived = activeSession?.status === "ARCHIVED";

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setError("");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        router.replace("/");
        return;
      }

      const [pursuitResult, pursuitsResponse, sessionsResponse] = await Promise.all([
        supabase
          .from("pursuit")
          .select("id, title, status")
          .eq("id", params.id)
          .eq("owner_user_id", sessionData.session.user.id)
          .single(),
        fetch("/api/v1/pursuits", { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/v1/pursuits/${params.id}/conversations`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (pursuitResult.error || !pursuitResult.data) {
        setError("Pursuit not found.");
        setLoading(false);
        return;
      }
      setPursuit(pursuitResult.data as Pursuit);

      if (pursuitsResponse.ok) {
        const body = (await pursuitsResponse.json()) as { pursuits?: Pursuit[] };
        setPursuits(body.pursuits ?? []);
      }

      if (!sessionsResponse.ok) {
        setError("Unable to load conversation history.");
        setLoading(false);
        return;
      }

      const sessionBody = (await sessionsResponse.json()) as { sessions?: ConversationSession[] };
      let availableSessions = sessionBody.sessions ?? [];
      if (availableSessions.length === 0) {
        const createResponse = await fetch(`/api/v1/pursuits/${params.id}/conversations`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!createResponse.ok) {
          setError("Unable to start a conversation.");
          setLoading(false);
          return;
        }
        const createBody = (await createResponse.json()) as { session?: ConversationSession };
        if (createBody.session) availableSessions = [createBody.session];
      }

      setSessions(availableSessions);
      const selected = availableSessions.find((session) => session.status === "ACTIVE") ?? availableSessions[0] ?? null;
      if (selected) await loadConversation(selected.id);
      setLoading(false);
    }

    void bootstrap().catch((err) => {
      setError(err instanceof Error ? err.message : "Unable to load Stryde.");
      setLoading(false);
    });
  }, [params.id, router]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, working, result]);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Session expired. Please sign in again.");
    return token;
  }

  async function loadConversation(sessionId: string) {
    const token = await getAccessToken();
    const response = await fetch(`/api/v1/pursuits/${params.id}/conversations/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await response.json()) as { error?: string; session?: ConversationSession; messages?: ConversationMessage[] };
    if (!response.ok || !body.session) throw new Error(body.error || "Unable to load conversation");
    const loadedMessages = body.messages ?? [];
    setActiveSession(body.session);
    setMessages(loadedMessages);
    const latestStryde = [...loadedMessages].reverse().find((message) => message.role === "stryde");
    setSuggestedOptions(latestStryde?.metadata?.options ?? []);
    setReadyForReasoning(latestStryde?.metadata?.ready_for_reasoning === true);
    setResult(null);
    setError("");
  }

  async function selectSession(session: ConversationSession) {
    if (working || session.id === activeSession?.id) return;
    try {
      setLoading(true);
      await loadConversation(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load conversation");
    } finally {
      setLoading(false);
    }
  }

  async function newConversation() {
    if (working) return;
    try {
      setWorking(true);
      setError("");
      const token = await getAccessToken();
      const response = await fetch(`/api/v1/pursuits/${params.id}/conversations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as { error?: string; session?: ConversationSession };
      if (!response.ok || !body.session) throw new Error(body.error || "Unable to start a new conversation");
      setSessions((current) => [body.session!, ...current.map((session) => session.status === "ACTIVE" ? { ...session, status: "ARCHIVED" as const } : session)]);
      setActiveSession(body.session);
      setMessages([]);
      setSuggestedOptions([]);
      setReadyForReasoning(false);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start a new conversation");
    } finally {
      setWorking(false);
    }
  }

  async function sendMessage(message: string) {
    const content = message.trim();
    if (!content || working || !activeSession || archived) return;

    setWorking(true);
    setError("");
    setSuggestedOptions([]);
    setReadyForReasoning(false);
    setInput("");
    setMessages((current) => [...current, { role: "user", content }, { role: "stryde", content: "" }]);

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/v1/pursuits/${params.id}/conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: content, session_id: activeSession.id }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Stryde couldn't continue the conversation.");
      }
      if (!response.body) throw new Error("Stryde returned no response stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;

      const updateAssistant = (patch: Partial<ConversationMessage>) => {
        setMessages((current) => {
          const next = [...current];
          const index = next.length - 1;
          if (index >= 0 && next[index].role === "stryde") next[index] = { ...next[index], ...patch };
          return next;
        });
      };

      const processFrame = (frame: string) => {
        const parsed = frameToEvent(frame);
        if (!parsed) return;
        if (parsed.event === "chunk") {
          const data = parsed.data as { text?: unknown };
          if (typeof data.text === "string") {
            setMessages((current) => {
              const next = [...current];
              const index = next.length - 1;
              if (index >= 0 && next[index].role === "stryde") next[index] = { ...next[index], content: `${next[index].content}${data.text}` };
              return next;
            });
          }
        } else if (parsed.event === "done") {
          const data = parsed.data as { turn?: { message: string; question: string | null; options: ConversationOption[]; ready_for_reasoning: boolean; focus: string | null } };
          const turn = data.turn;
          if (!turn) throw new Error("Stryde returned an incomplete response");
          completed = true;
          updateAssistant({ content: turn.message, metadata: { question: turn.question, options: turn.options, ready_for_reasoning: turn.ready_for_reasoning, focus: turn.focus } });
          setSuggestedOptions(turn.options);
          setReadyForReasoning(turn.ready_for_reasoning);
          setSessions((current) => current.map((session) => session.id === activeSession.id ? { ...session, title: session.title || content.slice(0, 72), updated_at: new Date().toISOString() } : session));
        } else if (parsed.event === "error") {
          const data = parsed.data as { message?: unknown };
          throw new Error(typeof data.message === "string" ? data.message : "Conversation failed");
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseStreamFrames(buffer);
        buffer = parsed.remainder;
        for (const frame of parsed.frames) processFrame(frame);
      }
      buffer += decoder.decode();
      for (const frame of parseStreamFrames(`${buffer}\n\n`).frames) processFrame(frame);
      if (!completed) throw new Error("Stryde's response ended before completion.");
    } catch (err) {
      setMessages((current) => current.filter((message, index) => !(index === current.length - 1 && message.role === "stryde" && !message.content)));
      setError(err instanceof Error ? err.message : "Stryde couldn't continue the conversation.");
    } finally {
      setWorking(false);
    }
  }

  async function runReasoning(reasoningInput: string) {
    if (!reasoningInput.trim() || !activeSession) return;
    setWorking(true);
    setError("");
    setResult(null);
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/v1/pursuits/${params.id}/reason`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ input: reasoningInput }),
      });
      const body = (await response.json()) as { error?: string } & Partial<ReasoningResult>;
      if (!response.ok) throw new Error(body.error || "Reasoning failed.");
      setResult(body as ReasoningResult);
      setReadyForReasoning(false);
      setSuggestedOptions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reasoning failed.");
    } finally {
      setWorking(false);
    }
  }

  async function workWithWhatWeHave() {
    const transcript = messages.filter((message) => message.content.trim()).map((message) => `${message.role === "user" ? "USER" : "STRYDE"}: ${message.content}`).join("\n\n");
    await runReasoning(transcript);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function renderAssistantExtras(message: ConversationMessage, index: number) {
    if (message.role !== "stryde" || index !== messages.length - 1 || working) return null;
    const metadata = message.metadata;
    const question = metadata?.question?.trim();
    return (
      <>
        {question && !message.content.includes(question) && <p className="mt-4 font-medium text-zinc-900">{question}</p>}
        {suggestedOptions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestedOptions.map((option) => (
              <button key={`${option.label}-${option.value}`} type="button" onClick={() => void sendMessage(option.value)} className="rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50">
                {option.label}
              </button>
            ))}
          </div>
        )}
      </>
    );
  }

  if (loading && !pursuit) return <main className="min-h-screen bg-[#f7f7f8] p-8 text-sm text-zinc-500">Loading…</main>;
  if (!pursuit) return <main className="min-h-screen bg-[#f7f7f8] p-8 text-sm text-red-600">{error || "Not found."}</main>;

  return (
    <main className="min-h-screen bg-[#f7f7f8] text-zinc-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-[292px] shrink-0 flex-col border-r border-zinc-200/80 bg-[#f7f7f8] lg:flex">
          <div className="flex h-16 items-center justify-between px-5">
            <button onClick={() => router.push("/")} className="text-[15px] font-semibold tracking-tight">Stryde</button>
            <button onClick={() => void newConversation()} disabled={working} aria-label="New conversation" className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-lg text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-950 disabled:opacity-40">+</button>
          </div>

          <div className="px-3 pb-3">
            <button onClick={() => router.push("/")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-600 transition hover:bg-white hover:text-zinc-950">
              <span className="text-base">←</span>
              <span>All pursuits</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-6">
            <div className="mb-5">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Pursuits</p>
              <div className="space-y-0.5">
                {pursuits.map((item) => (
                  <button key={item.id} onClick={() => router.push(`/pursuits/${item.id}`)} className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${item.id === pursuit.id ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-600 hover:bg-white/70 hover:text-zinc-950"}`}>
                    <span className="block truncate">{item.title || "Untitled pursuit"}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Conversations</p>
              <div className="space-y-0.5">
                {sessions.map((session) => (
                  <button key={session.id} onClick={() => void selectSession(session)} className={`w-full rounded-lg px-3 py-2.5 text-left transition ${session.id === activeSession?.id ? "bg-zinc-200/70 text-zinc-950" : "text-zinc-500 hover:bg-white/80 hover:text-zinc-900"}`}>
                    <span className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${session.status === "ACTIVE" ? "bg-zinc-900" : "bg-zinc-300"}`} />
                      <span className="truncate text-[13px]">{formatSessionTitle(session)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-200/80 p-4">
            <button onClick={() => void supabase.auth.signOut().then(() => router.replace("/"))} className="text-xs text-zinc-500 hover:text-zinc-950">Sign out</button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-zinc-200/80 bg-[#f7f7f8]/90 px-4 backdrop-blur sm:px-6">
            <div className="min-w-0">
              <p className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400 sm:block">Pursuit</p>
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold sm:text-[15px]">{title}</h1>
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                <span className="shrink-0 text-xs text-zinc-400">{pursuit.status.toLowerCase()}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => void newConversation()} disabled={working} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 disabled:opacity-40">New conversation</button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl px-4 pb-44 pt-8 sm:px-8 sm:pt-10">
                {messages.length === 0 && (
                  <div className="flex min-h-[55vh] flex-col justify-center pb-12">
                    <p className="text-2xl font-semibold tracking-tight sm:text-3xl">What needs to move?</p>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">You don't need to explain it perfectly. Start wherever your thinking is, and Stryde will help make sense of the situation.</p>
                    <div className="mt-7 grid gap-2 sm:grid-cols-2">
                      {STARTING_SIGNALS.map((option) => (
                        <button key={option.label} type="button" onClick={() => void sendMessage(option.value)} disabled={working} className="rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-left text-sm text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:shadow disabled:opacity-40">
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message, index) => (
                  <div key={`${message.id ?? index}-${message.role}`} className="mb-8">
                    {message.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-900 px-4 py-3 text-[15px] leading-6 text-white shadow-sm">{message.content}</div>
                      </div>
                    ) : (
                      <div className="max-w-3xl">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Stryde</div>
                        {message.content ? (
                          <div className="whitespace-pre-wrap text-[15px] leading-7 text-zinc-800">{message.content}{working && index === messages.length - 1 && <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-zinc-400 align-middle" />}</div>
                        ) : (
                          <div className="flex items-center gap-1 py-2 text-sm text-zinc-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400 [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400 [animation-delay:240ms]" /></div>
                        )}
                        {renderAssistantExtras(message, index)}
                      </div>
                    )}
                  </div>
                ))}

                {readyForReasoning && !working && !archived && (
                  <div className="mb-8 flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 shadow-sm">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">There’s enough here to work the situation.</p>
                      <p className="mt-1 text-xs text-zinc-500">Stryde can turn the conversation into a concrete situation analysis.</p>
                    </div>
                    <button onClick={() => void workWithWhatWeHave()} className="shrink-0 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-zinc-800">Work with this</button>
                  </div>
                )}

                {archived && (
                  <div className="mb-8 rounded-xl border border-dashed border-zinc-300 bg-white/70 px-4 py-3 text-sm text-zinc-500">This conversation is archived. Start a new conversation to continue working on this Pursuit.</div>
                )}

                {result && (
                  <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Situation analysis</p>
                      <span className="text-[11px] text-zinc-400">{result.reasoning.path.toLowerCase()}</span>
                    </div>
                    <p className="mt-3 text-[15px] leading-7 text-zinc-800">{result.reasoning.understanding}</p>
                    {result.reasoning.diagnosis && <div className="mt-5 border-t border-zinc-100 pt-4"><p className="text-xs font-medium text-zinc-500">Current constraint</p><p className="mt-2 text-sm leading-6 text-zinc-700">{result.reasoning.diagnosis}</p></div>}
                    {result.reasoning.intervention && <div className="mt-5 border-t border-zinc-100 pt-4"><p className="text-xs font-medium text-zinc-500">Suggested way forward</p><p className="mt-2 text-sm leading-6 text-zinc-700">{result.reasoning.intervention.rationale}</p></div>}
                    {result.reasoning.proposed_response && <p className="mt-5 border-t border-zinc-100 pt-4 text-sm font-medium leading-6 text-zinc-950">{result.reasoning.proposed_response}</p>}
                  </div>
                )}
                <div ref={messageEndRef} />
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-200/80 bg-[#f7f7f8]/95 px-3 py-3 backdrop-blur lg:left-[292px] sm:px-6">
              <div className="mx-auto max-w-3xl">
                {error && <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
                <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-300 bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage(input);
                      }
                    }}
                    disabled={working || archived || !activeSession}
                    rows={2}
                    placeholder={archived ? "Conversation archived" : "Tell Stryde what's on your mind…"}
                    className="min-h-14 w-full resize-none bg-transparent px-2 py-1 text-[15px] leading-6 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed"
                  />
                  <div className="flex items-center justify-between gap-3 px-1.5 pt-2">
                    <p className="text-[11px] text-zinc-400">Enter to send · Shift+Enter for a new line</p>
                    <button type="submit" disabled={working || archived || !input.trim() || !activeSession} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30">Send</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
