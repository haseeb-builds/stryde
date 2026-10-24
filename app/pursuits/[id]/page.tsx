"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { consumeConversationStream } from "@/lib/conversation-client-stream";
import type { WorkingState } from "@/lib/work-controller";
import PursuitWorkPanels from "./work-panels";
import PursuitClaimsPanel from "./claims-panel";
import PursuitMemoryPanel from "./memory-panel";
import PursuitAutonomyRow from "./autonomy-row";
import PursuitSkillsPanel from "./skills-panel";
import PursuitArtifactsPanel from "./artifacts-panel";
import { MarkdownContent } from "./markdown-content";

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
  results: ArrayLike<{
    length: number;
    [index: number]: { transcript?: unknown };
  }>;
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

function moveActorLabel(
  actor: NonNullable<WorkingState["next_move"]>["actor"]
) {
  if (actor === "HUMAN") return "You";
  if (actor === "WORKER") return "Assigned runner";
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
  const [pursuitFilter, setPursuitFilter] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [workingState, setWorkingState] = useState<WorkingState | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionReport, setActionReport] = useState<ActionReportState | null>(
    null
  );
  const [listening, setListening] = useState(false);
  const [fileNotice, setFileNotice] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [failedTurnMessage, setFailedTurnMessage] = useState<string | null>(
    null
  );

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const voiceRef = useRef<VoiceRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const switcherRef = useRef<HTMLDetailsElement | null>(null);

  const title = useMemo(() => pursuit?.title || "Untitled pursuit", [pursuit]);

  const token = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/");
      throw new Error("Session expired. Please sign in again.");
    }
    return data.session.access_token;
  }, [router]);

  const loadActiveAction = useCallback(
    async (accessToken?: string) => {
      const access = accessToken ?? (await token());
      const response = await fetch(
        "/api/v1/pursuits/" + params.id + "/actions?status=IN_PROGRESS",
        { headers: { Authorization: "Bearer " + access } }
      );
      if (!response.ok) return null;
      const body = (await response.json()) as { actions?: ActiveAction[] };
      const action = body.actions?.[0] ?? null;
      setActiveAction(action);
      return action;
    },
    [params.id, token]
  );

  const openSession = useCallback(
    async (sessionId: string, accessToken?: string) => {
      const access = accessToken ?? (await token());
      const response = await fetch(
        "/api/v1/pursuits/" + params.id + "/conversations/" + sessionId,
        { headers: { Authorization: "Bearer " + access } }
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
      const lastAssistant = [...loaded]
        .reverse()
        .find((item) => item.role === "stryde");
      const restoredWork =
        body.session.working_state ?? lastAssistant?.metadata?.work ?? null;

      setSession(body.session);
      setMessages(loaded);
      setWorkingState(restoredWork);
      setError("");
      await loadActiveAction(access);
    },
    [loadActiveAction, params.id, token]
  );

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const accessToken = await token();

      const [pursuitResult, pursuitsResponse, sessionsResponse] =
        await Promise.all([
          supabase
            .from("pursuit")
            .select("id, title, status")
            .eq("id", params.id)
            .single(),
          fetch("/api/v1/pursuits?limit=30", {
            headers: { Authorization: "Bearer " + accessToken }
          }),
          fetch("/api/v1/pursuits/" + params.id + "/conversations", {
            headers: { Authorization: "Bearer " + accessToken }
          })
        ]);

      if (pursuitResult.error || !pursuitResult.data) {
        throw new Error("Pursuit not found.");
      }

      setPursuit(pursuitResult.data as Pursuit);

      if (pursuitsResponse.ok) {
        const body = (await pursuitsResponse.json()) as {
          pursuits?: Pursuit[];
        };
        setPursuits(body.pursuits ?? []);
      }

      if (!sessionsResponse.ok) {
        throw new Error("Unable to load conversation.");
      }

      const body = (await sessionsResponse.json()) as { sessions?: Session[] };
      const available = body.sessions ?? [];

      if (!available.length) {
        const response = await fetch(
          "/api/v1/pursuits/" + params.id + "/conversations",
          {
            method: "POST",
            headers: { Authorization: "Bearer " + accessToken }
          }
        );
        const createBody = (await response.json()) as {
          session?: Session;
          error?: string;
        };
        if (!response.ok || !createBody.session) {
          throw new Error(createBody.error || "Unable to start Stryde.");
        }
        await openSession(createBody.session.id, accessToken);
      } else {
        const active =
          available.find((item) => item.status === "ACTIVE") ?? available[0];
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
      const response = await fetch(
        "/api/v1/pursuits/" + params.id + "/conversations",
        {
          method: "POST",
          headers: { Authorization: "Bearer " + access }
        }
      );
      const body = (await response.json()) as {
        session?: Session;
        error?: string;
      };

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
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start a new conversation."
      );
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

    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

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

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const transcript = event.results[index]?.[0]?.transcript;
        if (typeof transcript === "string" && transcript.trim()) {
          spokenParts.push(transcript.trim());
        }
      }

      const spoken = spokenParts.join(" ").trim();
      if (spoken) {
        setInput((current) =>
          [current.trim(), spoken].filter(Boolean).join(" ")
        );
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
          Authorization: "Bearer " + access
        },
        body: JSON.stringify({ session_id: session.id })
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
        throw new Error(
          body.error || "Stryde couldn't reassess this pursuit."
        );
      }

      setWorkingState(body.working_state);
      setSession((current) =>
        current
          ? {
              ...current,
              working_state: body.working_state!,
              updated_at: new Date().toISOString()
            }
          : current
      );

      await loadActiveAction(access);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Stryde couldn't reassess this pursuit."
      );
    } finally {
      setWorking(false);
    }
  }

  async function startCurrentAction() {
    if (
      working ||
      !session ||
      session.status !== "ACTIVE" ||
      !workingState?.next_move
    )
      return;

    const move = workingState.next_move;

    setWorking(true);
    setError("");

    try {
      const access = await token();
      const response =
        move.actor === "WORKER"
          ? await fetch(
              "/api/v1/pursuits/" + params.id + "/actions/delegate-worker",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: "Bearer " + access
                },
                body: JSON.stringify({
                  session_id: session.id,
                  approved: true
                })
              }
            )
          : await fetch("/api/v1/pursuits/" + params.id + "/actions/start", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + access
              },
              body: JSON.stringify({
                session_id: session.id,
                approved: true
              })
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
                updated_at: new Date().toISOString()
              }
            : current
        );
      } else {
        await recomputeWork();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Stryde couldn't start this move."
      );
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
        throw new Error(
          file.name + " is larger than the 10 MB source limit."
        );
      }

      const access = await token();
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(
        "/api/v1/pursuits/" + params.id + "/sources",
        {
          method: "POST",
          headers: { Authorization: "Bearer " + access },
          body: form
        }
      );

      const body = (await response.json()) as {
        source?: { title: string | null };
        warning?: string | null;
        error?: string;
      };

      if (!response.ok || !body.source) {
        throw new Error(body.error || "Stryde could not read that file.");
      }

      setFileNotice(
        "Added " +
          (body.source.title ?? file.name) +
          " to this pursuit's source material." +
          (body.warning ? " " + body.warning : "")
      );
    } catch (err) {
      setFileNotice(
        err instanceof Error ? err.message : "Stryde could not read that file."
      );
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
              Authorization: "Bearer " + access
            },
            body: JSON.stringify({
              session_id: session.id,
              terminal_status: actionReport.terminalStatus,
              report: content,
              turn_key: crypto.randomUUID()
            })
          }
        );

        const body = (await response.json()) as {
          working_state?: WorkingState | null;
          assistant_message?: string;
          metadata?: Message["metadata"];
          error?: string;
        };

        if (!response.ok || !body.working_state || !body.assistant_message) {
          throw new Error(
            body.error || "Stryde could not record what happened."
          );
        }

        setMessages((current) => [
          ...current,
          { role: "user", content },
          {
            role: "stryde",
            content: body.assistant_message!,
            metadata: body.metadata ?? undefined
          }
        ]);
        setWorkingState(body.working_state);
        setSession((current) =>
          current
            ? {
                ...current,
                working_state: body.working_state!,
                updated_at: new Date().toISOString()
              }
            : current
        );
        setActionReport(null);
        setActiveAction(null);
        setError("");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Stryde could not record what happened."
        );
      } finally {
        setWorking(false);
      }

      return;
    }

    setWorking(true);
    setError("");
    setInput("");

    setMessages((current) => [...current, { role: "user", content }]);
    const assistantId = "streaming-" + crypto.randomUUID();

    setMessages((current) => [
      ...current,
      { id: assistantId, role: "stryde", content: "" }
    ]);

    try {
      const access = await token();
      const response = await fetch(
        "/api/v1/pursuits/" + params.id + "/conversation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + access
          },
          body: JSON.stringify({
            message: content,
            session_id: session.id,
            turn_key: crypto.randomUUID()
          })
        }
      );

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
        const body = (await response
          .json()
          .catch(() => ({}))) as ConversationResponse;
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
                : item
            )
          ),
        () => undefined
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
                  ...("autonomous_research" in turn && turn.autonomous_research
                    ? { autonomous_research: turn.autonomous_research }
                    : {})
                }
              }
            : item
        )
      );

      setWorkingState(turn.work);

      setSession((current) =>
        current
          ? {
              ...current,
              title: current.title || content.slice(0, 72),
              updated_at: new Date().toISOString(),
              working_state: turn.work
            }
          : current
      );

      setMessages((current) =>
        current.filter(
          (item) => !(item.id === assistantId && !item.content.trim())
        )
      );

      const alreadyResearched =
        "autonomous_research" in turn && Boolean(turn.autonomous_research);
      if (
        !alreadyResearched &&
        turn.work.next_move?.mode === "RESEARCH_WEB" &&
        turn.work.next_move.actor === "STRYDE"
      ) {
        setWorking(false);
        await recomputeWork();
      } else {
        setWorking(false);
      }
      setFailedTurnMessage(null);
    } catch (err) {
      setMessages((current) =>
        current.filter((item) => item.id !== assistantId)
      );
      setError(
        err instanceof Error ? err.message : "Stryde couldn't continue."
      );
      setFailedTurnMessage(content);
      setWorking(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  if (loading && (!pursuit || !session)) {
    return (
      <main className="min-h-screen bg-[var(--canvas)] p-8 text-sm text-[var(--ink-muted)]">
        Loading…
      </main>
    );
  }

  if (!pursuit) {
    return (
      <main className="min-h-screen bg-[var(--canvas)] p-8 text-sm text-[var(--blocked)]">
        {error || "Not found."}
      </main>
    );
  }

  const currentMove = workingState?.next_move ?? null;
  const filteredSwitchPursuits = pursuits.filter((item) =>
    pursuitFilter.trim()
      ? (item.title || "Untitled pursuit")
          .toLowerCase()
          .includes(pursuitFilter.toLowerCase())
      : true
  );

  return (
    <main className="flex min-h-screen flex-col bg-[var(--canvas)] text-[var(--ink)]">
      {/* Top Operational Navigation Bar (Universal Desktop + Mobile) */}
      <header className="sticky top-0 z-20 border-b border-[var(--rule)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="shrink-0 text-[15px] font-bold tracking-tight text-[var(--ink)] hover:text-[var(--signal)]"
            >
              stryde<span className="text-[var(--signal)]">.</span>
            </button>

            <span className="text-[var(--rule-strong)]">/</span>

            {/* Pursuit Switcher inside <details> for universal mobile & desktop navigation */}
            <details ref={switcherRef} className="group relative min-w-0">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[12.5px] font-medium text-[var(--ink)] select-none hover:border-[var(--rule-strong)]">
                <span className="max-w-[145px] truncate sm:max-w-[260px]">
                  {title}
                </span>
                <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                  ▾
                </span>
              </summary>

              <div className="absolute left-0 z-30 mt-1.5 w-72 rounded-[4px] border border-[var(--rule-strong)] bg-[var(--surface)] p-2.5 shadow-lg sm:w-80">
                <div className="mb-2 flex items-center justify-between border-b border-[var(--rule)] pb-1.5">
                  <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                    Pursuits ({pursuits.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="font-mono text-[11px] font-medium text-[var(--signal)] hover:underline"
                  >
                    ← All pursuits
                  </button>
                </div>

                {pursuits.length > 4 ? (
                  <input
                    type="search"
                    value={pursuitFilter}
                    onChange={(e) => setPursuitFilter(e.target.value)}
                    placeholder="Filter pursuits…"
                    className="mb-2 w-full rounded-[3px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:outline-none"
                  />
                ) : null}

                <div className="max-h-60 divide-y divide-[var(--rule)] overflow-y-auto">
                  {filteredSwitchPursuits.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        switcherRef.current?.removeAttribute("open");
                        router.push("/pursuits/" + item.id);
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-[12.5px] transition-colors ${
                        item.id === pursuit.id
                          ? "bg-[var(--surface-subtle)] font-semibold text-[var(--ink)]"
                          : "text-[var(--ink-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
                      }`}
                    >
                      <span className="truncate">
                        {item.title || "Untitled pursuit"}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] uppercase text-[var(--ink-muted)]">
                        {item.status}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-[var(--rule)] pt-2">
                  <button
                    type="button"
                    onClick={() => void newConversation()}
                    disabled={working}
                    className="font-mono text-[11px] text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                  >
                    + Fresh conversation
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void supabase.auth
                        .signOut()
                        .then(() => router.replace("/"))
                    }
                    className="font-mono text-[11px] text-[var(--ink-muted)] hover:text-[var(--blocked)]"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </details>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <a
              href="#pursuit-context"
              className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-2.5 py-1.5 font-mono text-[11px] font-medium text-[var(--ink-secondary)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)]"
            >
              Context &amp; files
            </a>
            <button
              type="button"
              onClick={() => void newConversation()}
              disabled={working}
              aria-label="Start a fresh conversation"
              className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-2.5 py-1.5 font-mono text-[11px] font-medium text-[var(--ink-secondary)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)] disabled:opacity-40"
            >
              New
            </button>
          </div>
        </div>
      </header>

      {/* Main Single-Column Workspace */}
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-3 pt-5 pb-44 sm:px-6 sm:pt-7">
        {/* 1. Operational Brief ("Where this stands") & Next Meaningful Move */}
        <section
          aria-label="Pursuit operational brief"
          className="overflow-hidden rounded-[4px] border border-[var(--rule)] bg-[var(--surface)]"
        >
          <div className="border-b border-[var(--rule)] px-4 py-3.5 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        pursuit.status === "COMPLETED"
                          ? "bg-[var(--verified)]"
                          : "bg-[var(--signal)]"
                      }`}
                    />
                    {pursuit.status.toLowerCase()}
                  </span>
                  {workingState ? (
                    <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                      State: {statusLabel(workingState.status)}
                    </span>
                  ) : null}
                </div>
                <h1 className="text-lg font-semibold tracking-tight text-[var(--ink)] sm:text-xl">
                  {title}
                </h1>
              </div>

              {workingState && !activeAction && !working ? (
                <button
                  type="button"
                  onClick={() => void recomputeWork()}
                  className="shrink-0 rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-2.5 py-1 font-mono text-[11px] font-medium text-[var(--ink-secondary)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)]"
                >
                  Reassess
                </button>
              ) : null}
            </div>

            {workingState?.understanding ? (
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-[var(--ink-secondary)]">
                {workingState.understanding}
              </p>
            ) : null}

            {workingState?.bottleneck ? (
              <div className="mt-3 rounded-[4px] border border-[#ead2a2] bg-[var(--waiting-wash)] px-3.5 py-2.5">
                <div className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--waiting)]">
                  Current bottleneck
                </div>
                <p className="mt-0.5 text-[13.5px] font-medium text-[var(--ink)]">
                  {workingState.bottleneck}
                </p>
              </div>
            ) : null}

            {workingState ? (
              <details className="group mt-3 rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)]">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-1.5 font-mono text-[11px] text-[var(--ink-secondary)] select-none">
                  <span>
                    ▸ Why Stryde currently sees it this way (
                    {workingState.known.length} known ·{" "}
                    {workingState.unknowns.length} unknown)
                  </span>
                  <span className="text-[var(--ink-muted)]">Inspect</span>
                </summary>
                <div className="grid gap-4 border-t border-[var(--rule)] p-3.5 text-[12.5px] sm:grid-cols-2">
                  <div>
                    <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                      Known
                    </p>
                    <div className="mt-1.5 space-y-1 leading-relaxed text-[var(--ink-secondary)]">
                      {workingState.known.length ? (
                        workingState.known.map((item) => (
                          <p key={item}>• {item}</p>
                        ))
                      ) : (
                        <p className="text-[var(--ink-muted)]">
                          No established facts recorded yet.
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                      Unknown
                    </p>
                    <div className="mt-1.5 space-y-1 leading-relaxed text-[var(--ink-secondary)]">
                      {workingState.unknowns.length ? (
                        workingState.unknowns.map((item) => (
                          <p key={item}>• {item}</p>
                        ))
                      ) : (
                        <p className="text-[var(--ink-muted)]">
                          Nothing material is currently blocking the next move.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </details>
            ) : null}
          </div>

          {/* Active Action Surface (Human or Queued/Controlled Runner) */}
          {activeAction && !working ? (
            <div
              className={`bg-[var(--surface-subtle)] px-4 py-4 sm:px-5 ${
                activeAction.execution_mode === "CONTROLLED"
                  ? "border-l-[3px] border-l-[var(--waiting)]"
                  : "border-l-[3px] border-l-[var(--signal)]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--signal)]">
                      {activeAction.execution_mode === "CONTROLLED"
                        ? "Delegated Runner Action"
                        : "Your Active Move"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase ${
                        activeAction.execution_mode === "CONTROLLED"
                          ? "border-[#ead2a2] bg-[var(--waiting-wash)] text-[var(--waiting)]"
                          : "border-[#f0c5ba] bg-[var(--signal-wash)] text-[var(--signal)]"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          activeAction.execution_mode === "CONTROLLED"
                            ? "bg-[var(--waiting)]"
                            : "bg-[var(--signal)]"
                        }`}
                      />
                      {activeAction.execution_mode === "CONTROLLED"
                        ? "Queued / Awaiting runner"
                        : "In progress · You"}
                    </span>
                  </div>

                  <div className="mt-1.5 text-[16px] font-semibold tracking-tight text-[var(--ink)]">
                    {activeAction.intent_summary}
                  </div>

                  <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-secondary)]">
                    {activeAction.execution_mode === "CONTROLLED"
                      ? "Stryde queued this step for an automated runner. A queued job is not verified running until a runner daemon claims it—if no runner is active in this environment or you complete it yourself, report the outcome directly."
                      : "Do the real-world part, then tell Stryde what happened. Self-reported completions are recorded honestly as reported until linked to evidence."}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActionReport({
                        actionId: activeAction.id,
                        terminalStatus: "COMPLETED"
                      });
                      window.setTimeout(() => composerRef.current?.focus(), 0);
                    }}
                    className="rounded-[4px] bg-[var(--ink)] px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-[#2a2f2c]"
                  >
                    I’m done
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionReport({
                        actionId: activeAction.id,
                        terminalStatus: "FAILED"
                      });
                      window.setTimeout(() => composerRef.current?.focus(), 0);
                    }}
                    className="rounded-[4px] border border-[var(--rule-strong)] bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)]"
                  >
                    I’m blocked
                  </button>
                </div>
              </div>

              {/* Inline Outcome / Blocker Reporting Dock inside the Action Card */}
              {actionReport ? (
                <div className="mt-3 space-y-2 rounded-[4px] border border-[var(--rule-strong)] bg-[var(--surface)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--ink)]">
                      {actionReport.terminalStatus === "COMPLETED"
                        ? "Report what happened (records a reported claim)"
                        : "Report what is blocking this move"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActionReport(null)}
                      className="font-mono text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendMessage(input);
                        }
                      }}
                      placeholder="Tell Stryde what happened in your own words…"
                      className="min-w-0 flex-1 rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-3 py-2 text-[13.5px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--ink)] focus:bg-[var(--surface)] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={working || !input.trim()}
                      onClick={() => void sendMessage(input)}
                      className="shrink-0 rounded-[4px] bg-[var(--ink)] px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-[#2a2f2c] disabled:opacity-45"
                    >
                      Send report
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Proposed Next Meaningful Move Surface */}
          {workingState && currentMove && !activeAction && !working ? (
            <div className="border-l-[3px] border-l-[var(--signal)] bg-[var(--surface-subtle)] px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--signal)]">
                  What matters now · Proposed next move
                </p>
                <span className="rounded-[3px] border border-[var(--rule)] bg-[var(--surface)] px-2 py-0.5 font-mono text-[10.5px] text-[var(--ink-secondary)]">
                  {statusLabel(workingState.status)} ·{" "}
                  {moveModeLabel(currentMove.mode)} ·{" "}
                  {moveActorLabel(currentMove.actor)}
                </span>
              </div>

              <div className="mt-2 text-[16px] font-semibold tracking-tight text-[var(--ink)]">
                {currentMove.title}
              </div>

              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--ink-secondary)]">
                {currentMove.why}
              </p>

              <div className="mt-3.5 flex flex-wrap gap-2">
                {currentMove.actor === "HUMAN" &&
                  currentMove.mode === "CREATE_ACTION" && (
                    <button
                      type="button"
                      onClick={() => void startCurrentAction()}
                      className="rounded-[4px] bg-[var(--ink)] px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-[#2a2f2c]"
                    >
                      Start this
                    </button>
                  )}

                {currentMove.actor === "WORKER" && (
                  <button
                    type="button"
                    onClick={() => void startCurrentAction()}
                    className="rounded-[4px] bg-[var(--ink)] px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-[#2a2f2c]"
                  >
                    Delegate
                  </button>
                )}

                {currentMove.mode === "ASK_USER" && (
                  <button
                    type="button"
                    onClick={() => composerRef.current?.focus()}
                    className="rounded-[4px] border border-[var(--rule-strong)] bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)]"
                  >
                    Tell Stryde
                  </button>
                )}

                {currentMove.mode !== "CREATE_ACTION" &&
                  currentMove.mode !== "ASK_USER" &&
                  currentMove.mode !== "RESEARCH_WEB" &&
                  currentMove.actor !== "WORKER" && (
                    <button
                      type="button"
                      onClick={() => void recomputeWork()}
                      className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--ink-secondary)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)]"
                    >
                      Reassess
                    </button>
                  )}
              </div>
            </div>
          ) : null}
        </section>

        {/* 2. The Pursuit Record (Chronological Conversation Stream) */}
        <section aria-label="Pursuit record" className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-[var(--rule)] pb-2">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--ink-secondary)]">
              Pursuit Record
            </h2>
            <span className="font-mono text-[11px] text-[var(--ink-muted)]">
              {messages.length} {messages.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {messages.length === 0 ? (
            <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] p-6 sm:p-8">
              <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)] sm:text-2xl">
                What needs to move?
              </h2>
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[var(--ink-secondary)]">
                Start with the thing that matters. Share where things stand right now, what you have already tried, or attach a source file below. It does not need to be explained perfectly.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--rule)] overflow-hidden rounded-[4px] border border-[var(--rule)] bg-[var(--surface)]">
              {messages.map((item, index) => {
                const isUser = item.role === "user";
                const isLast = index === messages.length - 1;
                const question = item.metadata?.question?.trim();
                const showQuestionCallout =
                  !isUser &&
                  question &&
                  !item.content
                    .trim()
                    .toLowerCase()
                    .endsWith(question.toLowerCase());

                return (
                  <article
                    key={(item.id || String(index)) + "-" + item.role}
                    className={`p-4 sm:grid sm:grid-cols-[96px_1fr] sm:gap-4 sm:p-5 ${
                      isUser ? "bg-[var(--surface-subtle)]" : "bg-[var(--surface)]"
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between sm:mb-0 sm:block">
                      <span
                        className={`font-mono text-[11px] font-semibold uppercase tracking-wider ${
                          isUser
                            ? "text-[var(--ink-secondary)]"
                            : "text-[var(--signal)]"
                        }`}
                      >
                        {isUser ? "You" : "Stryde"}
                      </span>
                      <div className="font-mono text-[10px] text-[var(--ink-muted)] sm:mt-1">
                        #{index + 1}
                      </div>
                    </div>

                    <div className="min-w-0 space-y-3">
                      {isUser ? (
                        <div className="whitespace-pre-wrap text-[14.5px] leading-[1.62] text-[var(--ink)]">
                          {item.content}
                        </div>
                      ) : (
                        <MarkdownContent content={item.content} />
                      )}

                      {showQuestionCallout ? (
                        <div className="rounded-[4px] border-l-[3px] border-l-[var(--signal)] bg-[var(--signal-wash)] px-3.5 py-2.5 text-[13.5px] font-medium text-[var(--ink)]">
                          {question}
                        </div>
                      ) : null}

                      {isLast &&
                      item.metadata?.options &&
                      item.metadata.options.length > 0 &&
                      !working ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {item.metadata.options.map((option) => (
                            <div
                              key={option.label + "-" + option.value}
                              role="button"
                              tabIndex={0}
                              onClick={() => void sendMessage(option.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  void sendMessage(option.value);
                                }
                              }}
                              className="cursor-pointer rounded-[4px] border border-[var(--rule-strong)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--ink)] hover:bg-[var(--surface)]"
                            >
                              {option.label}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              {working ? (
                <article className="bg-[var(--surface)] p-4 sm:grid sm:grid-cols-[96px_1fr] sm:gap-4 sm:p-5">
                  <div className="mb-1 sm:mb-0">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--signal)]">
                      Stryde
                    </span>
                  </div>
                  <div className="font-mono text-[12.5px] text-[var(--ink-secondary)]">
                    Stryde is working through it…
                  </div>
                </article>
              ) : null}
            </div>
          )}

          {error ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-[#efb9b9] bg-[var(--blocked-wash)] px-3.5 py-2.5 text-[13px] text-[var(--blocked)]"
            >
              <span className="min-w-0 flex-1 font-medium">{error}</span>
              {failedTurnMessage && !working && session?.status === "ACTIVE" ? (
                <button
                  type="button"
                  onClick={() => void sendMessage(failedTurnMessage)}
                  className="shrink-0 rounded-[4px] bg-[var(--blocked)] px-3 py-1 font-mono text-[11px] font-medium text-white hover:opacity-90"
                >
                  Retry message
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* 3. Contextual Ledger & Supporting Disclosures (All inside <details>) */}
        <section
          id="pursuit-context"
          aria-label="Supporting context and provenance"
          className="space-y-3 pt-2"
        >
          <div className="flex items-center justify-between border-b border-[var(--rule)] pb-2">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--ink-secondary)]">
              Supporting Context, Deliverables &amp; Governance
            </h2>
            <span className="font-mono text-[11px] text-[var(--ink-muted)]">
              Contextual disclosures
            </span>
          </div>

          <div className="space-y-2.5">
            <PursuitArtifactsPanel
              pursuitId={params.id}
              sessionActive={Boolean(session)}
            />
            <PursuitWorkPanels
              pursuitId={params.id}
              sessionId={session?.id ?? null}
              sessionActive={Boolean(session)}
              workingState={workingState}
              onWorkingStateChange={setWorkingState}
              onActionStatusRequest={(actionId, status) =>
                setActionReport({ actionId, terminalStatus: status })
              }
              showExecutionSection={false}
            />
            <PursuitClaimsPanel
              pursuitId={params.id}
              sessionActive={Boolean(session)}
            />
            <PursuitMemoryPanel
              pursuitId={params.id}
              sessionActive={Boolean(session)}
            />
            <PursuitSkillsPanel
              pursuitId={params.id}
              sessionActive={Boolean(session)}
            />
            <PursuitAutonomyRow
              pursuitId={params.id}
              sessionActive={Boolean(session)}
            />
          </div>
        </section>
      </div>

      {/* 4. Sticky Universal Composer */}
      <footer className="fixed right-0 bottom-0 left-0 z-10 border-t border-[var(--rule)] bg-[var(--surface)] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto max-w-4xl">
          {actionReport ? (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-[4px] border border-[var(--rule-strong)] bg-[var(--surface-subtle)] px-3.5 py-2">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--ink)]">
                  {actionReport.terminalStatus === "COMPLETED"
                    ? "Action finished · Reporting outcome"
                    : "Action blocked · Reporting blocker"}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-[var(--ink-secondary)]">
                  Tell Stryde what happened. You do not need to structure it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActionReport(null)}
                className="shrink-0 font-mono text-[11px] text-[var(--ink-secondary)] hover:text-[var(--ink)]"
              >
                Cancel
              </button>
            </div>
          ) : null}

          <form
            onSubmit={submit}
            className="rounded-[4px] border border-[var(--rule-strong)] bg-[var(--surface)] p-2"
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
                    : session?.status === "ARCHIVED"
                      ? "Conversation archived"
                      : loading
                        ? "Loading conversation…"
                        : "Conversation unavailable — reload or start a new conversation"
              }
              className="min-h-12 w-full resize-none bg-transparent px-2 py-1 text-[14.5px] leading-6 text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
            />

            <div className="flex items-center justify-between gap-2 border-t border-[var(--rule)] px-1.5 pt-2">
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
                  disabled={
                    working || uploadingFile || session?.status !== "ACTIVE"
                  }
                  className="shrink-0 rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-2.5 py-1 font-mono text-[11px] font-medium text-[var(--ink-secondary)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)] disabled:opacity-40"
                  aria-label="Attach a file as source material"
                >
                  {uploadingFile ? "Adding…" : "Attach"}
                </button>

                {voiceSupported ? (
                  <button
                    type="button"
                    onClick={toggleVoice}
                    disabled={working || session?.status !== "ACTIVE"}
                    className={
                      "shrink-0 rounded-[4px] border px-2.5 py-1 font-mono text-[11px] font-medium " +
                      (listening
                        ? "border-[var(--signal)] bg-[var(--signal-wash)] text-[var(--signal)]"
                        : "border-[var(--rule)] bg-[var(--surface-subtle)] text-[var(--ink-secondary)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)]") +
                      " disabled:opacity-40"
                    }
                    aria-label={
                      listening ? "Stop voice input" : "Start voice input"
                    }
                  >
                    {listening ? "Stop listening" : "Voice"}
                  </button>
                ) : null}

                <span className="truncate font-mono text-[11px] text-[var(--ink-muted)]">
                  {fileNotice
                    ? fileNotice
                    : actionReport
                      ? "Say it naturally · Stryde will structure what matters"
                      : "Enter to send · Shift+Enter for new line"}
                </span>
              </div>

              <button
                type="submit"
                disabled={
                  working || !input.trim() || session?.status !== "ACTIVE"
                }
                className="shrink-0 rounded-[4px] bg-[var(--ink)] px-3.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#2a2f2c] disabled:opacity-40"
              >
                {actionReport ? "Send report" : "Send"}
              </button>
            </div>
          </form>
        </div>
      </footer>
    </main>
  );
}
