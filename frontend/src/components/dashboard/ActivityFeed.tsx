import React from "react";
import { SectionHeader } from "../shared/SectionHeader";
import { EmptyWorkspace } from "../shared/EmptyWorkspace";
import { Activity } from "lucide-react";

export function ActivityFeed() {
  // Since we don't have real backend activity feed data yet, we show the intelligent empty state
  return (
    <div className="mb-8">
      <SectionHeader title="Clinical Activity" subtitle="Global event telemetry" />
      <div className="h-64 flex">
        <EmptyWorkspace message="No clinical events recorded in the current session. Activity telemetry will synchronize upon board initialization." />
      </div>
    </div>
  );
}
