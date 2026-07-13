import React from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { Activity, Users, LayoutDashboard, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = useLocation({ select: (location) => location.pathname });

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Patients', path: '/patients' },
    { icon: Activity, label: 'Board', path: '/board' },
  ];

  return (
    <aside className="w-16 flex flex-col items-center py-6 bg-slate border-r border-line shrink-0 transition-all z-50">
      <div className="mb-8 cursor-pointer">
        <div className="w-8 h-8 rounded-full bg-void border border-gold flex items-center justify-center">
          <span className="text-gold font-serif text-sm font-bold tracking-widest">S</span>
        </div>
      </div>
      
      <nav className="flex-1 flex flex-col gap-4 w-full px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          return (
            <Link 
              key={item.label}
              to={item.path}
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center mx-auto transition-colors group relative",
                isActive ? "bg-void-2 text-gold shadow-sm" : "text-muted hover:text-cream hover:bg-void-2"
              )}
            >
              <item.icon className="w-5 h-5" />
              <div className="absolute left-14 px-2 py-1 bg-void-3 border border-line rounded text-[10px] text-cream opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg transition-opacity font-mono uppercase tracking-widest">
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-2 w-full">
        <button className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto text-muted hover:text-cream hover:bg-void-2 transition-colors">
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
}
