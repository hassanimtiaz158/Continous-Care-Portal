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

from app.audit import (
    delete_cardio_case,
    load_cardio_classification,
    load_cardio_imaging_orders,
    load_cardio_lab_orders,
    load_cardio_ownership,
    save_cardio_classification,
    save_cardio_imaging_orders,
    save_cardio_lab_orders,
    save_cardio_ownership,
)
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

# State is persisted to audit.db (via app.audit) rather than held in memory,
# so live demo cases survive a backend restart. Each case_id keys a small
# JSON blob per store.


# ---------------------------------------------------------------------------
# Intake classification
# ---------------------------------------------------------------------------


@cardio_router.post("/intake", response_model=IntakeClassification)
def classify_intake(req: IntakeRequest):
    result = classify_pathway(req)

    ownership = start_ownership(
        req.case_id,
        "emergency" if req.source == "emergency" else "cardiology",
    )
    labs = build_lab_orders(req.case_id, req.diagnosis_id)
    imaging = build_imaging_orders(req.case_id, req.diagnosis_id)
    for dept in result.consulting_departments:
        ownership = add_consulting_department(ownership, dept)

    save_cardio_classification(req.case_id, result.model_dump_json())
    save_cardio_ownership(req.case_id, ownership.model_dump_json())
    save_cardio_lab_orders(req.case_id, LabOrderList(items=labs).model_dump_json())
    save_cardio_imaging_orders(req.case_id, ImagingOrderList(items=imaging).model_dump_json())
    return result


@cardio_router.get("/cases/{case_id}/intake", response_model=IntakeClassification)
def get_intake(case_id: str):
    payload = load_cardio_classification(case_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"No intake classification for {case_id}")
    return IntakeClassification.model_validate_json(payload)


# ---------------------------------------------------------------------------
# Lab orders
# ---------------------------------------------------------------------------


class LabOrderList(BaseModel):
    items: list[LabOrder]


class ImagingOrderList(BaseModel):
    items: list[ImagingOrder]


def _load_labs(case_id: str) -> list[LabOrder]:
    payload = load_cardio_lab_orders(case_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"No lab orders for {case_id}")
    return LabOrderList.model_validate_json(payload).items


def _save_labs(case_id: str, orders: list[LabOrder]) -> None:
    save_cardio_lab_orders(case_id, LabOrderList(items=orders).model_dump_json())


def _load_imaging(case_id: str) -> list[ImagingOrder]:
    payload = load_cardio_imaging_orders(case_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"No imaging orders for {case_id}")
    return ImagingOrderList.model_validate_json(payload).items


def _save_imaging(case_id: str, orders: list[ImagingOrder]) -> None:
    save_cardio_imaging_orders(case_id, ImagingOrderList(items=orders).model_dump_json())


@cardio_router.get("/cases/{case_id}/labs", response_model=list[LabOrder])
def get_lab_orders(case_id: str):
    return _load_labs(case_id)


class LabResultRequest(BaseModel):
    order_id: str
    value: float
    source: ResultSource = "manual_entry"


@cardio_router.post("/cases/{case_id}/labs/result", response_model=LabOrder)
def post_lab_result(case_id: str, req: LabResultRequest):
    orders = _load_labs(case_id)
    idx = next((i for i, o in enumerate(orders) if o.id == req.order_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Order {req.order_id} not found")
    updated = record_lab_result(orders[idx], req.value, req.source)
    orders[idx] = updated
    _save_labs(case_id, orders)
    return updated


@cardio_router.post("/cases/{case_id}/labs/{order_id}/confirm", response_model=LabOrder)
def confirm_lab_draft(case_id: str, order_id: str):
    orders = _load_labs(case_id)
    idx = next((i for i, o in enumerate(orders) if o.id == order_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    if not orders[idx].is_draft:
        raise HTTPException(status_code=400, detail="Order is not a draft")
    updated = confirm_draft_result(orders[idx])
    orders[idx] = updated
    _save_labs(case_id, orders)
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
    orders = _load_labs(case_id)
    idx = next((i for i, o in enumerate(orders) if o.id == order_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    try:
        updated = acknowledge_critical_value(orders[idx], req.physician_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    orders[idx] = updated
    _save_labs(case_id, orders)
    return updated


# ---------------------------------------------------------------------------
# Imaging orders
# ---------------------------------------------------------------------------


@cardio_router.get("/cases/{case_id}/imaging", response_model=list[ImagingOrder])
def get_imaging_orders(case_id: str):
    return _load_imaging(case_id)


class ImagingStatusRequest(BaseModel):
    order_id: str
    status: str
    result_summary: str | None = None


@cardio_router.post("/cases/{case_id}/imaging/status", response_model=ImagingOrder)
def update_imaging_status(case_id: str, req: ImagingStatusRequest):
    orders = _load_imaging(case_id)
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
    _save_imaging(case_id, orders)
    return updated


# ---------------------------------------------------------------------------
# Ownership / cross-department coordination
# ---------------------------------------------------------------------------


@cardio_router.get("/cases/{case_id}/ownership", response_model=OwnershipState)
def get_ownership(case_id: str):
    payload = load_cardio_ownership(case_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"No ownership record for {case_id}")
    return OwnershipState.model_validate_json(payload)


class TransferOwnershipRequest(BaseModel):
    to_department: Department
    reason: str
    confirmed_by: str


@cardio_router.post("/cases/{case_id}/ownership/transfer", response_model=OwnershipState)
def transfer_case_ownership(case_id: str, req: TransferOwnershipRequest):
    payload = load_cardio_ownership(case_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"No ownership record for {case_id}")
    state = OwnershipState.model_validate_json(payload)
    try:
        updated = transfer_ownership(state, req.to_department, req.reason, req.confirmed_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    save_cardio_ownership(case_id, updated.model_dump_json())
    return updated


@cardio_router.delete("/cases/{case_id}")
def delete_case(case_id: str):
    """Remove all persisted cardio state for a case."""
    delete_cardio_case(case_id)
    return {"deleted": case_id}
