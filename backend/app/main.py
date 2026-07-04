import os
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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


@app.get("/api/review-queue")
def review_queue():
    """Return all pending manual review entries (TDD §2.6)."""
    return get_review_queue()
