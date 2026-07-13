import React from 'react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmptyWorkspace({ message = "No patient selected.", action }: { message?: string, action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-void text-center p-8 border border-dashed border-line rounded-xl">
      <div className="w-16 h-16 rounded-full bg-void-2 border border-line flex items-center justify-center mb-4">
        <FileText className="w-6 h-6 text-muted" />
      </div>
      <p className="text-sm text-muted font-mono mb-4">{message}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
