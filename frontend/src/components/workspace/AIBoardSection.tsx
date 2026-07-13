import React, { useEffect, useState } from 'react';
import { BoardResult } from './types';
import { motion } from 'framer-motion';
import { Activity, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIBoardSectionProps {
  boardResult: BoardResult | null;
  onRunBoard: () => void;
  isLocked?: boolean;
  isRunning?: boolean;
  onDeliberationComplete?: () => void;
}

export function AIBoardSection({ boardResult, onRunBoard, isLocked, isRunning, onDeliberationComplete }: AIBoardSectionProps) {
  const [activeSpecialistIdx, setActiveSpecialistIdx] = useState<number>(-1);
  const [telemetry, setTelemetry] = useState<string[]>([]);

  useEffect(() => {
    if (isRunning) {
      setActiveSpecialistIdx(-1);
      const logs = [
        "Initializing AI Board Context...",
        "Validating clinical evidence hash...",
        "Fetching latest guidelines for Endocrinology...",
        "Nephrology agent analyzing renal panel...",
        "Cardiology agent assessing ECG...",
        "Cross-referencing drug interactions...",
        "Synthesizing preliminary findings...",
        "Waiting for consensus convergence..."
      ];
      let i = 0;
      const interval = setInterval(() => {
        if (i < logs.length) {
          setTelemetry(prev => [...prev, logs[i]]);
          i++;
        }
      }, 500);
      return () => clearInterval(interval);
    } else {
      setTelemetry([]);
    }
  }, [isRunning]);

  useEffect(() => {
    if (boardResult && !isRunning) {
      let step = 0;
      setActiveSpecialistIdx(0);
      const interval = setInterval(() => {
        step++;
        setActiveSpecialistIdx(step);
        if (step >= 2) {
          clearInterval(interval);
          if (onDeliberationComplete) onDeliberationComplete();
        }
      }, 800);
      return () => clearInterval(interval);
    }
  }, [boardResult, isRunning]);

  const specialists = [
    { id: 'endo', label: 'ENDOCRINOLOGY' },
    { id: 'neph', label: 'NEPHROLOGY' },
    { id: 'cardio', label: 'CARDIOLOGY' },
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
        <div className="bg-void p-6 border-b border-line h-64 overflow-y-auto font-mono text-[10px] text-teal/80 flex flex-col justify-end">
          {telemetry.map((log, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="py-1">
              <span className="text-muted mr-2">{new Date().toISOString().split('T')[1].slice(0, 8)}</span>
              {log}
            </motion.div>
          ))}
          <div className="py-1 animate-pulse flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-teal rounded-full" /> Awaiting backend response...
          </div>
        </div>
      )}

      {boardResult && !isRunning && (
        <div className="flex flex-col gap-px bg-line">
          {specialists.map((spec, i) => {
            const isProcessing = boardResult && activeSpecialistIdx === i;
            const isDone = boardResult && activeSpecialistIdx > i;
            const isWaiting = boardResult && activeSpecialistIdx < i;

            const res = boardResult?.specialist_results[spec.id];
            
            return (
              <div key={spec.id} className={cn(
                "bg-void-2 flex flex-col transition-all duration-500",
                isWaiting ? "opacity-30 grayscale" : "opacity-100 grayscale-0"
              )}>
                <div className="flex items-center justify-between border-b border-line px-4 py-2 bg-void">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      isDone ? "bg-teal" : isProcessing ? "bg-gold animate-pulse" : "bg-muted"
                    )} />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-cream">{spec.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-muted">
                    {isDone ? (
                      <span className="text-teal flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Complete</span>
                    ) : isProcessing ? (
                      <span className="text-gold flex items-center gap-1"><Activity className="w-3 h-3"/> Processing</span>
                    ) : (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> Waiting</span>
                    )}
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Confidence & Status */}
                  <div className="col-span-1 flex flex-col gap-4 border-r border-line pr-4">
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-muted block mb-1">Confidence</span>
                      {isDone && res ? (
                        <div className="flex items-end gap-2">
                          <motion.span 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            className="font-serif text-3xl text-cream leading-none"
                          >
                            {res.confidence}%
                          </motion.span>
                        </div>
                      ) : (
                        <span className="font-serif text-2xl text-muted leading-none">--%</span>
                      )}
                    </div>
                    {isDone && res?.warn && (
                      <div className="bg-rose/10 border border-rose/30 p-2 rounded flex gap-2 text-rose">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                        <span className="text-[10px] font-mono leading-tight uppercase tracking-wide">Conflict Flagged</span>
                      </div>
                    )}
                  </div>

                  {/* Reasoning & Findings */}
                  <div className="col-span-3 flex flex-col gap-4">
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-muted block mb-2">Findings</span>
                      {isDone && res ? (
                        <ul className="flex flex-col gap-1.5">
                          {res.findings.map((f: any, idx: number) => (
                            <motion.li 
                              initial={{ opacity: 0, x: -10 }} 
                              animate={{ opacity: 1, x: 0 }} 
                              transition={{ delay: idx * 0.1 }}
                              key={idx} 
                              className="text-xs text-cream flex items-start gap-2"
                            >
                              <span className="text-gold font-mono text-[9px] mt-0.5">0{idx+1}</span>
                              <span className="leading-relaxed">{f.text}</span>
                            </motion.li>
                          ))}
                        </ul>
                      ) : (
                        <div className="h-4 w-1/2 bg-line/20 rounded animate-pulse" />
                      )}
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-muted block mb-1">Recommendation</span>
                      {isDone && res ? (
                        <motion.p 
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
                          className="text-sm text-cream leading-relaxed border-l-[2px] border-gold pl-3 py-1"
                        >
                          {res.recommendation}
                        </motion.p>
                      ) : (
                        <div className="h-8 w-full bg-line/20 rounded animate-pulse" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
