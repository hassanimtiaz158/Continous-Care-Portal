import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { Search, FileText, UserCircle, Activity, FileDown, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PatientData } from '../workspace/types';
import { getExportPdfUrl } from '@/lib/api';

interface CommandPaletteProps {
  patients: PatientData[];
  onSelectPatient: (patient: PatientData) => void;
  onNavigateHome: () => void;
  onRunBoard?: () => void;
  onToggleProveIt?: () => void;
  sessionId?: string | null;
}

export function CommandPalette({ 
  patients, onSelectPatient, onNavigateHome, onRunBoard, onToggleProveIt, sessionId 
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] bg-void/80 backdrop-blur-sm flex items-start justify-center pt-[15vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-lg bg-void border border-line rounded-lg shadow-2xl overflow-hidden"
          >
            <Command 
              label="Global Command Menu"
              className="flex flex-col bg-transparent w-full"
            >
              <div className="flex items-center border-b border-line px-4">
                <Search className="w-4 h-4 text-muted shrink-0" />
                <Command.Input 
                  autoFocus 
                  placeholder="Type a command or search..."
                  className="flex-1 h-12 bg-transparent border-none text-cream focus:ring-0 text-sm placeholder:text-muted/50 px-3 outline-none"
                />
              </div>

              <Command.List className="max-h-[300px] overflow-y-auto p-2 outline-none">
                <Command.Empty className="py-6 text-center text-sm text-muted">No results found.</Command.Empty>

                <Command.Group heading={<span className="text-[10px] font-mono uppercase tracking-widest text-muted/60 px-2 py-1 block">Actions</span>}>
                  <Command.Item 
                    onSelect={() => { onNavigateHome(); setOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2 text-sm text-cream hover:bg-void-2 aria-selected:bg-void-3 rounded cursor-pointer transition-colors"
                  >
                    <Activity className="w-4 h-4 text-teal" /> Go to Dashboard
                  </Command.Item>
                  {onRunBoard && (
                    <Command.Item 
                      onSelect={() => { onRunBoard(); setOpen(false); }}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-cream hover:bg-void-2 aria-selected:bg-void-3 rounded cursor-pointer transition-colors"
                    >
                      <Activity className="w-4 h-4 text-gold" /> Run AI Deliberation Board
                    </Command.Item>
                  )}
                  {onToggleProveIt && (
                    <Command.Item 
                      onSelect={() => { onToggleProveIt(); setOpen(false); }}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-cream hover:bg-void-2 aria-selected:bg-void-3 rounded cursor-pointer transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4 text-teal" /> Toggle Prove It Mode
                    </Command.Item>
                  )}
                  {sessionId && (
                    <Command.Item 
                      onSelect={() => { window.location.href = getExportPdfUrl(sessionId); setOpen(false); }}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-cream hover:bg-void-2 aria-selected:bg-void-3 rounded cursor-pointer transition-colors"
                    >
                      <FileDown className="w-4 h-4 text-gold" /> Export Encrypted PDF
                    </Command.Item>
                  )}
                </Command.Group>

                <Command.Group heading={<span className="text-[10px] font-mono uppercase tracking-widest text-muted/60 px-2 pt-4 pb-1 block">Patients</span>}>
                  {patients.map(p => (
                    <Command.Item 
                      key={p.id}
                      onSelect={() => { onSelectPatient(p); setOpen(false); }}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-cream hover:bg-void-2 aria-selected:bg-void-3 rounded cursor-pointer transition-colors"
                    >
                      <UserCircle className="w-4 h-4 text-muted" />
                      <div className="flex flex-col">
                        <span className="leading-tight">{p.name} <span className="text-muted text-xs">({p.id})</span></span>
                        <span className="text-[10px] font-mono text-muted/80">{p.dx}</span>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
          {/* Invisible backdrop click handler */}
          <div className="absolute inset-0 z-[-1]" onClick={() => setOpen(false)} />
        </div>
      )}
    </AnimatePresence>
  );
}
