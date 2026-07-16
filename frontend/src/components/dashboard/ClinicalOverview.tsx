import React from "react";
import { WelcomeHeader } from "./WelcomeHeader";
import { ClinicalFocus } from "./ClinicalFocus";
import { PriorityQueue } from "./PriorityQueue";
import { IntelligenceOverview } from "./IntelligenceOverview";
import { AIHealthPanel } from "./AIHealthPanel";
import { ActivityFeed } from "./ActivityFeed";
import { AIInsight } from "./AIInsight";
import { SectionHeader } from "../shared/SectionHeader";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Plus, Users, MessageSquare, Inbox, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { PatientData } from "../../types/patient";
import { ReferralResponse } from "../../lib/api";

interface ClinicalOverviewProps {
  user: { name: string; id: string; role: string };
  roleLabel: string;
  patients: PatientData[];
  referralMap: Record<string, ReferralResponse>;
  chatMap: Record<string, any[]>;
  openedCases: string[];
  role: string;
  loading?: boolean;
  error?: boolean;
  onOpenPatient: (p: PatientData) => void;
  onLogout: () => void;
  onAddPatient: () => void;
  activity?: { time: string; text: string }[];
}

const REFERRAL_LABEL: Record<string, string> = {
  not_required: "No Referral",
  recommended: "Referral Advised",
  referred: "Referred",
  declined: "PC Continuing",
};

function isPriority(
  p: PatientData,
  referralMap: Record<string, ReferralResponse>,
): boolean {
  if (p.status === "crit" || p.status === "review") return true;
  const st = referralMap[p.id]?.referral_status;
  // recommended (pending PC decision) + referred (pending specialist sign-off)
  return st === "recommended" || st === "referred";
}

export function ClinicalOverview({
  user,
  roleLabel,
  patients,
  referralMap,
  chatMap,
  openedCases,
  role,
  loading,
  error,
  onOpenPatient,
  onLogout,
  onAddPatient,
  activity = [],
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

  const newCases = patients
    .filter((p) => p.caseProgress === "Intake" && !openedCases.includes(p.id))
    .sort(
      (a, b) =>
        new Date(b.registeredAt || 0).getTime() - new Date(a.registeredAt || 0).getTime(),
    );
  const priorityCases = patients
    .filter((p) => isPriority(p, referralMap))
    .sort((a, b) => {
      const rank = (p: PatientData) => (p.status === "crit" ? 0 : 1);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      // longest-waiting first (earliest registered)
      return (
        new Date(a.registeredAt || 0).getTime() - new Date(b.registeredAt || 0).getTime()
      );
    });
  const chatCases = patients.filter((p) => chatMap[p.id]?.length > 0);

  return (
    <div className="h-full w-full overflow-y-auto p-4 md:p-6 lg:p-8 pb-24">
      <div className="w-full">
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
          <div className="flex flex-col gap-10 mt-8">
            {/* ---- Section 1: New Cases ---- */}
            <section>
              <SectionHeader
                title="New Cases"
                subtitle="Not yet opened or reviewed by anyone"
              />
              {newCases.length === 0 ? (
                <CardEmpty icon={<Inbox className="w-4 h-4 opacity-50" />} text="No new cases — everything has been opened." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {newCases.map((p, i) => (
                    <CaseRow key={p.id} p={p} i={i} onOpen={onOpenPatient} />
                  ))}
                </div>
              )}
            </section>

            {/* ---- Section 2: Today's Priority ---- */}
            <section>
              <SectionHeader
                title="Today's Priority"
                subtitle="Critical · conflict · referral-recommended · pending sign-off"
              />
              {priorityCases.length === 0 ? (
                <CardEmpty icon={<AlertTriangle className="w-4 h-4 opacity-50" />} text="No priority cases right now." />
              ) : (
                <PriorityQueue
                  patients={priorityCases}
                  referralMap={referralMap}
                  role={role}
                  onOpenPatient={onOpenPatient}
                />
              )}
            </section>

            {/* ---- Section 3: Doctor-to-Doctor Chat ---- */}
            <section>
              <SectionHeader
                title="Doctor-to-Doctor Chat"
                subtitle="Peer-to-peer human discussion, tied to specific cases"
              />
              {chatCases.length === 0 ? (
                <CardEmpty
                  icon={<MessageSquare className="w-4 h-4 opacity-50" />}
                  text="No active discussions yet. Open a case and start a clinical discussion."
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {chatCases.map((p, i) => {
                    const thread = chatMap[p.id];
                    const last = thread[thread.length - 1];
                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <button
                          onClick={() => onOpenPatient(p)}
                          className="w-full text-left rounded-lg border border-line bg-void-2 hover:border-gold/30 hover:bg-void-3 transition-all p-4 flex flex-col gap-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-cream text-sm">{p.name}</span>
                            <span className="text-[10px] font-mono text-muted">#{p.id}</span>
                            <span className="text-[10px] font-mono text-muted/60">
                              {thread.length} message{thread.length > 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="text-xs text-muted truncate">
                            <span className="text-gold/80">
                              {last.sender_name || last.sender_role}:
                            </span>{" "}
                            {last.text}
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 flex flex-col">
                <IntelligenceOverview
                  totalPatients={patients.length}
                  criticalCount={criticalCount}
                  reviewCount={reviewCount}
                  patients={patients}
                />
                <ActivityFeed events={activity} />
              </div>
              <div className="flex flex-col gap-4 md:gap-6">
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
                  </div>
                </div>
                <AIHealthPanel />
                <AIInsight reviewCount={reviewCount} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CaseRow({
  p,
  i,
  onOpen,
}: {
  p: PatientData;
  i: number;
  onOpen: (p: PatientData) => void;
}) {
  const registered = p.registeredAt
    ? new Date(p.registeredAt).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
    >
      <div className="rounded-lg border border-line bg-void-2 hover:border-gold/30 hover:bg-void-3 transition-all p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-cream text-sm">{p.name}</span>
            <span className="text-[10px] font-mono text-muted">#{p.id}</span>
            <span className="text-[10px] font-mono text-muted/70">
              {p.age}
              {p.sex?.[0]?.toUpperCase()}
            </span>
            {p.status === "crit" && <Badge variant="destructive">Critical</Badge>}
            {p.status === "review" && (
              <Badge variant="outline" className="border-gold text-gold">
                Review
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted truncate max-w-md">{p.chiefComplaint || p.dx}</div>
          <div className="text-[10px] font-mono text-muted/60 mt-0.5">
            Registered {registered}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpen(p)}
          className="h-8 text-xs font-mono uppercase tracking-widest shrink-0"
        >
          Open
        </Button>
      </div>
    </motion.div>
  );
}

function CardEmpty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-void-2 p-6 flex items-center gap-3 text-muted text-xs font-mono">
      {icon}
      {text}
    </div>
  );
}
