import React, { useEffect, useState } from "react";
import { PatientData } from "../../types/patient";
import { WorkflowStage } from "../../types/board";
import { CaseProgressTracker } from "./CaseProgressTracker";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { fetchCareTeam, CareTeamResponse } from "@/lib/api";
import {
  ArrowLeft,
  Pill,
  AlertTriangle,
  Activity,
  Stethoscope,
  TestTube,
  MessageSquare,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Maps the care-team agent_id (from the backend /care-team contract) to the
// agent param the /ask-shura backend understands.
const AGENT_TO_BACKEND: Record<string, string> = {
  amara: "endo",
  rousseau: "card",
  osei: "neph",
  pharmacology: "pharmacology",
  icd10: "icd10",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-gold",
  pending: "bg-muted/40",
  complete: "bg-teal",
};

interface ContextPanelProps {
  patient: PatientData;
  user: { name: string };
  roleLabel: string;
  onBack: () => void;
  currentStage: WorkflowStage;
  onAskShura: (question: string, agent?: string) => Promise<{ answer: string }>;
  dataCompleteness: number; // 0-100
}

export function ContextPanel({
  patient,
  user,
  roleLabel,
  onBack,
  currentStage,
  onAskShura,
  dataCompleteness,
}: ContextPanelProps) {
  const [careTeam, setCareTeam] = useState<CareTeamResponse | null>(null);
  const [careTeamLoading, setCareTeamLoading] = useState(false);
  const [careTeamError, setCareTeamError] = useState<string | null>(null);

  // Active Care Team is derived server-side from real case data; refetch when
  // the selected case changes.
  useEffect(() => {
    let cancelled = false;
    setCareTeamLoading(true);
    setCareTeamError(null);
    fetchCareTeam(patient.id)
      .then((data) => {
        if (!cancelled) setCareTeam(data);
      })
      .catch((e) => {
        if (!cancelled) setCareTeamError(e?.message || "Failed to load care team");
      })
      .finally(() => {
        if (!cancelled) setCareTeamLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patient.id]);

  const [askText, setAskText] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const ask = async (agentKey?: string) => {
    const q = askText.trim();
    if (!q || asking) return;
    setAsking(true);
    setReply("Thinking…");
    try {
      const res = await onAskShura(q, agentKey);
      setReply(res?.answer ?? "");
    } catch (err) {
      // Show an honest failure message — do not echo patient.edu as if it were
      // an AI-generated answer. The backend's own offline-fallback (returning
      // patient.edu in the 200 response when no API key is set) is handled by
      // the happy path above. This catch only fires on a real network/HTTP error.
      const msg = err instanceof Error ? err.message : "Request failed";
      setReply(`⚠ AI service unavailable — ${msg}. Please try again or check backend status.`);
    } finally {
      setAsking(false);
    }
  };


  return (
    <div className="w-full md:w-80 shrink-0 h-auto md:h-full overflow-visible md:overflow-y-auto border-t md:border-t-0 md:border-l border-line bg-void-2 flex flex-col relative z-20">
      <div className="p-6 pb-0 sticky top-0 bg-void-2/90 backdrop-blur-md z-10">
        <button
          onClick={onBack}
          aria-label="Back to Clinical Overview"
          className="text-muted hover:text-cream focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold transition-colors mb-6 flex items-center gap-2 text-xs font-mono uppercase tracking-widest rounded px-1 -ml-1"
        >
          <ArrowLeft className="w-3 h-3" aria-hidden="true" /> Back to Overview
        </button>
      </div>

      <div className="px-6 pb-6 flex flex-col flex-1">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono text-muted border border-line px-1.5 py-0.5 rounded uppercase tracking-widest bg-void">
              Case
            </span>
            <span className="text-xs font-mono text-gold tracking-widest">
              CCP-{patient.id.replace("EG-", "")}
            </span>
          </div>
          <h2 className="text-2xl font-serif text-cream leading-tight">{patient.name}</h2>
          <div className="text-sm text-muted mt-1 font-mono">
            {patient.age}y · {patient.sex}
          </div>
        </div>

        <div className="flex flex-col gap-6 flex-1">
          {/* Status block */}
          <div className="p-5 rounded-xl border border-line bg-void flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
                Clinical Status
              </span>
              {patient.status === "crit" && (
                <Badge variant="destructive" className="h-5 text-[9px] rounded-sm">
                  Critical
                </Badge>
              )}
              {patient.status === "review" && (
                <Badge
                  variant="outline"
                  className="border-gold text-gold h-5 text-[9px] rounded-sm"
                >
                  Review
                </Badge>
              )}
              {patient.status === "stable" && (
                <Badge
                  variant="outline"
                  className="border-teal text-teal h-5 text-[9px] rounded-sm"
                >
                  Stable
                </Badge>
              )}
            </div>
            <div className="h-[1px] bg-line w-full opacity-50" />
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted block mb-1">
                Working DX
              </span>
              <span className="text-sm text-cream">{patient.dx}</span>
            </div>
            {patient.allergies && patient.allergies.length > 0 && (
              <>
                <div className="h-[1px] bg-line w-full opacity-50" />
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-rose block mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Allergies
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {patient.allergies.map((a) => (
                      <span
                        key={a}
                        className="text-[11px] bg-rose/10 text-rose px-1.5 py-0.5 rounded border border-rose/20"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
            {patient.medications && patient.medications.length > 0 && (
              <>
                <div className="h-[1px] bg-line w-full opacity-50" />
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted block mb-1 flex items-center gap-1">
                    <Pill className="w-3 h-3" /> Medications
                  </span>
                  <ul className="text-xs text-cream flex flex-col gap-1">
                    {patient.medications.map((m) => (
                      <li key={m} className="truncate">
                        • {m}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            {patient.vitals && (
              <>
                <div className="h-[1px] bg-line w-full opacity-50" />
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted block mb-1 flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Vital Summary
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted">BP:</span> {patient.vitals.bp || "—"}
                    </div>
                    <div>
                      <span className="text-muted">HR:</span> {patient.vitals.hr || "—"}
                    </div>
                    <div>
                      <span className="text-muted">Wt:</span>{" "}
                      {patient.vitals.weight ? `${patient.vitals.weight}kg` : "—"}
                    </div>
                    <div>
                      <span className="text-muted">Temp:</span>{" "}
                      {patient.vitals.temp ? `${patient.vitals.temp}°C` : "—"}
                    </div>
                  </div>
                </div>
              </>
            )}
            <div className="h-[1px] bg-line w-full opacity-50" />
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted block mb-1">
                Archivist Completeness
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-void-3 border border-line rounded-full overflow-hidden">
                  <div className="h-full bg-teal" style={{ width: `${dataCompleteness}%` }} />
                </div>
                <span className="text-[10px] font-mono text-teal">{dataCompleteness}%</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-line text-muted hover:text-cream hover:bg-void-3 h-8 text-[10px] uppercase font-mono tracking-widest gap-1"
            >
              <TestTube className="w-3 h-3" /> Labs
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-line text-muted hover:text-cream hover:bg-void-3 h-8 text-[10px] uppercase font-mono tracking-widest gap-1"
            >
              <MessageSquare className="w-3 h-3" /> Ping
            </Button>
          </div>

          <CaseProgressTracker currentStage={currentStage} />

          {/* Active Care Team — derived server-side from real case data */}
          <div className="p-5 rounded-xl border border-line bg-void flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-gold" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-gold">
                  Active Care Team
                </span>
              </div>
              {careTeam?.board_chair_active && (
                <span className="text-[9px] font-mono uppercase tracking-widest text-teal border border-teal/30 px-1.5 py-0.5 rounded">
                  Board Chair Active
                </span>
              )}
            </div>

            {careTeamLoading && (
              <p className="text-[11px] text-muted leading-snug">Loading care team…</p>
            )}
            {careTeamError && <p className="text-[11px] text-rose leading-snug">{careTeamError}</p>}
            {careTeam && (
              <div className="flex flex-col gap-2.5">
                {careTeam.agents.map((m) => {
                  const isPending = m.status === "pending";
                  return (
                    <div key={m.agent_id} className={cn("flex gap-2.5", isPending && "opacity-50")}>
                      <div className="shrink-0 mt-1.5">
                        <span
                          className={cn(
                            "block w-2 h-2 rounded-full",
                            STATUS_DOT[m.status] || "bg-muted/40",
                          )}
                          aria-label={`status: ${m.status}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-cream">{m.name}</span>
                          <span className="text-[9px] font-mono uppercase tracking-widest text-muted">
                            {m.specialty}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted leading-snug">{m.reason}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-auto pt-6 border-t border-line flex flex-col gap-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
              Ask the care team
            </div>
            <Input
              value={askText}
              onChange={(e) => setAskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") ask();
              }}
              placeholder="Ask about this case…"
              className="h-9 text-sm bg-void border-line text-cream focus:ring-1 focus:ring-gold/50"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={asking}
                className="border-gold/30 text-gold hover:bg-gold/5 text-[10px] uppercase font-mono tracking-widest h-8"
                onClick={() => ask()}
              >
                Ask Shura
              </Button>
              {careTeam?.board_chair_active && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={asking}
                  className="border-gold/30 text-gold hover:bg-gold/5 text-[10px] uppercase font-mono tracking-widest h-8"
                  onClick={() => ask("board")}
                >
                  Ask Board
                </Button>
              )}
              {careTeam?.agents
                .filter((m) => m.status === "active")
                .map((m) => (
                  <Button
                    key={m.agent_id}
                    variant="outline"
                    size="sm"
                    disabled={asking}
                    className="border-line text-muted hover:text-cream hover:border-gold/30 hover:bg-void-3 text-[10px] uppercase font-mono tracking-widest h-8"
                    onClick={() => ask(AGENT_TO_BACKEND[m.agent_id])}
                  >
                    {m.name.includes("Agent")
                      ? `Ask ${m.agent_id === "pharmacology" ? "Pharmacology" : "ICD-10"}`
                      : `Ask ${m.name.split(" ")[1]}`}
                  </Button>
                ))}
            </div>
            {reply && (
              <div className="text-[11px] leading-relaxed text-cream bg-void border border-line rounded-md p-2.5 max-h-40 overflow-y-auto">
                {reply}
              </div>
            )}
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted/60">
              Consulting: {user.name} · {roleLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
