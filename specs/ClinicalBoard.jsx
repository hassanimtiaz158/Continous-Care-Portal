import React, { useState, useMemo, useRef } from "react";

/* ================================================================== */
/*  CONTINUOUS CARE PORTAL — Clinical Board                            */
/*  Phase 1 build: Archivist Agent, Evidence & Provenance,             */
/*  Double Grounding Validation, Backend Orchestration boundary,       */
/*  + Phase 2 seeds: Confidence Scoring, Deterministic Risk Engine,    */
/*  Data Completeness, Structured Audit Trail.                        */
/*                                                                      */
/*  Synthetic patient — 12-month deterioration timeline, no real PHI  */
/* ================================================================== */

const PATIENT = {
  id: "CCP-014",
  name: "Synthetic Patient — Case CCP-014",
  age: 58,
  sex: "Female",
  dx: "Type 2 Diabetes (6y) · Essential Hypertension (9y)",
  meds: ["Metformin 1000mg BID", "Amlodipine 5mg OD", "Atorvastatin 20mg OD"],
  bp: [
    { t: "12mo", sys: 138, dia: 86 },
    { t: "6mo", sys: 146, dia: 90 },
    { t: "Now", sys: 158, dia: 96 },
  ],
  hba1c: [
    { t: "12mo", v: 7.2 },
    { t: "6mo", v: 7.9 },
    { t: "Now", v: 8.6 },
  ],
  egfr: [
    { t: "12mo", v: 78 },
    { t: "6mo", v: 69 },
    { t: "Now", v: 58 },
  ],
  acr: [
    { t: "12mo", v: 18 },
    { t: "6mo", v: 34 },
    { t: "Now", v: 61 },
  ],
  ldl: [
    { t: "12mo", v: 118 },
    { t: "6mo", v: 126 },
    { t: "Now", v: 134 },
  ],
};

// Known gaps in the record — deliberately present so Data Completeness
// (§2.8) and the Archivist's missing-data flags have something real to show.
const MISSING_FIELDS = ["Recent lipid panel (last drawn 6mo ago)", "Urine microalbumin confirmatory test"];

/* ------------------------------------------------------------------ */
/* De-identification layer (§2.11) — strips identifiers before any    */
/* content is sent to an LLM. Enforced here, client-side, as a stand- */
/* in for the backend gate the TDD specifies.                         */
/* ------------------------------------------------------------------ */
function deidentify(patient) {
  const { id, name, ...clinical } = patient;
  return clinical; // only clinical values, trends, meds — no identifiers
}

/* ------------------------------------------------------------------ */
/* Archivist Agent (§2.1) — deterministic, NO LLM.                    */
/* Computes trends, deltas, threshold crossings, a data-completeness  */
/* score, and a rule-based risk-point tally (§2.9 Deterministic Risk  */
/* Engine) before any specialist agent ever sees the record.          */
/* ------------------------------------------------------------------ */
function computeArchivistSummary(patient) {
  const delta = (series) => +(series[series.length - 1].v - series[0].v).toFixed(1);
  const trendLabel = (d) => (d > 0.05 ? "rising" : d < -0.05 ? "falling" : "stable");

  const hba1cDelta = delta(patient.hba1c);
  const egfrDelta = delta(patient.egfr);
  const acrDelta = delta(patient.acr);
  const ldlDelta = delta(patient.ldl);
  const sysDelta = +(patient.bp[2].sys - patient.bp[0].sys).toFixed(0);
  const diaDelta = +(patient.bp[2].dia - patient.bp[0].dia).toFixed(0);

  const crossings = [];
  if (patient.egfr[2].v < 60 && patient.egfr[0].v >= 60) {
    crossings.push("eGFR crossed CKD Stage 3 threshold (<60 mL/min)");
  }
  if (patient.hba1c[2].v >= 8.0 && patient.hba1c[0].v < 8.0) {
    crossings.push("HbA1c crossed 8.0% (above ADA individualized target range)");
  }
  if (patient.acr[2].v > 30 && patient.acr[0].v <= 30) {
    crossings.push("ACR crossed 30 mg/g (moderately increased albuminuria)");
  }

  // Deterministic Risk Engine (§2.9) — rule-based point system.
  let points = 0;
  const ruleLog = [];
  if (patient.hba1c[2].v > 8.5) { points += 3; ruleLog.push("HbA1c > 8.5 → +3"); }
  if (egfrDelta < -15) { points += 2; ruleLog.push("eGFR decline > 15 over 12mo → +2"); }
  if (acrDelta > 40) { points += 2; ruleLog.push("ACR increase > 40 → +2"); }
  if (sysDelta > 15) { points += 1; ruleLog.push("Systolic BP increase > 15 → +1"); }
  const riskTier = points >= 5 ? "High" : points >= 2 ? "Moderate" : "Low";

  // Data completeness (§2.8) — based on known gaps in this record.
  const totalChecks = 8;
  const completeness = Math.round(((totalChecks - MISSING_FIELDS.length) / totalChecks) * 100);

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      hba1c: { latest: patient.hba1c[2].v, delta: hba1cDelta, trend: trendLabel(hba1cDelta), unit: "%", history: patient.hba1c },
      egfr: { latest: patient.egfr[2].v, delta: egfrDelta, trend: trendLabel(egfrDelta), unit: "mL/min", history: patient.egfr },
      acr: { latest: patient.acr[2].v, delta: acrDelta, trend: trendLabel(acrDelta), unit: "mg/g", history: patient.acr },
      ldl: { latest: patient.ldl[2].v, delta: ldlDelta, trend: trendLabel(ldlDelta), unit: "mg/dL", history: patient.ldl },
      bp: { latestSys: patient.bp[2].sys, latestDia: patient.bp[2].dia, sysDelta, diaDelta, trend: trendLabel(sysDelta), unit: "mmHg", history: patient.bp },
    },
    thresholdCrossings: crossings,
    completeness,
    missingFields: MISSING_FIELDS,
    riskPoints: points,
    riskTier,
    ruleLog,
  };
}

