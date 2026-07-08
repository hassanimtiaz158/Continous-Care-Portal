import { useState, useCallback, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fetchPatients, fetchPatient, transferToBoard, askShura as apiAskShura, recordDecision, runBoard } from "../lib/api";

export const Route = createFileRoute("/")({
  component: ShuraApp,
});

type Role = "family" | "specialist" | "patient";
type Status = "crit" | "stable" | "review";

interface SpecialistFinding { text: string; metric?: string | null; confidence?: number; grounded?: boolean; }
interface SpecialistResult { risk_level: string; findings: SpecialistFinding[]; recommendation: string; }
interface BoardResult {
  session_id: string; patient_id: string;
  specialist_results: Record<string, SpecialistResult>;
  consensus: { joint_plan: string; priority_actions: string[]; conflicts: string[] };
  confidence_scores: Record<string, number>;
  data_completeness: number;
}

interface PatientData {
  id: string; name: string; age: number; sex: string; dx: string; status: Status;
  screening: Record<string,string>; glycemic: Record<string,string>; vitals: Record<string,string>;
  renal: Record<string,string>; cardiac: Record<string,string>; ecg: Record<string,string>;
  gpNote: string;
  agents: { endo: {rec:string;conf:number;warn?:boolean}; neph: {rec:string;conf:number;warn?:boolean}; card: {rec:string;conf:number;warn?:boolean} };
  plan: string; edu: string;
}

