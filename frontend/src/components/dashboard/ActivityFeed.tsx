import React from "react";
import { SectionHeader } from "../shared/SectionHeader";
import { EmptyWorkspace } from "../shared/EmptyWorkspace";
import { Activity } from "lucide-react";

interface ActivityEvent {
  time: string;
  text: string;
}

export function ActivityFeed({ events = [] }: { events?: ActivityEvent[] }) {
  return (
    <div className="mb-8">
      <SectionHeader title="Clinical Activity" subtitle="Global event telemetry" />
      <div className="h-64 flex flex-col">
        {events.length === 0 ? (
          <EmptyWorkspace message="No clinical events recorded in the current session. Open a case or run an intake to populate live telemetry." />
        ) : (
          <div className="h-full overflow-y-auto border border-line bg-void-2 divide-y divide-line">
            {events
              .slice()
              .reverse()
              .map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 hover:bg-void-3 transition-colors"
                >
                  <Activity className="w-3.5 h-3.5 text-teal shrink-0" />
                  <span className="text-xs text-cream flex-1">{e.text}</span>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted shrink-0">
                    {e.time}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
