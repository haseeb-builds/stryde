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
import ContextDrawer, { type ContextDrawerTab } from "./context-drawer";
import AddContextModal, { type AddContextTab } from "./add-context-modal";
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
  if (actor === "WORKER") return "Background runner";
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
  const [actionReportText, setActionReportText] = useState("");
  const [listening, setListening] = useState(false);
  const [fileNotice, setFileNotice] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [failedTurnMessage, setFailedTurnMessage] = useState<string | null>(
    null
  );
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false);
  const [contextDrawerTab, setContextDrawerTab] = useState<ContextDrawerTab>("sources");
  const [addContextOpen, setAddContextOpen] = useState(false);
  const [addContextTab, setAddContextTab] = useState<AddContextTab>("source");

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const reportInputRef = useRef<HTMLInputElement | null>(null);
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
      window.setTimeout(() => reportInputRef.current?.focus(), 0);
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

  async function submitActionReport() {
    if (!actionReport || working || !session || session.status !== "ACTIVE") return;
    const reportText = actionReportText.trim() || (actionReport.terminalStatus === "COMPLETED" ? "Marked as completed." : "Reported as blocked.");

    setWorking(true);
    setError("");
    setActionReportText("");

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
            report: reportText,
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
        { role: "user", content: reportText },
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
      <main className="min-h-screen bg-[#F7F7F5] flex items-center justify-center p-8 text-sm text-[#6B6B6B]">
        Loading pursuit workspace…
      </main>
    );
  }

  if (!pursuit) {
    return (
      <main className="min-h-screen bg-[#F7F7F5] flex items-center justify-center p-8 text-sm text-red-600">
        {error || "Pursuit not found."}
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
    <div className="flex min-h-screen bg-[#F7F7F5] text-[#111111]">
      {/* 1. LEFT COLLAPSIBLE PURSUIT SIDEBAR (Desktop) */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col justify-between bg-[#F3F2EF] border-r border-[#E7E7E4] p-4">
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2 pt-1">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-base font-semibold tracking-tight text-[#111111] flex items-center gap-1.5"
            >
              <span>Stryde</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#111111]"></span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-xs font-medium bg-[#FCFCFB] border border-[#E7E7E4] px-3 py-1.5 rounded-full text-[#111111] hover:bg-white transition-colors"
            >
              + New pursuit
            </button>
          </div>

          <div className="space-y-1">
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
              Your Pursuits ({pursuits.length})
            </div>

            {pursuits.length > 5 && (
              <div className="px-2 pb-2">
                <input
                  type="text"
                  placeholder="Filter pursuits..."
                  value={pursuitFilter}
                  onChange={(e) => setPursuitFilter(e.target.value)}
                  className="w-full bg-[#FCFCFB] border border-[#E7E7E4] rounded-lg px-2.5 py-1 text-xs text-[#111111] placeholder:text-[#8C8C88] focus:outline-none focus:border-[#111111]"
                />
              </div>
            )}

            <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredSwitchPursuits.map((item) => {
                const isCurrent = item.id === pursuit.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (!isCurrent) router.push(`/pursuits/${item.id}`);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${
                      isCurrent
                        ? "bg-[#FCFCFB] border border-[#E7E7E4] shadow-xs"
                        : "hover:bg-[#EBEAE6]/60 text-[#52525B]"
                    }`}
                  >
                    <div className={`text-xs font-semibold truncate ${isCurrent ? "text-[#111111]" : "text-[#52525B]"}`}>
                      {item.title || "Untitled pursuit"}
                    </div>
                    <div className="text-[11px] text-[#6B6B6B] mt-0.5 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isCurrent ? "bg-emerald-600" : "bg-[#6B6B6B]"}`}></span>
                      <span className="capitalize">{item.status.toLowerCase()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quiet Plan & Navigation Footer */}
        <div className="pt-4 border-t border-[#E7E7E4] space-y-2">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FCFCFB] border border-[#E7E7E4]">
            <div>
              <div className="text-xs font-semibold text-[#111111]">Free Workspace</div>
              <div className="text-[11px] text-[#6B6B6B]">Persistent operational loop</div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/#pricing")}
              className="text-xs font-semibold text-[#111111] bg-[#F3F2EF] px-3 py-1 rounded-full hover:bg-[#EBEAE6] transition-colors"
            >
              Upgrade
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE COLUMN */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F7F7F5]">
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-[#F7F7F5]/85 backdrop-blur-md border-b border-[#E7E7E4] px-4 sm:px-8 h-[64px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile Pursuits Dropdown */}
            <details ref={switcherRef} className="lg:hidden relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-[#EBEAE6] text-[#111111]">
                <span>Pursuits ▾</span>
              </summary>
              <div className="absolute left-0 z-30 mt-2 w-72 rounded-2xl border border-[#E7E7E4] bg-[#FCFCFB] p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between border-b border-[#E7E7E4] pb-2">
                  <span className="text-xs font-semibold text-[#111111]">Switch Pursuit</span>
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="text-xs font-semibold text-[#111111] hover:underline"
                  >
                    All Pursuits
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {filteredSwitchPursuits.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        switcherRef.current?.removeAttribute("open");
                        router.push("/pursuits/" + item.id);
                      }}
                      className="w-full text-left p-2 rounded-xl text-xs hover:bg-[#F3F2EF] truncate block"
                    >
                      {item.title || "Untitled pursuit"}
                    </button>
                  ))}
                </div>
              </div>
            </details>

            <h1 className="text-sm sm:text-base font-semibold text-[#111111] truncate">
              {title}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-[#EBEAE6] text-[#111111]">
              <span className={`w-1.5 h-1.5 rounded-full ${pursuit.status === "COMPLETED" ? "bg-emerald-600" : "bg-[#111111]"}`} />
              <span className="capitalize">{pursuit.status.toLowerCase()}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setAddContextTab("source");
                setAddContextOpen(true);
              }}
              className="hidden sm:inline-flex rounded-full bg-[#FCFCFB] border border-[#E7E7E4] px-3.5 py-1.5 text-xs font-medium text-[#111111] hover:bg-white transition-colors"
            >
              + Add context
            </button>
            <button
              type="button"
              onClick={() => {
                setContextDrawerTab("sources");
                setContextDrawerOpen(true);
              }}
              className="bg-[#FCFCFB] border border-[#E7E7E4] hover:border-[#111111] text-[#111111] px-4 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-2"
            >
              <span>Context &amp; Sources</span>
            </button>
            <button
              type="button"
              onClick={() => void newConversation()}
              disabled={working}
              className="text-xs font-medium text-[#52525B] hover:text-[#111111] px-2.5 py-1.5 rounded-full"
            >
              New turn
            </button>
          </div>
        </header>

        {/* Workspace Main Stream */}
        <main className="max-w-3xl w-full mx-auto flex-1 px-4 sm:px-6 pt-6 pb-44 space-y-6">
          {/* 1. TOP "CURRENT REALITY & NEXT MOVE" BRIEF CARD (#FCFCFB rounded-3xl) */}
          <section aria-label="Current Pursuit Brief" className="bg-[#FCFCFB] rounded-3xl border border-[#E7E7E4] p-5 sm:p-7 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-[#EBEAE6] text-[#111111]">
                  Current Pursuit Brief
                </span>
                {workingState ? (
                  <span className="text-xs text-[#6B6B6B]">
                    Status: {statusLabel(workingState.status)}
                  </span>
                ) : null}
              </div>

              {workingState && !activeAction && !working ? (
                <button
                  type="button"
                  onClick={() => void recomputeWork()}
                  className="text-xs font-medium text-[#52525B] hover:text-[#111111] px-3 py-1 rounded-full bg-[#F3F2EF]"
                >
                  Reassess situation
                </button>
              ) : null}
            </div>

            {/* Current Reality & Active Bottleneck */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-7 space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
                  Where things stand
                </div>
                <p className="text-sm sm:text-[15px] text-[#111111] leading-relaxed">
                  {workingState?.understanding || "Initial goal captured. Stryde is waiting for your first turn or source file to synthesize the current situation."}
                </p>
              </div>

              {workingState?.bottleneck ? (
                <div className="md:col-span-5 rounded-2xl bg-[#FFFBEB] border border-amber-200/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-900 mb-1">
                    Active Bottleneck
                  </div>
                  <p className="text-xs sm:text-sm text-amber-950 leading-relaxed font-medium">
                    {workingState.bottleneck}
                  </p>
                </div>
              ) : null}
            </div>

            {/* HIGHLIGHTED NEXT MOVE / ACTIVE ACTION CONTAINER */}
            {activeAction && !working ? (
              <div className="bg-[#F3F2EF] rounded-2xl p-5 border border-[#E7E7E4] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#111111]"></span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#111111]">
                      {activeAction.execution_mode === "CONTROLLED" ? "Automated Runner Action" : "Your Active Move"}
                    </span>
                  </div>
                  <span className="text-xs font-medium px-3 py-0.5 rounded-full bg-[#FCFCFB] border border-[#E7E7E4] text-[#111111]">
                    {activeAction.execution_mode === "CONTROLLED" ? "Queued / Background runner" : "In progress · You"}
                  </span>
                </div>

                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-[#111111]">
                    {activeAction.intent_summary}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#52525B] mt-1 leading-relaxed">
                    {activeAction.execution_mode === "CONTROLLED"
                      ? "Queued for background execution. If you complete it yourself or want to record an outcome right now, report below."
                      : "Execute in reality, then report what happened below. Self-reports are saved honestly as Reported until grounded."}
                  </p>
                </div>

                {/* Outcome Reporting Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActionReport({ actionId: activeAction.id, terminalStatus: "COMPLETED" });
                    }}
                    className="bg-[#111111] text-white px-5 py-2 rounded-full text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    Report outcome
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionReport({ actionId: activeAction.id, terminalStatus: "FAILED" });
                    }}
                    className="bg-[#FCFCFB] border border-[#E7E7E4] text-[#111111] px-4 py-2 rounded-full text-xs font-medium hover:bg-white transition-colors"
                  >
                    I&apos;m blocked
                  </button>
                </div>

                {/* INLINE EXPANDING OUTCOME REPORT (Zero Popup Modals!) */}
                {actionReport ? (
                  <div className="bg-[#FCFCFB] rounded-xl p-4 border border-[#D4D4D0] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#111111]">
                        {actionReport.terminalStatus === "COMPLETED"
                          ? "Report what happened (saved as Reported until verified)"
                          : "Report what is blocking this move"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActionReport(null)}
                        className="text-xs text-[#6B6B6B] hover:text-[#111111]"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        ref={reportInputRef}
                        type="text"
                        value={actionReportText}
                        onChange={(e) => setActionReportText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void submitActionReport();
                          }
                        }}
                        placeholder="Describe what happened in plain language…"
                        className="flex-1 bg-[#F7F7F5] border border-[#E7E7E4] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#111111] focus:border-[#111111] focus:bg-white focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => void submitActionReport()}
                        className="bg-[#111111] text-white px-4 py-2 rounded-full text-xs font-medium shrink-0 hover:opacity-90 disabled:opacity-45"
                      >
                        {working ? "Saving…" : "Save report"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : workingState && currentMove && !working ? (
              <div className="bg-[#F3F2EF] rounded-2xl p-5 border border-[#E7E7E4] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#111111]"></span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#111111]">
                      Proposed Next Move · {moveActorLabel(currentMove.actor)}
                    </span>
                  </div>
                  <span className="text-xs font-medium px-3 py-0.5 rounded-full bg-[#FCFCFB] border border-[#E7E7E4] text-[#111111]">
                    {moveModeLabel(currentMove.mode)}
                  </span>
                </div>

                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-[#111111]">
                    {currentMove.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#52525B] mt-1 leading-relaxed">
                    {currentMove.why}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {currentMove.actor === "HUMAN" && currentMove.mode === "CREATE_ACTION" && (
                    <button
                      type="button"
                      onClick={() => void startCurrentAction()}
                      className="bg-[#111111] text-white px-5 py-2 rounded-full text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      Start this move
                    </button>
                  )}
                  {currentMove.actor === "WORKER" && (
                    <button
                      type="button"
                      onClick={() => void startCurrentAction()}
                      className="bg-[#111111] text-white px-5 py-2 rounded-full text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      Delegate to background runner
                    </button>
                  )}
                  {currentMove.mode === "ASK_USER" && (
                    <button
                      type="button"
                      onClick={() => composerRef.current?.focus()}
                      className="bg-[#FCFCFB] border border-[#E7E7E4] text-[#111111] px-4 py-2 rounded-full text-xs font-medium hover:bg-white transition-colors"
                    >
                      Answer in composer ↓
                    </button>
                  )}
                  {currentMove.mode !== "CREATE_ACTION" && currentMove.mode !== "ASK_USER" && (
                    <button
                      type="button"
                      onClick={() => void recomputeWork()}
                      className="bg-[#FCFCFB] border border-[#E7E7E4] text-[#52525B] px-4 py-2 rounded-full text-xs font-medium hover:text-[#111111]"
                    >
                      Reassess
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </section>

          {/* 2. CHRONOLOGICAL CONVERSATION & PROGRESS STREAM */}
          <section aria-label="Pursuit conversation record" className="space-y-4">
            {messages.length === 0 ? (
              <div className="bg-[#FCFCFB] rounded-3xl p-6 sm:p-8 border border-[#E7E7E4] text-center space-y-2">
                <h2 className="text-lg font-semibold text-[#111111]">Where does this pursuit stand?</h2>
                <p className="text-xs sm:text-sm text-[#52525B] max-w-md mx-auto">
                  Share where things currently stand, what you have tried, or attach a document below. Stryde isolates what matters.
                </p>
              </div>
            ) : (
              messages.map((item, index) => {
                const isUser = item.role === "user";
                const isLast = index === messages.length - 1;
                const question = item.metadata?.question?.trim();

                return (
                  <article
                    key={(item.id || String(index)) + "-" + item.role}
                    className={`rounded-2xl p-5 border transition-all ${
                      isUser
                        ? "bg-[#F3F2EF] border-[#E7E7E4]"
                        : "bg-[#FCFCFB] border-[#E7E7E4] shadow-xs space-y-3"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className={`font-semibold ${isUser ? "text-[#52525B]" : "text-[#111111]"}`}>
                        {isUser ? "You" : "Stryde"}
                      </span>
                      {!isUser ? (
                        <button
                          type="button"
                          onClick={() => {
                            setContextDrawerTab("sources");
                            setContextDrawerOpen(true);
                          }}
                          className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#F3F2EF] text-[#52525B] hover:text-[#111111]"
                        >
                          Context ↗
                        </button>
                      ) : null}
                    </div>

                    {isUser ? (
                      <div className="whitespace-pre-wrap text-sm sm:text-[15px] leading-relaxed text-[#111111]">
                        {item.content}
                      </div>
                    ) : (
                      <div className="text-sm sm:text-[15px] leading-relaxed text-[#111111]">
                        <MarkdownContent content={item.content} />
                      </div>
                    )}

                    {!isUser && question ? (
                      <div className="rounded-xl border border-amber-200/80 bg-[#FFFBEB] p-3 text-xs sm:text-sm font-medium text-amber-950">
                        {question}
                      </div>
                    ) : null}

                    {isLast && item.metadata?.options && item.metadata.options.length > 0 && !working ? (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {item.metadata.options.map((option) => (
                          <button
                            key={option.label + "-" + option.value}
                            type="button"
                            onClick={() => void sendMessage(option.value)}
                            className="text-xs font-medium px-3.5 py-1.5 rounded-full bg-[#F3F2EF] hover:bg-[#EBEAE6] text-[#111111] transition-colors"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}

            {working ? (
              <div className="bg-[#FCFCFB] rounded-2xl p-4 border border-[#E7E7E4] text-xs text-[#52525B] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#111111] animate-pulse"></span>
                <span>Stryde is working through the situation…</span>
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700"
              >
                <span>{error}</span>
                {failedTurnMessage && !working && session?.status === "ACTIVE" ? (
                  <button
                    type="button"
                    onClick={() => void sendMessage(failedTurnMessage)}
                    className="shrink-0 bg-red-700 text-white px-3 py-1 rounded-full text-xs hover:opacity-90"
                  >
                    Retry message
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        </main>

        {/* 3. STICKY UNIVERSAL BOTTOM COMPOSER */}
        <footer className="fixed bottom-0 left-0 lg:left-72 right-0 z-20 bg-[#F7F7F5]/90 backdrop-blur-md border-t border-[#E7E7E4] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={submit} className="bg-[#FCFCFB] rounded-2xl border border-[#E7E7E4] p-2.5 shadow-xs flex flex-col gap-2">
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
                  session?.status === "ACTIVE"
                    ? "Tell Stryde what happened, ask a question, or attach a document…"
                    : "Conversation unavailable"
                }
                className="w-full resize-none bg-transparent px-2.5 py-1 text-sm sm:text-[15px] text-[#111111] placeholder:text-[#6B6B6B] focus:outline-none"
              />

              <div className="flex items-center justify-between pt-1.5 border-t border-[#F3F2EF] px-1">
                <div className="flex items-center gap-2">
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
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-[#F3F2EF] hover:bg-[#EBEAE6] text-[#111111] transition-colors disabled:opacity-40"
                  >
                    {uploadingFile ? "Adding…" : "+ Attach file"}
                  </button>

                  {voiceSupported ? (
                    <button
                      type="button"
                      onClick={toggleVoice}
                      disabled={working || session?.status !== "ACTIVE"}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                        listening
                          ? "bg-[#111111] text-white"
                          : "bg-[#F3F2EF] hover:bg-[#EBEAE6] text-[#52525B]"
                      }`}
                    >
                      {listening ? "Stop voice" : "Voice"}
                    </button>
                  ) : null}

                  <span className="truncate text-[11px] text-[#6B6B6B] hidden sm:inline">
                    {fileNotice ? fileNotice : "Enter to send · Shift+Enter for new line"}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={working || !input.trim() || session?.status !== "ACTIVE"}
                  className="bg-[#111111] text-white px-5 py-1.5 rounded-full text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
                >
                  Send →
                </button>
              </div>
            </form>
          </div>
        </footer>
      </div>

      {/* Slide-Over Context Drawer & Add Context Modal */}
      <ContextDrawer
        isOpen={contextDrawerOpen}
        onClose={() => setContextDrawerOpen(false)}
        pursuitId={params.id}
        sessionId={session?.id ?? null}
        sessionActive={Boolean(session)}
        workingState={workingState}
        onWorkingStateChange={setWorkingState}
        onActionStatusRequest={(actionId, status) =>
          setActionReport({ actionId, terminalStatus: status })
        }
        initialTab={contextDrawerTab}
        onOpenAddContext={() => {
          setAddContextTab("source");
          setAddContextOpen(true);
        }}
      />

      <AddContextModal
        isOpen={addContextOpen}
        onClose={() => setAddContextOpen(false)}
        pursuitId={params.id}
        sessionId={session?.id ?? null}
        sessionActive={Boolean(session)}
        initialTab={addContextTab}
        onContextAdded={() => {
          if (session?.id) void openSession(session.id);
          void recomputeWork();
        }}
      />
    </div>
  );
}
