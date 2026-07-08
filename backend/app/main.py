import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from openai import AsyncOpenAI
from pydantic import BaseModel

from app.audit import get_audit_trail, init_audit_db, record_decision
from app.export import generate_export_pdf
from app.models import Patient, TimePoint, BPPoint
from app.orchestrator import run_board, get_review_queue

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="Continuous Care Portal — Backend", version="0.1.0")

_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
]
_frontend_url = os.getenv("FRONTEND_URL", "")
if _frontend_url:
    _CORS_ORIGINS.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve built frontend static files
_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

# Initialise audit database on startup
init_audit_db()

# ---------------------------------------------------------------------------
# Patient fixtures — Shura clinical data (matches HTML frontend)
# In production this would come from a database.
# ---------------------------------------------------------------------------

_PATIENTS: dict[str, Patient] = {}

# Shura patient schema — full record matching the HTML frontend
class ShuraPatient(BaseModel):
    id: str
    name: str
    age: int
    sex: str
    dx: str
    status: str  # "crit" | "stable" | "review"
    screening: dict
    glycemic: dict
    vitals: dict
    renal: dict
    cardiac: dict
    ecg: dict
    gpNote: str
    agents: dict
    plan: str
    edu: str

_SHURA_PATIENTS: dict[str, ShuraPatient] = {}

def _mk_p(*, id: str, name: str, age: int, sex: str, dx: str, status: str,
          screening: dict, glycemic: dict, vitals: dict, renal: dict,
          cardiac: dict, ecg: dict, gpNote: str, agents: dict, plan: str, edu: str):
    return ShuraPatient(
        id=id, name=name, age=age, sex=sex, dx=dx, status=status,
        screening=screening, glycemic=glycemic, vitals=vitals, renal=renal,
        cardiac=cardiac, ecg=ecg, gpNote=gpNote, agents=agents, plan=plan, edu=edu,
    )

