import React, { useState, useRef } from "react";

/* ================================================================== */
/*  CONTINUOUS CARE PORTAL — Clinical Board                            */
/*  All AI calls go through POST /api/board/run and related endpoints. */
/*  No API keys or system prompts exist in this file.                  */
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

const AGENT_META = [
  { key: "endocrine", tab: "Dr. Amara", role: "Endocrinology — Glucose Control", accent: "#B8823C", accentSoft: "#F3E4C8" },
  { key: "cardiology", tab: "Dr. Rousseau", role: "Cardiology — CV Risk", accent: "#A23B3B", accentSoft: "#F0D6D6" },
  { key: "nephrology", tab: "Dr. Osei", role: "Nephrology — Kidney Function", accent: "#2E6B62", accentSoft: "#D3E6E1" },
];

const RISK_LABEL = { stable: "Stable", watch: "Watch", urgent: "Urgent" };
const RISK_COLOR = { stable: "#3F6B4F", watch: "#B8823C", urgent: "#A23B3B" };

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

export default function ClinicalBoard() {
  const [status, setStatus] = useState("idle");
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

  async function runBoard() {
    const start = performance.now();
    setStatus("running");
    setErrMsg(null);
    setConsensus(null);
    setDecision(null);
    setEditing(false);
    setNote("");
    setTiming(null);
    setAuditTrail([]);

    try {
      const res = await fetch("/api/board/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: PATIENT.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Board request failed (${res.status})`);
      }
      const data = await res.json();

      sessionRef.current = data.session_id;
      setArchivist(data.archivist_summary);
      setConsensus(data.consensus);

      const combinedConfidence = data.confidence_scores || {};
      const next = {};
      for (const meta of AGENT_META) {
        const r = data.specialist_results[meta.key];
        if (r) {
          next[meta.key] = {
            ...r,
            confidence: combinedConfidence[meta.key] ?? null,
          };
        }
      }
      setResults(next);
      setEditText(data.consensus?.joint_plan || "");
      setStatus("done");
      setTiming(((performance.now() - start) / 1000).toFixed(1));
    } catch (e) {
      setErrMsg(e.message || "The board could not complete. Please try again.");
      setStatus("error");
    }
  }

  async function recordDecision(d) {
    setDecision(d);
    if (sessionRef.current) {
      try {
        await fetch("/api/board/decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionRef.current,
            decision: d,
            edited_text: d === "edited" ? editText : undefined,
            physician_note: note || undefined,
            physician_name: physician || undefined,
          }),
        });
      } catch {
        // Decision recorded locally even if backend call fails
      }
    }
  }

  async function toggleAudit() {
    if (!showAudit && sessionRef.current) {
      try {
        const res = await fetch(`/api/board/audit/${sessionRef.current}`);
        if (res.ok) {
          const trail = await res.json();
          const entries = [];
          entries.push({ ts: trail.created_at, event: "session_created", patient_id: trail.patient_id });
          for (const [agent, status] of Object.entries(trail.agent_status || {})) {
            entries.push({ ts: trail.created_at, event: `agent_${status}`, agent });
          }
          if (trail.data_completeness != null) {
            entries.push({ ts: trail.created_at, event: "data_completeness", value: trail.data_completeness });
          }
          if (trail.decision) {
            entries.push({ ts: trail.decided_at, event: "physician_decision", decision: trail.decision, physician: trail.physician_name });
          }
          setAuditTrail(entries);
        }
      } catch {
        // Keep existing trail on error
      }
    }
    setShowAudit((s) => !s);
  }

  async function exportPacket() {
    if (!sessionRef.current) return;
    try {
      const res = await fetch(`/api/board/export/${sessionRef.current}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${PATIENT.id}-review-packet.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail — export is non-critical
    }
  }

  return (
    <div style={styles.page}>
      <style>{`
        @media (max-width: 860px) { .tabs-row { flex-direction: column; } }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
        button:focus-visible, textarea:focus-visible, input:focus-visible { outline: 2px solid #2B3A55; outline-offset: 2px; }
      `}</style>

      <div style={styles.nonGoals}>
        <strong>Not a diagnosis. Not an order.</strong> The Clinical Board surfaces AI-assisted signals only — a human
        physician retains full decision authority and must review every recommendation before any action is taken.
      </div>

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

      <div style={styles.controlRow}>
        <button
          onClick={runBoard}
          disabled={status === "running"}
          style={{ ...styles.runButton, opacity: status === "running" ? 0.6 : 1 }}
        >
          {status === "idle" && "Convene the board"}
          {status === "running" && "Board reviewing…"}
          {(status === "done" || status === "error") && "Re-run the board"}
        </button>
        {timing && <div style={styles.timingNote}>Board response time: {timing}s</div>}
        {errMsg && <div style={styles.errText}>{errMsg}</div>}
        {auditTrail.length > 0 && (
          <button style={styles.linkButton} onClick={toggleAudit}>
            {showAudit ? "Hide audit trail" : `View audit trail (${auditTrail.length})`}
          </button>
        )}
      </div>

      {archivist && (
        <div style={styles.archivistBox}>
          <div style={styles.archivistHeader}>Archivist Agent — deterministic, no model involved</div>
          <div style={styles.archivistRow}>
            <span>Data completeness: <b>{archivist.completeness}%</b></span>
            <span>Risk points: <b>{archivist.risk_points}</b> → <b>{archivist.risk_tier}</b> tier</span>
          </div>
          {archivist.missing_fields && archivist.missing_fields.length > 0 && (
            <div style={styles.archivistMissing}>Missing: {archivist.missing_fields.join(" · ")}</div>
          )}
          {archivist.threshold_crossings && archivist.threshold_crossings.length > 0 && (
            <ul style={styles.archivistList}>
              {archivist.threshold_crossings.map((c, i) => (
                <li key={i} style={styles.archivistListItem}>⚑ {c}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showAudit && (
        <div style={styles.auditBox}>
          {auditTrail.map((e, i) => (
            <div key={i} style={styles.auditLine}>
              <span style={styles.auditTs}>{e.ts ? new Date(e.ts).toLocaleTimeString() : ""}</span> {e.event}
              {Object.entries(e)
                .filter(([k]) => !["ts", "event"].includes(k))
                .map(([k, v]) => ` · ${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
                .join("")}
            </div>
          ))}
        </div>
      )}

      <div className="tabs-row" style={styles.tabsRow}>
        {AGENT_META.map((a) => (
          <AgentTab key={a.key} agent={a} result={results[a.key]} />
        ))}
      </div>

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
  const loading = !result;
  return (
    <div style={{ ...styles.tab, borderTop: `4px solid ${agent.accent}` }}>
      <div style={styles.tabHeader}>
        <div style={{ ...styles.tabDot, background: agent.accent }} />
        <div>
          <div style={styles.tabName}>{agent.tab}</div>
          <div style={styles.tabRole}>{agent.role}</div>
        </div>
      </div>

      {loading && <div style={styles.tabIdle}>Awaiting board session</div>}

      {result && (
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
