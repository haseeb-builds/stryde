"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { consumeConversationStream } from "@/lib/conversation-client-stream";
import type { WorkingState } from "@/lib/work-controller";
import PursuitWorkPanels from "./work-panels";
import PursuitClaimsPanel from "./claims-panel";
import PursuitMemoryPanel from "./memory-panel";
import PursuitAutonomyRow from "./autonomy-row";

type Pursuit = { id: string; title: string | null; status: string };
type Option = { label: string; value: string };

type Message = {
  id?: string;
  role: "user" | "stryde";
  content: string;
  metadata?: {
    options?: Option[];
    question?: string | null;
    ready_for_reasoning?: boolean;
    focus?: string | null;
    work?: WorkingState | null;
    [key: string]: unknown;
  } | null;
};

type Session = {
  id: string;
  pursuit_id: string;
  title: string | null;
  status: "ACTIVE" | "ARCHIVED";
  working_state: WorkingState | null;
  created_at: string;
  updated_at: string;
};

type ActionReportState = {
  actionId: string;
  terminalStatus: "COMPLETED" | "FAILED";
};

type ActiveAction = {
  id: string;
  execution_mode: "HUMAN" | "CONTROLLED";
  intent_summary: string;
  status: string;
};

type VoiceRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{ length: number; [index: number]: { transcript?: unknown } }>;
};

type VoiceRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type VoiceRecognitionConstructor = new () => VoiceRecognition;

declare global {
  interface Window {
    SpeechRecognition?: VoiceRecognitionConstructor;
    webkitSpeechRecognition?: VoiceRecognitionConstructor;
  }
}

function statusLabel(status: WorkingState["status"]) {
  return status.replaceAll("_", " ").toLowerCase();
}

function moveActorLabel(actor: NonNullable<WorkingState["next_move"]>["actor"]) {
  if (actor === "HUMAN") return "You";
  if (actor === "WORKER") return "Assigned worker";
  if (actor === "CONTROLLED_TOOL") return "Connected capability";
  return "Stryde";
}

function moveModeLabel(mode: NonNullable<WorkingState["next_move"]>["mode"]) {
  return mode.replaceAll("_", " ").toLowerCase();
}