const hardcodedPatients: PatientData[] = [
  {id:'EG-4471', name:'E.G.', age:58, sex:'Female', dx:'T2DM + HTN + CKD 3a', status:'crit',
   screening:{rbg:'196', hba1c:'8.4', bp:'148/92', date:'10/03/2026'},
   glycemic:{hba1c:'9.1', fbs:'168', rbs:'—'},
   vitals:{bp:'158/96', hr:'88', weight:'89', temp:'36.9'},
   renal:{egfr:'41', creat:'1.8', acr:'61', k:'4.6'},
   cardiac:{sounds:'Normal S1/S2, no murmur', grade:'—', notes:'No radiation, no gallop.'},
   ecg:{rhythm:'Sinus rhythm', rate:'86', findings:'No ST changes.'},
   gpNote:'Missed evening Metformin doses ~3x/week (transport cost); mild GI upset with current dose.',
   agents:{ endo:{rec:'Increase Metformin — HbA1c 9.1% above target.', conf:91, warn:true},
     neph:{rec:'Hold Metformin. Recommend SGLT2i — renal-protective, once-daily.', conf:72},
     card:{rec:'Confirms SGLT2i safe. BP 158/96 needs antihypertensive adjustment.', conf:84} },
   plan:'Hold Metformin. Initiate SGLT2i. Adjust antihypertensive regimen.',
   edu:'Stop increasing your diabetes medicine dose. Start a new once-daily medicine that protects your kidneys and heart. Your blood pressure medicine dose was adjusted. Return in 4 weeks for a follow-up kidney test.'
  },
  {id:'EG-2290', name:'M.H.', age:64, sex:'Male', dx:'T2DM, stable', status:'stable',
   screening:{rbg:'171', hba1c:'7.0', bp:'128/80', date:'22/01/2025'},
   glycemic:{hba1c:'6.8', fbs:'112', rbs:'—'},
   vitals:{bp:'126/78', hr:'74', weight:'82', temp:'36.7'},
   renal:{egfr:'88', creat:'0.9', acr:'9', k:'4.2'},
   cardiac:{sounds:'Normal S1/S2, no murmur', grade:'—', notes:'No abnormal findings.'},
   ecg:{rhythm:'Sinus rhythm', rate:'72', findings:'Normal.'},
   gpNote:'Well controlled on current regimen, no adherence concerns.',
   agents:{ endo:{rec:'Continue current Metformin dose — well controlled.', conf:95},
     neph:{rec:'No renal concerns — routine monitoring only.', conf:97},
     card:{rec:'No cardiac concerns.', conf:96} },
   plan:'No changes — continue current management, routine follow-up in 6 months.',
   edu:'Your diabetes is well controlled. Keep taking your current medicine and come back for your routine check-up in 6 months.'
  },
  {id:'EG-3157', name:'A.R.', age:47, sex:'Female', dx:'HTN, newly diagnosed', status:'review',
   screening:{rbg:'104', hba1c:'5.5', bp:'152/94', date:'02/06/2026'},
   glycemic:{hba1c:'5.5', fbs:'96', rbs:'—'},
   vitals:{bp:'150/92', hr:'80', weight:'71', temp:'36.8'},
   renal:{egfr:'92', creat:'0.8', acr:'12', k:'4.3'},
   cardiac:{sounds:'Normal S1/S2, no murmur', grade:'—', notes:'No abnormal findings.'},
   ecg:{rhythm:'Sinus rhythm', rate:'78', findings:'Normal.'},
   gpNote:'Newly diagnosed hypertension, first specialist referral for medication choice.',
   agents:{ endo:{rec:'No diabetes concern at this time.', conf:90},
     neph:{rec:'Renal function normal — safe to start ACE inhibitor.', conf:93},
     card:{rec:'Recommend starting ACE inhibitor as first-line therapy.', conf:92} },
   plan:'Start ACE inhibitor, lifestyle counseling, recheck BP in 4 weeks.',
   edu:'You have been started on a new blood pressure medicine. Please check your blood pressure at home and return in 4 weeks.'
  },
  {id:'EG-5502', name:'N.F.', age:71, sex:'Male', dx:'CKD 3b + T2DM', status:'crit',
   screening:{rbg:'210', hba1c:'8.9', bp:'160/98', date:'15/09/2024'},
   glycemic:{hba1c:'8.2', fbs:'176', rbs:'—'},
   vitals:{bp:'162/98', hr:'92', weight:'79', temp:'37.0'},
   renal:{egfr:'32', creat:'2.4', acr:'210', k:'5.1'},
   cardiac:{sounds:'Murmur detected', grade:'II/VI systolic', notes:'Best heard at left sternal border, no radiation.'},
   ecg:{rhythm:'Sinus rhythm', rate:'90', findings:'Mild LVH pattern.'},
   gpNote:'Progressive renal decline over 6 months; patient reports fatigue and ankle swelling.',
   agents:{ endo:{rec:'Consider reducing Metformin dose — renal clearance reduced.', conf:88, warn:true},
     neph:{rec:'Stage 3b CKD — avoid Metformin entirely, refer to nephrology clinic.', conf:96},
     card:{rec:'New murmur warrants echocardiogram before medication changes.', conf:85} },
   plan:'Discontinue Metformin. Refer to nephrology clinic. Order echocardiogram for new murmur.',
   edu:'Stop your diabetes tablet completely — we will discuss a safer alternative. You will have a heart ultrasound and a kidney specialist visit arranged for you.'
  },
  {id:'EG-1183', name:'Y.S.', age:39, sex:'Female', dx:'HTN, well controlled', status:'stable',
   screening:{rbg:'98', hba1c:'5.2', bp:'122/78', date:'11/11/2024'},
   glycemic:{hba1c:'5.2', fbs:'90', rbs:'—'},
   vitals:{bp:'120/76', hr:'70', weight:'64', temp:'36.6'},
   renal:{egfr:'99', creat:'0.7', acr:'6', k:'4.1'},
   cardiac:{sounds:'Normal S1/S2, no murmur', grade:'—', notes:'No abnormal findings.'},
   ecg:{rhythm:'Sinus rhythm', rate:'68', findings:'Normal.'},
   gpNote:'Stable on current antihypertensive, no side effects reported.',
   agents:{ endo:{rec:'No diabetes concern.', conf:97},
     neph:{rec:'Renal function excellent.', conf:98},
     card:{rec:'Blood pressure well controlled — continue current dose.', conf:96} },
   plan:'Continue current management, routine follow-up in 6 months.',
   edu:'Your blood pressure is well controlled. Keep taking your current medicine and come back in 6 months.'
  },
  {id:'EG-6640', name:'H.K.', age:55, sex:'Male', dx:'T2DM, pending board review', status:'review',
   screening:{rbg:'188', hba1c:'8.0', bp:'138/88', date:'03/05/2026'},
   glycemic:{hba1c:'8.5', fbs:'160', rbs:'—'},
   vitals:{bp:'140/88', hr:'82', weight:'90', temp:'36.9'},
   renal:{egfr:'64', creat:'1.1', acr:'28', k:'4.4'},
   cardiac:{sounds:'Normal S1/S2, no murmur', grade:'—', notes:'No abnormal findings.'},
   ecg:{rhythm:'Sinus rhythm', rate:'80', findings:'Normal.'},
   gpNote:'HbA1c rising over last 3 visits despite adherence — needs dose review.',
   agents:{ endo:{rec:'Increase Metformin dose, consider adding second agent.', conf:87},
     neph:{rec:'Renal function borderline — monitor ACR, safe for now.', conf:80},
     card:{rec:'No cardiac contraindication to proposed changes.', conf:89} },
   plan:'Increase Metformin dose, add second glycemic agent, recheck ACR in 3 months.',
   edu:'Your diabetes medicine dose will be increased and a second medicine added. Please have a follow-up kidney test in 3 months.'
  }
];

