import React from "react";
import { WelcomeHeader } from "./WelcomeHeader";
import { ClinicalFocus } from "./ClinicalFocus";
import { PriorityQueue } from "./PriorityQueue";
import { IntelligenceOverview } from "./IntelligenceOverview";
import { AIHealthPanel } from "./AIHealthPanel";
import { ActivityFeed } from "./ActivityFeed";
import { AIInsight } from "./AIInsight";
import { Button } from "../ui/button";
import { SectionHeader } from "../shared/SectionHeader";
import { Plus, Users, Search as SearchIcon, FileClock } from "lucide-react";
import { motion } from "framer-motion";
import { PatientData } from "../../types/patient";

interface ClinicalOverviewProps {
  user: { name: string; id: string; role: string };
  roleLabel: string;
  patients: PatientData[];
  loading?: boolean;
  error?: boolean;
  onOpenPatient: (p: PatientData) => void;
  onLogout: () => void;
  onAddPatient: () => void;
}

export function ClinicalOverview({
  user,
  roleLabel,
  patients,
  loading,
  error,
  onOpenPatient,
  onLogout,
  onAddPatient,
}: ClinicalOverviewProps) {
  const criticalCount = patients.filter((p) => p.status === "crit").length;
  const reviewCount = patients.filter((p) => p.status === "review").length;

  // Compute missing data by inspecting real backend values
  const missingData = patients.filter((p) => {
    const stringified = JSON.stringify({
      s: p.screening,
      g: p.glycemic,
      v: p.vitals,
      r: p.renal,
    });
    return stringified.includes('"—"') || stringified.includes('"--"');
  }).length;

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-8 pb-24">
      <div className="max-w-6xl mx-auto">
        <WelcomeHeader userName={user.name} roleLabel={roleLabel} onLogout={onLogout} />

        <ClinicalFocus pendingReview={reviewCount} missingData={missingData} />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-muted">
            <div className="h-8 w-8 border-2 border-gold border-t-transparent rounded-full animate-spin mb-6" />
            <div className="font-mono text-xs uppercase tracking-widest text-gold animate-pulse">
              Syncing Clinical Registry
            </div>
            <div className="text-sm mt-2 opacity-60">
              Establishing secure connection to SHURA core...
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-32 text-muted">
            <div className="mb-6 p-4 rounded-full bg-rose/10 border border-rose/20 text-rose">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <div className="font-mono text-xs uppercase tracking-widest text-rose mb-2">
              Connection Failed
            </div>
            <div className="text-sm opacity-80 text-center max-w-sm">
              Unable to establish a secure connection to the SHURA backend. Please verify your
              network and ensure the API server is running.
            </div>
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-muted border border-dashed border-line rounded-lg mt-8">
            <Users className="w-10 h-10 text-muted/50 mb-4" />
            <div className="font-mono text-xs uppercase tracking-widest text-gold mb-2">
              Registry Empty
            </div>
            <div className="text-sm opacity-60 text-center max-w-sm">
              No patients are currently registered in the clinic roster.
            </div>
            <Button
              variant="outline"
              className="mt-6 border-gold/30 text-gold hover:bg-gold/10"
              onClick={onAddPatient}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Patient Intake
            </Button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content Column */}
            <div className="lg:col-span-2 flex flex-col">
              <PriorityQueue patients={patients} onOpenPatient={onOpenPatient} />
              <IntelligenceOverview
                totalPatients={patients.length}
                criticalCount={criticalCount}
                reviewCount={reviewCount}
              />
              <ActivityFeed />
            </div>

            {/* Right Sidebar Column */}
            <div className="flex flex-col gap-8">
              {/* Quick Actions */}
              <div>
                <SectionHeader title="Quick Actions" />
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2 bg-void-2 border-line hover:border-gold/30 hover:bg-void-3"
                    onClick={onAddPatient}
                  >
                    <Plus className="w-5 h-5 text-gold" />
                    <span className="text-xs">New Intake</span>
                  </Button>
                  <Button
                    variant="outline"
                    disabled
                    className="h-20 flex-col gap-2 bg-void-2 border-line opacity-50 cursor-not-allowed"
                  >
                    <Users className="w-5 h-5 text-muted" />
                    <span className="text-xs">Full Roster</span>
                  </Button>
                  <Button
                    variant="outline"
                    disabled
                    className="h-20 flex-col gap-2 bg-void-2 border-line opacity-50 cursor-not-allowed"
                  >
                    <SearchIcon className="w-5 h-5 text-muted" />
                    <span className="text-xs">Search</span>
                  </Button>
                  <Button
                    variant="outline"
                    disabled
                    className="h-20 flex-col gap-2 bg-void-2 border-line opacity-50 cursor-not-allowed"
                  >
                    <FileClock className="w-5 h-5 text-muted" />
                    <span className="text-xs">Last Session</span>
                  </Button>
                </div>
              </div>

              <AIHealthPanel />
              <AIInsight reviewCount={reviewCount} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