export default function PursuitPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [pursuit, setPursuit] = useState<Pursuit | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [pursuits, setPursuits] = useState<Pursuit[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [workingState, setWorkingState] = useState<WorkingState | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionReport, setActionReport] = useState<ActionReportState | null>(null);
  const [listening, setListening] = useState(false);
  const [fileNotice, setFileNotice] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const voiceRef = useRef<VoiceRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const title = useMemo(() => pursuit?.title || "Untitled pursuit", [pursuit]);

  const token = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/");
      throw new Error("Session expired. Please sign in again.");
    }
    return data.session.access_token;
  }, [router]);

  const loadActiveAction = useCallback(async (accessToken?: string) => {
    const access = accessToken ?? (await token());
    const response = await fetch(
      "/api/v1/pursuits/" + params.id + "/actions?status=IN_PROGRESS",
      { headers: { Authorization: "Bearer " + access } },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { actions?: ActiveAction[] };
    const action = body.actions?.[0] ?? null;
    setActiveAction(action);
    return action;
  }, [params.id, token]);

  const openSession = useCallback(async (sessionId: string, accessToken?: string) => {
    const access = accessToken ?? (await token());
    const response = await fetch(
      "/api/v1/pursuits/" + params.id + "/conversations/" + sessionId,
      { headers: { Authorization: "Bearer " + access } },
    );
    const body = (await response.json()) as {
      session?: Session;
      messages?: Message[];
      error?: string;
    };

    if (!response.ok || !body.session) {
      throw new Error(body.error || "Unable to load conversation.");
    }

    const loaded = body.messages ?? [];
    const lastAssistant = [...loaded].reverse().find((item) => item.role === "stryde");
    const restoredWork = body.session.working_state ?? lastAssistant?.metadata?.work ?? null;

    setSession(body.session);
    setMessages(loaded);
    setWorkingState(restoredWork);
    setError("");
    await loadActiveAction(access);
  }, [loadActiveAction, params.id, token]);

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const accessToken = await token();

      const [
        pursuitResult,
        pursuitsResponse,
        sessionsResponse,
      ] = await Promise.all([
        supabase
          .from("pursuit")
          .select("id, title, status")
          .eq("id", params.id)
          .single(),
        fetch("/api/v1/pursuits", {
          headers: { Authorization: "Bearer " + accessToken },
        }),
        fetch("/api/v1/pursuits/" + params.id + "/conversations", {
          headers: { Authorization: "Bearer " + accessToken },
        }),
      ]);

      if (pursuitResult.error || !pursuitResult.data) {
        throw new Error("Pursuit not found.");
      }

      setPursuit(pursuitResult.data as Pursuit);

      if (pursuitsResponse.ok) {
        const body = (await pursuitsResponse.json()) as { pursuits?: Pursuit[] };
        setPursuits(body.pursuits ?? []);
      }

      if (!sessionsResponse.ok) {
        throw new Error("Unable to load conversation.");
      }

      const body = (await sessionsResponse.json()) as { sessions?: Session[] };
      const available = body.sessions ?? [];

      if (!available.length) {
        const response = await fetch("/api/v1/pursuits/" + params.id + "/conversations", {
          method: "POST",
          headers: { Authorization: "Bearer " + accessToken },
        });
        const createBody = (await response.json()) as { session?: Session; error?: string };
        if (!response.ok || !createBody.session) {
          throw new Error(createBody.error || "Unable to start Stryde.");
        }
        await openSession(createBody.session.id, accessToken);
      } else {
        const active = available.find((item) => item.status === "ACTIVE") ?? available[0];
        await openSession(active.id, accessToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Stryde.");
    } finally {
      setLoading(false);
    }
  }, [openSession, params.id, token]);

  useEffect(() => {
    void Promise.resolve().then(bootstrap);
  }, [bootstrap]);

  async function newConversation() {
    if (working) return;

    try {
      setWorking(true);
      const access = await token();
      const response = await fetch("/api/v1/pursuits/" + params.id + "/conversations", {
        method: "POST",
        headers: { Authorization: "Bearer " + access },
      });
      const body = (await response.json()) as { session?: Session; error?: string };

      if (!response.ok || !body.session) {
        throw new Error(body.error || "Unable to start a new conversation.");
      }

      setSession(body.session);
      setMessages([]);
      setWorkingState(null);
      setActiveAction(null);
      setActionReport(null);
      setInput("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start a new conversation.");
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    return () => {
      voiceRef.current?.stop();
      voiceRef.current = null;
    };
  }, []);

  const voiceSupported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (actionReport) {
      window.setTimeout(() => composerRef.current?.focus(), 0);
    }
  }, [actionReport]);

  function toggleVoice() {
    if (listening) {
      voiceRef.current?.stop();
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
      setError("Voice input is not available in this browser.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event) => {
      const spokenParts: string[] = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index]?.[0]?.transcript;
        if (typeof transcript === "string" && transcript.trim()) {
          spokenParts.push(transcript.trim());
        }
      }

      const spoken = spokenParts.join(" ").trim();
      if (spoken) {
        setInput((current) => [current.trim(), spoken].filter(Boolean).join(" "));
      }
    };

    recognition.onerror = () => {
      setListening(false);
      voiceRef.current = null;
      setError("Voice input stopped.");
    };

    recognition.onend = () => {
      setListening(false);
      voiceRef.current = null;
    };

    voiceRef.current = recognition;
    setListening(true);
    setError("");
    recognition.start();
  }

  async function recomputeWork() {
    if (working || !session || session.status !== "ACTIVE") return;

    setWorking(true);
    setError("");

    try {
      const access = await token();
      const response = await fetch("/api/v1/pursuits/" + params.id + "/work", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + access,
        },
        body: JSON.stringify({ session_id: session.id }),
      });

      const body = (await response.json()) as {
        working_state?: WorkingState;
        autonomous_research?: {
          query?: string;
          provider?: string;
          results?: unknown[];
        } | null;
        error?: string;
      };

      if (!response.ok || !body.working_state) {
        throw new Error(body.error || "Stryde couldn't reassess this pursuit.");
      }

      setWorkingState(body.working_state);
      setSession((current) =>
        current
          ? {
              ...current,
              working_state: body.working_state!,
              updated_at: new Date().toISOString(),
            }
          : current,
      );

      await loadActiveAction(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stryde couldn't reassess this pursuit.");
    } finally {
      setWorking(false);
    }
  }

  async function startCurrentAction() {
    if (working || !session || session.status !== "ACTIVE" || !workingState?.next_move) return;

    const move = workingState.next_move;

    setWorking(true);
    setError("");

    try {
      const access = await token();
      const response =
        move.actor === "WORKER"
          ? await fetch("/api/v1/pursuits/" + params.id + "/actions/delegate-worker", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + access,
              },
              body: JSON.stringify({
                session_id: session.id,
                approved: true,
              }),
            })
          : await fetch("/api/v1/pursuits/" + params.id + "/actions/start", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + access,
              },
              body: JSON.stringify({
                session_id: session.id,
                approved: true,
              }),
            });

      const body = (await response.json()) as {
        action?: ActiveAction;
        working_state?: WorkingState;
        delegated?: boolean;
        error?: string;
      };

      if (!response.ok || !body.action) {
        throw new Error(body.error || "Stryde couldn't start this move.");
      }

      setActiveAction(body.action);

      if (body.working_state) {
        setWorkingState(body.working_state);
        setSession((current) =>
          current
            ? {
                ...current,
                working_state: body.working_state!,
                updated_at: new Date().toISOString(),
              }
            : current,
        );
      } else {
        await recomputeWork();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stryde couldn't start this move.");
    } finally {
      setWorking(false);
    }
  }

  async function attachFile(file: File) {
    if (working || uploadingFile || session?.status !== "ACTIVE") return;

    setUploadingFile(true);
    setFileNotice("Adding " + file.name + "…");

    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error(file.name + " is larger than the 10 MB source limit.");
      }

      const access = await token();
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/v1/pursuits/" + params.id + "/sources", {
        method: "POST",
        headers: { Authorization: "Bearer " + access },
        body: form,
      });

      const body = (await response.json()) as {
        source?: { title: string | null };
        warning?: string | null;
        error?: string;
      };

      if (!response.ok || !body.source) {
        throw new Error(body.error || "Stryde could not read that file.");
      }

      setFileNotice(
        "Added " + (body.source.title ?? file.name) + " to this pursuit's source material." +
          (body.warning ? " " + body.warning : ""),
      );
    } catch (err) {
      setFileNotice(err instanceof Error ? err.message : "Stryde could not read that file.");
    } finally {
      setUploadingFile(false);
    }
  }

  async function sendMessage(text: string) {
    const content = text.trim();

    if (!content || working || !session || session.status !== "ACTIVE") return;

    if (actionReport) {
      setWorking(true);
      setError("");
      setInput("");

      try {
        const access = await token();
        const response = await fetch(
          "/api/v1/pursuits/" +
            params.id +
            "/actions/" +
            actionReport.actionId +
            "/complete",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + access,
            },
            body: JSON.stringify({
              session_id: session.id,
              terminal_status: actionReport.terminalStatus,
              report: content,
              turn_key: crypto.randomUUID(),
            }),
          },
        );

        const body = (await response.json()) as {
          working_state?: WorkingState | null;
          assistant_message?: string;
          metadata?: Message["metadata"];
          error?: string;
        };

        if (!response.ok || !body.working_state || !body.assistant_message) {
          throw new Error(body.error || "Stryde could not record what happened.");
        }

        setMessages((current) => [
          ...current,
          { role: "user", content },
          {
            role: "stryde",
            content: body.assistant_message!,
            metadata: body.metadata ?? undefined,
          },
        ]);
        setWorkingState(body.working_state);
        setSession((current) =>
          current
            ? {
                ...current,
                working_state: body.working_state!,
                updated_at: new Date().toISOString(),
              }
            : current,
        );
        setActionReport(null);
        setActiveAction(null);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Stryde could not record what happened.");
      } finally {
        setWorking(false);
      }

      return;
    }

    setWorking(true);
    setError("");
    setInput("");

    setMessages((current) => [...current, { role: "user", content }]);
    // Unique per turn: a reused constant id would collide with the previous
    // turn's committed placeholder and overwrite its bubble on the next stream.
    const assistantId = "streaming-" + crypto.randomUUID();

    setMessages((current) => [
      ...current,
      { id: assistantId, role: "stryde", content: "" },
    ]);

    try {
      const access = await token();
      const response = await fetch("/api/v1/pursuits/" + params.id + "/conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + access,
        },
        body: JSON.stringify({
          message: content,
          session_id: session.id,
          turn_key: crypto.randomUUID(),
        }),
      });

      type ConversationResponse = {
        turn?: {
          message: string;
          question: string | null;
          options: Option[];
          ready_for_reasoning: boolean;
          focus: string | null;
          memory_candidates?: unknown[];
          work: WorkingState;
        };
        error?: string;
      };

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ConversationResponse;
        throw new Error(body.error || "Stryde couldn't continue.");
      }

      const turn = await consumeConversationStream<
        NonNullable<ConversationResponse["turn"]>
      >(
        response,
        (delta) =>
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId
                ? { ...item, content: item.content + delta }
                : item,
            ),
          ),
        () => undefined,
      );

      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content: turn.message,
                metadata: {
                  options: turn.options,
                  question: turn.question,
                  ready_for_reasoning: turn.ready_for_reasoning,
                  focus: turn.focus,
                  work: turn.work,
                },
              }
            : item,
        ),
      );

      setWorkingState(turn.work);

      setSession((current) =>
        current
          ? {
              ...current,
              title: current.title || content.slice(0, 72),
              updated_at: new Date().toISOString(),
              working_state: turn.work,
            }
          : current,
      );

      setMessages((current) =>
        current.filter(
          (item) =>
            !(item.id === assistantId && !item.content.trim()),
        ),
      );

      if (turn.work.next_move?.mode === "RESEARCH_WEB" && turn.work.next_move.actor === "STRYDE") {
        setWorking(false);
        await recomputeWork();
      } else {
        setWorking(false);
      }
    } catch (err) {
      setMessages((current) => current.filter((item) => item.id !== assistantId));
      setError(err instanceof Error ? err.message : "Stryde couldn't continue.");
      setWorking(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  if (loading && !pursuit) {
    return (
      <main className="min-h-screen bg-[#f7f7f8] p-8 text-sm text-zinc-500">
        Loading…
      </main>
    );
  }

  if (!pursuit) {
    return (
      <main className="min-h-screen bg-[#f7f7f8] p-8 text-sm text-red-600">
        {error || "Not found."}
      </main>
    );
  }

  const currentMove = workingState?.next_move ?? null;
  const hasMessages = messages.some((message) => message.content.trim());

  return (
    <main className="min-h-screen bg-[#f7f7f8] text-zinc-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200/80 bg-[#f7f7f8] lg:flex">
          <div className="flex h-16 items-center justify-between px-5">
            <button
              onClick={() => router.push("/")}
              className="text-[15px] font-semibold tracking-tight"
            >
              Stryde
            </button>
            <button
              onClick={() => void newConversation()}
              disabled={working}
              aria-label="Start a fresh conversation"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-lg text-zinc-500 hover:text-zinc-950 disabled:opacity-40"
            >
              +
            </button>
          </div>

          <div className="px-3 pb-4">
            <button
              onClick={() => router.push("/")}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-600 hover:bg-white hover:text-zinc-950"
            >
              ← All pursuits
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-6">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Pursuits
            </p>
            <div className="space-y-1">
              {pursuits.map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push("/pursuits/" + item.id)}
                  className={
                    "w-full truncate rounded-lg px-3 py-2.5 text-left text-sm " +
                    (item.id === pursuit.id
                      ? "bg-white shadow-sm"
                      : "text-zinc-600 hover:bg-white/70")
                  }
                >
                  {item.title || "Untitled pursuit"}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-200/80 p-4">
            <button
              onClick={() =>
                void supabase.auth.signOut().then(() => router.replace("/"))
              }
              className="text-xs text-zinc-500 hover:text-zinc-950"
            >
              Sign out
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-zinc-200/80 bg-[#f7f7f8]/90 px-4 backdrop-blur sm:px-6">
            <div className="min-w-0">
              <p className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400 sm:block">
                Pursuit
              </p>
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold sm:text-[15px]">
                  {title}
                </h1>
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                <span className="text-xs text-zinc-400">
                  {pursuit.status.toLowerCase()}
                </span>
              </div>
            </div>

            <button
              onClick={() => void newConversation()}
              disabled={working}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:border-zinc-300 disabled:opacity-40"
            >
              New
            </button>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 pb-40 pt-10 sm:px-8">
              {messages.length === 0 ? (
                <div className="flex min-h-[58vh] flex-col justify-center">
                  <h2 className="text-3xl font-semibold tracking-tight">
                    What needs to move?
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">
                    Start with the thing that matters. It does not need to be
                    explained perfectly.
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((item, index) => (
                    <div
                      key={(item.id || String(index)) + "-" + item.role}
                      className="mb-8"
                    >
                      {item.role === "user" ? (
                        <div className="flex justify-end">
                          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-900 px-4 py-3 text-[15px] leading-6 text-white">
                            {item.content}
                          </div>
                        </div>
                      ) : (
                        <div className="max-w-3xl">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                            Stryde
                          </div>
                          <div className="whitespace-pre-wrap text-[15px] leading-7 text-zinc-800">
                            {item.content}
                          </div>

                          {index === messages.length - 1 &&
                            item.metadata?.options &&
                            item.metadata.options.length > 0 &&
                            !working && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {item.metadata.options.map((option) => (
                                  <button
                                    key={option.label + "-" + option.value}
                                    onClick={() => void sendMessage(option.value)}
                                    className="rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-700 hover:border-zinc-400"
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  ))}

                  {working && (
                    <div className="mb-8 text-sm text-zinc-400">
                      Stryde is working through it…
                    </div>
                  )}

                  {activeAction && !actionReport && !working && (
                    <section className="mb-8 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                            {activeAction.execution_mode === "CONTROLLED"
                              ? "Stryde is working"
                              : "Your move"}
                          </p>
                          <h3 className="mt-2 text-[17px] font-medium tracking-tight">
                            {activeAction.intent_summary}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-zinc-600">
                            {activeAction.execution_mode === "CONTROLLED"
                              ? "Stryde will bring the result back into this pursuit."
                              : "Do the real-world part, then tell Stryde what happened in the same composer."}
                          </p>
                        </div>

                        {activeAction.execution_mode === "HUMAN" && (
                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() => {
                                setActionReport({
                                  actionId: activeAction.id,
                                  terminalStatus: "COMPLETED",
                                });
                                window.setTimeout(
                                  () => composerRef.current?.focus(),
                                  0,
                                );
                              }}
                              className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white"
                            >
                              I’m done
                            </button>
                            <button
                              onClick={() => {
                                setActionReport({
                                  actionId: activeAction.id,
                                  terminalStatus: "FAILED",
                                });
                                window.setTimeout(
                                  () => composerRef.current?.focus(),
                                  0,
                                );
                              }}
                              className="rounded-lg border border-zinc-200 px-3.5 py-2 text-xs font-medium text-zinc-700"
                            >
                              I’m blocked
                            </button>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {workingState && currentMove && !activeAction && !working && (
                    <section className="mb-8 rounded-2xl border border-zinc-200 bg-white shadow-sm">
                      <div className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                            What matters now
                          </p>
                          <span className="text-[11px] text-zinc-400">
                            {statusLabel(workingState.status)} ·{" "}
                            {moveModeLabel(currentMove.mode)} ·{" "}
                            {moveActorLabel(currentMove.actor)}
                          </span>
                        </div>
                        <h3 className="mt-2 text-[17px] font-medium tracking-tight">
                          {currentMove.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-zinc-600">
                          {currentMove.why}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {currentMove.actor === "HUMAN" &&
                            currentMove.mode === "CREATE_ACTION" && (
                              <button
                                onClick={() => void startCurrentAction()}
                                className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white"
                              >
                                Start this
                              </button>
                            )}

                          {currentMove.actor === "WORKER" && (
                            <button
                              onClick={() => void startCurrentAction()}
                              className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white"
                            >
                              Delegate
                            </button>
                          )}

                          {currentMove.mode === "ASK_USER" && (
                            <button
                              onClick={() => composerRef.current?.focus()}
                              className="rounded-lg border border-zinc-200 px-3.5 py-2 text-xs font-medium text-zinc-700"
                            >
                              Tell Stryde
                            </button>
                          )}

                          {currentMove.mode !== "CREATE_ACTION" &&
                            currentMove.mode !== "ASK_USER" &&
                            currentMove.mode !== "RESEARCH_WEB" &&
                            currentMove.actor !== "WORKER" && (
                              <button
                                onClick={() => void recomputeWork()}
                                className="rounded-lg border border-zinc-200 px-3.5 py-2 text-xs font-medium text-zinc-700"
                              >
                                Reassess
                              </button>
                            )}

                          <details className="basis-full border-t border-zinc-100 pt-3">
                            <summary className="cursor-pointer text-xs font-medium text-zinc-500">
                              Why Stryde currently sees it this way
                            </summary>
                            <div className="mt-4 grid gap-5 sm:grid-cols-2">
                              <div>
                                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                                  Understanding
                                </p>
                                <p className="mt-2 text-sm leading-6 text-zinc-700">
                                  {workingState.understanding}
                                </p>
                              </div>

                              {workingState.bottleneck && (
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                                    Bottleneck
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-zinc-700">
                                    {workingState.bottleneck}
                                  </p>
                                </div>
                              )}

                              <div>
                                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                                  Known
                                </p>
                                <div className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-700">
                                  {workingState.known.map((item) => (
                                    <p key={item}>• {item}</p>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                                  Unknown
                                </p>
                                <div className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-700">
                                  {workingState.unknowns.length ? (
                                    workingState.unknowns.map((item) => (
                                      <p key={item}>• {item}</p>
                                    ))
                                  ) : (
                                    <p>Nothing material is currently blocking the next move.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </details>
                        </div>
                      </div>
                    </section>
                  )}
                </>
              )}

              {error && (
                <div className="mb-8 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {!hasMessages && !working && error === "" ? null : null}

              {/* Contextual work surfaces: source material, claims/evidence,
                  and what Stryde remembers. Collapsible, never primary
                  navigation — the composer stays the one control surface. */}
              <div className="mb-8 space-y-3">
                <PursuitWorkPanels
                  pursuitId={params.id}
                  sessionId={session?.id ?? null}
                  sessionActive={Boolean(session)}
                  workingState={workingState}
                  onWorkingStateChange={setWorkingState}
                  onActionStatusRequest={(actionId, status) =>
                    setActionReport({ actionId, terminalStatus: status })
                  }
                />
                <PursuitClaimsPanel pursuitId={params.id} sessionActive={Boolean(session)} />
                <PursuitMemoryPanel pursuitId={params.id} sessionActive={Boolean(session)} />
                <PursuitAutonomyRow sessionActive={Boolean(session)} />
              </div>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-200/80 bg-[#f7f7f8]/95 px-3 py-3 backdrop-blur lg:left-64 sm:px-6">
            <div className="mx-auto max-w-3xl">
              {actionReport && (
                <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 shadow-sm">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-800">
                      {actionReport.terminalStatus === "COMPLETED"
                        ? "Action finished"
                        : "Action blocked"}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                      Tell Stryde what happened. You do not need to structure it.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionReport(null)}
                    className="shrink-0 text-xs text-zinc-400 hover:text-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <form
                onSubmit={submit}
                className="rounded-2xl border border-zinc-300 bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
              >
                <textarea
                  ref={composerRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage(input);
                    }
                  }}
                  rows={2}
                  disabled={working || session?.status !== "ACTIVE"}
                  placeholder={
                    actionReport
                      ? "Tell Stryde what happened…"
                      : session?.status === "ACTIVE"
                        ? "Tell Stryde what’s happening…"
                        : "Conversation archived"
                  }
                  className="min-h-14 w-full resize-none bg-transparent px-2 py-1 text-[15px] leading-6 outline-none placeholder:text-zinc-400"
                />

                <div className="flex items-center justify-between px-1.5 pt-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void attachFile(file);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={working || uploadingFile || session?.status !== "ACTIVE"}
                      className="shrink-0 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-30"
                      aria-label="Attach a file as source material"
                    >
                      {uploadingFile ? "Adding…" : "Attach"}
                    </button>

                    {voiceSupported && (
                      <button
                        type="button"
                        onClick={toggleVoice}
                        disabled={working || session?.status !== "ACTIVE"}
                        className={
                          "shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium " +
                          (listening
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 text-zinc-500 hover:text-zinc-900") +
                          " disabled:opacity-30"
                        }
                        aria-label={
                          listening
                            ? "Stop voice input"
                            : "Start voice input"
                        }
                      >
                        {listening ? "Stop listening" : "Voice"}
                      </button>
                    )}

                    <span className="truncate text-[11px] text-zinc-400">
                      {fileNotice
                        ? fileNotice
                        : actionReport
                          ? "Say it naturally · Stryde will structure what matters"
                          : "Enter to send · Shift+Enter for a new line"}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      working ||
                      !input.trim() ||
                      session?.status !== "ACTIVE"
                    }
                    className="shrink-0 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white disabled:opacity-30"
                  >
                    {actionReport ? "Send report" : "Send"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
