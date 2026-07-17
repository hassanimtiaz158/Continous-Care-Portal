import React, { useState, useEffect } from "react";
import { Role } from "../../types/auth";
import { PatientData } from "../../types/patient";
import { BoardResult, WorkflowStage } from "../../types/board";
import { ContextPanel, resolveCardioDiagnosis } from "./ContextPanel";
import { WorkspaceCanvas } from "./WorkspaceCanvas";
import { fetchChat, sendChat, ReferralResponse } from "@/lib/api";

interface ClinicalWorkspaceProps {
  patient: PatientData;
  user: { name: string };
  role: Role;
  roleLabel: string;
  onBack: () => void;
  onAskShura: (question: string, agent?: string) => Promise<{ answer: string }>;
  onRunBoard: () => Promise<void>;
  onApprove: () => void;
  onReject: () => void;
  sessionId: string | null;
  onFieldChange: (
    section: "screening" | "glycemic" | "vitals" | "renal" | "cardiac" | "ecg" | "chiefComplaint",
    field: string,
    value: string,
  ) => void;
  boardResult: BoardResult | null;
  proveItMode: boolean;
  onToggleProveIt: () => void;
  onReferralChange?: (id: string, data: ReferralResponse) => void;
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
  onReferralChange,
}: ClinicalWorkspaceProps) {
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);

  // Local state to manage the workflow progress based on props
  const [isRunningBoard, setIsRunningBoard] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Compute completeness
  const checkFields = ["vitals.bp", "chiefComplaint", "glycemic.hba1c", "renal.creat"];
  const filled = checkFields.filter((f) => {
    if (f === "chiefComplaint") return !!patient.chiefComplaint;
    const [sec, key] = f.split(".");
    return !!(patient as any)[sec]?.[key];
  }).length;
  const completeness = Math.round((filled / checkFields.length) * 100);

  const isCardiac = !!resolveCardioDiagnosis(patient.dx);

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

  // Backend chat rows use {sender_role, text}; the UI expects {role, content}.
  const toUiMessages = (msgs: any[]) =>
    (msgs || []).map((m) => ({ role: m.sender_role, content: m.text }));

  // Chat polling
  useEffect(() => {
    if (!sessionId) return;
    fetchChat(patient.id)
      .then((msgs) => setChatMessages(toUiMessages(msgs)))
      .catch(console.error);

    const interval = setInterval(async () => {
      const msgs = await fetchChat(patient.id);
      setChatMessages(toUiMessages(msgs));
    }, 3000);
    return () => clearInterval(interval);
  }, [patient.id, sessionId]);

  const handleSendChat = async (text: string) => {
    if (!sessionId) return;
    const optimistic = { role: "user", content: text };
    setChatMessages((prev) => [...prev, optimistic]);
    await sendChat(patient.id, user.name, role, text);
    const msgs = await fetchChat(patient.id);
    setChatMessages(toUiMessages(msgs));
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
        isCardiac={isCardiac}
      />
      <ContextPanel
        patient={patient}
        user={user}
        roleLabel={roleLabel}
        onBack={onBack}
        currentStage={stage}
        onAskShura={onAskShura}
        dataCompleteness={completeness}
        onReferralChange={onReferralChange}
      />
    </div>
  );
}
