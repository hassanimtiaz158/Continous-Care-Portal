import os
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from app.audit import get_audit_trail, init_audit_db, record_decision
from app.export import generate_export_pdf
from app.models import Patient, TimePoint, BPPoint
from app.orchestrator import run_board, get_review_queue

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="Continuous Care Portal — Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialise audit database on startup
init_audit_db()

# ---------------------------------------------------------------------------
# Patient fixture — CCP-014 synthetic record (TDD §3).
# In production this would come from a database.
# ---------------------------------------------------------------------------

_PATIENTS: dict[str, Patient] = {}

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
    anthropic_key_set: bool


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        anthropic_key_set=bool(os.getenv("ANTHROPIC_API_KEY")),
    )


@app.post("/api/board/run")
async def board_run(req: BoardRunRequest):
    patient = _PATIENTS.get(req.patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail=f"Patient {req.patient_id} not found")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")

    client = anthropic.AsyncAnthropic(api_key=api_key)
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
