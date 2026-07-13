import React from 'react';
import { BoardResult } from './types';
import { motion } from 'framer-motion';
import { CheckCircle, AlertOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConsensusSectionProps {
  boardResult: BoardResult | null;
}

export function ConsensusSection({ boardResult }: ConsensusSectionProps) {
  if (!boardResult) return null; // Only appear after deliberation finishes

  const conflicts = boardResult.consensus.conflicts || [];
  const hasConflicts = conflicts.length > 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-px bg-line border-y border-line"
    >
      <div className="bg-void-2 p-6 flex flex-col md:flex-row gap-6">
        
        {/* Main Recommendation */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className={cn("w-2.5 h-2.5 rounded-full", hasConflicts ? "bg-rose" : "bg-teal")} />
            <h4 className="font-serif text-xl text-cream">Board Consensus Reached</h4>
          </div>
          <p className="text-sm leading-relaxed text-cream border-l-[2px] border-line pl-4">
            {boardResult.consensus.joint_plan}
          </p>

          <div className="mt-4">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted block mb-2">Priority Actions</span>
            <div className="flex flex-col gap-2">
              {boardResult.consensus.priority_actions.map((act, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-cream bg-void border border-line px-3 py-2 rounded-sm">
                  <span className="text-gold mt-0.5"><CheckCircle className="w-3 h-3" /></span>
                  {act}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Telemetry / Summary */}
        <div className="w-full md:w-64 shrink-0 bg-void border border-line p-4 rounded-sm flex flex-col gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted block mb-1">Overall Confidence</span>
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-3xl text-cream leading-none">{boardResult.confidence_scores.consensus || 88}%</span>
            </div>
            <div className="w-full h-1 bg-void-3 mt-2 rounded-full overflow-hidden">
              <div className="h-full bg-gold" style={{ width: `${boardResult.confidence_scores.consensus || 88}%` }} />
            </div>
          </div>

          <div className="h-px bg-line w-full" />

          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted block mb-2">Cross-Audit Status</span>
            {hasConflicts ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-rose text-[10px] font-mono uppercase tracking-widest">
                  <AlertOctagon className="w-3 h-3" /> {conflicts.length} Conflict(s) Detected
                </div>
                <ul className="flex flex-col gap-1">
                  {conflicts.map((c, i) => (
                    <li key={i} className="text-xs text-rose/80 leading-tight border-l border-rose/30 pl-2">{c}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-teal text-[10px] font-mono uppercase tracking-widest">
                <CheckCircle className="w-3 h-3" /> Unanimous Support
              </div>
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
}
