"""Lab Orders Agent & Imaging Orders Agent — Cardiology module TDD §2.

Both agents share the same shape on purpose (mirrors each other), so a
future department can reuse this module by pointing it at its own
guidelines file with the same schema.

Design rules carried over from CCP/EpiLink:
  - Order *suggestion* is 100% deterministic (table lookup against
    cardiology_guidelines.json) — no LLM involved in deciding WHAT to
    order. An LLM deciding lab panels from scratch is exactly the kind
    of hallucination risk the anti-hallucination architecture exists to
    prevent.
  - Every order carries provenance: which diagnosis/guideline entry it
    was generated from.
  - A result entered via OCR (mobile) MUST be created with
    ``source="ocr"`` and stays ``status="draft"`` until a clinician
    confirms it — confirmed results can never silently downgrade back
    to draft.
  - Critical-value flags are computed with a plain numeric rule string
    evaluated in a restricted namespace (no arbitrary eval of user
    input) — see ``_evaluate_critical_rule``.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel

from app.cardio_pathway import DIAGNOSIS_MAP

OrderStatus = Literal["ordered", "collected", "resulting", "resulted"]
ResultSource = Literal["manual_entry", "ocr", "lab_interface"]

_STATUS_SEQUENCE: list[OrderStatus] = ["ordered", "collected", "resulting", "resulted"]

_VALID_RULE_TOKEN = re.compile(r"^[a-z_][a-z_0-9]*\s*(<|>|<=|>=|==)\s*-?\d+(\.\d+)?$")


class LabOrder(BaseModel):
    id: str
    case_id: str
    test: str
    label: str
    status: OrderStatus = "ordered"
    value: float | None = None
    critical: bool = False
    critical_note: str | None = None
    acknowledged_by: str | None = None
    source: ResultSource = "manual_entry"
    is_draft: bool = False
    guideline_diagnosis_id: str
    created_at: str
    updated_at: str


class ImagingOrder(BaseModel):
    id: str
    case_id: str
    study: str
    label: str
    status: OrderStatus = "ordered"
    urgency: str = "routine"
    result_summary: str | None = None
    source: ResultSource = "manual_entry"
    is_draft: bool = False
    guideline_diagnosis_id: str
    created_at: str
    updated_at: str


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_lab_orders(case_id: str, diagnosis_id: str) -> list[LabOrder]:
    """Generate the suggested lab panel for a case, from the guideline table.

    Deterministic — same diagnosis always produces the same panel. This is
    the "suggestion" step; a clinician can still remove/add orders in the
    UI, but the STARTING set is never invented by an LLM.
    """
    entry = DIAGNOSIS_MAP.get(diagnosis_id)
    if entry is None:
        raise ValueError(f"Unknown diagnosis_id: {diagnosis_id!r}")

    ts = _now()
    orders = []
    for lab in entry["labs"]:
        orders.append(
            LabOrder(
                id=f"LAB-{uuid.uuid4().hex[:8]}",
                case_id=case_id,
                test=lab["test"],
                label=lab["label"],
                guideline_diagnosis_id=diagnosis_id,
                created_at=ts,
                updated_at=ts,
            )
        )
    return orders


def build_imaging_orders(case_id: str, diagnosis_id: str) -> list[ImagingOrder]:
    entry = DIAGNOSIS_MAP.get(diagnosis_id)
    if entry is None:
        raise ValueError(f"Unknown diagnosis_id: {diagnosis_id!r}")

    ts = _now()
    orders = []
    for img in entry["imaging"]:
        orders.append(
            ImagingOrder(
                id=f"IMG-{uuid.uuid4().hex[:8]}",
                case_id=case_id,
                study=img["study"],
                label=img["label"],
                urgency=img.get("urgency", "routine"),
                guideline_diagnosis_id=diagnosis_id,
                created_at=ts,
                updated_at=ts,
            )
        )
    return orders


def advance_status(current: OrderStatus, to: OrderStatus) -> OrderStatus:
    """Validate and return a forward-only status transition.

    Orders cannot skip backwards (e.g. "resulted" -> "ordered") — that
    would erase provenance. Raises ValueError on an invalid transition.
    """
    if to not in _STATUS_SEQUENCE:
        raise ValueError(f"Unknown status: {to!r}")
    if _STATUS_SEQUENCE.index(to) < _STATUS_SEQUENCE.index(current):
        raise ValueError(f"Cannot move status backwards: {current!r} -> {to!r}")
    return to


def _evaluate_critical_rule(rule: str, value: float) -> bool:
    """Safely evaluate a critical-value rule like 'value > 0.04' or 'egfr < 30'.

    Only a single comparison of the form ``<name> <op> <number>`` is
    accepted — this is NOT a general-purpose eval. The left-hand token is
    ignored (the *value* passed in is what's compared) so guideline
    authors can use whatever variable name reads naturally in the JSON.
    """
    if not _VALID_RULE_TOKEN.match(rule.strip()):
        raise ValueError(f"Unsafe or malformed critical rule: {rule!r}")
    match = re.match(r"^[a-z_][a-z_0-9]*\s*(<=|>=|<|>|==)\s*(-?\d+(?:\.\d+)?)$", rule.strip())
    op, threshold_str = match.group(1), match.group(2)
    threshold = float(threshold_str)
    ops = {
        "<": lambda a, b: a < b,
        ">": lambda a, b: a > b,
        "<=": lambda a, b: a <= b,
        ">=": lambda a, b: a >= b,
        "==": lambda a, b: a == b,
    }
    return ops[op](value, threshold)


def record_lab_result(
    order: LabOrder,
    value: float,
    source: ResultSource = "manual_entry",
) -> LabOrder:
    """Attach a result value to a lab order, flag critical values, and
    advance its status to "resulted".

    Results entered via OCR are always marked ``is_draft=True`` — the
    anti-hallucination / DRAFT-only rule that applies everywhere else in
    Shura (camera OCR, ambient recording) applies here too.
    """
    entry = DIAGNOSIS_MAP[order.guideline_diagnosis_id]
    lab_def = next(l for l in entry["labs"] if l["test"] == order.test)

    critical = False
    if lab_def.get("critical_rule"):
        critical = _evaluate_critical_rule(lab_def["critical_rule"], value)

    return order.model_copy(
        update={
            "value": value,
            "critical": critical,
            "critical_note": lab_def.get("critical_note") if critical else None,
            "acknowledged_by": None,  # a fresh value always needs a fresh sign-off
            "status": advance_status(order.status, "resulted"),
            "source": source,
            "is_draft": source == "ocr",
            "updated_at": _now(),
        }
    )


def acknowledge_critical_value(order: LabOrder, physician_name: str) -> LabOrder:
    """A clinician explicitly signs off on having seen a critical value.

    This is deliberately separate from ``confirm_draft_result`` — a result
    can be both non-draft AND unacknowledged (e.g. a manually-entered
    troponin that's critical but nobody has signed for yet). The visual
    "critical" flag in the UI is not itself a safety control; this
    function is what actually closes the loop.
    """
    if not order.critical:
        raise ValueError("Only critical results require acknowledgement.")
    if not physician_name.strip():
        raise ValueError("acknowledged_by must not be empty.")
    return order.model_copy(update={"acknowledged_by": physician_name, "updated_at": _now()})


def confirm_draft_result(order: LabOrder) -> LabOrder:
    """A clinician confirms a draft (OCR-sourced) result — clears is_draft.

    This is the ONLY way is_draft can become False; nothing does it
    automatically.
    """
    return order.model_copy(update={"is_draft": False, "updated_at": _now()})