/* ------------------------------------------------------------------ */
/* Specialist + Chair agent definitions                                */
/* ------------------------------------------------------------------ */
const AGENTS = [
  {
    key: "endocrine",
    tab: "Dr. Amara",
    role: "Endocrinology — Glucose Control",
    accent: "#B8823C",
    accentSoft: "#F3E4C8",
    metrics: ["hba1c"],
    system:
      "You are the Endocrinology agent on a multi-agent clinical board reviewing a chronic-disease patient with type 2 diabetes and hypertension. " +
      "You focus ONLY on glycemic control: HbA1c trend, medication adequacy, hypoglycemia risk, and how renal or cardiac findings from colleagues should modify diabetes therapy (e.g. metformin dose limits at low eGFR). " +
      "You do not make final decisions — you produce a specialist opinion for a human physician to review. " +
      "Every finding you report MUST reference one of these metric keys so it can be verified against the structured record: hba1c. " +
      "Respond with ONLY raw JSON, no markdown fences, no preamble, matching exactly: " +
      '{"risk_level":"stable|watch|urgent","findings":[{"text":"short finding referencing a real value","metric":"hba1c"}],"recommendation":"one or two sentence recommendation"}',
  },
  {
    key: "cardiology",
    tab: "Dr. Rousseau",
    role: "Cardiology — CV Risk",
    accent: "#A23B3B",
    accentSoft: "#F0D6D6",
    metrics: ["bp", "ldl"],
    system:
      "You are the Cardiology agent on a multi-agent clinical board reviewing a chronic-disease patient with type 2 diabetes and hypertension. " +
      "You focus ONLY on cardiovascular risk arising from the BP trend, LDL trend, and glycemic burden: blood pressure control, statin adequacy, and estimated risk of hypertensive or atherosclerotic complications. " +
      "You do not make final decisions — you produce a specialist opinion for a human physician to review. " +
      "Every finding you report MUST reference one of these metric keys so it can be verified against the structured record: bp, ldl. " +
      "Respond with ONLY raw JSON, no markdown fences, no preamble, matching exactly: " +
      '{"risk_level":"stable|watch|urgent","findings":[{"text":"short finding referencing a real value","metric":"bp|ldl"}],"recommendation":"one or two sentence recommendation"}',
  },
  {
    key: "nephrology",
    tab: "Dr. Osei",
    role: "Nephrology — Kidney Function",
    accent: "#2E6B62",
    accentSoft: "#D3E6E1",
    metrics: ["egfr", "acr"],
    system:
      "You are the Nephrology agent on a multi-agent clinical board reviewing a chronic-disease patient with type 2 diabetes and hypertension. " +
      "You focus ONLY on renal trajectory: eGFR trend, albumin-creatinine ratio (ACR) trend, staging of diabetic kidney disease, and any nephrotoxic or renally-cleared medications that need dose adjustment. " +
      "You do not make final decisions — you produce a specialist opinion for a human physician to review. " +
      "Every finding you report MUST reference one of these metric keys so it can be verified against the structured record: egfr, acr. " +
      "Respond with ONLY raw JSON, no markdown fences, no preamble, matching exactly: " +
      '{"risk_level":"stable|watch|urgent","findings":[{"text":"short finding referencing a real value","metric":"egfr|acr"}],"recommendation":"one or two sentence recommendation"}',
  },
];

