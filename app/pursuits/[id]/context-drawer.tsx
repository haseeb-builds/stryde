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

  const tabs: Array<{ id: ContextDrawerTab; label: string }> = [
    { id: "sources", label: "Sources & Files" },
    { id: "claims", label: "Evidence & Claims" },
    { id: "memory", label: "Memories" },
    { id: "artifacts", label: "Deliverables" },
    { id: "skills", label: "Saved Procedures" },
    { id: "autonomy", label: "Permissions" }
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="context-drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={drawerRef}
        className="flex h-full w-full max-w-2xl flex-col border-l border-[#E7E7E4] bg-[#F7F7F5] shadow-2xl"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[#E7E7E4] bg-[#FCFCFB] px-5 py-4 sm:px-6">
          <div>
            <h2
              id="context-drawer-title"
              className="text-base font-semibold tracking-tight text-[#111111]"
            >
              Context, Sources &amp; Deliverables
            </h2>
            <p className="mt-0.5 text-xs text-[#52525B]">
              Inspect grounded sources, claims, memories, procedures, and permissions.
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
                className="rounded-full bg-[#111111] px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
              >
                + Add context
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="rounded-full bg-[#F3F2EF] px-3 py-1.5 text-xs font-medium text-[#52525B] hover:text-[#111111] transition-colors"
            >
              Close ✕
            </button>
          </div>
        </div>

        {/* Horizontal Navigation Pill Tabs */}
        <div className="flex overflow-x-auto gap-1.5 border-b border-[#E7E7E4] bg-[#F3F2EF] px-4 py-2.5 sm:px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-[#111111] text-white shadow-xs"
                  : "bg-[#FCFCFB] border border-[#E7E7E4] text-[#52525B] hover:text-[#111111]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drawer Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {activeTab === "sources" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#E7E7E4] bg-[#FCFCFB] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
                  Sources &amp; Grounded Evidence
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-[#52525B] leading-relaxed">
                  Source material ingested for this pursuit. Stryde audits claims against your specific constraints.
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
              <div className="rounded-2xl border border-[#E7E7E4] bg-[#FCFCFB] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
                  Evidence &amp; Claims Ledger
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-[#52525B] leading-relaxed">
                  Assertions and empirical observations. Self-reported claims remain Reported until grounded in evidence.
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
              <div className="rounded-2xl border border-[#E7E7E4] bg-[#FCFCFB] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
                  Pursuit Memories
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-[#52525B] leading-relaxed">
                  Persistent facts, preferences, and verified conclusions remembered across conversation turns.
                </p>
              </div>

              <PursuitMemoryPanel
                pursuitId={pursuitId}
                sessionActive={sessionActive}
              />
            </div>
          )}

          {activeTab === "artifacts" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#E7E7E4] bg-[#FCFCFB] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
                  Deliverables &amp; Artifacts
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-[#52525B] leading-relaxed">
                  Generated documents, code, templates, and roadmaps with full revision history.
                </p>
              </div>

              <PursuitArtifactsPanel
                pursuitId={pursuitId}
                sessionActive={sessionActive}
              />
            </div>
          )}

          {activeTab === "skills" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#E7E7E4] bg-[#FCFCFB] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
                  Saved Procedures &amp; Reusable Steps
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-[#52525B] leading-relaxed">
                  Proven routines that Stryde can execute reliably for similar tasks.
                </p>
              </div>

              <PursuitSkillsPanel
                pursuitId={pursuitId}
                sessionActive={sessionActive}
              />
            </div>
          )}

          {activeTab === "autonomy" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#E7E7E4] bg-[#FCFCFB] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
                  Execution Permissions
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-[#52525B] leading-relaxed">
                  Define what Stryde may execute or research autonomously. Consequential actions always ask for authorization.
                </p>
              </div>

              <PursuitAutonomyRow
                pursuitId={pursuitId}
                sessionActive={sessionActive}
              />
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-[#E7E7E4] bg-[#FCFCFB] p-4 px-6 text-xs text-[#52525B] flex items-center justify-between">
          <span>Stryde verifies outcomes against reality before marking them done.</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-[#111111] hover:underline"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
