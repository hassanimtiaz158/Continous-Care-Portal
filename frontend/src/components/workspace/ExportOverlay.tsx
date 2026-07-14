import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getExportPdfUrl } from "@/lib/api";

export function ExportOverlay({
  sessionId,
  onComplete,
}: {
  sessionId: string;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // Cinematic sequence
    const timers = [
      setTimeout(() => setPhase(1), 1000), // Assembling document
      setTimeout(() => setPhase(2), 2200), // Applying cryptographic seal
      setTimeout(() => {
        window.location.href = getExportPdfUrl(sessionId);
        setTimeout(onComplete, 500);
      }, 3500), // Trigger download and close
    ];
    return () => timers.forEach(clearTimeout);
  }, [sessionId, onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-void/90 backdrop-blur-md flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-6 max-w-sm text-center">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="absolute inset-0 rounded-full border-2 border-void border-t-gold opacity-80"
            />
            <div className="w-8 h-8 bg-gold/20 rounded-full animate-pulse" />
          </div>

          <div className="flex flex-col gap-2 h-16">
            <AnimatePresence mode="wait">
              {phase === 0 && (
                <motion.span
                  key="0"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="font-mono text-sm tracking-widest uppercase text-cream"
                >
                  Assembling Document...
                </motion.span>
              )}
              {phase === 1 && (
                <motion.span
                  key="1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="font-mono text-sm tracking-widest uppercase text-cream"
                >
                  Applying Cryptographic Seal...
                </motion.span>
              )}
              {phase === 2 && (
                <motion.span
                  key="2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="font-mono text-sm tracking-widest uppercase text-teal"
                >
                  Export Ready
                </motion.span>
              )}
            </AnimatePresence>
            <span className="text-[10px] font-mono text-muted uppercase tracking-widest">
              Session: {sessionId.split("-").pop()}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
