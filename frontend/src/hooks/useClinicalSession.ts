import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { askShura as apiAskShura, runBoard, recordDecision, transferToBoard } from "../lib/api";
import { User } from "../types/auth";
import { PatientData } from "../types/patient";
import { BoardResult } from "../types/board";

export function useClinicalSession(
  user: User | null,
  setAllPatients: React.Dispatch<React.SetStateAction<PatientData[]>>,
) {
  const [activePatient, setActivePatient] = useState<PatientData | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [boardResult, setBoardResult] = useState<BoardResult | null>(null);
  const [proveItMode, setProveItMode] = useState(false);
  const [qdOpen, setQdOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setQdOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const openPatient = useCallback((p: PatientData) => {
    setActivePatient(p);
    setActivePage(1);
    setSessionId(null);
    setBoardResult(null);
    setProveItMode(false);
  }, []);

  const gotoPage = useCallback((n: number) => setActivePage(n), []);

  const handleFieldChange = useCallback(
    (
      section: "screening" | "glycemic" | "vitals" | "renal" | "cardiac" | "ecg",
      field: string,
      value: string,
    ) => {
      setActivePatient((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, [section]: { ...prev[section], [field]: value } };
        setAllPatients((list) => list.map((p) => (p.id === updated.id ? updated : p)));
        return updated;
      });
    },
    [setAllPatients],
  );

  const handleAskShura = useCallback(async () => {
    const input = document.getElementById("askInput") as HTMLInputElement;
    const reply = document.getElementById("askReply");
    if (!input || !reply || !activePatient) return;
    const q = input.value.trim();
    if (!q) return;
    reply.style.display = "block";
    reply.textContent = "Thinking...";
    try {
      const res = await apiAskShura(activePatient.id, q);
      reply.textContent = res.answer;
    } catch {
      reply.textContent = `Based on your approved care plan: ${activePatient.edu}`;
    }
  }, [activePatient]);

  const handleTransferBoard = useCallback(
    (btn: HTMLElement) => {
      btn.classList.add("sent");
      btn.textContent = "✓ Sent to Specialist Board";
      if (activePatient) transferToBoard(activePatient.id).catch(() => {});
    },
    [activePatient],
  );

  const handleRunBoard = useCallback(async () => {
    if (!activePatient || !user) return;
    try {
      const result = await runBoard(activePatient.id);
      setSessionId(result.session_id);
      setBoardResult(result);
    } catch {
      toast.error(
        "Board unavailable — DASHSCOPE_API_KEY not configured or service down. Showing demo data instead.",
      );
    }
  }, [activePatient, user]);

  const handleApprove = useCallback(async () => {
    if (!sessionId || !user) {
      toast.error("No active board session. Convene the board first.");
      return;
    }
    try {
      await recordDecision({
        session_id: sessionId,
        decision: "approved",
        physician_name: user.name,
        physician_note: "Plan approved and released to Family Medicine.",
      });
      toast.success("Plan approved and released to Family Medicine.");
    } catch {
      toast.error("Failed to record decision.");
    }
  }, [sessionId, user]);

  const handleReject = useCallback(async () => {
    if (!sessionId || !user) {
      toast.error("No active board session.");
      return;
    }
    try {
      await recordDecision({
        session_id: sessionId,
        decision: "rejected",
        physician_name: user.name,
        physician_note: "Plan rejected — returned to Specialist Board.",
      });
      toast.success("Plan rejected — returned to Specialist Board.");
    } catch {
      toast.error("Failed to record decision.");
    }
  }, [sessionId, user]);

  return {
    activePatient,
    setActivePatient,
    activePage,
    gotoPage,
    sessionId,
    boardResult,
    proveItMode,
    setProveItMode,
    qdOpen,
    setQdOpen,
    openPatient,
    handleFieldChange,
    handleAskShura,
    handleTransferBoard,
    handleRunBoard,
    handleApprove,
    handleReject,
  };
}
