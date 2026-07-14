import React from "react";
import { PatientData } from "../../types/patient";
import { WorkflowStage } from "../../types/board";
import { CaseProgressTracker } from "./CaseProgressTracker";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  ArrowLeft,
  Pill,
  AlertTriangle,
  Activity,
  Stethoscope,
  TestTube,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContextPanelProps {
  patient: PatientData;
  onBack: () => void;
  currentStage: WorkflowStage;
  onAskShura: () => void;
  dataCompleteness: number; // 0-100
}

export function ContextPanel({
  patient,
  onBack,
  currentStage,
  onAskShura,
  dataCompleteness,
}: ContextPanelProps) {
  return (
    <div className="w-80 shrink-0 h-full overflow-y-auto border-r border-line bg-void-2 flex flex-col hide-scrollbar relative z-20">
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
          <div className="p-4 rounded-xl border border-line bg-void flex flex-col gap-3">
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

          <div className="mt-auto pt-6 border-t border-line">
            <Button
              variant="outline"
              className="w-full text-gold border-gold/30 hover:bg-gold/5 font-mono uppercase tracking-widest text-xs h-10"
              onClick={onAskShura}
            >
              Ask Shura
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