function ShuraApp() {
  const [screen, setScreen] = useState<"cover" | "login" | "grid" | "record">("cover");
  const [role, setRole] = useState<Role>("family");
  const [user, setUser] = useState<{ name: string; id: string; role: Role } | null>(null);
  const [activePatient, setActivePatient] = useState<PatientData | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [loginErr, setLoginErr] = useState(false);
  const [qdOpen, setQdOpen] = useState(false);
  const [allPatients, setAllPatients] = useState<PatientData[]>(hardcodedPatients);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [boardResult, setBoardResult] = useState<BoardResult | null>(null);

  useEffect(() => {
    fetchPatients()
      .then(async (list: {id:string;name:string;age:number;sex:string;dx:string;status:string}[]) => {
        const full = await Promise.all(
          list.map(p => fetchPatient(p.id).catch(() => null))
        );
        const valid = full.filter(Boolean) as PatientData[];
        if (valid.length > 0) setAllPatients(valid);
      })
      .catch(() => {});
  }, []);

  const selectRole = useCallback((r: Role) => setRole(r), []);
  const enterApp = useCallback(() => setScreen("login"), []);

  const doLogin = useCallback(() => {
    const nameInput = document.getElementById("loginName") as HTMLInputElement;
    const idInput = document.getElementById("loginId") as HTMLInputElement;
    const name = nameInput?.value?.trim() || "";
    const id = idInput?.value?.trim() || "";
    if (!name || !id) { setLoginErr(true); return; }
    setLoginErr(false);
    const u = { name, id, role };
    setUser(u);
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
  }, []);

  const showGrid = useCallback(() => setScreen("grid"), []);

  const logout = useCallback(() => {
    setUser(null);
    setActivePatient(null);
    setActivePage(1);
    setLoginErr(false);
    setSessionId(null);
    setBoardResult(null);
    setScreen("cover");
  }, []);

  const gotoPage = useCallback((n: number) => setActivePage(n), []);

  const handleFieldChange = useCallback((
    section: "screening"|"glycemic"|"vitals"|"renal"|"cardiac"|"ecg",
    field: string,
    value: string,
  ) => {
    setActivePatient(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [section]: { ...prev[section], [field]: value } };
      setAllPatients(list => list.map(p => (p.id === updated.id ? updated : p)));
      return updated;
    });
  }, []);

  const handleAskShura = useCallback(async () => {
    const input = document.getElementById("askInput") as HTMLInputElement;
    const reply = document.getElementById("askReply");
    if (!input || !reply || !activePatient) return;
    const q = input.value.trim();
    if (!q) return;
    reply.style.display = "block";
    reply.textContent = "Thinking...";
    try {
      const res = await apiAskShura(activePatient.id, q);
      reply.textContent = res.answer;
    } catch {
      reply.textContent = `Based on your approved care plan: ${activePatient.edu}`;
    }
  }, [activePatient]);

  const handleTransferBoard = useCallback((btn: HTMLElement) => {
    btn.classList.add("sent");
    btn.textContent = "✓ Sent to Specialist Board";
    if (activePatient) transferToBoard(activePatient.id).catch(() => {});
  }, [activePatient]);

  const handleRunBoard = useCallback(async () => {
    if (!activePatient || !user) return;
    try {
      const result = await runBoard(activePatient.id);
      setSessionId(result.session_id);
      setBoardResult(result);
    } catch {
      alert("Board unavailable — GROQ_API_KEY not configured or service down. Showing demo data instead.");
    }
  }, [activePatient, user]);

  const handleApprove = useCallback(async () => {
    if (!sessionId || !user) { alert("No active board session. Convene the board first."); return; }
    try {
      await recordDecision({
        session_id: sessionId,
        decision: "approved",
        physician_name: user.name,
        physician_note: "Plan approved and released to Family Medicine.",
      });
      alert("Plan approved and released to Family Medicine.");
    } catch {
      alert("Failed to record decision.");
    }
  }, [sessionId, user]);

  const handleReject = useCallback(async () => {
    if (!sessionId || !user) { alert("No active board session."); return; }
    try {
      await recordDecision({
        session_id: sessionId,
        decision: "rejected",
        physician_name: user.name,
        physician_note: "Plan rejected — returned to Specialist Board.",
      });
      alert("Plan rejected — returned to Specialist Board.");
    } catch {
      alert("Failed to record decision.");
    }
  }, [sessionId, user]);

  const roleLabel = role === "family" ? "Family Medicine" : role === "specialist" ? "Specialist" : "Patient";

  return (
    <div style={{ minHeight: "100vh", background: "var(--void)", color: "var(--cream)", fontFamily: "'IBM Plex Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 14px" }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        {screen === "cover" && <CoverScreen onEnter={enterApp} />}
        {screen === "login" && (
          <LoginScreen role={role} onSelectRole={selectRole} onLogin={doLogin} loginErr={loginErr} onClearErr={() => setLoginErr(false)} />
        )}
        {screen === "grid" && user && (
          <GridScreen user={user} roleLabel={roleLabel} patients={allPatients} onOpenPatient={openPatient} onLogout={logout} />
        )}
        {screen === "record" && user && activePatient && (
          <RecordScreen
            patient={activePatient} user={user} role={role} roleLabel={roleLabel}
            activePage={activePage} onGotoPage={gotoPage}
            onBack={role === "patient" ? undefined : showGrid}
            onLogout={logout} onAskShura={handleAskShura}
            onTransferBoard={handleTransferBoard}
            onOpenQd={() => setQdOpen(true)}
            onRunBoard={handleRunBoard}
            onApprove={handleApprove}
            onReject={handleReject}
            sessionId={sessionId}
            onFieldChange={handleFieldChange}
            boardResult={boardResult}
          />
        )}
      </div>
      {qdOpen && activePatient && (
        <div className="overlay on">
          <QdOverlay patient={activePatient} onClose={() => setQdOpen(false)} />
        </div>
      )}
    </div>
  );
}

