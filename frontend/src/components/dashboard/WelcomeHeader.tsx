import React from 'react';
import { Search } from 'lucide-react';
import { PageHeader } from '../shared/PageHeader';

export function WelcomeHeader({ userName, roleLabel, onLogout }: { userName: string; roleLabel: string; onLogout: () => void }) {
  const dateStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  return (
    <PageHeader 
      title={`Clinical Overview`}
      description={`${dateStr} · ${userName} (${roleLabel})`}
    >
      <div className="flex items-center gap-4">
        {/* Premium Search Field with Keyboard Shortcut */}
        <div className="relative group hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-hover:text-gold transition-colors" />
          <input 
            type="text" 
            placeholder="Search patients..." 
            className="h-9 w-64 bg-void-2 border border-line rounded-md pl-9 pr-12 text-sm text-cream focus:outline-none focus:border-gold/50 transition-colors placeholder:text-muted/50"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <kbd className="font-mono text-[10px] text-muted border border-line rounded px-1.5 bg-void">⌘</kbd>
            <kbd className="font-mono text-[10px] text-muted border border-line rounded px-1.5 bg-void">K</kbd>
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="text-xs font-mono uppercase tracking-widest text-muted hover:text-rose transition-colors px-3 py-2"
        >
          Sign Out
        </button>
      </div>
    </PageHeader>
  );
}