_sp = _mk_p
_SHURA_PATIENTS["EG-4471"] = _sp(
    id="EG-4471", name="E.G.", age=58, sex="Female", dx="T2DM + HTN + CKD 3a", status="crit",
    screening={"rbg":"196","hba1c":"8.4","bp":"148/92","date":"10/03/2026"},
    glycemic={"hba1c":"9.1","fbs":"168","rbs":"—"},
    vitals={"bp":"158/96","hr":"88","weight":"adapted protocol","temp":"36.9"},
    renal={"egfr":"41","creat":"1.8","acr":"61","k":"4.6"},
    cardiac={"sounds":"Normal S1/S2, no murmur","grade":"—","notes":"No radiation, no gallop."},
    ecg={"rhythm":"Sinus rhythm","rate":"86","findings":"No ST changes."},
    gpNote="Missed evening Metformin doses ~3x/week (transport cost); mild GI upset with current dose.",
    agents={"endo":{"rec":"Increase Metformin — HbA1c 9.1% above target.","conf":91,"warn":True},"neph":{"rec":"Hold Metformin. Recommend SGLT2i — renal-protective, once-daily.","conf":72},"card":{"rec":"Confirms SGLT2i safe. BP 158/96 needs antihypertensive adjustment.","conf":84}},
    plan="Hold Metformin. Initiate SGLT2i. Adjust antihypertensive regimen.",
    edu="Stop increasing your diabetes medicine dose. Start a new once-daily medicine that protects your kidneys and heart. Your blood pressure medicine dose was adjusted. Return in 4 weeks for a follow-up kidney test."
)
_SHURA_PATIENTS["EG-2290"] = _sp(
    id="EG-2290", name="M.H.", age=64, sex="Male", dx="T2DM, stable", status="stable",
    screening={"rbg":"171","hba1c":"7.0","bp":"128/80","date":"22/01/2025"},
    glycemic={"hba1c":"6.8","fbs":"112","rbs":"—"},
    vitals={"bp":"126/78","hr":"74","weight":"82","temp":"36.7"},
    renal={"egfr":"88","creat":"0.9","acr":"9","k":"4.2"},
    cardiac={"sounds":"Normal S1/S2, no murmur","grade":"—","notes":"No abnormal findings."},
    ecg={"rhythm":"Sinus rhythm","rate":"72","findings":"Normal."},
    gpNote="Well controlled on current regimen, no adherence concerns.",
    agents={"endo":{"rec":"Continue current Metformin dose — well controlled.","conf":95},"neph":{"rec":"No renal concerns — routine monitoring only.","conf":97},"card":{"rec":"No cardiac concerns.","conf":96}},
    plan="No changes — continue current management, routine follow-up in 6 months.",
    edu="Your diabetes is well controlled. Keep taking your current medicine and come back for your routine check-up in 6 months."
)
_SHURA_PATIENTS["EG-3157"] = _sp(
    id="EG-3157", name="A.R.", age=47, sex="Female", dx="HTN, newly diagnosed", status="review",
    screening={"rbg":"104","hba1c":"5.5","bp":"152/94","date":"02/06/2026"},
    glycemic={"hba1c":"5.5","fbs":"96","rbs":"—"},
    vitals={"bp":"150/92","hr":"80","weight":"71","temp":"36.8"},
    renal={"egfr":"92","creat":"0.8","acr":"12","k":"4.3"},
    cardiac={"sounds":"Normal S1/S2, no murmur","grade":"—","notes":"No abnormal findings."},
    ecg={"rhythm":"Sinus rhythm","rate":"78","findings":"Normal."},
    gpNote="Newly diagnosed hypertension, first specialist referral for medication choice.",
    agents={"endo":{"rec":"No diabetes concern at this time.","conf":90},"neph":{"rec":"Renal function normal — safe to start ACE inhibitor.","conf":93},"card":{"rec":"Recommend starting ACE inhibitor as first-line therapy.","conf":92}},
    plan="Start ACE inhibitor, lifestyle counseling, recheck BP in 4 weeks.",
    edu="You have been started on a new blood pressure medicine. Please check your blood pressure at home and return in 4 weeks."
)
_SHURA_PATIENTS["EG-5502"] = _sp(
    id="EG-5502", name="N.F.", age=71, sex="Male", dx="CKD 3b + T2DM", status="crit",
    screening={"rbg":"210","hba1c":"8.9","bp":"160/98","date":"15/09/2024"},
    glycemic={"hba1c":"8.2","fbs":"176","rbs":"—"},
    vitals={"bp":"162/98","hr":"92","weight":"79","temp":"37.0"},
    renal={"egfr":"32","creat":"2.4","acr":"210","k":"5.1"},
    cardiac={"sounds":"Murmur detected","grade":"II/VI systolic","notes":"Best heard at left sternal border, no radiation."},
    ecg={"rhythm":"Sinus rhythm","rate":"90","findings":"Mild LVH pattern."},
    gpNote="Progressive renal decline over 6 months; patient reports fatigue and ankle swelling.",
    agents={"endo":{"rec":"Consider reducing Metformin dose — renal clearance reduced.","conf":88,"warn":True},"neph":{"rec":"Stage 3b CKD — avoid Metformin entirely, refer to nephrology clinic.","conf":96},"card":{"rec":"New murmur warrants echocardiogram before medication changes.","conf":85}},
    plan="Discontinue Metformin. Refer to nephrology clinic. Order echocardiogram for new murmur.",
    edu="Stop your diabetes tablet completely — we will discuss a safer alternative. You will have a heart ultrasound and a kidney specialist visit arranged for you."
)
_SHURA_PATIENTS["EG-1183"] = _sp(
    id="EG-1183", name="Y.S.", age=39, sex="Female", dx="HTN, well controlled", status="stable",
    screening={"rbg":"98","hba1c":"5.2","bp":"122/78","date":"11/11/2024"},
    glycemic={"hba1c":"5.2","fbs":"90","rbs":"—"},
    vitals={"bp":"120/76","hr":"70","weight":"64","temp":"36.6"},
    renal={"egfr":"99","creat":"0.7","acr":"6","k":"4.1"},
    cardiac={"sounds":"Normal S1/S2, no murmur","grade":"—","notes":"No abnormal findings."},
    ecg={"rhythm":"Sinus rhythm","rate":"68","findings":"Normal."},
    gpNote="Stable on current antihypertensive, no side effects reported.",
    agents={"endo":{"rec":"No diabetes concern.","conf":97},"neph":{"rec":"Renal function excellent.","conf":98},"card":{"rec":"Blood pressure well controlled — continue current dose.","conf":96}},
    plan="Continue current management, routine follow-up in 6 months.",
    edu="Your blood pressure is well controlled. Keep taking your current medicine and come back in 6 months."
)
_SHURA_PATIENTS["EG-6640"] = _sp(
    id="EG-6640", name="H.K.", age=55, sex="Male", dx="T2DM, pending board review", status="review",
    screening={"rbg":"188","hba1c":"8.0","bp":"138/88","date":"03/05/2026"},
    glycemic={"hba1c":"8.5","fbs":"160","rbs":"—"},
    vitals={"bp":"140/88","hr":"82","weight":"90","temp":"36.9"},
    renal={"egfr":"64","creat":"1.1","acr":"28","k":"4.4"},
    cardiac={"sounds":"Normal S1/S2, no murmur","grade":"—","notes":"No abnormal findings."},
    ecg={"rhythm":"Sinus rhythm","rate":"80","findings":"Normal."},
    gpNote="HbA1c rising over last 3 visits despite adherence — needs dose review.",
    agents={"endo":{"rec":"Increase Metformin dose, consider adding second agent.","conf":87},"neph":{"rec":"Renal function borderline — monitor ACR, safe for now.","conf":80},"card":{"rec":"No cardiac contraindication to proposed changes.","conf":89}},
    plan="Increase Metformin dose, add second glycemic agent, recheck ACR in 3 months.",
    edu="Your diabetes medicine dose will be increased and a second medicine added. Please have a follow-up kidney test in 3 months."
)

