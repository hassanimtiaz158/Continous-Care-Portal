import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="Continuous Care Portal — Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    status: str = "ok"
    anthropic_key_set: bool


@app.get("/api/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        anthropic_key_set=bool(os.getenv("ANTHROPIC_API_KEY")),
    )


@app.post("/api/board/run")
def run_board(patient_id: str = "CCP-014"):
    return {
        "patient_id": patient_id,
        "archivist_summary": {},
        "specialist_results": {},
        "consensus": {},
        "data_completeness": 0,
        "confidence_scores": {},
        "_note": "placeholder — agent orchestration not yet wired",
    }
