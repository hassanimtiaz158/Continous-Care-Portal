import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Database, Users, Network, Lock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const stages = [
  { id: 'intake', label: 'Patient Intake', icon: FileText, delay: 0 },
  { id: 'archivist', label: 'Archivist Engine', icon: Database, delay: 1 },
  { id: 'board', label: 'Specialist Board', icon: Users, delay: 2 },
  { id: 'consensus', label: 'Consensus', icon: Network, delay: 3 },
  { id: 'human', label: 'Physician Sign-off', icon: Lock, delay: 4 },
  { id: 'confidence', label: 'Clinical Confidence', icon: CheckCircle2, delay: 5 },
];

export function HeroWorkflow() {
  return (
    <div className="w-full max-w-4xl mx-auto py-16 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gold/5 via-void to-void opacity-50 pointer-events-none" />
      
      <div className="flex flex-col md:flex-row items-center justify-between relative z-10 gap-4 md:gap-0">
        {stages.map((stage, index) => {
          const isLast = index === stages.length - 1;
          
          return (
            <React.Fragment key={stage.id}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: stage.delay * 0.4, ease: "easeOut" }}
                className="flex flex-col items-center gap-3 relative group"
              >
                <motion.div 
                  className={cn(
                    "w-16 h-16 rounded-2xl border flex items-center justify-center bg-void-2 relative z-20",
                    isLast ? "border-teal shadow-[0_0_15px_rgba(61,139,139,0.3)] text-teal" : "border-line text-gold group-hover:border-gold-dim transition-colors"
                  )}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <stage.icon className="w-7 h-7" />
                </motion.div>
                <div className="text-[10px] uppercase tracking-widest font-mono text-muted text-center max-w-[80px] leading-tight">
                  {stage.label}
                </div>
              </motion.div>

              {!isLast && (
                <div className="hidden md:block flex-1 h-[1px] relative mx-2">
                  <div className="absolute inset-0 bg-line" />
                  <motion.div 
                    className="absolute inset-0 bg-gold origin-left"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.6, delay: (stage.delay * 0.4) + 0.4, ease: "easeInOut" }}
                  />
                </div>
              )}
              
              {!isLast && (
                <div className="block md:hidden h-8 w-[1px] relative my-2">
                  <div className="absolute inset-0 bg-line" />
                  <motion.div 
                    className="absolute inset-0 bg-gold origin-top"
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.6, delay: (stage.delay * 0.4) + 0.4, ease: "easeInOut" }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
