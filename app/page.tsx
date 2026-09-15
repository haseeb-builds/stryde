"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Pursuit = { id: string; title: string | null; status: string };

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [pursuits, setPursuits] = useState<Pursuit[]>([]);
  const [sessionReady, setSessionReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadPursuits() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setSessionReady(false);
      return;
    }
    setSessionReady(true);
    const response = await fetch("/api/v1/pursuits", { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const body = (await response.json()) as { pursuits?: Pursuit[] };
    setPursuits(body.pursuits ?? []);
  }

  useEffect(() => {
    void loadPursuits();
    const { data } = supabase.auth.onAuthStateChange(() => { void loadPursuits(); });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(""); setMessage("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) setError(authError.message);
    else { setMessage("Signed in."); await loadPursuits(); }
    setLoading(false);
  }

  async function signUp() {
    setLoading(true); setError(""); setMessage("");
    const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password });
    if (authError) setError(authError.message);
    else setMessage(data.session ? "Account created." : "Account created. Check your email to confirm it.");
    setLoading(false);
  }

  async function createPursuit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setLoading(true); setError(""); setMessage("");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setError("Please sign in first."); setLoading(false); return; }
    const response = await fetch("/api/v1/pursuits", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: title.trim() }),
    });
    const body = (await response.json()) as { pursuit?: Pursuit; error?: string };
    if (!response.ok || !body.pursuit) setError(body.error || "Unable to create pursuit.");
    else { setTitle(""); setPursuits((current) => [body.pursuit!, ...current]); router.push(`/pursuits/${body.pursuit.id}`); }
    setLoading(false);
  }

  async function signOut() { await supabase.auth.signOut(); setPursuits([]); setSessionReady(false); }

  if (!sessionReady) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-950">
        <div className="mx-auto max-w-md space-y-8">
          <header className="space-y-3"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Stryde</p><h1 className="text-4xl font-semibold tracking-tight">What needs to move?</h1><p className="text-zinc-500">A persistent intelligence layer for understanding situations and moving real work forward.</p></header>
          <form onSubmit={signIn} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-zinc-300 px-4 py-3" required />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-xl border border-zinc-300 px-4 py-3" required minLength={6} />
            <button disabled={loading} className="w-full rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-40">{loading ? "Working…" : "Sign in"}</button>
            <button type="button" disabled={loading || !email || !password} onClick={() => void signUp()} className="w-full rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium disabled:opacity-40">Create account</button>
            {error && <p className="text-sm text-red-600">{error}</p>}{message && <p className="text-sm text-zinc-600">{message}</p>}
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="flex items-start justify-between gap-6"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Stryde</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">What needs to move?</h1><p className="mt-2 text-zinc-500">Start with a real outcome. Stryde will help you work the situation.</p></div><button onClick={() => void signOut()} className="text-sm text-zinc-500">Sign out</button></header>
        <form onSubmit={createPursuit} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Land my first AI-native operations client" className="w-full rounded-xl border border-zinc-300 px-4 py-4 text-lg outline-none focus:border-zinc-950"/><button disabled={loading || !title.trim()} className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40">Start pursuit</button>{error && <p className="text-sm text-red-600">{error}</p>}</form>
        <section className="space-y-3"><p className="text-sm font-medium text-zinc-500">Active pursuits</p>{pursuits.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-sm text-zinc-500">No pursuits yet. Start with something real.</div> : pursuits.map((pursuit) => <button key={pursuit.id} onClick={() => router.push(`/pursuits/${pursuit.id}`)} className="block w-full rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm hover:border-zinc-400"><p className="font-medium">{pursuit.title || "Untitled pursuit"}</p><p className="mt-1 text-xs text-zinc-500">{pursuit.status}</p></button>)}</section>
      </div>
    </main>
  );
}
