import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-void text-cream font-sans overflow-hidden">
      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-void-2 border-b border-line z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setDrawerOpen(true)} className="text-cream p-1">
            <Menu className="w-6 h-6" />
          </button>
          <div className="font-serif text-xl font-light text-cream tracking-widest">SHURA</div>
        </div>
      </div>

      {/* Desktop & Tablet Sidebar */}
      <div className="hidden md:block shrink-0">
        <Sidebar isMobile={false} />
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="md:hidden fixed inset-0 bg-void/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="md:hidden fixed inset-y-0 left-0 z-50 flex"
            >
              <Sidebar isMobile={true} onClose={() => setDrawerOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 relative h-full flex flex-col min-w-0 overflow-hidden pt-16 md:pt-0">
        {children}
      </main>
    </div>
  );
}
