import React, { useEffect, useState } from "react";
import { PatientData } from "../../types/patient";
import { WorkflowStage } from "../../types/board";
import { CaseProgressTracker } from "./CaseProgressTracker";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { fetchCareTeam, CareTeamResponse } from "@/lib/api";
import {
  ArrowLeft,
  Pill,
  AlertTriangle,
  Activity,
  Stethoscope,
  TestTube,
  MessageSquare,
  Users,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchReferral, setReferral, ReferralResponse } from "@/lib/api";
import { CardiologyBoard } from "../dashboard/CardiologyBoard";
import {
  classifyIntake,
  fetchIntake,
  IntakeClassification,
} from "@/lib/cardioApi";

// Working diagnoses in the registry that map to the Cardiology module's
// guideline keys. A case is only surfaced to the Cardiology Board when its
// working DX matches one of these.
export const CARDIO_DIAGNOSIS_MAP: Record<string, string> = {
  "aortic dissection": "AORTIC_DISSECTION",
  "hypertrophic obstructive cardiomyopathy": "HOCM_SUSPECTED",
  hocm: "HOCM_SUSPECTED",
  "myocardial infarction": "ACUTE_MI",
  "acute mi": "ACUTE_MI",
  kawasaki: "KAWASAKI_DISEASE",
  "acute stroke": "ACUTE_STROKE_HTN_DM",
  "sle pericarditis": "SLE_PERICARDITIS",
  "sle with pericarditis": "SLE_PERICARDITIS",
};

