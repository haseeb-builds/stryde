"use client";

import { useEffect, useState, useRef } from "react";
import type { WorkingState } from "@/lib/work-controller";
import PursuitWorkPanels from "./work-panels";
import PursuitClaimsPanel from "./claims-panel";
import PursuitMemoryPanel from "./memory-panel";
import PursuitSkillsPanel from "./skills-panel";
import PursuitArtifactsPanel from "./artifacts-panel";
import PursuitAutonomyRow from "./autonomy-row";

export type ContextDrawerTab =
  | "sources"
  | "claims"
  | "memory"
  | "skills"
  | "artifacts"
  | "autonomy";

export default function ContextDrawer(props: {
  isOpen: boolean;
  onClose: () => void;
  pursuitId: string;
  sessionId: string | null;
  sessionActive: boolean;
  workingState: WorkingState | null;
  onWorkingStateChange: (state: WorkingState) => void;
  onActionStatusRequest: (
    actionId: string,
    status: "COMPLETED" | "FAILED"
  ) => void;
  initialTab?: ContextDrawerTab;
  onOpenAddContext?: () => void;
}) {
  const {
    isOpen,
    onClose,
    pursuitId,
    sessionId,
    sessionActive,
    workingState,
    onWorkingStateChange,
    onActionStatusRequest,
    initialTab = "sources",
    onOpenAddContext
  } = props;

  const [activeTab, setActiveTab] = useState<ContextDrawerTab>(initialTab);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tabs: Array<{ id: ContextDrawerTab; label: string; icon: string }> = [
    { id: "sources", label: "Sources & Research", icon: "📁" },
    { id: "claims", label: "Evidence & Claims", icon: "⚖️" },
    { id: "memory", label: "Memories", icon: "🧠" },
    { id: "skills", label: "Saved Workflows", icon: "⚡" },
    { id: "artifacts", label: "Deliverables", icon: "📄" },
    { id: "autonomy", label: "Automation", icon: "⚙️" }
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="context-drawer-title"
      className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={drawerRef}
        className="flex h-full w-full max-w-2xl flex-col border-l border-[var(--rule-strong)] bg-[var(--surface)] shadow-2xl"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[var(--rule)] px-4 py-3.5 sm:px-6">
          <div>
            <h2
              id="context-drawer-title"
              className="text-[15px] font-semibold tracking-tight text-[var(--ink)]"
            >
              Supporting Context &amp; Governance
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--ink-secondary)]">
              Inspect grounded sources, claims, memories, procedures, and autonomy policies.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenAddContext ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAddContext();
                }}
                className="rounded-[4px] border border-[var(--rule-strong)] bg-[var(--surface-subtle)] px-2.5 py-1 font-mono text-[11px] font-medium text-[var(--ink)] hover:bg-[#e4e7e2]"
              >
                + Add context
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close context drawer"
              className="rounded-[4px] p-1 font-mono text-[14px] text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Horizontal Navigation Tabs */}
        <div className="flex overflow-x-auto border-b border-[var(--rule)] bg-[var(--surface-subtle)] px-2 sm:px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12.5px] font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-[var(--ink)] font-semibold text-[var(--ink)] bg-[var(--surface)]"
                  : "border-transparent text-[var(--ink-secondary)] hover:text-[var(--ink)]"
              }`}
            >
              <span className="text-[12px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Drawer Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === "sources" && (
            <div className="space-y-4">
              <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-3.5">
                <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                  Sources &amp; Method Adaptations
                </h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
                  Source material ingested for this pursuit, with methods extracted and audited against your specific constraints.
                </p>
              </div>

              <PursuitWorkPanels
                pursuitId={pursuitId}
                sessionId={sessionId}
                sessionActive={sessionActive}
                workingState={workingState}
                onWorkingStateChange={onWorkingStateChange}
                onActionStatusRequest={onActionStatusRequest}
                showExecutionSection={false}
              />
            </div>
          )}

          {activeTab === "claims" && (
            <div className="space-y-4">
              <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-3.5">
                <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                  Evidence &amp; Claims Ledger
                </h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
                  Track assertions and link empirical observations. Self-reported claims remain REPORTED until grounded in evidence.
                </p>
              </div>

              <PursuitClaimsPanel
                pursuitId={pursuitId}
                sessionActive={sessionActive}
              />
            </div>
          )}

          {activeTab === "memory" && (
            <div className="space-y-4">
              <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-3.5">
                <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                  Pursuit Memories
                </h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
                  Durable knowledge carried across turns. Confirm tentative facts or forget unwanted observations.
                </p>
              </div>

              <PursuitMemoryPanel
                pursuitId={pursuitId}
                sessionActive={sessionActive}
              />
            </div>
          )}

          {activeTab === "skills" && (
            <div className="space-y-4">
              <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-3.5">
                <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                  Saved Workflows &amp; Reusable Steps
                </h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
                  Tested multi-step procedures synthesized when a repeatable problem is solved.
                </p>
              </div>

              <PursuitSkillsPanel
                pursuitId={pursuitId}
                sessionActive={sessionActive}
              />
            </div>
          )}

          {activeTab === "artifacts" && (
            <div className="space-y-4">
              <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-3.5">
                <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                  Deliverables &amp; Output Artifacts
                </h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
                  Structured documents, code, research dossiers, and reports generated for this pursuit.
                </p>
              </div>

              <PursuitArtifactsPanel
                pursuitId={pursuitId}
                sessionActive={sessionActive}
              />
            </div>
          )}

          {activeTab === "autonomy" && (
            <div className="space-y-4">
              <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-3.5">
                <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
                  Autonomy &amp; Automation Permissions
                </h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
                  Control what Stryde may prepare or execute autonomously. Consequential worker tasks always require your approval.
                </p>
              </div>

              <PursuitAutonomyRow
                pursuitId={pursuitId}
                sessionActive={sessionActive}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
