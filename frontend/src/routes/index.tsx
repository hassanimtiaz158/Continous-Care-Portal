import { useState, useCallback, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  fetchPatients,
  fetchPatient,
  transferToBoard,
  askShura as apiAskShura,
  recordDecision,
  runBoard,
  createPatient,
  fetchChat,
  sendChat,
} from "../lib/api";
import { LandingPage } from "../components/landing/LandingPage";
import { ClinicalOverview } from "../components/dashboard/ClinicalOverview";
import { ClinicalWorkspace } from "../components/workspace/ClinicalWorkspace";
import { CommandPalette } from "../components/shared/CommandPalette";
import { Toaster, toast } from "sonner";

export const Route = createFileRoute("/")({
  component: ShuraApp,
});

type Role = "family" | "specialist" | "patient";
type Status = "crit" | "stable" | "review";

interface SpecialistFinding {
  text: string;
  metric?: string | null;
  confidence?: number;
  grounded?: boolean;
}
interface SpecialistResult {
  risk_level: string;
  findings: SpecialistFinding[];
  recommendation: string;
}
interface BoardResult {
  session_id: string;
  patient_id: string;
  specialist_results: Record<string, SpecialistResult>;
  consensus: { joint_plan: string; priority_actions: string[]; conflicts: string[] };
  confidence_scores: Record<string, number>;
  data_completeness: number;
}

interface PatientData {
  id: string;
  name: string;
  age: number;
  sex: string;
  dx: string;
  status: Status;
  screening: Record<string, string>;
  glycemic: Record<string, string>;
  vitals: Record<string, string>;
  renal: Record<string, string>;
  cardiac: Record<string, string>;
  ecg: Record<string, string>;
  gpNote: string;
  chiefComplaint: string;
  icd10?: {
    code: string;
    label: string;
    confidence: number;
    alternates: { code: string; label: string; confidence: number }[];
  };
  agents: {
    endo: { rec: string; conf: number; warn?: boolean; conflictNote?: string };
    neph: { rec: string; conf: number; warn?: boolean; conflictNote?: string };
    card: { rec: string; conf: number; warn?: boolean; conflictNote?: string };
  };
  plan: string;
  edu: string;
}