/** Resolve a working DX string to a cardiology guideline id, or null. */
export function resolveCardioDiagnosis(dx: string): string | null {
  const key = (dx || "").toLowerCase().trim();
  if (!key) return null;
  for (const [needle, id] of Object.entries(CARDIO_DIAGNOSIS_MAP)) {
    if (key.includes(needle)) return id;
  }
  return null;
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

// Maps the care-team agent_id (from the backend /care-team contract) to the
// agent param the /ask-shura backend understands.
const AGENT_TO_BACKEND: Record<string, string> = {
  amara: "endo",
  rousseau: "card",
  osei: "neph",
  pharmacology: "pharmacology",
  icd10: "icd10",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-gold",
  pending: "bg-muted/40",
  complete: "bg-teal",
};

interface ContextPanelProps {
  patient: PatientData;
  user: { name: string };
  roleLabel: string;
  onBack: () => void;
  currentStage: WorkflowStage;
  onAskShura: (question: string, agent?: string) => Promise<{ answer: string }>;
  dataCompleteness: number; // 0-100
  onReferralChange?: (id: string, data: ReferralResponse) => void;
}

export function ContextPanel({
  patient,
  user,
  roleLabel,
  onBack,
  currentStage,
  onAskShura,
  dataCompleteness,
  onReferralChange,
}: ContextPanelProps) {
  const [careTeam, setCareTeam] = useState<CareTeamResponse | null>(null);
  const [careTeamLoading, setCareTeamLoading] = useState(false);
  const [careTeamError, setCareTeamError] = useState<string | null>(null);

  // Active Care Team is derived server-side from real case data; refetch when
  // the selected case changes.
  useEffect(() => {
    let cancelled = false;
    setCareTeamLoading(true);
    setCareTeamError(null);
    fetchCareTeam(patient.id)
      .then((data) => {
        if (!cancelled) setCareTeam(data);
      })
      .catch((e) => {
        if (!cancelled) setCareTeamError(e?.message || "Failed to load care team");
      })
      .finally(() => {
        if (!cancelled) setCareTeamLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patient.id]);

  const [askText, setAskText] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  // Cardiology module — classify the active case against the cardiology
  // guideline set and surface the CardiologyBoard when the working DX is a
  // cardiac diagnosis. Classification is keyed off the real backend
  // /api/cardiology/intake endpoint (deterministic, auditable).
  const [cardioIntake, setCardioIntake] = useState<IntakeClassification | null>(null);
  const [cardioLoading, setCardioLoading] = useState(false);
  const [cardioError, setCardioError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const diagnosisId = resolveCardioDiagnosis(patient.dx);
    // Reset whenever the case (or its DX) changes.
    setCardioIntake(null);
    setCardioError(null);
    if (!diagnosisId) return;
    setCardioLoading(true);
    fetchIntake(patient.id)
      .then((data) => {
        if (!cancelled) {
          setCardioIntake(data);
          setCardioLoading(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        classifyIntake({
          case_id: patient.id,
          diagnosis_id: diagnosisId,
          source: patient.status === "crit" ? "emergency" : "internal_clinic",
        })
          .then((data) => {
            if (!cancelled) setCardioIntake(data);
          })
          .catch((e) => {
            if (!cancelled) setCardioError(e?.message || "Failed to load cardiology board");
          })
          .finally(() => {
            if (!cancelled) setCardioLoading(false);
          });
      });
    return () => {
      cancelled = true;
    };
  }, [patient.id, patient.dx, patient.status]);

  // Referral status — derived server-side from real case data (same pattern
  // as the Active Care Team reasons). Refetched when the case changes.
  const [referral, setReferralState] = useState<ReferralResponse | null>(null);
  const [referring, setReferring] = useState(false);
  const [referDialogOpen, setReferDialogOpen] = useState(false);
  const [referTo, setReferTo] = useState("Dr. Jamal Khaled");
  const [referNote, setReferNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchReferral(patient.id)
      .then((data) => {
        if (!cancelled) setReferralState(data);
      })
      .catch(() => {
        if (!cancelled) setReferralState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [patient.id]);

  const applyReferral = (data: ReferralResponse) => {
    setReferralState(data);
    onReferralChange?.(patient.id, data);
  };

  const onReferConfirm = async () => {
    if (referring) return;
    setReferring(true);
    try {
      const data = await setReferral(patient.id, "referred", {
        referred_by: user.name,
        referred_to: referTo.trim() || "Dr. Jamal Khaled",
        note: referNote.trim() || undefined,
      });
      applyReferral(data);
      setReferDialogOpen(false);
      setReferNote("");
    } catch {
      /* ignore */
    } finally {
      setReferring(false);
    }
  };

  const onContinuePC = async () => {
    if (referring) return;
    setReferring(true);
    try {
      const data = await setReferral(patient.id, "declined", {
        referred_by: user.name,
      });
      applyReferral(data);
    } catch {
      /* ignore */
    } finally {
      setReferring(false);
    }
  };

  const ask = async (agentKey?: string) => {
    const q = askText.trim();
    if (!q || asking) return;
    setAsking(true);
    setReply("Thinking…");
    try {
      const res = await onAskShura(q, agentKey);
      setReply(res?.answer ?? "");
    } catch (err) {
      // Show an honest failure message — do not echo patient.edu as if it were
      // an AI-generated answer. The backend's own offline-fallback (returning
      // patient.edu in the 200 response when no API key is set) is handled by
      // the happy path above. This catch only fires on a real network/HTTP error.
      const msg = err instanceof Error ? err.message : "Request failed";
      setReply(`⚠ AI service unavailable — ${msg}. Please try again or check backend status.`);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="w-full md:w-80 shrink-0 h-auto md:h-full overflow-visible md:overflow-y-auto border-t md:border-t-0 md:border-l border-line bg-void-2 flex flex-col relative z-20">
      <div className="p-6 pb-0 sticky top-0 bg-void-2/90 backdrop-blur-md z-10">
        <button
          onClick={onBack}
          aria-label="Back to Clinical Overview"
          className="text-muted hover:text-cream focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold transition-colors mb-6 flex items-center gap-2 text-xs font-mono uppercase tracking-widest rounded px-1 -ml-1"
        >
          <ArrowLeft className="w-3 h-3" aria-hidden="true" /> Back to Overview
        </button>
      </div>

      <div className="px-6 pb-6 flex flex-col flex-1">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono text-muted border border-line px-1.5 py-0.5 rounded uppercase tracking-widest bg-void">
              Case
            </span>
            <span className="text-xs font-mono text-gold tracking-widest">
              CCP-{patient.id.replace("EG-", "")}
            </span>
          </div>
          <h2 className="text-2xl font-serif text-cream leading-tight">{patient.name}</h2>
          <div className="text-sm text-muted mt-1 font-mono">
            {patient.age}y · {patient.sex}
          </div>
        </div>

        <div className="flex flex-col gap-6 flex-1">
          {/* Status block */}
          <div className="p-5 rounded-xl border border-line bg-void flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
                Clinical Status
              </span>
              {patient.status === "crit" && (
                <Badge variant="destructive" className="h-5 text-[9px] rounded-sm">
                  Critical
                </Badge>
              )}
              {patient.status === "review" && (
                <Badge
                  variant="outline"
                  className="border-gold text-gold h-5 text-[9px] rounded-sm"
                >
                  Review
                </Badge>
              )}
              {patient.status === "stable" && (
                <Badge
                  variant="outline"
                  className="border-teal text-teal h-5 text-[9px] rounded-sm"
                >
                  Stable
                </Badge>
              )}
            </div>
            <div className="h-[1px] bg-line w-full opacity-50" />
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted block mb-1">
                Working DX
              </span>
              <span className="text-sm text-cream">{patient.dx}</span>
            </div>

            {/* Referral recommendation — derived server-side from real case data */}
            {referral && referral.referral_status === "recommended" && (
              <>
                <div className="h-[1px] bg-line w-full opacity-50" />
                <div className="rounded-md border border-gold/40 bg-gold/5 p-2.5 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-gold">
                    <Send className="w-3 h-3" /> Specialist referral recommended
                  </div>
                  <p className="text-[11px] text-cream/90 leading-snug">
                    {referral.referral_reason}
                  </p>
                </div>
              </>
            )}
            {referral && referral.referral_status === "referred" && (
              <>
                <div className="h-[1px] bg-line w-full opacity-50" />
                <div className="rounded-md border border-teal/40 bg-teal/5 p-2.5 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-teal">
                    <Send className="w-3 h-3" /> Referred to Specialist
                  </div>
                  <p className="text-[11px] text-cream/90 leading-snug">
                    {referral.referred_by || "Primary Care"} → {referral.referred_to || "Specialist"}
                    {referral.referred_at ? ` · ${new Date(referral.referred_at).toLocaleString()}` : ""}
                  </p>
                </div>
              </>
            )}
            {referral && referral.referral_status === "declined" && (
              <>
                <div className="h-[1px] bg-line w-full opacity-50" />
                <div className="rounded-md border border-line bg-void-3 p-2.5 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted">
                    <Send className="w-3 h-3" /> Primary Care (referral declined)
                  </div>
                  <p className="text-[11px] text-cream/70 leading-snug">
                    {referral.referral_reason}
                  </p>
                </div>
              </>
            )}
            {patient.allergies && patient.allergies.length > 0 && (
              <>
                <div className="h-[1px] bg-line w-full opacity-50" />
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-rose block mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Allergies
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {patient.allergies.map((a) => (
                      <span
                        key={a}
                        className="text-[11px] bg-rose/10 text-rose px-1.5 py-0.5 rounded border border-rose/20"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
            {patient.medications && patient.medications.length > 0 && (
              <>
                <div className="h-[1px] bg-line w-full opacity-50" />
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted block mb-1 flex items-center gap-1">
                    <Pill className="w-3 h-3" /> Medications
                  </span>
                  <ul className="text-xs text-cream flex flex-col gap-1">
                    {patient.medications.map((m) => (
                      <li key={m} className="truncate">
                        • {m}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            {patient.vitals && (
              <>
                <div className="h-[1px] bg-line w-full opacity-50" />
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted block mb-1 flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Vital Summary
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted">BP:</span> {patient.vitals.bp || "—"}
                    </div>
                    <div>
                      <span className="text-muted">HR:</span> {patient.vitals.hr || "—"}
                    </div>
                    <div>
                      <span className="text-muted">Wt:</span>{" "}
                      {patient.vitals.weight ? `${patient.vitals.weight}kg` : "—"}
                    </div>
                    <div>
                      <span className="text-muted">Temp:</span>{" "}
                      {patient.vitals.temp ? `${patient.vitals.temp}°C` : "—"}
                    </div>
                  </div>
                </div>
              </>
            )}
            <div className="h-[1px] bg-line w-full opacity-50" />
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted block mb-1">
                Archivist Completeness
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-void-3 border border-line rounded-full overflow-hidden">
                  <div className="h-full bg-teal" style={{ width: `${dataCompleteness}%` }} />
                </div>
                <span className="text-[10px] font-mono text-teal">{dataCompleteness}%</span>
              </div>
            </div>
          </div>

          {/* Cardiology Board — only rendered for cardiac working diagnoses.
              Driven entirely by the auditable /api/cardiology endpoints. */}
          {cardioLoading && (
            <div className="p-5 rounded-xl border border-line bg-void flex flex-col gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-gold">
                Cardiology Board
              </span>
              <p className="text-[11px] text-muted leading-snug">Loading cardiology pathway…</p>
            </div>
          )}
          {cardioError && (
            <div className="p-5 rounded-xl border border-rose/40 bg-rose/5 flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-rose">
                Cardiology Board
              </span>
              <p className="text-[11px] text-cream/80 leading-snug">{cardioError}</p>
            </div>
          )}
          {cardioIntake && (
            <CardiologyBoard intake={cardioIntake} physicianName={user.name} />
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Labs integration coming soon"
              className="flex-1 border-line text-muted/50 h-8 text-[10px] uppercase font-mono tracking-widest gap-1 cursor-not-allowed"
            >
              <TestTube className="w-3 h-3" /> Labs
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent("scroll-to-chat"))}
              title="Jump to clinical discussion"
              className="flex-1 border-line text-muted hover:text-cream hover:bg-void-3 h-8 text-[10px] uppercase font-mono tracking-widest gap-1"
            >
              <MessageSquare className="w-3 h-3" /> Ping
            </Button>
          </div>

          {/* Referral actions — only meaningful when a referral is recommended
              or already acted on. Physician judgment stays final. */}
          {referral && referral.referral_status !== "not_required" && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                {referral.referral_status !== "referred" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={referring}
                    onClick={() => setReferDialogOpen(true)}
                    className="flex-1 border-gold/40 text-gold hover:bg-gold/5 h-8 text-[10px] uppercase font-mono tracking-widest gap-1"
                  >
                    <Send className="w-3 h-3" /> Refer to Specialist
                  </Button>
                )}
                {referral.referral_status !== "declined" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={referring}
                    onClick={onContinuePC}
                    className="flex-1 border-line text-muted hover:text-cream hover:bg-void-3 h-8 text-[10px] uppercase font-mono tracking-widest gap-1"
                  >
                    Continue as Primary Care
                  </Button>
                )}
              </div>

              {referral.referral_status === "referred" && (
                <p className="text-[10px] font-mono uppercase tracking-widest text-gold/80 leading-snug">
                  Referred to {referral.referred_to || "specialist"}
                  {referral.referred_by ? ` by ${referral.referred_by}` : ""}
                  {referral.note ? ` — ${referral.note}` : ""}
                </p>
              )}
              {referral.referral_status === "declined" && (
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted leading-snug">
                  Primary Care continuing (referral declined)
                </p>
              )}

              <Dialog open={referDialogOpen} onOpenChange={setReferDialogOpen}>
                <DialogContent className="bg-void-2 border-line">
                  <DialogHeader>
                    <DialogTitle className="text-cream font-mono uppercase tracking-widest text-sm">
                      Refer to Specialist
                    </DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-3">
                    <p className="text-[11px] text-muted leading-snug">
                      {referral.referral_reason}
                    </p>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
                        Refer to
                      </span>
                      <Input
                        value={referTo}
                        onChange={(e) => setReferTo(e.target.value)}
                        className="bg-void border-line text-cream text-sm"
                        placeholder="Specialist name"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
                        Note (optional)
                      </span>
                      <Input
                        value={referNote}
                        onChange={(e) => setReferNote(e.target.value)}
                        className="bg-void border-line text-cream text-sm"
                        placeholder="Reason / context for referral"
                      />
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <DialogClose asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-line text-muted hover:text-cream"
                      >
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={referring}
                      onClick={onReferConfirm}
                      className="border-gold/40 text-gold hover:bg-gold/5"
                    >
                      Confirm Referral
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          <CaseProgressTracker currentStage={currentStage} />

          {/* Active Care Team — derived server-side from real case data */}
          <div className="p-5 rounded-xl border border-line bg-void flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-gold" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-gold">
                  Active Care Team
                </span>
              </div>
              {careTeam?.board_chair_active && (
                <span className="text-[9px] font-mono uppercase tracking-widest text-teal border border-teal/30 px-1.5 py-0.5 rounded">
                  Board Chair Active
                </span>
              )}
            </div>

            {careTeamLoading && (
              <p className="text-[11px] text-muted leading-snug">Loading care team…</p>
            )}
            {careTeamError && <p className="text-[11px] text-rose leading-snug">{careTeamError}</p>}
            {careTeam && (
              <div className="flex flex-col gap-2.5">
                {careTeam.agents.map((m) => {
                  const isPending = m.status === "pending";
                  return (
                    <div key={m.agent_id} className={cn("flex gap-2.5", isPending && "opacity-50")}>
                      <div className="shrink-0 mt-1.5">
                        <span
                          className={cn(
                            "block w-2 h-2 rounded-full",
                            STATUS_DOT[m.status] || "bg-muted/40",
                          )}
                          aria-label={`status: ${m.status}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-cream">{m.name}</span>
                          <span className="text-[9px] font-mono uppercase tracking-widest text-muted">
                            {m.specialty}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted leading-snug">{m.reason}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-auto pt-6 border-t border-line flex flex-col gap-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
              Ask the care team
            </div>
            <Input
              value={askText}
              onChange={(e) => setAskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") ask();
              }}
              placeholder="Ask about this case…"
              className="h-9 text-sm bg-void border-line text-cream focus:ring-1 focus:ring-gold/50"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={asking}
                className="border-gold/30 text-gold hover:bg-gold/5 text-[10px] uppercase font-mono tracking-widest h-8"
                onClick={() => ask()}
              >
                Ask Shura
              </Button>
              {careTeam?.board_chair_active && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={asking}
                  className="border-gold/30 text-gold hover:bg-gold/5 text-[10px] uppercase font-mono tracking-widest h-8"
                  onClick={() => ask("board")}
                >
                  Ask Board
                </Button>
              )}
              {careTeam?.agents
                .filter((m) => m.status === "active")
                .map((m) => (
                  <Button
                    key={m.agent_id}
                    variant="outline"
                    size="sm"
                    disabled={asking}
                    className="border-line text-muted hover:text-cream hover:border-gold/30 hover:bg-void-3 text-[10px] uppercase font-mono tracking-widest h-8"
                    onClick={() => ask(AGENT_TO_BACKEND[m.agent_id])}
                  >
                    {m.name.includes("Agent")
                      ? `Ask ${m.agent_id === "pharmacology" ? "Pharmacology" : "ICD-10"}`
                      : `Ask ${m.name.split(" ")[1]}`}
                  </Button>
                ))}
            </div>
            {reply && (
              <div className="text-[11px] leading-relaxed text-cream bg-void border border-line rounded-md p-2.5 max-h-40 overflow-y-auto">
                {reply}
              </div>
            )}
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted/60">
              Consulting: {user.name} · {roleLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