function CoverScreen({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="login-card" style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9.5px", letterSpacing: "2px", color: "var(--muted)", textTransform: "uppercase", marginBottom: 22 }}>Shura / Clinical AI Council</div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, color: "var(--cream)", marginBottom: 26 }}>Three readings. <span style={{ color: "var(--gold)" }}>One instrument.</span> One decision.</div>
      <div className="dial-wrap" style={{ maxWidth: 220, margin: "0 auto 16px" }}>
        <svg className="dial" viewBox="0 0 300 300">
          <circle className="rim" cx="150" cy="150" r="138"/>
          <g className="tick"><line x1="150" y1="14" x2="150" y2="28"/><line x1="150" y1="272" x2="150" y2="286"/><line x1="14" y1="150" x2="28" y2="150"/><line x1="272" y1="150" x2="286" y2="150"/></g>
          <line className="needle" x1="150" y1="150" x2="105" y2="185"/>
        </svg>
        <div className="node n-top"><div className="ic">◐</div><div className="pct">91%</div><div className="role">Endocrine</div></div>
        <div className="node n-left"><div className="ic">♡</div><div className="pct">84%</div><div className="role">Cardiology</div></div>
        <div className="node n-right"><div className="ic">◈</div><div className="pct">72%</div><div className="role">Nephrology</div></div>
        <div className="center-seal">✓</div>
      </div>
      <div className="wordmark" style={{ marginTop: 10 }}><h1>SHURA</h1></div>
      <div className="sub">AI reaches the consensus. <span style={{ color: "var(--gold)" }}>The physician reaches the decision.</span></div>
      <div className="signin-btn" onClick={onEnter}>Enter Shura</div>
    </div>
  );
}

