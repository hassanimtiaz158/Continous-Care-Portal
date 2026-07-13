import React from 'react';
import { cn } from '@/lib/utils';

export function AIStatusBadge({ status }: { status: 'idle' | 'processing' | 'complete' | 'conflict' }) {
  const styles = {
    idle: "bg-void-3 text-muted border-line",
    processing: "bg-gold/10 text-gold border-gold/30 animate-pulse",
    complete: "bg-teal/10 text-teal border-teal/30",
    conflict: "bg-rose/10 text-rose border-rose/30"
  };

  return (
    <span className={cn("px-2 py-0.5 rounded-full border text-[9px] uppercase tracking-widest font-semibold flex items-center gap-1.5", styles[status])}>
      <span className={cn("w-1.5 h-1.5 rounded-full", 
        status === 'idle' ? "bg-muted" : 
        status === 'processing' ? "bg-gold" : 
        status === 'complete' ? "bg-teal" : "bg-rose"
      )} />
      {status}
    </span>
  );
}
