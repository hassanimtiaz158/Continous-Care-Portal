import React, { useState, useEffect } from "react";
import { PatientData } from "../../types/patient";
import { BoardResult, WorkflowStage } from "../../types/board";
import { ClinicalEvidence } from "./ClinicalEvidence";
import { AIBoardSection } from "./AIBoardSection";
import { ConsensusSection } from "./ConsensusSection";
import { GroundingValidation } from "./GroundingValidation";
import { PhysicianDecision } from "./PhysicianDecision";
import { ClinicalDiscussion } from "./ClinicalDiscussion";
import { AuditSummary } from "./AuditSummary";
import { WorkflowStageWrapper } from "./WorkflowStageWrapper";
import { ExportOverlay } from "./ExportOverlay";
import { motion, AnimatePresence } from "framer-motion";

interface WorkspaceCanvasProps {
  patient: PatientData;
  onFieldChange: (
    section: "screening" | "glycemic" | "vitals" | "renal" | "cardiac" | "ecg" | "chiefComplaint",
    field: string,
    value: string,
  ) => void;
  boardResult: BoardResult | null;
  onRunBoard: () => void;
  isRunningBoard: boolean;
  onApprove: () => void;
  onReject: () => void;
  isLocked: boolean;
  sessionId: string | null;
  chatMessages: { role: string; content: string }[];
  onSendChat: (msg: string) => Promise<void>;
  currentStage: WorkflowStage;
  proveItMode: boolean;
  onToggleProveIt: () => void;
  hoveredMetric: string | null;
  onHoverMetric: (metric: string | null) => void;
}

export function WorkspaceCanvas({
  patient,
  onFieldChange,
  boardResult,
  onRunBoard,
  isRunningBoard,
  onApprove,
  onReject,
  isLocked,
  sessionId,
  chatMessages,
  onSendChat,
  currentStage,
  proveItMode,
  onToggleProveIt,
  hoveredMetric,
  onHoverMetric,
}: WorkspaceCanvasProps) {
  const [deliberationComplete, setDeliberationComplete] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // If patient changes, reset deliberation completion
  useEffect(() => {
    setDeliberationComplete(false);
    setIsExporting(false);
  }, [patient.id]);

  // Track previous lock state to trigger the sweep animation precisely once when it locks
  const [showSweep, setShowSweep] = useState(false);
  useEffect(() => {
    if (isLocked) {
      setShowSweep(true);
      const t = setTimeout(() => setShowSweep(false), 2000);
      return () => clearTimeout(t);
    }
  }, [isLocked]);

  const getStatus = (stage: WorkflowStage) => {
    if (isLocked) return "locked";

    const stages: WorkflowStage[] = [
      "intake",
      "evidence",
      "deliberation",
      "consensus",
      "review",
      "finalized",
    ];
    const currIdx = stages.indexOf(currentStage);
    const thisIdx = stages.indexOf(stage);

    // Block downstream stages until deliberation actually finishes animating
    if (!deliberationComplete && thisIdx > stages.indexOf("deliberation")) {
      return "pending";
    }

    if (thisIdx === currIdx) return "active";
    if (thisIdx < currIdx) return "completed";
    return "pending";
  };

  return (
    <div
      className={`flex-1 h-auto md:h-full overflow-visible md:overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth relative transition-colors duration-500 ${proveItMode ? "bg-void-3" : "bg-void"}`}
    >
      {/* Prove It Mode Toggle */}
      <div className="absolute top-4 right-8 z-50">
        <button
          onClick={onToggleProveIt}
          className={`px-3 py-1.5 rounded-full border text-xs font-mono transition-all flex items-center gap-2 ${
            proveItMode
              ? "border-teal bg-teal/10 text-teal shadow-[0_0_15px_rgba(45,212,191,0.2)]"
              : "border-line text-muted hover:border-teal/50 hover:text-teal/80"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${proveItMode ? "bg-teal animate-pulse" : "bg-muted"}`}
          />
          {proveItMode ? "PROVE IT MODE: ACTIVE" : "PROVE IT MODE"}
        </button>
      </div>

      {/* Global Workspace Seal Sweep Animation */}
      <AnimatePresence>
        {showSweep && (
          <motion.div
            className="absolute top-0 bottom-0 w-2 bg-gold z-50 shadow-[0_0_30px_10px_rgba(201,162,39,0.5)] pointer-events-none"
            initial={{ left: "-10%" }}
            animate={{ left: "110%" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      <div className="w-full">
        {/* 1. Clinical Evidence */}
        <WorkflowStageWrapper
          id="evidence"
          title="Clinical Evidence"
          status={getStatus("evidence")}
          summary={
            <span className="text-xs text-muted font-mono">
              {Object.keys(patient.screening).length + Object.keys(patient.vitals).length} data
              points verified
            </span>
          }
        >
          <ClinicalEvidence
            patient={patient}
            onFieldChange={onFieldChange}
            isLocked={isLocked || currentStage !== "evidence"}
            proveItMode={proveItMode}
            hoveredMetric={hoveredMetric}
          />
        </WorkflowStageWrapper>

        {/* 2. AI Deliberation */}
        <WorkflowStageWrapper
          id="deliberation"
          title="AI Deliberation"
          status={getStatus("deliberation")}
          summary={
            <span className="text-xs text-muted font-mono">
              {deliberationComplete
                ? "Specialist board deliberation complete"
                : "Awaiting deliberation"}
            </span>
          }
        >
          <AIBoardSection
            boardResult={boardResult}
            onRunBoard={onRunBoard}
            isLocked={isLocked}
            isRunning={isRunningBoard}
            onDeliberationComplete={() => setDeliberationComplete(true)}
          />
        </WorkflowStageWrapper>

        {/* 3. Consensus */}
        <WorkflowStageWrapper id="consensus" title="Consensus" status={getStatus("consensus")}>
          <ConsensusSection boardResult={boardResult} />
        </WorkflowStageWrapper>

        {/* 4. Grounding Validation */}
        <WorkflowStageWrapper
          id="grounding"
          title="Grounding Validation"
          status={boardResult ? getStatus("consensus") : "pending"}
        >
          <GroundingValidation
            boardResult={boardResult}
            proveItMode={proveItMode}
            onHoverMetric={onHoverMetric}
          />
        </WorkflowStageWrapper>

        {/* 5. Physician Decision */}
        <WorkflowStageWrapper id="review" title="Physician Decision" status={getStatus("review")}>
          {boardResult && (
            <PhysicianDecision
              onApprove={onApprove}
              onReject={onReject}
              isLocked={isLocked}
              onExport={() => setIsExporting(true)}
            />
          )}
        </WorkflowStageWrapper>

        {/* 6. Audit & Discussion (Only visible after lock) */}
        {isLocked && (
          <div className="mt-16 pt-16 border-t border-line">
            <h3 className="font-serif text-xl text-cream mb-6">Post-Decision Audit</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <AuditSummary sessionId={sessionId} />
              <ClinicalDiscussion
                sessionId={sessionId}
                messages={chatMessages}
                onSend={onSendChat}
              />
            </div>
          </div>
        )}
      </div>

      {isExporting && sessionId && (
        <ExportOverlay sessionId={sessionId} onComplete={() => setIsExporting(false)} />
      )}
    </div>
  );
}
