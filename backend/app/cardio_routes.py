"""Cardiology module API routes — Cardiology TDD §4.

Mount with: ``app.include_router(cardio_router)`` in main.py.

Kept as a separate router (same reasoning as the pharmacology/icd10 agents
being kept out of ``AGENTS``): this module can be dropped into any other
department later by swapping cardiology_guidelines.json, without touching
the existing chronic-disease board routes.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.cardio_coordination import (
    Department,
    OwnershipState,
    add_consulting_department,
    start_ownership,
    transfer_ownership,
)
from app.cardio_orders import (
    ImagingOrder,
    LabOrder,
    ResultSource,
    acknowledge_critical_value,
    advance_status,
    build_imaging_orders,
    build_lab_orders,
    confirm_draft_result,
    record_lab_result,
)
from app.cardio_pathway import IntakeClassification, IntakeRequest, classify_pathway

cardio_router = APIRouter(prefix="/api/cardiology", tags=["cardiology"])

# In-memory stores for the hackathon demo — same pattern as _REFERRALS in
# main.py. A real deployment would back these with the audit.db tables.
_CLASSIFICATIONS: dict[str, IntakeClassification] = {}
_LAB_ORDERS: dict[str, list[LabOrder]] = {}
_IMAGING_ORDERS: dict[str, list[ImagingOrder]] = {}
_OWNERSHIP: dict[str, OwnershipState] = {}


# ---------------------------------------------------------------------------
# Intake classification
# ---------------------------------------------------------------------------


@cardio_router.post("/intake", response_model=IntakeClassification)
def classify_intake(req: IntakeRequest):
    result = classify_pathway(req)
    _CLASSIFICATIONS[req.case_id.upper()] = result

    # Auto-open the ownership state machine and auto-generate the order
    # sets, so the frontend doesn't need three separate calls right after
    # intake.
    _OWNERSHIP[req.case_id.upper()] = start_ownership(
        req.case_id,
        "emergency" if req.source == "emergency" else "cardiology",
    )
    _LAB_ORDERS[req.case_id.upper()] = build_lab_orders(req.case_id, req.diagnosis_id)
    _IMAGING_ORDERS[req.case_id.upper()] = build_imaging_orders(req.case_id, req.diagnosis_id)
    for dept in result.consulting_departments:
        _OWNERSHIP[req.case_id.upper()] = add_consulting_department(
            _OWNERSHIP[req.case_id.upper()], dept  # type: ignore[arg-type]
        )
    return result


@cardio_router.get("/cases/{case_id}/intake", response_model=IntakeClassification)
def get_intake(case_id: str):
    result = _CLASSIFICATIONS.get(case_id.upper())
    if result is None:
        raise HTTPException(status_code=404, detail=f"No intake classification for {case_id}")
    return result


# ---------------------------------------------------------------------------
# Lab orders
# ---------------------------------------------------------------------------


@cardio_router.get("/cases/{case_id}/labs", response_model=list[LabOrder])
def get_lab_orders(case_id: str):
    orders = _LAB_ORDERS.get(case_id.upper())
    if orders is None:
        raise HTTPException(status_code=404, detail=f"No lab orders for {case_id}")
    return orders


class LabResultRequest(BaseModel):
    order_id: str
    value: float
    source: ResultSource = "manual_entry"


@cardio_router.post("/cases/{case_id}/labs/result", response_model=LabOrder)
def post_lab_result(case_id: str, req: LabResultRequest):
    orders = _LAB_ORDERS.get(case_id.upper())
    if orders is None:
        raise HTTPException(status_code=404, detail=f"No lab orders for {case_id}")
    idx = next((i for i, o in enumerate(orders) if o.id == req.order_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Order {req.order_id} not found")
    updated = record_lab_result(orders[idx], req.value, req.source)
    orders[idx] = updated
    return updated


@cardio_router.post("/cases/{case_id}/labs/{order_id}/confirm", response_model=LabOrder)
def confirm_lab_draft(case_id: str, order_id: str):
    orders = _LAB_ORDERS.get(case_id.upper())
    if orders is None:
        raise HTTPException(status_code=404, detail=f"No lab orders for {case_id}")
    idx = next((i for i, o in enumerate(orders) if o.id == order_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    if not orders[idx].is_draft:
        raise HTTPException(status_code=400, detail="Order is not a draft")
    updated = confirm_draft_result(orders[idx])
    orders[idx] = updated
    return updated


class AcknowledgeCriticalRequest(BaseModel):
    physician_name: str


@cardio_router.post("/cases/{case_id}/labs/{order_id}/acknowledge", response_model=LabOrder)
def acknowledge_lab_critical(case_id: str, order_id: str, req: AcknowledgeCriticalRequest):
    """A physician explicitly signs off on having seen a critical value.

    This is the human-in-the-loop control for the Lab Orders Agent — the
    'critical' flag alone is only a visual cue, this is what closes the
    loop with an attributed acknowledgement.
    """
    orders = _LAB_ORDERS.get(case_id.upper())
    if orders is None:
        raise HTTPException(status_code=404, detail=f"No lab orders for {case_id}")
    idx = next((i for i, o in enumerate(orders) if o.id == order_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    try:
        updated = acknowledge_critical_value(orders[idx], req.physician_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    orders[idx] = updated
    return updated


# ---------------------------------------------------------------------------
# Imaging orders
# ---------------------------------------------------------------------------


@cardio_router.get("/cases/{case_id}/imaging", response_model=list[ImagingOrder])
def get_imaging_orders(case_id: str):
    orders = _IMAGING_ORDERS.get(case_id.upper())
    if orders is None:
        raise HTTPException(status_code=404, detail=f"No imaging orders for {case_id}")
    return orders


class ImagingStatusRequest(BaseModel):
    order_id: str
    status: str
    result_summary: str | None = None


@cardio_router.post("/cases/{case_id}/imaging/status", response_model=ImagingOrder)
def update_imaging_status(case_id: str, req: ImagingStatusRequest):
    orders = _IMAGING_ORDERS.get(case_id.upper())
    if orders is None:
        raise HTTPException(status_code=404, detail=f"No imaging orders for {case_id}")
    idx = next((i for i, o in enumerate(orders) if o.id == req.order_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Order {req.order_id} not found")
    order = orders[idx]
    new_status = advance_status(order.status, req.status)  # type: ignore[arg-type]
    updated = order.model_copy(
        update={
            "status": new_status,
            "result_summary": req.result_summary or order.result_summary,
        }
    )
    orders[idx] = updated
    return updated


# ---------------------------------------------------------------------------
# Ownership / cross-department coordination
# ---------------------------------------------------------------------------


@cardio_router.get("/cases/{case_id}/ownership", response_model=OwnershipState)
def get_ownership(case_id: str):
    state = _OWNERSHIP.get(case_id.upper())
    if state is None:
        raise HTTPException(status_code=404, detail=f"No ownership record for {case_id}")
    return state


class TransferOwnershipRequest(BaseModel):
    to_department: Department
    reason: str
    confirmed_by: str


@cardio_router.post("/cases/{case_id}/ownership/transfer", response_model=OwnershipState)
def transfer_case_ownership(case_id: str, req: TransferOwnershipRequest):
    state = _OWNERSHIP.get(case_id.upper())
    if state is None:
        raise HTTPException(status_code=404, detail=f"No ownership record for {case_id}")
    try:
        updated = transfer_ownership(state, req.to_department, req.reason, req.confirmed_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    _OWNERSHIP[case_id.upper()] = updated
    return updated