function LoginScreen({ role, onSelectRole, onLogin, loginErr, onClearErr }: { role: Role; onSelectRole: (r: Role) => void; onLogin: () => void; loginErr: boolean; onClearErr: () => void }) {
  return (
    <div className="login-card">
      <div className="wordmark"><h1>SHURA</h1><div className="ar">شورى</div></div>
      <div className="sub">Sign in to your role</div>
      <div className="role-tabs">
        {(["family", "specialist", "patient"] as Role[]).map((r) => (
          <div key={r} className={`role-tab${role === r ? " active" : ""}`} onClick={() => onSelectRole(r)}>
            {r === "family" ? "Family Medicine" : r === "specialist" ? "Specialist" : "Patient"}
          </div>
        ))}
      </div>
      <div className="field-group"><label>Full name</label><input type="text" id="loginName" placeholder="e.g. Sarah Ahmed Mostafa" onChange={() => loginErr && onClearErr()} /></div>
      <div className="field-group"><label>National ID number</label><input type="text" id="loginId" placeholder="14-digit ID" onChange={() => loginErr && onClearErr()} /></div>
      <div className="signin-btn" onClick={onLogin}>Sign In</div>
      <div className="login-err" id="loginErr" style={{ display: loginErr ? "block" : "none" }}>Please enter both name and ID number.</div>
    </div>
  );
}

function GridScreen({ user, roleLabel, patients, onOpenPatient, onLogout }: { user: { name: string }; roleLabel: string; patients: PatientData[]; onOpenPatient: (p: PatientData) => void; onLogout: () => void }) {
  return (
    <>
      <div className="topbar">
        <div className="who-badge">Signed in as <b>{user.name}</b> · <span>{roleLabel}</span></div>
        <div className="logout" onClick={onLogout}>Sign out</div>
      </div>
      <div className="grid-title">Your patients</div>
      <div className="grid-sub">{roleLabel === "Family Medicine" ? "Patients under your routine follow-up" : "Cases referred to the Specialist Board"}</div>
      <div className="patient-grid">
        {patients.map((p) => (
          <div key={p.id} className="patient-icon" onClick={() => onOpenPatient(p)}>
            <div className="avatar">{p.name.split(".")[0]}</div>
            <div className="pname">{p.name}</div>
            <div className="pid">#{p.id}</div>
            <div className={`status-dot ${p.status}`} />
          </div>
        ))}
      </div>
    </>
  );
}

