import React from 'react';
import { cn } from '@/lib/utils';

export function ConfidenceMeter({ score }: { score: number }) {
  // Score is 0-100
  const isHigh = score >= 80;
  const isMed = score >= 50 && score < 80;
  
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 h-1 bg-void-3 rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all duration-1000",
            isHigh ? "bg-teal" : isMed ? "bg-gold" : "bg-rose"
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted">{score}%</span>
    </div>
  );
}
