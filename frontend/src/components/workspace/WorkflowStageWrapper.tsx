import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StageStatus = 'pending' | 'active' | 'completed' | 'locked';

interface WorkflowStageWrapperProps {
  id: string;
  title: string;
  status: StageStatus;
  children: React.ReactNode;
  summary?: React.ReactNode;
}

export function WorkflowStageWrapper({ title, status, children, summary }: WorkflowStageWrapperProps) {
  const isPending = status === 'pending';
  const isActive = status === 'active';
  const isCompleted = status === 'completed';
  const isLocked = status === 'locked';

  return (
    <div className={cn(
      "mb-8 border-l-[2px] pl-6 relative transition-all duration-500",
      isPending ? "border-line opacity-40" : 
      isActive ? "border-gold opacity-100" : 
      "border-teal opacity-80",
      isLocked && "border-gold opacity-90"
    )}>
      {/* Node circle */}
      <div className={cn(
        "absolute -left-[11px] top-0 w-[20px] h-[20px] rounded-full border-[2px] bg-void flex items-center justify-center transition-colors duration-500",
        isPending ? "border-line" : 
        isActive ? "border-gold" : 
        "border-teal",
        isLocked && "border-gold"
      )}>
        {isCompleted && <Check className="w-3 h-3 text-teal" />}
        {isLocked && <Lock className="w-2.5 h-2.5 text-gold" />}
        {isActive && <motion.div layoutId="activeDot" className="w-2 h-2 rounded-full bg-gold" />}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={cn(
          "font-serif text-lg transition-colors duration-300",
          isPending ? "text-muted" : "text-cream"
        )}>
          {title}
        </h3>
        {isCompleted && !isLocked && <span className="text-[10px] font-mono text-teal uppercase tracking-widest">Completed</span>}
        {isLocked && <span className="text-[10px] font-mono text-gold uppercase tracking-widest">Sealed</span>}
      </div>

      {/* Content */}
      <motion.div
        initial={false}
        animate={{ 
          height: isActive || isLocked ? 'auto' : isCompleted && summary ? 'auto' : 0,
          opacity: isActive || isLocked || (isCompleted && summary) ? 1 : 0
        }}
        className="overflow-hidden"
        transition={{ duration: 0.4, ease: "easeInOut" }}
      >
        <div className="pb-4">
          {(isActive || isLocked) ? children : summary}
        </div>
      </motion.div>
    </div>
  );
}
