import React from "react";
import { Activity, Users, LayoutDashboard, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isMobile?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isMobile = false, onClose }: SidebarProps) {
  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: Users, label: "Patients", path: "/patients" },
    { icon: Activity, label: "Board", path: "/board" },
  ];

  return (
    <aside
      className={cn(
        "h-full flex flex-col py-6 bg-slate border-r border-line shrink-0 transition-all z-50",
        isMobile ? "w-64" : "w-16 lg:w-64",
      )}
    >
      <div className="mb-8 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 shrink-0 rounded-full bg-void border border-gold flex items-center justify-center mx-auto lg:mx-0">
            <span className="text-gold font-serif text-sm font-bold tracking-widest">S</span>
          </div>
          <span
            className={cn(
              "font-serif text-lg tracking-widest text-cream",
              isMobile ? "block" : "hidden lg:block",
            )}
          >
            SHURA
          </span>
        </div>
        {isMobile && onClose && (
          <button onClick={onClose} className="text-muted hover:text-cream p-1">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 flex flex-col gap-2 w-full px-2">
        {navItems.map((item) => {
          const isActive = item.path === "/";
          return (
            <div
              key={item.label}
              onClick={isMobile ? onClose : undefined}
              className={cn(
                "h-12 rounded-xl flex items-center transition-colors group relative px-3 cursor-pointer",
                isActive
                  ? "bg-void-2 text-gold shadow-sm"
                  : "text-muted/40 hover:text-muted hover:bg-void/50",
                isMobile ? "justify-start" : "justify-center lg:justify-start",
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span
                className={cn(
                  "ml-3 font-mono text-xs tracking-wider uppercase",
                  isMobile ? "block" : "hidden lg:block",
                )}
              >
                {item.label}
              </span>

              {/* Tooltip for collapsed state */}
              {!isMobile && (
                <div className="lg:hidden absolute left-14 px-2 py-1 bg-void-3 border border-line rounded text-[10px] text-cream opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg transition-opacity font-mono uppercase tracking-widest">
                  {item.label}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto px-2 w-full">
        <button
          className={cn(
            "h-12 rounded-xl flex items-center transition-colors px-3 w-full text-muted/40 cursor-not-allowed",
            isMobile ? "justify-start" : "justify-center lg:justify-start",
          )}
          title="Settings (Unavailable in Demo)"
        >
          <Settings className="w-5 h-5 shrink-0" />
          <span
            className={cn(
              "ml-3 font-mono text-xs tracking-wider uppercase",
              isMobile ? "block" : "hidden lg:block",
            )}
          >
            Settings
          </span>
        </button>
      </div>
    </aside>
  );
}
