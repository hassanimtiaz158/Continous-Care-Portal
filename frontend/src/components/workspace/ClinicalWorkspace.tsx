import React, { useState, useEffect } from "react";
import { Role } from "../../types/auth";
import { PatientData } from "../../types/patient";
import { BoardResult, WorkflowStage } from "../../types/board";
import { ContextPanel } from "./ContextPanel";
import { WorkspaceCanvas } from "./WorkspaceCanvas";
import { fetchChat, sendChat } from "@/lib/api";

interface ClinicalWorkspaceProps {
  patient: PatientData;
  user: { name: string };
  role: Role;
  roleLabel: string;
  onBack: () => void;
  onAskShura: () => void;
  onRunBoard: () => Promise<void>;
  onApprove: () => void;
  onReject: () => void;
  sessionId: string | null;
  onFieldChange: (
    section: "screening" | "glycemic" | "vitals" | "renal" | "cardiac" | "ecg",
    field: string,
    value: string,
  ) => void;
  boardResult: BoardResult | null;
  proveItMode: boolean;
  onToggleProveIt: () => void;
}

export function ClinicalWorkspace({
  patient,
  user,
  role,
  roleLabel,
  onBack,
  onAskShura,
  onRunBoard,
  onApprove,
  onReject,
  sessionId,
  onFieldChange,
  boardResult,
  proveItMode,
  onToggleProveIt,
}: ClinicalWorkspaceProps) {
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);

  // Local state to manage the workflow progress based on props
  const [isRunningBoard, setIsRunningBoard] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Compute completeness
  const checkFields = ["vitals.bp", "screening.symptoms", "glycemic.hba1c", "renal.creatinine"];
  const filled = checkFields.filter((f) => {
    const [sec, key] = f.split(".");
    return !!(patient as any)[sec]?.[key];
  }).length;
  const completeness = Math.round((filled / checkFields.length) * 100);

  // Derive stage
  let stage: WorkflowStage = "intake";
  if (completeness > 0) stage = "evidence";
  if (isRunningBoard) stage = "deliberation";
  if (boardResult) stage = "consensus";
  if (boardResult) stage = "review";
  if (patient.status === "stable" && boardResult) stage = "finalized";

  const handleRunBoard = async () => {
    setIsRunningBoard(true);
    await onRunBoard();
    setIsRunningBoard(false);
  };

  // Chat polling
  useEffect(() => {
    if (!sessionId) return;
    fetchChat(patient.id)
      .then((msgs) => {
        if (msgs) setChatMessages(msgs);
      })
      .catch(console.error);

    const interval = setInterval(async () => {
      const msgs = await fetchChat(patient.id);
      if (msgs) setChatMessages(msgs);
    }, 3000);
    return () => clearInterval(interval);
  }, [patient.id, sessionId]);

  const handleSendChat = async (text: string) => {
    if (!sessionId) return;
    const optimistic = { role: "user", content: text };
    setChatMessages((prev) => [...prev, optimistic]);
    await sendChat(patient.id, user.name, role, text);
    const msgs = await fetchChat(patient.id);
    if (msgs) setChatMessages(msgs);
  };

  return (
    <div className="flex-1 h-full w-full flex flex-col md:flex-row bg-void overflow-y-auto md:overflow-hidden">
      <WorkspaceCanvas
        patient={patient}
        onFieldChange={onFieldChange}
        boardResult={boardResult}
        onRunBoard={handleRunBoard}
        isRunningBoard={isRunningBoard}
        onApprove={onApprove}
        onReject={onReject}
        isLocked={stage === "finalized"}
        sessionId={sessionId}
        chatMessages={chatMessages}
        onSendChat={handleSendChat}
        currentStage={stage}
        proveItMode={proveItMode}
        onToggleProveIt={onToggleProveIt}
        hoveredMetric={hoveredMetric}
        onHoverMetric={setHoveredMetric}
      />
      <ContextPanel
        patient={patient}
        onBack={onBack}
        currentStage={stage}
        onAskShura={onAskShura}
        dataCompleteness={completeness}
      />
    </div>
  );
}