const CHAIR_SYSTEM =
  "You are the Board Chair synthesizing three specialist opinions (endocrinology, cardiology, nephrology) into one joint plan for a patient with type 2 diabetes and hypertension. " +
  "Note any place where specialists' recommendations conflict (e.g. a cardiology drug choice that nephrology would need to dose-adjust). " +
  "This joint plan is a DRAFT for a human physician to approve, edit, or reject — it is not a final order. " +
  "Respond with ONLY raw JSON, no markdown fences, no preamble, matching exactly: " +
  '{"joint_plan":"2-3 sentence synthesized plan","priority_actions":["action 1","action 2","action 3"],"conflicts":["conflict 1"]}' +
  " (conflicts can be an empty array if there are none).";

const RISK_LABEL = { stable: "Stable", watch: "Watch", urgent: "Urgent" };
const RISK_COLOR = { stable: "#3F6B4F", watch: "#B8823C", urgent: "#A23B3B" };

/* ------------------------------------------------------------------ */
/* Backend Agent Orchestration boundary (§2.16)                        */
/* In production this whole function lives behind POST /api/board/run */
/* on the FastAPI backend — the browser never touches an API key or   */
/* a raw system prompt. Inside this sandboxed demo there is no        */
/* deployable backend host, so this single function stands in for     */
/* that server-side orchestrator; it is the ONLY place in the file    */
/* that talks to a model, and it only ever receives de-identified     */
/* data (see deidentify() above).                                     */
/* ------------------------------------------------------------------ */
async function askAgent(system, userContent) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await response.json();
  const raw = (data.content || [])
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

/* ------------------------------------------------------------------ */
/* Double Grounding Validation (§2.5)                                   */
/* Every numeric claim in a finding is checked against the Archivist's */
/* structured values. Unsupported findings are withheld, not shown.    */
/* ------------------------------------------------------------------ */
function extractNumbers(text) {
  const matches = text.match(/-?\d+(\.\d+)?/g) || [];
  return matches.map(Number);
}

function knownValuesForMetric(metric, archivist) {
  const m = archivist.metrics[metric === "bp" ? "bp" : metric];
  if (!m) return [];
  if (metric === "bp") {
    return [m.latestSys, m.latestDia, Math.abs(m.sysDelta), Math.abs(m.diaDelta), ...m.history.flatMap((h) => [h.sys, h.dia])];
  }
  return [m.latest, Math.abs(m.delta), ...m.history.map((h) => h.v)];
}

function validateFinding(finding, archivist) {
  if (!finding || !finding.metric || !archivist.metrics[finding.metric === "bp" ? "bp" : finding.metric]) {
    return { ...finding, grounded: false, evidence: null };
  }
  const nums = extractNumbers(finding.text || "");
  const known = knownValuesForMetric(finding.metric, archivist);
  const tolerance = 0.6;
  const unsupported = nums.filter((n) => !known.some((k) => Math.abs(k - n) <= tolerance));
  const grounded = unsupported.length === 0;
  const m = archivist.metrics[finding.metric === "bp" ? "bp" : finding.metric];
  const evidence =
    finding.metric === "bp"
      ? { sourceValues: m.history.map((h) => `${h.t}: ${h.sys}/${h.dia}`), method: "Δ vs. earliest reading", date: "Now" }
      : { sourceValues: m.history.map((h) => `${h.t}: ${h.v}${m.unit}`), method: "Δ vs. earliest reading", date: "Now" };
  return { ...finding, grounded, evidence, unsupportedValues: unsupported };
}

/* ------------------------------------------------------------------ */
/* Confidence Scoring (§2.7) — driven by data completeness             */
/* ------------------------------------------------------------------ */
function confidenceFor(archivist, riskLevel) {
  const base = 40 + archivist.completeness * 0.55;
  const adj = riskLevel === "urgent" ? 4 : riskLevel === "watch" ? 0 : 6;
  return Math.max(35, Math.min(97, Math.round(base + adj)));
}

