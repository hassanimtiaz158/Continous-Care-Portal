import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

import { WorkflowStage } from "../../types/board";

const STAGES: { id: WorkflowStage; label: string }[] = [
  { id: "intake", label: "Intake" },
  { id: "evidence", label: "Evidence Review" },
  { id: "deliberation", label: "AI Deliberation" },
  { id: "consensus", label: "Consensus" },
  { id: "review", label: "Physician Review" },
  { id: "finalized", label: "Finalized" },
];

export function CaseProgressTracker({ currentStage }: { currentStage: WorkflowStage }) {
  const currentIndex = STAGES.findIndex((s) => s.id === currentStage);

  return (
    <div className="mt-8">
      <h4 className="text-[10px] uppercase tracking-widest text-gold font-mono mb-4">
        Case Progress
      </h4>
      <div className="flex flex-col gap-3 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[1px] before:bg-line">
        {STAGES.map((stage, i) => {
          const isCompleted = i < currentIndex;
          const isActive = i === currentIndex;
          const isPending = i > currentIndex;

          return (
            <div
              key={stage.id}
              className={cn(
                "flex items-center gap-3 relative z-10 transition-colors",
                isActive ? "opacity-100" : isCompleted ? "opacity-70" : "opacity-40",
              )}
            >
              <div
                className={cn(
                  "w-[15px] h-[15px] rounded-full flex items-center justify-center border bg-void transition-colors",
                  isCompleted
                    ? "border-teal text-teal"
                    : isActive
                      ? "border-gold bg-gold/10"
                      : "border-line",
                )}
              >
                {isCompleted ? (
                  <Check className="w-2.5 h-2.5" />
                ) : isActive ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                ) : null}
              </div>
              <span
                className={cn(
                  "text-xs font-mono tracking-wide",
                  isCompleted ? "text-muted" : isActive ? "text-gold" : "text-muted",
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
