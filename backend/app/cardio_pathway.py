"""Cardiology Intake Classifier — Cardiology module TDD §1.

Deterministic, rule-based classification of an incoming cardiology case
into one or more of four intake pathways. This module makes NO LLM call —
classification must be reproducible and auditable, same principle as
``icd10.candidates_for_complaint`` narrowing a field before any agent runs.

Pathways:
    A — ER Admission/Transfer      (came in via Emergency, already has a
                                     working diagnosis)
    B — Referral-in (external)     (an outside physician referred the case
                                     and requested a specific test)
    C — Concurrent Shared Care     (another department is actively managing
                                     the same case at the same time)
    D — Outbound Consult           (Cardiology needs a result/opinion from
                                     another department)

A single case can carry more than one pathway at once (e.g. aortic
dissection is A + C + D simultaneously) — this is intentional and drives
which downstream agents/routes get triggered.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel

_GUIDELINES_PATH = Path(__file__).parent / "cardiology_guidelines.json"

with open(_GUIDELINES_PATH, encoding="utf-8") as _f:
    _CARDIOLOGY_GUIDELINES: dict[str, Any] = json.load(_f)

DIAGNOSES: list[dict[str, Any]] = _CARDIOLOGY_GUIDELINES["diagnoses"]
DIAGNOSIS_MAP: dict[str, dict[str, Any]] = {d["id"]: d for d in DIAGNOSES}

VALID_PATHWAYS = {"A", "B", "C", "D"}


class IntakeRequest(BaseModel):
    """What the Intake Classifier needs to know about a new case."""

    case_id: str
    diagnosis_id: str  # must match an id in cardiology_guidelines.json
    source: str  # "emergency" | "external_referral" | "internal_clinic" | "other_department"
    referring_department: str | None = None  # e.g. "family_medicine", "neurology"
    is_concurrent_with: list[str] = []  # department keys actively co-managing NOW


class IntakeClassification(BaseModel):
    case_id: str
    diagnosis_id: str
    pathways: list[str]
    urgency: str  # "stat" | "urgent" | "routine"
    consulting_departments: list[str]
    reason: str


def classify_pathway(req: IntakeRequest) -> IntakeClassification:
    """Classify a new cardiology case into pathway(s) A/B/C/D.

    Rules (deterministic, in priority order — a case can match several):
      - source == "emergency"                       -> A
      - source == "external_referral"                -> B
      - is_concurrent_with is non-empty              -> C
      - diagnosis's guideline entry lists consulting
        departments AND this case needs a result
        FROM them (not already provided)             -> D

    The diagnosis's own ``default_pathway`` in cardiology_guidelines.json is
    used as a floor — the case is never classified with FEWER pathways than
    the guideline says are typical for that diagnosis, only equal or more,
    since real intake circumstances can add pathways the general guideline
    doesn't anticipate (e.g. a HOCM referral that also turns out to be
    urgent enough to need concurrent co-management).
    """
    entry = DIAGNOSIS_MAP.get(req.diagnosis_id)
    if entry is None:
        raise ValueError(f"Unknown diagnosis_id: {req.diagnosis_id!r}")

    pathways: set[str] = set(entry["default_pathway"])
    reasons: list[str] = [f"Diagnosis default pathway: {', '.join(entry['default_pathway'])}"]

    if req.source == "emergency":
        pathways.add("A")
        reasons.append("Source is Emergency — admitted/transferred case (A).")
    if req.source == "external_referral":
        pathways.add("B")
        reasons.append(f"External referral from {req.referring_department or 'unspecified'} (B).")
    if req.is_concurrent_with:
        pathways.add("C")
        reasons.append(
            "Concurrent co-management with: " + ", ".join(req.is_concurrent_with) + " (C)."
        )
    if entry.get("consulting_departments"):
        pathways.add("D")
        reasons.append(
            "Outbound consult expected with: "
            + ", ".join(entry["consulting_departments"])
            + " (D)."
        )

    return IntakeClassification(
        case_id=req.case_id,
        diagnosis_id=req.diagnosis_id,
        pathways=sorted(pathways),
        urgency=entry["urgency"],
        consulting_departments=entry.get("consulting_departments", []),
        reason=" ".join(reasons),
    )


def diagnosis_exists(diagnosis_id: str) -> bool:
    return diagnosis_id in DIAGNOSIS_MAP
