import React from "react";
import { BoardResult, SpecialistResult, SpecialistFinding } from "../../types/board";
import { motion } from "framer-motion";
import { Link2 } from "lucide-react";

interface GroundingValidationProps {
  boardResult: BoardResult | null;
  proveItMode?: boolean;
  onHoverMetric?: (metric: string | null) => void;
}

export function GroundingValidation({
  boardResult,
  proveItMode,
  onHoverMetric,
}: GroundingValidationProps) {
  if (!boardResult) return null;

  // Extract findings that are explicitly grounded
  const groundedFindings: { agent: string; text: string; metric?: string | null }[] = [];

  Object.entries(boardResult.specialist_results).forEach(([agent, result]: [string, unknown]) => {
    const typedResult = result as SpecialistResult;
    typedResult.findings.forEach((f: SpecialistFinding) => {
      if (f.grounded && f.metric) {
        groundedFindings.push({ agent, text: f.text, metric: f.metric });
      }
    });
  });

  if (groundedFindings.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-px bg-line border-y border-line"
    >
      <div className="bg-void-2 p-6 flex flex-col gap-4">
        <p className="text-xs text-muted max-w-2xl mb-2">
          Every conclusion below is mathematically linked to the primary source data in the
          patient's record. This ensures the AI is not hallucinating clinical observations.
        </p>

        <div className="grid grid-cols-1 gap-px bg-line">
          {groundedFindings.map((finding, idx) => (
            <div
              key={idx}
              className={`flex flex-col md:flex-row items-stretch transition-colors ${proveItMode ? "cursor-pointer hover:bg-gold/5 bg-void-2" : "bg-void"}`}
              onMouseEnter={() => proveItMode && onHoverMetric?.(finding.metric || null)}
              onMouseLeave={() => proveItMode && onHoverMetric?.(null)}
            >
              <div className="w-full md:w-48 shrink-0 border-r border-line p-3 bg-void-3 flex flex-col justify-center gap-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
                  {finding.agent}
                </span>
                <span className="text-[9px] font-mono uppercase tracking-widest text-teal flex items-center gap-1">
                  <Link2 className="w-3 h-3" /> Grounded
                </span>
              </div>
              <div className="flex-1 p-3 flex flex-col gap-2 justify-center">
                <p className="text-xs text-cream/90 font-serif leading-relaxed italic">
                  "{finding.text}"
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted">
                    Source:
                  </span>
                  <span className="text-xs font-mono text-gold bg-gold/10 px-1.5 rounded-sm">
                    {finding.metric}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