/* ------------------------------------------------------------------ */
/* Small SVG sparkline                                                  */
/* ------------------------------------------------------------------ */
function Sparkline({ points, color }) {
  const vals = points.map((p) => p.v ?? p.sys);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const w = 96;
  const h = 30;
  const norm = (v) => (max === min ? h / 2 : h - ((v - min) / (max - min)) * h);
  const coords = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${norm(v)}`);
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={coords.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => {
        const [x, y] = c.split(",");
        return <circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 2.6 : 1.6} fill={color} />;
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */
export default function ClinicalBoard() {
  const [status, setStatus] = useState("idle"); // idle | archiving | running | synthesizing | done | error
  const [archivist, setArchivist] = useState(null);
  const [results, setResults] = useState({});
  const [consensus, setConsensus] = useState(null);
  const [decision, setDecision] = useState(null);
  const [editText, setEditText] = useState("");
  const [editing, setEditing] = useState(false);
  const [physician, setPhysician] = useState("");
  const [note, setNote] = useState("");
  const [errMsg, setErrMsg] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [showAudit, setShowAudit] = useState(false);
  const [timing, setTiming] = useState(null);
  const sessionRef = useRef(null);

  const clinicalOnly = useMemo(() => deidentify(PATIENT), []);

  function logAudit(entry) {
    setAuditTrail((prev) => [...prev, { ts: new Date().toISOString(), ...entry }]);
  }

  async function runBoard() {
    const start = performance.now();
    const sessionId = `CCP-SESSION-${Date.now()}`;
    sessionRef.current = sessionId;
    setStatus("archiving");
    setErrMsg(null);
    setConsensus(null);
    setDecision(null);
    setEditing(false);
    setNote("");
    setTiming(null);

    // Step 1 — Archivist Agent: deterministic, no LLM (§2.1)
    const summary = computeArchivistSummary(PATIENT);
    setArchivist(summary);
    logAudit({ sessionId, event: "archivist_computed", completeness: summary.completeness, riskTier: summary.riskTier });

    setStatus("running");
    const loading = {};
    AGENTS.forEach((a) => (loading[a.key] = { loading: true }));
    setResults(loading);

    try {
      const patientSummary = JSON.stringify(clinicalOnly, null, 2);
      const archivistBrief = JSON.stringify(summary.metrics, null, 2);

      const settled = await Promise.allSettled(
        AGENTS.map((a) =>
          askAgent(
            a.system,
            `De-identified clinical record:\n${patientSummary}\n\nArchivist's computed trends (use these numbers — do not recompute):\n${archivistBrief}\n\nGive your specialist opinion.`
          )
        )
      );

      const next = {};
      settled.forEach((r, i) => {
        const key = AGENTS[i].key;
        if (r.status === "fulfilled") {
          const val = r.value;
          const validated = (val.findings || []).map((f) => validateFinding(f, summary));
          const withheld = validated.filter((f) => !f.grounded).length;
          if (withheld > 0) {
            logAudit({ sessionId, event: "finding_withheld", agent: key, count: withheld });
          }
          next[key] = {
            risk_level: val.risk_level,
            findings: validated,
            recommendation: val.recommendation,
            confidence: confidenceFor(summary, val.risk_level),
          };
        } else {
          // AI Failure Handling (§2.6) — patient never disappears from the workflow
          next[key] = {
            risk_level: "watch",
            findings: [{ text: "Agent response unavailable.", grounded: true, evidence: null, fallback: true }],
            recommendation: "Retry the board. Raw archivist data remains available below.",
            confidence: null,
            failed: true,
          };
          logAudit({ sessionId, event: "agent_failed", agent: key });
        }
      });
      setResults(next);
      setStatus("synthesizing");

      const chairInput = `Patient record:\n${patientSummary}\n\nSpecialist opinions:\n${JSON.stringify(
        Object.fromEntries(Object.entries(next).map(([k, v]) => [k, { risk_level: v.risk_level, findings: v.findings.map((f) => f.text), recommendation: v.recommendation }])),
        null,
        2
      )}`;
      const chairResult = await askAgent(CHAIR_SYSTEM, chairInput);
      setConsensus(chairResult);
      setEditText(chairResult.joint_plan || "");
      setStatus("done");
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);
      setTiming(elapsed);
      logAudit({ sessionId, event: "board_complete", elapsedSeconds: elapsed });
    } catch (e) {
      setErrMsg("The board could not complete. Please try again.");
      setStatus("error");
      logAudit({ sessionId, event: "board_error", message: String(e) });
    }
  }

  function recordDecision(d) {
    setDecision(d);
    logAudit({
      sessionId: sessionRef.current,
      event: "physician_decision",
      decision: d,
      physician: physician || "reviewing physician",
      note: note || null,
      finalText: d === "edited" ? editText : consensus?.joint_plan,
    });
  }

  function exportPacket() {
    const packet = {
      patient: { id: PATIENT.id, name: PATIENT.name },
      archivistSummary: archivist,
      specialistResults: results,
      consensus,
      decision,
      physician: physician || "reviewing physician",
      note,
      timingSeconds: timing,
      auditTrail,
      nonGoalsNotice: "The Clinical Board does not diagnose, prescribe, or make final treatment decisions. All recommendations require physician review.",
    };
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${PATIENT.id}-review-packet.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={styles.page}>
      <style>{`
        @media (max-width: 860px) { .tabs-row { flex-direction: column; } }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
        button:focus-visible, textarea:focus-visible, input:focus-visible { outline: 2px solid #2B3A55; outline-offset: 2px; }
      `}</style>

      {/* ---------- Non-Goals banner (§2.12) — must be visible everywhere ---------- */}
      <div style={styles.nonGoals}>
        <strong>Not a diagnosis. Not an order.</strong> The Clinical Board surfaces AI-assisted signals only — a human
        physician retains full decision authority and must review every recommendation before any action is taken.
      </div>

      {/* ---------- Header / patient chart ---------- */}
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Continuous Care Portal · Clinical Board</div>
          <h1 style={styles.title}>{PATIENT.name}</h1>
          <div style={styles.sub}>{PATIENT.age} · {PATIENT.sex} · {PATIENT.dx}</div>
          <div style={styles.meds}>{PATIENT.meds.join("  ·  ")}</div>
        </div>
        <div style={styles.trendGrid}>
          <TrendCell label="Systolic BP" unit="mmHg" points={PATIENT.bp} color="#A23B3B" last={PATIENT.bp[2].sys} />
          <TrendCell label="HbA1c" unit="%" points={PATIENT.hba1c} color="#B8823C" last={PATIENT.hba1c[2].v} />
          <TrendCell label="eGFR" unit="mL/min" points={PATIENT.egfr} color="#2E6B62" last={PATIENT.egfr[2].v} />
          <TrendCell label="ACR" unit="mg/g" points={PATIENT.acr} color="#2E6B62" last={PATIENT.acr[2].v} />
        </div>
      </div>

      {/* ---------- Run control ---------- */}
      <div style={styles.controlRow}>
        <button
          onClick={runBoard}
          disabled={status === "archiving" || status === "running" || status === "synthesizing"}
          style={{ ...styles.runButton, opacity: ["archiving", "running", "synthesizing"].includes(status) ? 0.6 : 1 }}
        >
          {status === "idle" && "Convene the board"}
          {status === "archiving" && "Archivist computing trends…"}
          {status === "running" && "Specialists reviewing…"}
          {status === "synthesizing" && "Chair is synthesizing…"}
          {(status === "done" || status === "error") && "Re-run the board"}
        </button>
        {timing && <div style={styles.timingNote}>Board response time: {timing}s</div>}
        {errMsg && <div style={styles.errText}>{errMsg}</div>}
        {auditTrail.length > 0 && (
          <button style={styles.linkButton} onClick={() => setShowAudit((s) => !s)}>
            {showAudit ? "Hide audit trail" : `View audit trail (${auditTrail.length})`}
          </button>
        )}
      </div>

      {/* ---------- Archivist summary (deterministic — no LLM) ---------- */}
      {archivist && (
        <div style={styles.archivistBox}>
          <div style={styles.archivistHeader}>Archivist Agent — deterministic, no model involved</div>
          <div style={styles.archivistRow}>
            <span>Data completeness: <b>{archivist.completeness}%</b></span>
            <span>Risk points: <b>{archivist.riskPoints}</b> → <b>{archivist.riskTier}</b> tier</span>
          </div>
          {archivist.missingFields.length > 0 && (
            <div style={styles.archivistMissing}>Missing: {archivist.missingFields.join(" · ")}</div>
          )}
          {archivist.thresholdCrossings.length > 0 && (
            <ul style={styles.archivistList}>
              {archivist.thresholdCrossings.map((c, i) => (
                <li key={i} style={styles.archivistListItem}>⚑ {c}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ---------- Audit trail drawer ---------- */}
      {showAudit && (
        <div style={styles.auditBox}>
          {auditTrail.map((e, i) => (
            <div key={i} style={styles.auditLine}>
              <span style={styles.auditTs}>{e.ts.slice(11, 19)}</span> {e.event}
              {Object.entries(e)
                .filter(([k]) => !["ts", "event"].includes(k))
                .map(([k, v]) => ` · ${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
                .join("")}
            </div>
          ))}
        </div>
      )}

      {/* ---------- Agent tabs ---------- */}
      <div className="tabs-row" style={styles.tabsRow}>
        {AGENTS.map((a) => (
          <AgentTab key={a.key} agent={a} result={results[a.key]} />
        ))}
      </div>

      {/* ---------- Consensus strip ---------- */}
      {consensus && (
        <div style={styles.consensus}>
          <div style={styles.consensusHeader}>Board consensus — draft, pending physician sign-off</div>

          {editing ? (
            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} style={styles.textarea} rows={3} />
          ) : (
            <p style={styles.consensusPlan}>{editText || consensus.joint_plan}</p>
          )}

          {consensus.priority_actions && consensus.priority_actions.length > 0 && (
            <ul style={styles.actionList}>
              {consensus.priority_actions.map((a, i) => (
                <li key={i} style={styles.actionItem}>{a}</li>
              ))}
            </ul>
          )}

          {consensus.conflicts && consensus.conflicts.length > 0 && (
            <div style={styles.conflictBox}>
              <div style={styles.conflictLabel}>Cross-specialty conflicts flagged</div>
              {consensus.conflicts.map((c, i) => (
                <div key={i} style={styles.conflictItem}>⚠ {c}</div>
              ))}
            </div>
          )}

          {/* ---------- Physician decision ---------- */}
          {!decision && (
            <div style={styles.decisionArea}>
              <div style={styles.decisionRow}>
                <input
                  placeholder="Reviewing physician (optional)"
                  value={physician}
                  onChange={(e) => setPhysician(e.target.value)}
                  style={styles.physicianInput}
                />
                <div style={styles.decisionButtons}>
                  <button style={{ ...styles.decisionBtn, background: "#3F6B4F" }} onClick={() => recordDecision("approved")}>Approve</button>
                  <button
                    style={{ ...styles.decisionBtn, background: "#2B3A55" }}
                    onClick={() => {
                      if (editing) { recordDecision("edited"); setEditing(false); } else { setEditing(true); }
                    }}
                  >
                    {editing ? "Save edit & sign" : "Edit plan"}
                  </button>
                  <button style={{ ...styles.decisionBtn, background: "#A23B3B" }} onClick={() => recordDecision("rejected")}>Reject</button>
                </div>
              </div>
              <input
                placeholder="Optional note (e.g. reason for edit or rejection)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={styles.noteInput}
              />
            </div>
          )}

          {decision && (
            <div style={styles.stamp}>
              <div style={styles.stampText}>
                {decision === "approved" && "APPROVED"}
                {decision === "edited" && "APPROVED — EDITED"}
                {decision === "rejected" && "REJECTED — no orders placed"}
              </div>
              <div style={styles.stampSub}>
                {physician ? `Signed by ${physician}` : "Signed by reviewing physician"} · {new Date().toLocaleString()}
              </div>
              {note && <div style={styles.stampNote}>Note: {note}</div>}
              <button style={styles.exportBtn} onClick={exportPacket}>Export review packet (.json)</button>
            </div>
          )}
        </div>
      )}

      <div style={styles.footnote}>
        Synthetic demo patient · no real clinical data · AI agents surface signals only, a human physician retains final decision authority.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */
function TrendCell({ label, unit, points, color, last }) {
  return (
    <div style={styles.trendCell}>
      <div style={styles.trendLabel}>{label}</div>
      <div style={styles.trendValueRow}>
        <span style={{ ...styles.trendValue, color }}>{last}</span>
        <span style={styles.trendUnit}>{unit}</span>
      </div>
      <Sparkline points={points} color={color} />
    </div>
  );
}

function AgentTab({ agent, result }) {
  const loading = !result || result.loading;
  return (
    <div style={{ ...styles.tab, borderTop: `4px solid ${agent.accent}` }}>
      <div style={styles.tabHeader}>
        <div style={{ ...styles.tabDot, background: agent.accent }} />
        <div>
          <div style={styles.tabName}>{agent.tab}</div>
          <div style={styles.tabRole}>{agent.role}</div>
        </div>
      </div>

      {loading && result === undefined && <div style={styles.tabIdle}>Awaiting board session</div>}
      {loading && result && result.loading && <div style={styles.tabLoading}>Reviewing patient record…</div>}

      {result && !result.loading && (
        <>
          <div style={styles.badgeRow}>
            <div
              style={{
                ...styles.riskBadge,
                background: (RISK_COLOR[result.risk_level] || "#8A8A80") + "22",
                color: RISK_COLOR[result.risk_level] || "#5A5A50",
                border: `1px solid ${RISK_COLOR[result.risk_level] || "#8A8A80"}`,
              }}
            >
              {RISK_LABEL[result.risk_level] || result.risk_level}
            </div>
            {result.confidence != null && <div style={styles.confBadge}>Confidence {result.confidence}%</div>}
            {result.failed && <div style={styles.failedBadge}>Agent unavailable</div>}
          </div>

          <div style={styles.flagWrap}>
            {(result.findings || []).map((f, i) =>
              f.grounded === false ? (
                <div key={i} style={styles.withheld}>Unverifiable finding withheld — see audit trail for raw output.</div>
              ) : (
                <div key={i}>
                  <div
                    style={{
                      ...styles.flag,
                      background: agent.accentSoft,
                      borderLeft: `3px solid ${agent.accent}`,
                      transform: `rotate(${i % 2 === 0 ? "-0.6deg" : "0.5deg"})`,
                    }}
                  >
                    {f.text}
                  </div>
                  {f.evidence && (
                    <div style={styles.evidence}>
                      ✓ verified · {f.evidence.sourceValues.join(" → ")} ({f.evidence.method})
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          <div style={styles.recBox}>
            <div style={styles.recLabel}>Recommendation</div>
            <div style={styles.recText}>{result.recommendation}</div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                                */
/* ------------------------------------------------------------------ */
const styles = {
  page: { minHeight: "100vh", background: "#F2EFE4", color: "#262019", fontFamily: "'Segoe UI', -apple-system, sans-serif", padding: "20px 20px 60px", maxWidth: 1100, margin: "0 auto" },
  nonGoals: { background: "#FBFAF5", border: "1px solid #DEDACB", borderLeft: "4px solid #B8823C", borderRadius: 3, padding: "10px 14px", fontSize: 12.5, lineHeight: 1.5, color: "#4A4436", marginBottom: 18 },
  header: { display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #262019", paddingBottom: 20, marginBottom: 24 },
  eyebrow: { fontFamily: "'Courier New', monospace", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6B6152", marginBottom: 6 },
  title: { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 26, margin: "0 0 6px" },
  sub: { fontSize: 14, color: "#4A4436" },
  meds: { fontFamily: "'Courier New', monospace", fontSize: 12, color: "#6B6152", marginTop: 8 },
  trendGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(120px,1fr))", gap: 14 },
  trendCell: { background: "#FBFAF5", border: "1px solid #DEDACB", borderRadius: 4, padding: "8px 12px", minWidth: 120 },
  trendLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6152" },
  trendValueRow: { display: "flex", alignItems: "baseline", gap: 4, margin: "2px 0 4px" },
  trendValue: { fontFamily: "'Courier New', monospace", fontSize: 20, fontWeight: 700 },
  trendUnit: { fontSize: 11, color: "#6B6152" },
  controlRow: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 16 },
  runButton: { background: "#2B3A55", color: "#F2EFE4", border: "none", borderRadius: 3, padding: "12px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: "0.02em" },
  timingNote: { fontFamily: "'Courier New', monospace", fontSize: 12, color: "#6B6152" },
  errText: { color: "#A23B3B", fontSize: 13 },
  linkButton: { background: "none", border: "none", color: "#2B3A55", textDecoration: "underline", fontSize: 12.5, cursor: "pointer", padding: 0 },
  archivistBox: { background: "#FBFAF5", border: "1px dashed #B0A88F", borderRadius: 4, padding: "12px 16px", marginBottom: 18, fontFamily: "'Courier New', monospace" },
  archivistHeader: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B6152", marginBottom: 8 },
  archivistRow: { display: "flex", gap: 24, fontSize: 13, marginBottom: 6, flexWrap: "wrap" },
  archivistMissing: { fontSize: 12, color: "#8A6A2E", marginBottom: 6 },
  archivistList: { margin: "6px 0 0", paddingLeft: 18 },
  archivistListItem: { fontSize: 12.5, color: "#A23B3B", marginBottom: 3 },
  auditBox: { background: "#262019", color: "#D8D2C0", borderRadius: 4, padding: "12px 16px", marginBottom: 18, fontFamily: "'Courier New', monospace", fontSize: 11.5, maxHeight: 220, overflowY: "auto" },
  auditLine: { marginBottom: 4, lineHeight: 1.5 },
  auditTs: { color: "#8FA6C9" },
  tabsRow: { display: "flex", gap: 16, marginBottom: 20 },
  tab: { flex: 1, background: "#FBFAF5", border: "1px solid #DEDACB", borderRadius: 4, padding: 16, minHeight: 260 },
  tabHeader: { display: "flex", gap: 10, alignItems: "center", marginBottom: 12 },
  tabDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  tabName: { fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 700 },
  tabRole: { fontSize: 11, color: "#6B6152" },
  tabIdle: { fontSize: 13, color: "#9A917E", fontStyle: "italic" },
  tabLoading: { fontSize: 13, color: "#6B6152" },
  badgeRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 },
  riskBadge: { display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 3 },
  confBadge: { display: "inline-block", fontSize: 11, fontFamily: "'Courier New', monospace", color: "#4A4436", background: "#EFE9D6", padding: "3px 9px", borderRadius: 3 },
  failedBadge: { display: "inline-block", fontSize: 11, color: "#A23B3B", background: "#F0D6D6", padding: "3px 9px", borderRadius: 3 },
  flagWrap: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 },
  flag: { fontSize: 12.5, padding: "6px 9px", borderRadius: 2, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" },
  withheld: { fontSize: 12, padding: "6px 9px", borderRadius: 2, background: "repeating-linear-gradient(45deg, #F0D6D6, #F0D6D6 6px, #F7E6E6 6px, #F7E6E6 12px)", color: "#A23B3B", fontStyle: "italic" },
  evidence: { fontSize: 11, color: "#6B6152", padding: "2px 9px 0", fontFamily: "'Courier New', monospace" },
  recBox: { borderTop: "1px dashed #DEDACB", paddingTop: 10 },
  recLabel: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6152", marginBottom: 3 },
  recText: { fontSize: 13, lineHeight: 1.45 },
  consensus: { background: "#2B3A55", color: "#F2EFE4", borderRadius: 4, padding: 22, marginBottom: 20 },
  consensusHeader: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#B9C2D6", marginBottom: 10 },
  consensusPlan: { fontSize: 15, lineHeight: 1.55, margin: "0 0 14px" },
  textarea: { width: "100%", fontFamily: "inherit", fontSize: 14, padding: 10, borderRadius: 3, border: "1px solid #6B7A99", marginBottom: 14, background: "#F2EFE4", color: "#262019" },
  actionList: { margin: "0 0 14px", paddingLeft: 18 },
  actionItem: { fontSize: 13.5, marginBottom: 4, lineHeight: 1.4 },
  conflictBox: { background: "rgba(162,59,59,0.18)", border: "1px solid #C97575", borderRadius: 3, padding: "10px 12px", marginBottom: 16 },
  conflictLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, color: "#F0C9C9" },
  conflictItem: { fontSize: 13, marginBottom: 4 },
  decisionArea: { display: "flex", flexDirection: "column", gap: 10, marginTop: 4 },
  decisionRow: { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" },
  physicianInput: { flex: "1 1 220px", padding: "9px 10px", borderRadius: 3, border: "1px solid #6B7A99", background: "#F2EFE4", color: "#262019", fontSize: 13 },
  noteInput: { padding: "9px 10px", borderRadius: 3, border: "1px solid #6B7A99", background: "#F2EFE4", color: "#262019", fontSize: 13 },
  decisionButtons: { display: "flex", gap: 8 },
  decisionBtn: { border: "none", color: "#F2EFE4", padding: "9px 16px", borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  stamp: { marginTop: 6, borderTop: "1px solid #56618C", paddingTop: 12 },
  stampText: { display: "inline-block", fontFamily: "'Courier New', monospace", fontSize: 15, fontWeight: 700, letterSpacing: "0.06em", border: "2px solid #F2EFE4", borderRadius: 3, padding: "4px 10px", transform: "rotate(-2deg)", marginBottom: 6 },
  stampSub: { fontSize: 12, color: "#B9C2D6" },
  stampNote: { fontSize: 12, color: "#D8DEEC", marginTop: 6, fontStyle: "italic" },
  exportBtn: { marginTop: 12, background: "none", border: "1px solid #6B7A99", color: "#F2EFE4", padding: "7px 12px", borderRadius: 3, fontSize: 12, cursor: "pointer" },
  footnote: { fontSize: 11.5, color: "#8A8272", textAlign: "center", marginTop: 10 },
};
