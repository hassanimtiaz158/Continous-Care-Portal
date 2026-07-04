from __future__ import annotations

from pydantic import BaseModel


class TimePoint(BaseModel):
    t: str
    v: float


class BPPoint(BaseModel):
    t: str
    sys: int
    dia: int


class Patient(BaseModel):
    id: str
    name: str
    age: int
    sex: str
    dx: str
    meds: list[str]
    bp: list[BPPoint]
    hba1c: list[TimePoint]
    egfr: list[TimePoint]
    acr: list[TimePoint]
    ldl: list[TimePoint]
    missing_fields: list[str] = []


class MetricSummary(BaseModel):
    latest: float
    delta: float
    trend: str
    unit: str
    history: list[dict]
    # BP-only fields (omitted for scalar metrics)
    latest_sys: int | None = None
    latest_dia: int | None = None
    dia_delta: int | None = None


class StructuredClinicalSummary(BaseModel):
    generated_at: str
    metrics: dict[str, MetricSummary]
    threshold_crossings: list[str]
    completeness: int
    missing_fields: list[str]
    risk_points: int
    risk_tier: str
    rule_log: list[str]