function RecordScreen({ patient, user, role, roleLabel, activePage, onGotoPage, onBack, onLogout, onAskShura, onTransferBoard, onOpenQd, onRunBoard, onApprove, onReject, sessionId, onFieldChange, boardResult }: {
  patient: PatientData; user: { name: string }; role: Role; roleLabel: string;
  activePage: number; onGotoPage: (n: number) => void;
  onBack?: () => void; onLogout: () => void;
  onAskShura: () => void; onTransferBoard: (btn: HTMLElement) => void; onOpenQd: () => void;
  onRunBoard: () => void; onApprove: () => void; onReject: () => void;
  sessionId: string | null;
  onFieldChange: (section: "screening"|"glycemic"|"vitals"|"renal"|"cardiac"|"ecg", field: string, value: string) => void;
  boardResult: BoardResult | null;
}) {
  const navLabels = ["1 · Screening", "2 · Family Medicine", "3 · Specialist Board", "4 · Sign-off", "5 · Return to FM"];

  const renderBody = () => {
    if (role === "patient") {
      return (
        <>
          <div className="section-block"><h4>Your Care Summary</h4><p>{patient.edu}</p></div>
          <div className="section-block locked"><h4>Specialist Discussion</h4><p>Internal clinical discussion between your care team.</p></div>
          <div className="section-block locked"><h4>Raw Lab Values & Audit Trail</h4><p>Available to your Family Medicine physician and specialists.</p></div>
          <div className="ask-shura">
            <h4>Ask Shura</h4>
            <div className="ask-row">
              <input type="text" id="askInput" placeholder="e.g. Why did you stop my old medicine?" />
              <div className="send" onClick={onAskShura}>Ask</div>
            </div>
            <div className="ask-reply" id="askReply" />
          </div>
        </>
      );
    }

    const a = patient.agents;
    switch (activePage) {
      case 1:
        return (
          <>
            <div className="section-block"><h4>Initial Screening Panel</h4>
              <div className="field-grid">{[["RBG (mg/dL)","rbg",patient.screening.rbg],["HbA1c (%)","hba1c",patient.screening.hba1c],["Blood Pressure","bp",patient.screening.bp],["Date","date",patient.screening.date]].map(([l,k,v]) => (
                <div className="field" key={l as string}><label>{l as string}</label><input value={v as string} disabled={role !== "family"} onChange={(e) => onFieldChange("screening", k as string, e.target.value)} /></div>
              ))}</div>
              <p>Initial diagnosis: {patient.dx}.</p>
            </div>
            <div className="stat-row">
              <div className="stat-box"><div className="v">100%</div><div className="k">Data Completeness</div></div>
              <div className="stat-box"><div className="v">{role === "family" ? "47" : "—"}</div><div className="k">Evidence Sources</div></div>
            </div>
            <div className="section-block"><h4>Evidence Chain</h4>
              {[["PHC Registry","47 records"],["Lab Interface HL7","128 records"],["Family Medicine Notes","9 records"],["Pharmacy Refill Log","22 records"]].map(([src,cnt]) => (
                <div className="evidence-row" key={src as string}><span className="src">{src as string}</span><span className="cnt">{cnt as string}</span></div>
              ))}
            </div>
            <div className="section-block"><h4>Missing Data · Flagged</h4>
              <div className="missing-row"><span>Retinal exam</span><span className="tag">never on file</span></div>
              <div className="missing-row"><span>Foot exam</span><span className="tag">overdue 18mo</span></div>
            </div>
          </>
        );
      case 2:
        return (
          <>
            <div className="section-block"><h4>Glycemic Panel</h4>
              <div className="field-grid">{[["HbA1c (%)","hba1c",patient.glycemic.hba1c],["FBS (mg/dL)","fbs",patient.glycemic.fbs],["RBS (mg/dL)","rbs",patient.glycemic.rbs]].map(([l,k,v]) => (
                <div className="field" key={l as string}><label>{l as string}</label><input value={v as string} disabled={role !== "family"} onChange={(e) => onFieldChange("glycemic", k as string, e.target.value)} /></div>
              ))}</div>
            </div>
            <div className="section-block"><h4>Vitals</h4>
              <div className="field-grid">{[["Blood Pressure","bp",patient.vitals.bp],["Heart Rate","hr",patient.vitals.hr],["Weight (kg)","weight",patient.vitals.weight],["Temp (°C)","temp",patient.vitals.temp]].map(([l,k,v]) => (
                <div className="field" key={l as string}><label>{l as string}</label><input value={v as string} disabled={role !== "family"} onChange={(e) => onFieldChange("vitals", k as string, e.target.value)} /></div>
              ))}</div>
            </div>
            <div className="section-block"><h4>Renal Panel</h4>
              <div className="field-grid">{[["eGFR","egfr",patient.renal.egfr],["Creatinine","creat",patient.renal.creat],["ACR","acr",patient.renal.acr],["Potassium","k",patient.renal.k]].map(([l,k,v]) => (
                <div className="field" key={l as string}><label>{l as string}</label><input value={v as string} disabled={role !== "family"} onChange={(e) => onFieldChange("renal", k as string, e.target.value)} /></div>
              ))}</div>
            </div>
            <div className="section-block"><h4>Cardiac Examination</h4>
              <div className="field-grid">{[["Heart sounds","sounds",patient.cardiac.sounds],["Murmur grade","grade",patient.cardiac.grade]].map(([l,k,v]) => (
                <div className="field" key={l as string}><label>{l as string}</label><input value={v as string} disabled={role !== "family"} onChange={(e) => onFieldChange("cardiac", k as string, e.target.value)} /></div>
              ))}</div>
              <p>{patient.cardiac.notes}</p>
            </div>
            <div className="section-block"><h4>ECG</h4>
              <div className="field-grid">{[["Rhythm","rhythm",patient.ecg.rhythm],["Rate","rate",patient.ecg.rate]].map(([l,k,v]) => (
                <div className="field" key={l as string}><label>{l as string}</label><input value={v as string} disabled={role !== "family"} onChange={(e) => onFieldChange("ecg", k as string, e.target.value)} /></div>
              ))}</div>
              <p>{patient.ecg.findings}</p>
            </div>
            <div className={`section-block${role !== "family" ? " locked" : ""}`}><h4>Contextual Notes to Board</h4><p>{patient.gpNote}</p></div>
            {role === "family" && (
              <>
                <div className="transfer-btn" onClick={(e) => onTransferBoard(e.currentTarget)}>⇄ Transfer to Specialist Board (Shura)</div>
                <div className="batch-note">Sends one batched case alert — not a separate notification per abnormal value.</div>
              </>
            )}
          </>
        );
      case 3: {
        const live = boardResult && boardResult.patient_id === patient.id ? boardResult : null;
        const specialists = live
          ? {
              endo: { rec: live.specialist_results.endocrine?.recommendation ?? "—", conf: live.confidence_scores.endocrine ?? 0 },
              card: { rec: live.specialist_results.cardiology?.recommendation ?? "—", conf: live.confidence_scores.cardiology ?? 0 },
              neph: { rec: live.specialist_results.nephrology?.recommendation ?? "—", conf: live.confidence_scores.nephrology ?? 0 },
            }
          : a;
        const planText = live ? live.consensus.joint_plan : patient.plan;
        return (
          <>
            <div className="section-block"><h4>Family Medicine Note</h4><p>{patient.gpNote}</p></div>
            <p style={{fontSize:11,fontWeight:600,color: live ? "var(--done)" : "var(--muted)",margin:"0 0 4px"}}>
              {live ? "● Live board analysis — session " + live.session_id : "○ Demo data shown — convene the board on the Sign-off tab for a live analysis"}
            </p>
            <p style={{fontSize:11,color:"var(--muted)",margin:"0 0 8px"}} title="Confidence reflects how complete the underlying data is for that specialty, adjusted for risk level — it is not disease severity or specialist agreement.">
              ⓘ % = confidence based on data completeness, not severity or agreement between specialists.
            </p>
            <div className="dial-wrap">
              <svg className="dial" viewBox="0 0 300 300">
                <circle className="rim" cx="150" cy="150" r="138"/>
                <g className="tick"><line x1="150" y1="14" x2="150" y2="28"/><line x1="150" y1="272" x2="150" y2="286"/><line x1="14" y1="150" x2="28" y2="150"/><line x1="272" y1="150" x2="286" y2="150"/></g>
                <line className="needle" x1="150" y1="150" x2="105" y2="185"/>
              </svg>
              <div className="node n-top"><div className="ic">◐</div><div className="pct">{specialists.endo.conf}%</div><div className="role">Endocrine</div></div>
              <div className="node n-left"><div className="ic">♡</div><div className="pct">{specialists.card.conf}%</div><div className="role">Cardiology</div></div>
              <div className="node n-right"><div className="ic">◈</div><div className="pct">{specialists.neph.conf}%</div><div className="role">Nephrology</div></div>
              <div className="center-seal">✓</div>
            </div>
            <div className="agent-card"><div className="spec">Endocrinology</div><p>{specialists.endo.rec}</p></div>
            <div className="agent-card"><div className="spec">Nephrology</div><p>{specialists.neph.rec}</p></div>
            <div className="agent-card"><div className="spec">Cardiology</div><p>{specialists.card.rec}</p></div>
            {role === "specialist"
              ? <div className="section-block"><h4>Internal Case Chat</h4><p>🔒 Not visible to Family Medicine or patient. Full discussion thread available here.</p></div>
              : <div className="chat-lock">🔒 Internal Case Chat — restricted to specialists</div>}
            <div className="section-block" style={{ border: "1px solid var(--gold-dim)", marginTop: 10 }}><h4 style={{ color: "var(--gold)" }}>Unified Care Plan</h4><p>{planText}</p></div>
          </>
        );
      }
      case 4: {
        const canSign = role === "specialist";
        return (
          <>
            <div className="section-block"><h4>Internal Medicine Sign-off</h4><p>Review the Unified Care Plan before it is released to Family Medicine.</p></div>
            <div style={{fontSize:10.5,color:"var(--muted)",marginBottom:6,fontFamily:"'IBM Plex Mono',monospace"}}>
              Session: {sessionId ?? "No active board session"}
            </div>
            <div className="signoff-row">
              <div className={`btn approve${canSign ? "" : " disabled"}`} onClick={() => canSign && onApprove()}>Approve</div>
              <div className={`btn reject${canSign ? "" : " disabled"}`} onClick={() => canSign && onReject()}>Reject</div>
            </div>
            {!canSign && <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>Only the Internal Medicine specialist can sign off. Family Medicine has view-only access at this stage.</p>}
            {role === "specialist" && (
              <div className="transfer-btn" style={{marginTop:12}} onClick={onRunBoard}>⚙ Convene Clinical Board</div>
            )}
          </>
        );
      }
      case 5:
        return (
          <>
            <div className="section-block"><h4>Return to Family Medicine — Implementation</h4><p>{patient.plan}</p></div>
            <div className="section-block"><h4>Patient Education Summary</h4><p>{patient.edu}</p></div>
          </>
        );
      default:
        return null;
    }
  };

  const accessNote = role === "family"
    ? "Family Medicine access: full screening & follow-up data entry, view-only Specialist Board outcome, Internal Case Chat restricted."
    : role === "specialist"
    ? "Specialist access: full Specialist Board tools and sign-off, PHC vitals shown as summary only."
    : "Patient access: a plain-language summary only. Clinical reasoning, internal notes, and specialist discussion are not shown here.";

  return (
    <>
      <div className="topbar">
        <div className="who-badge">Signed in as <b>{user.name}</b> · <span>{roleLabel}</span></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {role !== "patient" && <div className="qd-btn" onClick={onOpenQd}>⊞ Quick Dashboard</div>}
          <div className="logout" onClick={onLogout}>Sign out</div>
        </div>
      </div>
      <div className="record-view">
        {onBack ? <span className="back-link" onClick={onBack}>‹ Back to patient list</span> : <span className="back-link" style={{ visibility: "hidden" }}>‹</span>}
        <div className="record-title">Patient #{patient.id}</div>
        <div className="record-sub">{patient.age}y, {patient.sex} · {patient.dx}</div>
        <div className="access-note">{accessNote}</div>
        {role !== "patient" && (
          <div className="page-nav">
            {navLabels.map((l, i) => (
              <div key={i} className={`pn${activePage === i + 1 ? " on" : ""}`} onClick={() => onGotoPage(i + 1)}>{l}</div>
            ))}
          </div>
        )}
        {renderBody()}
      </div>
    </>
  );
}

