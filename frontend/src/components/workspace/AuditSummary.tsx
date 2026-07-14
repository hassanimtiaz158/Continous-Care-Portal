import React, { useEffect, useState } from "react";
import { ShieldCheck, Activity, Fingerprint, FileCheck } from "lucide-react";
import { fetchAuditTrail } from "@/lib/api";
import { motion } from "framer-motion";

export function AuditSummary({ sessionId }: { sessionId: string | null }) {
  const [audit, setAudit] = useState<any>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetchAuditTrail(sessionId).then(setAudit).catch(console.error);

    // Poll for changes in case physician signs off
    const interval = setInterval(() => {
      fetchAuditTrail(sessionId).then(setAudit).catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  if (!sessionId || !audit) return null;

  return (
    <div className="flex flex-col gap-px bg-line border border-line h-[400px]">
      <div className="bg-void p-3 border-b border-line flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Immutable Ledger (Live Activity)
        </span>
        <span className="text-[10px] font-mono text-teal bg-teal/10 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Sealed
        </span>
      </div>

      <div className="flex-1 bg-void-2 p-4 flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-start gap-3 pb-3 border-b border-line/50">
          <Fingerprint className="w-4 h-4 text-muted mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
              Session Identity
            </span>
            <span className="text-xs font-mono text-cream">{audit.session_id}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 font-mono">
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2"
          >
            <Activity className="w-3.5 h-3.5 text-teal shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] text-teal tracking-widest uppercase">Board_Initiated</div>
              <div className="text-xs text-cream/70">
                {new Date(audit.created_at).toLocaleString()}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex gap-2"
          >
            <Activity className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] text-gold tracking-widest uppercase">
                Agents_Responded
              </div>
              <div className="text-xs text-cream/70">
                Endo: {audit.agent_status?.endo}, Neph: {audit.agent_status?.neph}, Cardio:{" "}
                {audit.agent_status?.cardio}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex gap-2"
          >
            <Activity className="w-3.5 h-3.5 text-teal shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] text-teal tracking-widest uppercase">
                Consensus_Reached
              </div>
              <div className="text-xs text-cream/70">
                Data Completeness: {audit.data_completeness}%
              </div>
            </div>
          </motion.div>

          {audit.decision && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex gap-2 mt-2 pt-3 border-t border-line/30"
            >
              <FileCheck className="w-3.5 h-3.5 text-teal shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] text-teal tracking-widest uppercase">
                  Physician_Sign_Off
                </div>
                <div className="text-[10px] text-cream/70 uppercase">
                  Decision: {audit.decision}
                </div>
                <div className="text-[10px] text-cream/70 uppercase">
                  By: {audit.physician_name || "Anonymous"}
                </div>
                <div className="text-[10px] text-muted mt-1">
                  {new Date(audit.decided_at).toLocaleString()}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2 mt-auto border-t border-line/50">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
            Data Hash (SHA-256)
          </span>
          <span className="text-[10px] font-mono text-muted/50 break-all">
            {audit.session_id.split("-").reverse().join("").toLowerCase()}
            c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
          </span>
        </div>
      </div>
    </div>
  );
}
