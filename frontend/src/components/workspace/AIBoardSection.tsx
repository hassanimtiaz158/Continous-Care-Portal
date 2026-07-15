import React from "react";
import { BoardResult } from "../../types/board";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, AlertTriangle, Scale, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIBoardSectionProps {
  boardResult: BoardResult | null;
  onRunBoard: () => void;
  isLocked?: boolean;
  isRunning?: boolean;
  onDeliberationComplete?: () => void;
}

export function AIBoardSection({
  boardResult,
  onRunBoard,
  isLocked,
  isRunning,
  onDeliberationComplete,
}: AIBoardSectionProps) {
  React.useEffect(() => {
    if (boardResult && !isRunning && onDeliberationComplete) {
      onDeliberationComplete();
    }
  }, [boardResult, isRunning, onDeliberationComplete]);

  const specialists = [
    { id: "endocrine", label: "ENDOCRINOLOGY" },
    { id: "nephrology", label: "NEPHROLOGY" },
    { id: "cardiology", label: "CARDIOLOGY" },
  ];

  return (
    <div className="flex flex-col gap-px bg-line border-y border-line">
      {!boardResult && !isRunning && !isLocked && (
        <div className="bg-void-2 p-8 flex flex-col items-center justify-center text-center">
          <p className="text-muted text-xs font-mono uppercase tracking-widest mb-6">
            Dossier compiled. Ready for multi-agent deliberation.
          </p>
          <button
            onClick={onRunBoard}
            className="h-8 px-6 border border-gold text-gold font-mono uppercase tracking-widest text-xs hover:bg-gold hover:text-void transition-colors"
          >
            Commence Deliberation
          </button>
        </div>
      )}

      {isRunning && !boardResult && (
        <div className="bg-void p-6 border-b border-line h-32 flex flex-col items-center justify-center font-mono text-[10px] text-teal/80">
          <div className="py-1 animate-pulse flex items-center gap-2 text-sm text-gold">
            <Activity className="w-4 h-4" /> Awaiting live backend deliberation...
          </div>
        </div>
      )}

      {boardResult && !isRunning && (
        <div className="flex flex-col gap-px bg-line">
          {/* Specialists */}
          {specialists.map((spec) => {
            const res = boardResult.specialist_results[spec.id];
            if (!res) return null;

            return (
              <div key={spec.id} className="bg-void-2 flex flex-col">
                <div className="flex items-center justify-between border-b border-line px-4 py-2 bg-void">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-teal" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-cream">
                      {spec.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-muted">
                    <span className="text-teal flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Complete
                    </span>
                  </div>
                </div>

                <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-4 gap-8">
                  {/* Confidence & Status */}
                  <div className="col-span-1 flex flex-col gap-4 border-r border-line pr-4">
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-muted block mb-1">
                        Confidence
                      </span>
                      <div className="flex items-end gap-2">
                        <motion.span
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="font-serif text-3xl text-cream leading-none"
                        >
                          {res.confidence || 0}%
                        </motion.span>
                      </div>
                    </div>
                    {res.warn && (
                      <div className="bg-rose/10 border border-rose/30 p-2 rounded flex gap-2 text-rose">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                        <span className="text-[10px] font-mono leading-tight uppercase tracking-wide">
                          Conflict Flagged
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Reasoning & Findings */}
                  <div className="col-span-3 flex flex-col gap-4">
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-muted block mb-2">
                        Findings
                      </span>
                      <ul className="flex flex-col gap-1.5">
                        {res.findings.map((f: any, idx: number) => (
                          <motion.li
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            key={idx}
                            className="text-xs text-cream flex items-start gap-2"
                          >
                            <span className="text-gold font-mono text-[9px] mt-0.5">
                              0{idx + 1}
                            </span>
                            <span className="leading-relaxed">{f.text}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-muted block mb-1">
                        Recommendation
                      </span>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-cream leading-relaxed border-l-[2px] border-gold pl-3 py-1"
                      >
                        {res.recommendation}
                      </motion.p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pharmacology Agent */}
          {boardResult.pharmacology_result && (
            <div className="bg-void-2 flex flex-col border-t-2 border-line">
              <div className="flex items-center justify-between border-b border-line px-4 py-2 bg-void">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-teal" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-cream">
                    PHARMACOLOGY
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-muted">
                  <span className="text-teal flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Complete
                  </span>
                </div>
              </div>

              <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="col-span-1 flex flex-col gap-4 border-r border-line pr-4">
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted block mb-1">
                      Confidence
                    </span>
                    <div className="flex items-end gap-2">
                      <motion.span
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="font-serif text-3xl text-cream leading-none"
                      >
                        {boardResult.pharmacology_confidence || 0}%
                      </motion.span>
                    </div>
                  </div>
                  {boardResult.pharmacology_result.risk_level === "high" && (
                    <div className="bg-rose/10 border border-rose/30 p-2 rounded flex gap-2 text-rose">
                      <ShieldCheck className="w-3 h-3 shrink-0 mt-0.5" />
                      <span className="text-[10px] font-mono leading-tight uppercase tracking-wide">
                        Safety Flag
                      </span>
                    </div>
                  )}
                </div>

                <div className="col-span-3 flex flex-col gap-4">
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted block mb-2">
                      Safety Findings
                    </span>
                    <ul className="flex flex-col gap-1.5">
                      {boardResult.pharmacology_result.findings.map((f: any, idx: number) => (
                        <li key={idx} className="text-xs text-cream flex items-start gap-2">
                          <span className="text-gold font-mono text-[9px] mt-0.5">0{idx + 1}</span>
                          <span className="leading-relaxed">{f.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted block mb-1">
                      Recommendation
                    </span>
                    <p className="text-sm text-cream leading-relaxed border-l-[2px] border-gold pl-3 py-1">
                      {boardResult.pharmacology_result.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Board Chair / Consensus */}
          {boardResult.consensus && (
            <div className="bg-void flex flex-col border-t-[4px] border-gold/30">
              <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-void-2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gold" />
                  <span className="text-xs font-serif uppercase tracking-widest text-gold font-semibold">
                    BOARD CHAIR SYNTHESIS
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-muted">
                  <span className="text-gold flex items-center gap-1">
                    <Scale className="w-3 h-3" /> Consensus Reached
                  </span>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-gold/80 block mb-3">
                    Joint Plan Proposal
                  </span>
                  <p className="text-sm text-cream leading-relaxed whitespace-pre-wrap">
                    {boardResult.consensus.joint_plan}
                  </p>
                </div>

                <div className="flex flex-col gap-6">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-gold/80 block mb-3">
                      Priority Actions
                    </span>
                    <ul className="flex flex-col gap-2">
                      {boardResult.consensus.priority_actions.map((act: string, idx: number) => (
                        <li key={idx} className="text-xs text-cream flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-gold/50 mt-1 shrink-0" />
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {boardResult.consensus.conflicts &&
                    boardResult.consensus.conflicts.length > 0 && (
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-rose block mb-3">
                          Resolved Conflicts
                        </span>
                        <ul className="flex flex-col gap-2">
                          {boardResult.consensus.conflicts.map((c: string, idx: number) => (
                            <li key={idx} className="text-xs text-rose/90 flex items-start gap-2">
                              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-rose/50" />
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