function QdOverlay({ patient, onClose }: { patient: PatientData; onClose: () => void }) {
  const renalWarn = parseInt(patient.renal.egfr) < 60;
  const glyWarn = parseFloat(patient.glycemic.hba1c) > 7.5;
  const hasMurmur = patient.cardiac.sounds.includes("Murmur");

  return (
    <div className="qd-card" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 70, background: "var(--void-2)", border: "1px solid var(--line)", borderRadius: 12, padding: "20px 22px", maxWidth: 420, width: "90%", maxHeight: "80vh", overflowY: "auto" }}>
      <h3 style={{ fontFamily: "'Fraunces', serif", margin: "0 0 12px", fontSize: 16 }}>Quick Dashboard — #{patient.id}</h3>
      <div className="organ-row">
        <div className={`organ-card${renalWarn ? " warn" : ""}`}><div>Kidney</div><div className="oval">{patient.renal.egfr}</div><div>eGFR</div></div>
        <div className={`organ-card${hasMurmur ? " warn" : ""}`}><div>Heart</div><div className="oval" style={{ fontSize: 13 }}>{hasMurmur ? "Murmur" : "Normal"}</div><div>exam</div></div>
        <div className={`organ-card${glyWarn ? " warn" : ""}`}><div>Glycemic</div><div className="oval">{patient.glycemic.hba1c}%</div><div>HbA1c</div></div>
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>
        {renalWarn || glyWarn ? "1 batched alert for this case — grouped, not sent per metric." : "No active threshold alerts for this case."}
      </div>
      <div className="qd-close" onClick={onClose}>Close ✕</div>
    </div>
  );
}
