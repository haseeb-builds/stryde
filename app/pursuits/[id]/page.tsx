"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Pursuit = { id: string; title: string | null; status: string };
type Option = { label: string; value: string };
type Message = { id?: string; role: "user" | "stryde"; content: string; metadata?: { options?: Option[]; ready_for_reasoning?: boolean } | null };
type Session = { id: string; pursuit_id: string; title: string | null; status: "ACTIVE" | "ARCHIVED"; created_at: string; updated_at: string };
type ReasoningResult = { reasoning: { path: string; understanding: string; diagnosis: string | null; intervention: { kind: string; rationale: string } | null; proposed_response: string | null } };

const STARTERS: Option[] = [
  { label: "I don't know what to do next", value: "I don't know what to do next." },
  { label: "I'm stuck on something", value: "I know what I want, but I'm stuck on something." },
  { label: "I need to make a decision", value: "I need to make a decision and I'm not sure how to evaluate the options." },
  { label: "I'm not sure what's going on", value: "I'm not sure what's actually going on yet." },
];

function sessionLabel(session: Session) {
  return session.title?.trim() || (session.status === "ACTIVE" ? "Current conversation" : "Untitled conversation");
}

export default function PursuitPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [pursuit, setPursuit] = useState<Pursuit | null>(null);
  const [pursuits, setPursuits] = useState<Pursuit[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reasoning, setReasoning] = useState<ReasoningResult | null>(null);

  const title = useMemo(() => pursuit?.title || "Untitled pursuit", [pursuit]);

  useEffect(() => {
    void bootstrap();
  }, [params.id]);

  async function token() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/");
      throw new Error("Session expired. Please sign in again.");
    }
    return data.session.access_token;
  }

  async function bootstrap() {
    try {
      setLoading(true);
      setError("");
      const accessToken = await token();
      const [{ data: pursuitData, error: pursuitError }, pursuitsResponse, sessionsResponse] = await Promise.all([
        supabase.from("pursuit").select("id, title, status").eq("id", params.id).single(),
        fetch("/api/v1/pursuits", { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`/api/v1/pursuits/${params.id}/conversations`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);

      if (pursuitError || !pursuitData) throw new Error("Pursuit not found.");
      setPursuit(pursuitData as Pursuit);

      if (pursuitsResponse.ok) {
        const body = (await pursuitsResponse.json()) as { pursuits?: Pursuit[] };
        setPursuits(body.pursuits ?? []);
      }

      if (!sessionsResponse.ok) throw new Error("Unable to load conversation history.");
      const body = (await sessionsResponse.json()) as { sessions?: Session[] };
      let available = body.sessions ?? [];
      if (!available.length) {
        const response = await fetch(`/api/v1/pursuits/${params.id}/conversations`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
        const createBody = (await response.json()) as { session?: Session; error?: string };
        if (!response.ok || !createBody.session) throw new Error(createBody.error || "Unable to start conversation.");
        available = [createBody.session];
      }
      setSessions(available);
      const active = available.find((item) => item.status === "ACTIVE") ?? available[0];
      await openSession(active.id, accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Stryde.");
    } finally {
      setLoading(false);
    }
  }

  async function openSession(sessionId: string, accessToken?: string) {
    const access = accessToken ?? (await token());
    const response = await fetch(`/api/v1/pursuits/${params.id}/conversations/${sessionId}`, { headers: { Authorization: `Bearer ${access}` } });
    const body = (await response.json()) as { session?: Session; messages?: Message[]; error?: string };
    if (!response.ok || !body.session) throw new Error(body.error || "Unable to load conversation.");
    const loaded = body.messages ?? [];
    const lastAssistant = [...loaded].reverse().find((item) => item.role === "stryde");
    setSession(body.session);
    setMessages(loaded);
    setOptions(lastAssistant?.metadata?.options ?? []);
    setReady(lastAssistant?.metadata?.ready_for_reasoning === true);
    setReasoning(null);
    setError("");
  }

  async function selectConversation(item: Session) {
    if (working) return;
    try {
      await openSession(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load conversation.");
    }
  }

  async function newConversation() {
    if (working) return;
    try {
      setWorking(true);
      const access = await token();
      const response = await fetch(`/api/v1/pursuits/${params.id}/conversations`, { method: "POST", headers: { Authorization: `Bearer ${access}` } });
      const body = (await response.json()) as { session?: Session; error?: string };
      if (!response.ok || !body.session) throw new Error(body.error || "Unable to start a new conversation.");
      setSessions((current) => [body.session!, ...current.map((item) => item.status === "ACTIVE" ? { ...item, status: "ARCHIVED" as const } : item)]);
      setSession(body.session);
      setMessages([]);
      setOptions([]);
      setReady(false);
      setReasoning(null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start a new conversation.");
    } finally {
      setWorking(false);
    }
  }

  async function sendMessage(text: string) {
    const content = text.trim();
    if (!content || working || !session || session.status !== "ACTIVE") return;
    setWorking(true);
    setError("");
    setOptions([]);
    setReady(false);
    setReasoning(null);
    setMessages((current) => [...current, { role: "user", content }]);
    setInput("");

    try {
      const access = await token();
      const response = await fetch(`/api/v1/pursuits/${params.id}/conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
        body: JSON.stringify({ message: content, session_id: session.id }),
      });
      const body = (await response.json()) as { turn?: { message: string; question: string | null; options: Option[]; ready_for_reasoning: boolean }; error?: string };
      if (!response.ok || !body.turn) throw new Error(body.error || "Stryde couldn't continue the conversation.");
      const turn = body.turn;
      setMessages((current) => [...current, { role: "stryde", content: turn.message, metadata: { options: turn.options, ready_for_reasoning: turn.ready_for_reasoning } }]);
      setOptions(turn.options);
      setReady(turn.ready_for_reasoning);
      setSessions((current) => current.map((item) => item.id === session.id ? { ...item, title: item.title || content.slice(0, 72), updated_at: new Date().toISOString() } : item));
      setSession((current) => current ? { ...current, title: current.title || content.slice(0, 72), updated_at: new Date().toISOString() } : current);
    } catch (err) {
      setMessages((current) => current.slice(0, -1));
      setError(err instanceof Error ? err.message : "Stryde couldn't continue the conversation.");
    } finally {
      setWorking(false);
    }
  }

  async function workWithWhatWeHave() {
    const transcript = messages.filter((item) => item.content.trim()).map((item) => `${item.role === "user" ? "USER" : "STRYDE"}: ${item.content}`).join("\n\n");
    if (!transcript) return;
    setWorking(true);
    try {
      const access = await token();
      const response = await fetch(`/api/v1/pursuits/${params.id}/reason`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
        body: JSON.stringify({ input: transcript }),
      });
      const raw = await response.text();
      let body: ({ error?: string } & Partial<ReasoningResult>) | null = null;
      try {
        body = raw ? (JSON.parse(raw) as { error?: string } & Partial<ReasoningResult>) : null;
      } catch {
        throw new Error(raw.trim() || `Reasoning failed (HTTP ${response.status}).`);
      }
      if (!response.ok) throw new Error(body?.error || raw.trim() || `Reasoning failed (HTTP ${response.status}).`);
      if (!body?.reasoning) throw new Error("Reasoning returned an incomplete response.");
      setReasoning(body as ReasoningResult);
      setReady(false);
      setOptions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reasoning failed.");
    } finally {
      setWorking(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  if (loading && !pursuit) return <main className="min-h-screen bg-[#f7f7f8] p-8 text-sm text-zinc-500">Loading…</main>;
  if (!pursuit) return <main className="min-h-screen bg-[#f7f7f8] p-8 text-sm text-red-600">{error || "Not found."}</main>;

  return (
    <main className="min-h-screen bg-[#f7f7f8] text-zinc-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-zinc-200/80 bg-[#f7f7f8] lg:flex">
          <div className="flex h-16 items-center justify-between px-5">
            <button onClick={() => router.push("/")} className="text-[15px] font-semibold tracking-tight">Stryde</button>
            <button onClick={() => void newConversation()} disabled={working} aria-label="New conversation" className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-lg text-zinc-500 hover:text-zinc-950 disabled:opacity-40">+</button>
          </div>
          <div className="px-3 pb-4">
            <button onClick={() => router.push("/")} className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-600 hover:bg-white hover:text-zinc-950">← All pursuits</button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-6">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Pursuits</p>
            <div className="space-y-1">
              {pursuits.map((item) => <button key={item.id} onClick={() => router.push(`/pursuits/${item.id}`)} className={`w-full truncate rounded-lg px-3 py-2.5 text-left text-sm ${item.id === pursuit.id ? "bg-white shadow-sm" : "text-zinc-600 hover:bg-white/70"}`}>{item.title || "Untitled pursuit"}</button>)}
            </div>
            <p className="mt-6 px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Conversations</p>
            <div className="space-y-1">
              {sessions.map((item) => <button key={item.id} onClick={() => void selectConversation(item)} className={`w-full truncate rounded-lg px-3 py-2.5 text-left text-[13px] ${item.id === session?.id ? "bg-zinc-200/70" : "text-zinc-500 hover:bg-white/80"}`}>{sessionLabel(item)}</button>)}
            </div>
          </div>
          <div className="border-t border-zinc-200/80 p-4"><button onClick={() => void supabase.auth.signOut().then(() => router.replace("/"))} className="text-xs text-zinc-500 hover:text-zinc-950">Sign out</button></div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-zinc-200/80 bg-[#f7f7f8]/90 px-4 backdrop-blur sm:px-6">
            <div className="min-w-0"><p className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400 sm:block">Pursuit</p><div className="flex items-center gap-2"><h1 className="truncate text-sm font-semibold sm:text-[15px]">{title}</h1><span className="h-1.5 w-1.5 rounded-full bg-zinc-300" /><span className="text-xs text-zinc-400">{pursuit.status.toLowerCase()}</span></div></div>
            <button onClick={() => void newConversation()} disabled={working} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:border-zinc-300 disabled:opacity-40">New conversation</button>
          </header>

          <div className="flex-1 overflow-y-auto"><div className="mx-auto w-full max-w-3xl px-4 pb-40 pt-10 sm:px-8">
            {messages.length === 0 ? <div className="flex min-h-[58vh] flex-col justify-center"><h2 className="text-3xl font-semibold tracking-tight">What needs to move?</h2><p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">You don't need to explain it perfectly. Start wherever your thinking is.</p><div className="mt-7 grid gap-2 sm:grid-cols-2">{STARTERS.map((item) => <button key={item.label} onClick={() => void sendMessage(item.value)} disabled={working} className="rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-left text-sm text-zinc-700 shadow-sm hover:border-zinc-300 disabled:opacity-40">{item.label}</button>)}</div></div> : messages.map((item, index) => <div key={`${item.id ?? index}-${item.role}`} className="mb-8">{item.role === "user" ? <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-900 px-4 py-3 text-[15px] leading-6 text-white">{item.content}</div></div> : <div className="max-w-3xl"><div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Stryde</div><div className="whitespace-pre-wrap text-[15px] leading-7 text-zinc-800">{item.content}</div>{index === messages.length - 1 && options.length > 0 && !working && <div className="mt-4 flex flex-wrap gap-2">{options.map((option) => <button key={`${option.label}-${option.value}`} onClick={() => void sendMessage(option.value)} className="rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-700 hover:border-zinc-400">{option.label}</button>)}</div>}</div>}</div>)}
            {working && <div className="mb-8 text-sm text-zinc-400">Stryde is thinking…</div>}
            {ready && !working && <div className="mb-8 flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 shadow-sm"><div><p className="text-sm font-medium">There’s enough here to work the situation.</p><p className="mt-1 text-xs text-zinc-500">Turn this conversation into a concrete situation analysis.</p></div><button onClick={() => void workWithWhatWeHave()} className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white">Work with this</button></div>}
            {reasoning && <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Situation analysis</p><p className="mt-3 text-[15px] leading-7 text-zinc-800">{reasoning.reasoning.understanding}</p>{reasoning.reasoning.diagnosis && <div className="mt-5 border-t border-zinc-100 pt-4"><p className="text-xs font-medium text-zinc-500">Current constraint</p><p className="mt-2 text-sm leading-6 text-zinc-700">{reasoning.reasoning.diagnosis}</p></div>}{reasoning.reasoning.intervention && <div className="mt-5 border-t border-zinc-100 pt-4"><p className="text-xs font-medium text-zinc-500">Suggested way forward</p><p className="mt-2 text-sm leading-6 text-zinc-700">{reasoning.reasoning.intervention.rationale}</p></div>}{reasoning.reasoning.proposed_response && <p className="mt-5 border-t border-zinc-100 pt-4 text-sm font-medium">{reasoning.reasoning.proposed_response}</p>}</div>}
            {error && <div className="mb-8 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          </div></div>

          <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-200/80 bg-[#f7f7f8]/95 px-3 py-3 backdrop-blur lg:left-72 sm:px-6"><div className="mx-auto max-w-3xl"><form onSubmit={submit} className="rounded-2xl border border-zinc-300 bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(input); } }} rows={2} disabled={working || session?.status !== "ACTIVE"} placeholder={session?.status === "ACTIVE" ? "Tell Stryde what's on your mind…" : "Conversation archived"} className="min-h-14 w-full resize-none bg-transparent px-2 py-1 text-[15px] leading-6 outline-none placeholder:text-zinc-400"/><div className="flex items-center justify-between px-1.5 pt-2"><span className="text-[11px] text-zinc-400">Enter to send · Shift+Enter for a new line</span><button type="submit" disabled={working || !input.trim() || session?.status !== "ACTIVE"} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white disabled:opacity-30">Send</button></div></form></div></div>
        </section>
      </div>
    </main>
  );
}
