import React, { useState } from 'react';
import { Button } from '../ui/button';
import { FileDown, Lock, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PhysicianDecisionProps {
  onApprove: () => void;
  onReject: () => void;
  isLocked: boolean;
  onExport: () => void;
}

export function PhysicianDecision({ onApprove, onReject, isLocked, onExport }: PhysicianDecisionProps) {
  const [locking, setLocking] = useState(false);

  const handleSignOff = () => {
    setLocking(true);
    // Simulate signature animation sequence before triggering the actual callback
    setTimeout(() => {
      onApprove();
      setLocking(false);
    }, 1200); // Wait for animation
  };

  return (
    <div className="relative">
      <div className="bg-void-2 border border-line p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        
        {isLocked ? (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full border border-gold/50 bg-gold/10 flex items-center justify-center">
                <Lock className="w-4 h-4 text-gold" />
              </div>
              <div>
                <h3 className="text-lg font-serif text-cream">Case Locked & Finalized</h3>
                <p className="text-xs text-muted font-mono uppercase tracking-widest mt-1">Immutable Audit Ledger Generated</p>
              </div>
            </div>
            <Button onClick={onExport} variant="outline" className="border-gold/30 text-gold hover:bg-gold/10 font-mono text-[10px] uppercase tracking-widest gap-2 h-10">
              <FileDown className="w-3 h-3" /> Export PDF
            </Button>
          </motion.div>
        ) : (
          <>
            <div className="flex-1">
              <h3 className="text-lg font-serif text-cream mb-1">Final Authorization</h3>
              <p className="text-xs text-muted max-w-md leading-relaxed">
                By signing off, you verify that you have reviewed the AI consensus and agree with the proposed clinical plan. This action is irreversible.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                onClick={onReject}
                variant="outline" 
                disabled={locking}
                className="h-10 border-rose/30 text-rose hover:bg-rose/10 font-mono text-[10px] uppercase tracking-widest gap-2"
              >
                <X className="w-3 h-3" /> Reject
              </Button>
              <Button 
                onClick={handleSignOff}
                disabled={locking}
                className="h-10 bg-gold text-void hover:bg-cream font-mono text-[10px] uppercase tracking-widest gap-2 min-w-[200px]"
              >
                {locking ? (
                  <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-3 h-3 border-2 border-void border-t-transparent rounded-full"
                  />
                ) : (
                  <><CheckCircle2 className="w-3 h-3" /> Sign Off & Lock Case</>
                )}
              </Button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
