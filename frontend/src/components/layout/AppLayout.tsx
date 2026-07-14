import React from "react";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-void text-cream font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 relative h-full flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