# Also seed the original Patient model for board/run compatibility
CCP014 = Patient(
    id="CCP-014",
    name="Synthetic Patient — Case CCP-014",
    age=58,
    sex="Female",
    dx="Type 2 Diabetes (6y) · Essential Hypertension (9y)",
    meds=["Metformin 1000mg BID", "Amlodipine 5mg OD", "Atorvastatin 20mg OD"],
    bp=[
        BPPoint(t="12mo", sys=138, dia=86),
        BPPoint(t="6mo", sys=146, dia=90),
        BPPoint(t="Now", sys=158, dia=96),
    ],
    hba1c=[TimePoint(t="12mo", v=7.2), TimePoint(t="6mo", v=7.9), TimePoint(t="Now", v=8.6)],
    egfr=[TimePoint(t="12mo", v=78), TimePoint(t="6mo", v=69), TimePoint(t="Now", v=58)],
    acr=[TimePoint(t="12mo", v=18), TimePoint(t="6mo", v=34), TimePoint(t="Now", v=61)],
    ldl=[TimePoint(t="12mo", v=118), TimePoint(t="6mo", v=126), TimePoint(t="Now", v=134)],
    missing_fields=[
        "Recent lipid panel (last drawn 6mo ago)",
        "Urine microalbumin confirmatory test",
    ],
)
_PATIENTS[CCP014.id] = CCP014


# ---------------------------------------------------------------------------
# Request / response schemas — TDD §5 API contract
# ---------------------------------------------------------------------------


class BoardRunRequest(BaseModel):
    patient_id: str = "CCP-014"


class BoardDecisionRequest(BaseModel):
    session_id: str
    decision: str  # "approved" | "edited" | "rejected"
    edited_text: str | None = None
    physician_note: str | None = None
    physician_name: str | None = None


class HealthResponse(BaseModel):
    status: str = "ok"
    groq_key_set: bool


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        groq_key_set=bool(os.getenv("GROQ_API_KEY")),
    )