function ShuraApp() {
  const [screen, setScreen] = useState<"cover" | "login" | "grid" | "record">(() => {
    const saved = localStorage.getItem("shura_user");
    if (saved) {
      const u = JSON.parse(saved);
      return u.role === "patient" ? "record" : "grid";
    }
    return "cover";
  });
  const [role, setRole] = useState<Role>(() => {
    try {
      const saved = localStorage.getItem("shura_user");
      return saved ? JSON.parse(saved).role : "family";
    } catch {
      return "family";
    }
  });
  const [user, setUser] = useState<{ name: string; id: string; role: Role } | null>(() => {
    const saved = localStorage.getItem("shura_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [activePatient, setActivePatient] = useState<PatientData | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [loginErr, setLoginErr] = useState(false);
  const [qdOpen, setQdOpen] = useState(false);
  const [allPatients, setAllPatients] = useState<PatientData[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [boardResult, setBoardResult] = useState<BoardResult | null>(null);
  const [proveItMode, setProveItMode] = useState(false);
  const [activity, setActivity] = useState<{ time: string; text: string }[]>([]);
  const logActivity = useCallback((text: string) => {
    setActivity((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text,
      },
    ]);
  }, []);

  useEffect(() => {
    setPatientsLoading(true);
    setPatientsError(false);
    fetchPatients()
      .then(
        async (
          list: {
            id: string;
            name: string;
            age: number;
            sex: string;
            dx: string;
            status: string;
          }[],
        ) => {
          const full = await Promise.all(list.map((p) => fetchPatient(p.id).catch(() => null)));
          const valid = full.filter(Boolean) as PatientData[];
          setAllPatients(valid);
          logActivity(
            valid.length > 0
              ? `Synced ${valid.length} patients from SHURA registry`
              : "Registry synced — no patients on file",
          );
          if (user && user.role === "patient" && !activePatient && valid.length > 0) {
            setActivePatient(valid[0]);
          }
        },
      )
      .catch((e) => {
        console.error("Failed to fetch backend patients:", e);
        setPatientsError(true);
      })
      .finally(() => {
        setPatientsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectRole = useCallback((r: Role) => setRole(r), []);
  const enterApp = useCallback(() => setScreen("login"), []);

  const doLogin = useCallback(() => {
    const nameInput = document.getElementById("loginName") as HTMLInputElement;
    const idInput = document.getElementById("loginId") as HTMLInputElement;
    const name = nameInput?.value?.trim() || "";
    const id = idInput?.value?.trim() || "";
    if (!name || !id) {
      setLoginErr(true);
      return;
    }
    setLoginErr(false);
    const u = { name, id, role };
    setUser(u);
    localStorage.setItem("shura_user", JSON.stringify(u));
    if (role === "patient") {
      setActivePatient(allPatients[0]);
      setActivePage(1);
      setScreen("record");
    } else {
      setScreen("grid");
    }
  }, [role, allPatients]);

  const openPatient = useCallback((p: PatientData) => {
    setActivePatient(p);
    setActivePage(1);
    setScreen("record");
    setSessionId(null);
    setBoardResult(null);
    setProveItMode(false);
  }, []);

  const showGrid = useCallback(() => setScreen("grid"), []);

  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [intakeSubmitting, setIntakeSubmitting] = useState(false);

  const handleCreatePatient = useCallback(
    async (form: {
      name: string;
      age: string;
      sex: string;
      chiefComplaint: string;
      dx: string;
      meds: string;
      bpSys: string;
      bpDia: string;
      hba1c: string;
      egfr: string;
      acr: string;
      ldl: string;
      creat: string;
      k: string;
      hr: string;
    }) => {
      setIntakeError(null);
      setIntakeSubmitting(true);
      const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
      try {
        const created = await createPatient({
          name: form.name.trim(),
          age: Number(form.age),
          sex: form.sex,
          chief_complaint: form.chiefComplaint.trim(),
          dx: form.dx.trim() || undefined,
          meds: form.meds
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean),
          bp_sys: num(form.bpSys),
          bp_dia: num(form.bpDia),
          hba1c: num(form.hba1c),
          egfr: num(form.egfr),
          acr: num(form.acr),
          ldl: num(form.ldl),
          creat: num(form.creat),
          k: num(form.k),
          hr: num(form.hr),
        });
        setAllPatients((prev) => [...prev, created as PatientData]);
        setIntakeOpen(false);
        logActivity(
          `New intake registered: ${(created as PatientData).name} (${(created as PatientData).id})`,
        );
        openPatient(created as PatientData);
      } catch (err) {
        setIntakeError(err instanceof Error ? err.message : "Failed to create patient.");
      } finally {
        setIntakeSubmitting(false);
      }
    },
    [openPatient],
  );

  const logout = useCallback(() => {
    setUser(null);
    setActivePatient(null);
    setActivePage(1);
    setLoginErr(false);
    setSessionId(null);
    setBoardResult(null);
    setScreen("cover");
    localStorage.removeItem("shura_user");
  }, []);

  const gotoPage = useCallback((n: number) => setActivePage(n), []);

  const handleFieldChange = useCallback(
    (
      section: "screening" | "glycemic" | "vitals" | "renal" | "cardiac" | "ecg" | "chiefComplaint",
      field: string,
      value: string,
    ) => {
      setActivePatient((prev) => {
        if (!prev) return prev;
        let updated;
        if (section === "chiefComplaint") {
          updated = { ...prev, chiefComplaint: value };
        } else {
          updated = { ...prev, [section]: { ...(prev as any)[section], [field]: value } };
        }
        setAllPatients((list) => list.map((p) => (p.id === updated.id ? updated : p)));
        return updated;
      });
    },
    [],
  );

  const handleAskShura = useCallback(
    async (question: string, agent?: string): Promise<{ answer: string }> => {
      if (!activePatient) return { answer: "" };
      const q = question.trim();
      if (!q) return { answer: "" };
      try {
        const res = await apiAskShura(activePatient.id, q, agent);
        return { answer: res.answer };
      } catch (err) {
        return {
          answer:
            err instanceof Error
              ? err.message
              : "Failed to connect to SHURA backend. AI assistance unavailable.",
        };
      }
    },
    [activePatient],
  );

  const handleTransferBoard = useCallback(
    (btn: HTMLElement) => {
      btn.classList.add("sent");
      btn.textContent = "✓ Sent to Specialist Board";
      if (activePatient) transferToBoard(activePatient.id).catch(() => {});
    },
    [activePatient],
  );

  const handleRunBoard = useCallback(async () => {
    if (!activePatient || !user) return;
    try {
      const result = await runBoard(activePatient.id);
      setSessionId(result.session_id);
      setBoardResult(result);
      logActivity(`Specialist board convened for ${activePatient.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Board unavailable — failed to connect to backend service.",
      );
    }
  }, [activePatient, user]);

  const handleApprove = useCallback(async () => {
    if (!sessionId || !user) {
      toast.error("No active board session. Convene the board first.");
      return;
    }
    try {
      await recordDecision({
        session_id: sessionId,
        decision: "approved",
        physician_name: user.name,
        physician_note: "Plan approved and released to Family Medicine.",
      });
      toast.success("Plan approved and released to Family Medicine.");
      logActivity(`Plan approved for ${activePatient?.id} by ${user.name}`);
    } catch {
      toast.error("Failed to record decision.");
    }
  }, [sessionId, user]);

  const handleReject = useCallback(async () => {
    if (!sessionId || !user) {
      toast.error("No active board session.");
      return;
    }
    try {
      await recordDecision({
        session_id: sessionId,
        decision: "rejected",
        physician_name: user.name,
        physician_note: "Plan rejected — returned to Specialist Board.",
      });
      toast.success("Plan rejected — returned to Specialist Board.");
      logActivity(`Plan rejected for ${activePatient?.id} by ${user.name}`);
    } catch {
      toast.error("Failed to record decision.");
    }
  }, [sessionId, user]);

  const roleLabel =
    role === "family" ? "Family Medicine" : role === "specialist" ? "Specialist" : "Patient";

  return (
    <>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          className:
            "font-mono text-xs uppercase tracking-widest bg-void border border-line text-cream",
        }}
      />
      <div className="flex-1 h-full w-full flex flex-col overflow-hidden relative bg-void text-cream font-sans selection:bg-gold/30 selection:text-gold">
        {screen === "cover" && <LandingPage onEnter={enterApp} />}

        {screen === "login" && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            style={{ background: "radial-gradient(circle at 50% -20%, #172431, #0B1119 60%)" }}
          >
            <div className="w-full max-w-sm rounded-xl border border-[--line] bg-[--void-2] p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[--gold] to-transparent" />
              <div className="mb-8 flex items-center justify-between">
                <div className="font-serif text-3xl font-light text-cream">SHURA</div>
                <div className="mono text-[10px] tracking-[3px] text-muted">ID VERIFY</div>
              </div>

              {loginErr && (
                <div className="mb-6 rounded border border-[--rose]/30 bg-[--rose]/10 px-4 py-3 text-sm text-[--rose]">
                  Invalid credentials. Please verify your physician ID.
                </div>
              )}

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="mono text-[10px] uppercase tracking-[1px] text-muted">
                    Physician Name
                  </label>
                  <input
                    id="loginName"
                    autoComplete="off"
                    defaultValue="Dr. Sarah Chen"
                    className="w-full rounded border border-[--line] bg-[--void] px-4 py-2.5 text-sm text-cream placeholder:text-muted/40 focus:border-[--gold-dim] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="mono text-[10px] uppercase tracking-[1px] text-muted">
                    ID Number
                  </label>
                  <input
                    id="loginId"
                    type="password"
                    defaultValue="12345"
                    className="w-full rounded border border-[--line] bg-[--void] px-4 py-2.5 text-sm text-cream placeholder:text-muted/40 focus:border-[--gold-dim] focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <label className="mono mb-2 block text-[10px] uppercase tracking-[1px] text-muted">
                    Role Override (Demo)
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => selectRole("family")}
                      className={`flex-1 rounded border p-2 text-xs transition-colors ${role === "family" ? "border-[--gold] bg-[--gold]/10 text-[--gold]" : "border-[--line] text-muted hover:border-[--gold-dim]"}`}
                    >
                      Primary Care
                    </button>
                    <button
                      onClick={() => selectRole("specialist")}
                      className={`flex-1 rounded border p-2 text-xs transition-colors ${role === "specialist" ? "border-[--gold] bg-[--gold]/10 text-[--gold]" : "border-[--line] text-muted hover:border-[--gold-dim]"}`}
                    >
                      Specialist
                    </button>
                  </div>
                </div>

                <button onClick={doLogin} className="mt-8 w-full btn-luxe py-3">
                  Authenticate
                </button>
              </div>
            </div>
          </div>
        )}

        {screen === "grid" && user && (
          <ClinicalOverview
            patients={allPatients}
            user={user}
            loading={patientsLoading}
            error={patientsError}
            roleLabel={roleLabel}
            onOpenPatient={openPatient}
            onLogout={logout}
            onAddPatient={() => setIntakeOpen(true)}
            activity={activity}
          />
        )}

        {screen === "record" && activePatient && user && (
          <ClinicalWorkspace
            patient={activePatient}
            user={user}
            role={role}
            roleLabel={roleLabel}
            onBack={showGrid}
            onAskShura={handleAskShura}
            onRunBoard={handleRunBoard}
            onApprove={handleApprove}
            onReject={handleReject}
            sessionId={sessionId}
            onFieldChange={handleFieldChange}
            boardResult={boardResult}
            proveItMode={proveItMode}
            onToggleProveIt={() => setProveItMode(!proveItMode)}
          />
        )}

        {intakeOpen && (
          <IntakeModal
            atCapacity={allPatients.length >= 50}
            submitting={intakeSubmitting}
            error={intakeError}
            onCancel={() => {
              setIntakeOpen(false);
              setIntakeError(null);
            }}
            onSubmit={handleCreatePatient}
          />
        )}
      </div>

      <CommandPalette
        patients={allPatients}
        onSelectPatient={openPatient}
        onNavigateHome={showGrid}
        onRunBoard={screen === "record" ? handleRunBoard : undefined}
        sessionId={sessionId}
        onToggleProveIt={screen === "record" ? () => setProveItMode(!proveItMode) : undefined}
      />
    </>
  );
}

function LoginScreen({
  role,
  onSelectRole,
  onLogin,
  loginErr,
  onClearErr,
}: {
  role: Role;
  onSelectRole: (r: Role) => void;
  onLogin: () => void;
  loginErr: boolean;
  onClearErr: () => void;
}) {
  return (
    <div className="login-card">
      <div className="wordmark">
        <h1>SHURA</h1>
        <div className="ar">شورى</div>
      </div>
      <div className="sub">Sign in to your role</div>
      <div className="role-tabs">
        {(["family", "specialist", "patient"] as Role[]).map((r) => (
          <div
            key={r}
            className={`role-tab${role === r ? " active" : ""}`}
            onClick={() => onSelectRole(r)}
          >
            {r === "family" ? "Family Medicine" : r === "specialist" ? "Specialist" : "Patient"}
          </div>
        ))}
      </div>
      <div className="field-group">
        <label>Full name</label>
        <input
          type="text"
          id="loginName"
          placeholder="e.g. Sarah Ahmed Mostafa"
          onChange={() => loginErr && onClearErr()}
        />
      </div>
      <div className="field-group">
        <label>National ID number</label>
        <input
          type="text"
          id="loginId"
          placeholder="14-digit ID"
          onChange={() => loginErr && onClearErr()}
        />
      </div>
      <div className="signin-btn" onClick={onLogin}>
        Sign In
      </div>
      <div className="login-err" id="loginErr" style={{ display: loginErr ? "block" : "none" }}>
        Please enter both name and ID number.
      </div>
    </div>
  );
}

function IntakeModal({
  atCapacity,
  submitting,
  error,
  onCancel,
  onSubmit,
}: {
  atCapacity: boolean;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (form: {
    name: string;
    age: string;
    sex: string;
    chiefComplaint: string;
    dx: string;
    meds: string;
    bpSys: string;
    bpDia: string;
    hba1c: string;
    egfr: string;
    acr: string;
    ldl: string;
    creat: string;
    k: string;
    hr: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("Female");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [dx, setDx] = useState("");
  const [meds, setMeds] = useState("");
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [hba1c, setHba1c] = useState("");
  const [egfr, setEgfr] = useState("");
  const [acr, setAcr] = useState("");
  const [ldl, setLdl] = useState("");
  const [creat, setCreat] = useState("");
  const [k, setK] = useState("");
  const [hr, setHr] = useState("");

  const canSubmit =
    name.trim() && age.trim() && chiefComplaint.trim() && !submitting && !atCapacity;

  return (
    <div className="intake-overlay">
      <div className="intake-modal">
        <h3>New Patient Intake</h3>
        <p className="intake-sub">
          Enter what you actually have from this visit. Anything left blank is recorded as not
          measured — the AI agents will never treat it as a real value.
        </p>
        {atCapacity && (
          <p className="intake-error">
            Registry is at capacity (50/50) — cannot add more patients.
          </p>
        )}
        {error && <p className="intake-error">{error}</p>}

        <div className="intake-grid">
          <div className="field">
            <label>Patient name / initials *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. S.M." />
          </div>
          <div className="field">
            <label>Age *</label>
            <input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div className="field">
            <label>Sex *</label>
            <select value={sex} onChange={(e) => setSex(e.target.value)}>
              <option>Female</option>
              <option>Male</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>Chief complaint *</label>
          <textarea
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="What the patient told you, in your own words"
            rows={2}
          />
        </div>
        <div className="field">
          <label>Working diagnosis (optional)</label>
          <input value={dx} onChange={(e) => setDx(e.target.value)} />
        </div>
        <div className="field">
          <label>Current medications (comma-separated, optional)</label>
          <input
            value={meds}
            onChange={(e) => setMeds(e.target.value)}
            placeholder="Metformin 500mg OD, Amlodipine 5mg OD"
          />
        </div>

        <div className="intake-grid">
          <div className="field">
            <label>BP Systolic</label>
            <input type="number" value={bpSys} onChange={(e) => setBpSys(e.target.value)} />
          </div>
          <div className="field">
            <label>BP Diastolic</label>
            <input type="number" value={bpDia} onChange={(e) => setBpDia(e.target.value)} />
          </div>
          <div className="field">
            <label>Heart rate</label>
            <input type="number" value={hr} onChange={(e) => setHr(e.target.value)} />
          </div>
          <div className="field">
            <label>HbA1c (%)</label>
            <input
              type="number"
              step="0.1"
              value={hba1c}
              onChange={(e) => setHba1c(e.target.value)}
            />
          </div>
          <div className="field">
            <label>eGFR</label>
            <input type="number" value={egfr} onChange={(e) => setEgfr(e.target.value)} />
          </div>
          <div className="field">
            <label>ACR</label>
            <input type="number" value={acr} onChange={(e) => setAcr(e.target.value)} />
          </div>
          <div className="field">
            <label>Creatinine</label>
            <input
              type="number"
              step="0.1"
              value={creat}
              onChange={(e) => setCreat(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Potassium</label>
            <input type="number" step="0.1" value={k} onChange={(e) => setK(e.target.value)} />
          </div>
          <div className="field">
            <label>LDL</label>
            <input type="number" value={ldl} onChange={(e) => setLdl(e.target.value)} />
          </div>
        </div>

        <div className="intake-actions">
          <button className="intake-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="intake-submit"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                name,
                age,
                sex,
                chiefComplaint,
                dx,
                meds,
                bpSys,
                bpDia,
                hba1c,
                egfr,
                acr,
                ldl,
                creat,
                k,
                hr,
              })
            }
          >
            {submitting ? "Registering…" : "Register Patient"}
          </button>
        </div>
      </div>
    </div>
  );
}
