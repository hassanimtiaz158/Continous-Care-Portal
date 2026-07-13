import React, { useState, useEffect } from 'react';
import { Role, PatientData, BoardResult, WorkflowStage } from './types';
import { ContextPanel } from './ContextPanel';
import { WorkspaceCanvas } from './WorkspaceCanvas';
import { fetchChat, sendChat } from '@/lib/api';

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
  onFieldChange: (section: "screening"|"glycemic"|"vitals"|"renal"|"cardiac"|"ecg", field: string, value: string) => void;
  boardResult: BoardResult | null;
  proveItMode: boolean;
  onToggleProveIt: () => void;
}

export function ClinicalWorkspace({
  patient, user, role, roleLabel, onBack, onAskShura,
  onRunBoard, onApprove, onReject, sessionId, onFieldChange, boardResult,
  proveItMode, onToggleProveIt
}: ClinicalWorkspaceProps) {
  
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);
  
  // Local state to manage the workflow progress based on props
  const [isRunningBoard, setIsRunningBoard] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Compute completeness
  const checkFields = ['vitals.bp', 'screening.symptoms', 'glycemic.hba1c', 'renal.creatinine'];
  const filled = checkFields.filter(f => {
    const [sec, key] = f.split('.');
    return !!(patient as any)[sec]?.[key];
  }).length;
  const completeness = Math.round((filled / checkFields.length) * 100);

  // Derive stage
  let stage: WorkflowStage = 'intake';
  if (completeness > 0) stage = 'evidence';
  if (isRunningBoard) stage = 'deliberation';
  if (boardResult) stage = 'consensus';
  if (boardResult) stage = 'review';
  if (patient.status === 'stable' && boardResult) stage = 'finalized';

  const handleRunBoard = async () => {
    setIsRunningBoard(true);
    await onRunBoard();
    setIsRunningBoard(false);
  };

  // Chat polling
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      const msgs = await fetchChat(sessionId);
      if (msgs) setChatMessages(msgs);
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleSendChat = async (text: string) => {
    if (!sessionId) return;
    const optimistic = { role: 'user', content: text };
    setChatMessages(prev => [...prev, optimistic]);
    await sendChat(sessionId, text);
    const msgs = await fetchChat(sessionId);
    if (msgs) setChatMessages(msgs);
  };

  return (
    <div className="flex h-screen w-full bg-void overflow-hidden absolute inset-0 z-50">
      <ContextPanel 
        patient={patient} 
        onBack={onBack} 
        currentStage={stage} 
        onAskShura={onAskShura} 
        dataCompleteness={completeness}
      />
      <WorkspaceCanvas 
        patient={patient}
        onFieldChange={onFieldChange}
        boardResult={boardResult}
        onRunBoard={handleRunBoard}
        isRunningBoard={isRunningBoard}
        onApprove={onApprove}
        onReject={onReject}
        isLocked={stage === 'finalized'}
        sessionId={sessionId}
        chatMessages={chatMessages}
        onSendChat={handleSendChat}
        currentStage={stage}
        proveItMode={proveItMode}
        onToggleProveIt={onToggleProveIt}
        hoveredMetric={hoveredMetric}
        onHoverMetric={setHoveredMetric}
      />
    </div>
  );
}