@app.post("/api/board/run")
async def board_run(req: BoardRunRequest):
    patient = _PATIENTS.get(req.patient_id)
    if patient is None:
        sp = _SHURA_PATIENTS.get(req.patient_id.upper())
        if sp is not None:
            patient = Patient(
                id=sp.id,
                name=sp.name,
                age=sp.age,
                sex=sp.sex,
                dx=sp.dx,
                meds=[],
                bp=[BPPoint(t="Now", sys=int(sp.vitals.get("bp","120/80").split("/")[0]), dia=int(sp.vitals.get("bp","120/80").split("/")[1]))],
                hba1c=[TimePoint(t="Now", v=float(sp.glycemic.get("hba1c","7.0")))],
                egfr=[TimePoint(t="Now", v=float(sp.renal.get("egfr","90")))],
                acr=[TimePoint(t="Now", v=float(sp.renal.get("acr","10")))],
                ldl=[TimePoint(t="Now", v=100)],
                missing_fields=[],
            )
    if patient is None:
        raise HTTPException(status_code=404, detail=f"Patient {req.patient_id} not found")

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")

    client = AsyncOpenAI(
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1",
    )
    try:
        result = await run_board(patient, client)
    finally:
        await client.close()

    return result


@app.post("/api/board/decision")
def board_decision(req: BoardDecisionRequest):
    if req.decision not in ("approved", "edited", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be approved, edited, or rejected")

    try:
        audit_entry_id = record_decision(
            session_id=req.session_id,
            decision=req.decision,
            edited_text=req.edited_text,
            physician_note=req.physician_note,
            physician_name=req.physician_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {"audit_entry_id": audit_entry_id}


@app.get("/api/board/audit/{session_id}")
def board_audit(session_id: str):
    trail = get_audit_trail(session_id)
    if trail is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return trail


@app.get("/api/board/export/{session_id}")
def board_export(session_id: str):
    """Return a PDF review packet for the given session (TDD §2.15)."""
    trail = get_audit_trail(session_id)
    if trail is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    patient = _PATIENTS.get(trail["patient_id"])
    if patient is None:
        raise HTTPException(status_code=404, detail=f"Patient {trail['patient_id']} not found")

    pdf_bytes = generate_export_pdf(
        patient_id=patient.id,
        patient_name=patient.name,
        patient_age=patient.age,
        patient_sex=patient.sex,
        patient_dx=patient.dx,
        patient_meds=patient.meds,
        archivist_summary={
            "metrics": {},
            "threshold_crossings": [],
            "missing_fields": patient.missing_fields,
            "completeness": trail.get("data_completeness"),
        },
        specialist_results={
            k: {
                "risk_level": trail.get("specialist_risk_levels", {}).get(k, "stable"),
                "findings": trail.get("specialist_findings", {}).get(k, []),
                "recommendation": trail.get("recommendations", {}).get(k, ""),
                "failed": trail.get("agent_status", {}).get(k) == "failed",
            }
            for k in ("endocrine", "cardiology", "nephrology")
        },
        consensus=trail.get("consensus", {}),
        decision=trail.get("decision"),
        edited_text=trail.get("edited_text"),
        physician_note=trail.get("physician_note"),
        physician_name=trail.get("physician_name"),
        decided_at=trail.get("decided_at"),
        data_completeness=trail.get("data_completeness"),
        confidence_scores=trail.get("confidence_scores"),
        audit_log=[
            {"ts": trail["created_at"], "event": "session_created"},
            *[
                {"ts": trail["created_at"], "event": f"agent_{status}", "agent": agent}
                for agent, status in trail.get("agent_status", {}).items()
            ],
            *(
                [{"ts": trail["decided_at"], "event": "physician_decision", "decision": trail["decision"], "physician": trail.get("physician_name")}]
                if trail.get("decision")
                else []
            ),
        ],
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{session_id}-review-packet.pdf"'},
    )


@app.get("/api/review-queue")
def review_queue():
    """Return all pending manual review entries (TDD §2.6)."""
    return get_review_queue()


# ---------------------------------------------------------------------------
# Shura patient endpoints — compatible with the frontend
# ---------------------------------------------------------------------------


@app.get("/api/patients")
def list_patients():
    """Return a lightweight list of all Shura patients (for the grid screen)."""
    return [
        {
            "id": p.id,
            "name": p.name,
            "age": p.age,
            "sex": p.sex,
            "dx": p.dx,
            "status": p.status,
        }
        for p in _SHURA_PATIENTS.values()
    ]


@app.get("/api/patients/{patient_id}")
def get_patient(patient_id: str):
    """Return the full Shura patient record."""
    p = _SHURA_PATIENTS.get(patient_id.upper())
    if p is None:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return p.model_dump()


@app.post("/api/patients/{patient_id}/transfer-board")
def transfer_to_board(patient_id: str):
    """Log a transfer-to-specialist-board action."""
    p = _SHURA_PATIENTS.get(patient_id.upper())
    if p is None:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return {"status": "transferred", "patient_id": patient_id, "message": f"Case #{patient_id} sent to Specialist Board."}


class AskShuraRequest(BaseModel):
    patient_id: str
    question: str


def _contextual_answer(patient: ShuraPatient, question: str) -> str:
    """Generate a context-aware answer based on the question and patient data."""
    q = question.lower()
    p = patient

    if any(kw in q for kw in ["medicine", "drug", "medication", "prescription", "dose", "metformin"]):
        return (
            f"Your current care plan: {p.plan}. "
            f"The specialist board has reviewed your medications and recommends: "
            f"{p.agents['endo']['rec']} {p.agents['neph']['rec']}"
        )
    if any(kw in q for kw in ["kidney", "renal", "egfr", "creatinine"]):
        return (
            f"Your kidney function: eGFR {p.renal.egfr}, Creatinine {p.renal.creat}, ACR {p.renal.acr}. "
            f"Nephrology says: {p.agents['neph']['rec']}"
        )
    if any(kw in q for kw in ["heart", "cardiac", "blood pressure", "bp", "hypertension"]):
        return (
            f"Your blood pressure: {p.vitals.bp}, Heart rate: {p.vitals.hr}. "
            f"Cardiology says: {p.agents['card']['rec']}"
        )
    if any(kw in q for kw in ["diabetes", "sugar", "glucose", "hba1c", "glycemic"]):
        return (
            f"Your glycemic status: HbA1c {p.glycemic.hba1c}%, FBS {p.glycemic.fbs} mg/dL. "
            f"Endocrinology says: {p.agents['endo']['rec']}"
        )
    if any(kw in q for kw in ["plan", "treatment", "next", "follow", "return"]):
        return f"Your care plan: {p.plan}. Education: {p.edu}"
    if any(kw in q for kw in ["murmur", "ecg", "rhythm"]):
        return (
            f"Cardiac findings: {p.cardiac.sounds}, ECG: {p.ecg.rhythm} at {p.ecg.rate} bpm. "
            f"{p.ecg.findings} Cardiology says: {p.agents['card']['rec']}"
        )

    return (
        f"Regarding your question about '{question}': "
        f"Your care plan is: {p.plan}. "
        f"Education summary: {p.edu}"
    )


@app.post("/api/board/ask-shura")
def ask_shura(req: AskShuraRequest):
    """Return a context-aware answer based on the question and patient data."""
    p = _SHURA_PATIENTS.get(req.patient_id.upper())
    if p is None:
        raise HTTPException(status_code=404, detail=f"Patient {req.patient_id} not found")
    return {"question": req.question, "answer": _contextual_answer(p, req.question)}


# ---------------------------------------------------------------------------
# Marketing/Landing page data endpoints — maps to clinical.ts structure
# ---------------------------------------------------------------------------

_CLINICAL_DATA: dict[str, dict] = {
    "CCP-014": {
        "heroMetrics": [
            {"label":"Evidence Verified","value":98,"suffix":"%"},
            {"label":"Specialist Reviews","value":3,"suffix":""},
            {"label":"Data Completeness","value":100,"suffix":"%"},
            {"label":"Review Confidence","value":94,"suffix":"%"},
        ],
        "trends": [
            {"label":"HbA1c","unit":"%","values":[7.2,7.4,7.6,7.9,8.2,8.6],"dates":["Jul '25","Sep '25","Nov '25","Jan '26","Mar '26","Jun '26"],"target":7.0,"status":"critical","delta":"+1.4"},
            {"label":"Blood Pressure","unit":"mmHg","values":[138,142,146,150,154,158],"dates":["Jul '25","Sep '25","Nov '25","Jan '26","Mar '26","Jun '26"],"target":130,"status":"critical","delta":"+20"},
            {"label":"eGFR","unit":"mL/min","values":[78,74,71,68,63,58],"dates":["Jul '25","Sep '25","Nov '25","Jan '26","Mar '26","Jun '26"],"target":90,"status":"warning","delta":"−20","invertGood":True},
            {"label":"ACR","unit":"mg/g","values":[18,22,27,34,48,61],"dates":["Jul '25","Sep '25","Nov '25","Jan '26","Mar '26","Jun '26"],"target":30,"status":"critical","delta":"+43"},
            {"label":"LDL","unit":"mg/dL","values":[128,122,118,114,108,102],"dates":["Jul '25","Sep '25","Nov '25","Jan '26","Mar '26","Jun '26"],"target":70,"status":"ok","delta":"−26"},
        ],
        "archivist": {
            "findings": [
                {"label":"HbA1c trajectory","values":"7.2 → 7.9 → 8.6","trend":"Sustained rise across 18 months","confidence":98,"evidence":"Lab CSV · 6 verified samples · PHC Registry"},
                {"label":"eGFR decline","values":"78 → 69 → 58","trend":"Loss of 20 mL/min — Stage 3a threshold crossed","confidence":96,"evidence":"Renal Panel · Consecutive quarterly readings"},
                {"label":"Albuminuria progression","values":"18 → 34 → 61","trend":"Moderately increased — A2 category","confidence":94,"evidence":"ACR test log · Reference: KDIGO 2024"},
            ],
            "thresholdCrossings": [
                {"label":"HbA1c > 8.0%","crossed":"Jan 2026","severity":"critical"},
                {"label":"eGFR < 60 mL/min","crossed":"Jun 2026","severity":"critical"},
                {"label":"BP > 140/90","crossed":"Nov 2025","severity":"warning"},
                {"label":"ACR > 30 mg/g","crossed":"Mar 2026","severity":"warning"},
            ],
            "missingFlags": [
                {"field":"Retinal exam","lastSeen":"Never on file"},
                {"field":"Foot exam","lastSeen":"2023 — overdue 18 months"},
            ],
            "evidenceSources": [
                {"name":"PHC Registry","records":47},
                {"name":"Lab Interface HL7","records":128},
                {"name":"GP Continuity Notes","records":9},
                {"name":"Pharmacy Refill Log","records":22},
            ],
        },
        "specialists": [
            {"id":"endo","name":"Endocrinology Agent","initials":"EN","riskLevel":"High","riskColor":"rose","findings":["Uncontrolled T2DM with HbA1c 8.6% — glucotoxicity risk","Metformin adherence below therapeutic threshold (68%)","SGLT2i already in regimen — renal-protective, retain"],"recommendation":"Do not up-titrate Metformin given renal decline. Consider GLP-1 RA with adherence support; evaluate CGM candidacy.","confidence":93},
            {"id":"cardio","name":"Cardiology Agent","initials":"CA","riskLevel":"High","riskColor":"rose","findings":["Stage 2 hypertension trending upward across 12 months","Losartan monotherapy insufficient — dual RAAS blockade contraindicated","No LVH on prior ECG; repeat ECG recommended"],"recommendation":"Add amlodipine 5mg with 4-week BP re-check. Continue statin. Cardiovascular risk requires quarterly review.","confidence":91},
            {"id":"neph","name":"Nephrology Agent","initials":"NE","riskLevel":"Elevated","riskColor":"teal","findings":["eGFR 58 with 20 mL/min decline — Stage 3a CKD confirmed","ACR 61 mg/g — moderately increased albuminuria (A2)","Renal-safe medication reconciliation required"],"recommendation":"Hold any Metformin increase. Maintain Empagliflozin (renal-protective). Refer for renal ultrasound. Repeat eGFR and ACR in 6 weeks.","confidence":95},
        ],
        "grounding": {
            "verified": [
                {"label":"HbA1c 8.6% (Jun 2026)","source":"Lab HL7 · Sample #L-2288","by":"Archivist trace"},
                {"label":"eGFR 58 mL/min (Jun 2026)","source":"Renal Panel · CKD-EPI 2021","by":"Deterministic recompute"},
                {"label":"ACR 61 mg/g (Jun 2026)","source":"Urinalysis · Lab #L-2291","by":"Archivist trace"},
                {"label":"Metformin adherence 68%","source":"Pharmacy refill · 12mo window","by":"Deterministic calc"},
            ],
            "rejected": [
                {"label":"'Recent hypoglycemic episode'","reason":"No supporting glucose reading or clinical note in record"},
                {"label":"'Family history of ESRD'","reason":"Not present in intake or continuity notes"},
            ],
        },
        "consensus": {
            "jointPlan": "Prioritize renal preservation while intensifying glycemic control through adherence support rather than dose escalation. Coordinated cardiovascular management with quarterly reassessment.",
            "priorityActions": [
                {"order":1,"text":"Do NOT increase Metformin (Nephrology overrides Endocrinology titration)","tag":"Renal-safety"},
                {"order":2,"text":"Initiate adherence intervention: transport voucher + evening reminder protocol","tag":"Adherence"},
                {"order":3,"text":"Add Amlodipine 5mg — re-check BP at 4 weeks","tag":"Cardiovascular"},
                {"order":4,"text":"Repeat eGFR + ACR at 6 weeks; renal ultrasound referral","tag":"Monitoring"},
                {"order":5,"text":"Schedule retinal and foot exams — overdue","tag":"Preventive"},
            ],
            "conflicts": [
                {"between":"Endocrinology ↔ Nephrology","about":"Metformin titration","resolution":"Resolved in favor of renal safety — hold titration; pursue adherence-first strategy."},
            ],
        },
        "auditLog": [
            {"time":"14:02:11","actor":"System","event":"Board Run Initiated","status":"complete"},
            {"time":"14:02:14","actor":"Archivist Agent","event":"Record ingested · 206 data points","status":"complete"},
            {"time":"14:02:19","actor":"Archivist Agent","event":"Trend computation · 5 metrics","status":"complete"},
            {"time":"14:02:23","actor":"Grounding Layer","event":"Provenance verified · 98% coverage","status":"complete"},
            {"time":"14:02:28","actor":"Endocrinology","event":"Analysis delivered · confidence 93%","status":"complete"},
            {"time":"14:02:31","actor":"Cardiology","event":"Analysis delivered · confidence 91%","status":"complete"},
            {"time":"14:02:34","actor":"Nephrology","event":"Analysis delivered · confidence 95%","status":"complete"},
            {"time":"14:02:41","actor":"Consensus Engine","event":"Conflict detected · resolved via renal-safety priority","status":"complete"},
            {"time":"14:02:44","actor":"Consensus Engine","event":"Joint plan generated · 5 priority actions","status":"complete"},
            {"time":"—","actor":"Physician","event":"Awaiting human review","status":"pending"},
        ],
        "transparencyGauges": [
            {"label":"Confidence Score","value":94},
            {"label":"Evidence Verification","value":98},
            {"label":"Data Completeness","value":100},
            {"label":"Board Response","value":87,"suffix":"s","raw":"32s"},
            {"label":"Agent Agreement","value":82},
        ],
        "evidenceChain": [
            {"key":"raw","label":"Raw Patient Data","detail":"206 data points ingested"},
            {"key":"arch","label":"Archivist Agent","detail":"Trends, thresholds, gaps"},
            {"key":"prov","label":"Provenance Layer","detail":"Every value traced to source"},
            {"key":"spec","label":"Specialist Agents","detail":"3 domain reviewers"},
            {"key":"grd","label":"Grounding Validation","detail":"Verify + reject findings"},
            {"key":"cons","label":"Board Consensus","detail":"Joint plan · conflicts resolved"},
            {"key":"human","label":"Physician Review","detail":"Human decides · always"},
        ],
    },
}


@app.get("/api/patients/{patient_id}/metrics")
def patient_metrics(patient_id: str):
    """Hero metrics for the landing page."""
    data = _CLINICAL_DATA.get(patient_id.upper())
    if data is None:
        raise HTTPException(404, detail=f"Clinical data for {patient_id} not found")
    return data["heroMetrics"]


@app.get("/api/patients/{patient_id}/trends")
def patient_trends(patient_id: str):
    """Clinical trend data for charts."""
    data = _CLINICAL_DATA.get(patient_id.upper())
    if data is None:
        raise HTTPException(404, detail=f"Clinical data for {patient_id} not found")
    return data["trends"]


@app.get("/api/patients/{patient_id}/archivist")
def patient_archivist(patient_id: str):
    """Archivist findings, threshold crossings, missing flags, evidence sources."""
    data = _CLINICAL_DATA.get(patient_id.upper())
    if data is None:
        raise HTTPException(404, detail=f"Clinical data for {patient_id} not found")
    return data["archivist"]


@app.get("/api/patients/{patient_id}/specialists")
def patient_specialists(patient_id: str):
    """Specialist board results."""
    data = _CLINICAL_DATA.get(patient_id.upper())
    if data is None:
        raise HTTPException(404, detail=f"Clinical data for {patient_id} not found")
    return data["specialists"]


@app.get("/api/patients/{patient_id}/grounding")
def patient_grounding(patient_id: str):
    """Grounding validation data."""
    data = _CLINICAL_DATA.get(patient_id.upper())
    if data is None:
        raise HTTPException(404, detail=f"Clinical data for {patient_id} not found")
    return data["grounding"]


@app.get("/api/patients/{patient_id}/consensus")
def patient_consensus(patient_id: str):
    """Board consensus data."""
    data = _CLINICAL_DATA.get(patient_id.upper())
    if data is None:
        raise HTTPException(404, detail=f"Clinical data for {patient_id} not found")
    return data["consensus"]


@app.get("/api/patients/{patient_id}/audit-log")
def patient_audit_log(patient_id: str):
    """Audit trail for the landing page."""
    data = _CLINICAL_DATA.get(patient_id.upper())
    if data is None:
        raise HTTPException(404, detail=f"Clinical data for {patient_id} not found")
    return data["auditLog"]


@app.get("/api/patients/{patient_id}/transparency")
def patient_transparency(patient_id: str):
    """Transparency gauge data."""
    data = _CLINICAL_DATA.get(patient_id.upper())
    if data is None:
        raise HTTPException(404, detail=f"Clinical data for {patient_id} not found")
    return data["transparencyGauges"]


@app.get("/api/patients/{patient_id}/evidence-chain")
def patient_evidence_chain(patient_id: str):
    """Evidence chain data."""
    data = _CLINICAL_DATA.get(patient_id.upper())
    if data is None:
        raise HTTPException(404, detail=f"Clinical data for {patient_id} not found")
    return data["evidenceChain"]


# ---------------------------------------------------------------------------
# Serve built frontend (SPA)
# ---------------------------------------------------------------------------

if _STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the frontend SPA — every non-API route returns index.html."""
        file_path = _STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(_STATIC_DIR / "index.html"))
