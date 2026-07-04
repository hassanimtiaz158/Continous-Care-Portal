from __future__ import annotations

from pydantic import BaseModel, ConfigDict, model_validator

from app.models import BPPoint, Patient, TimePoint


class ClinicalPayload(BaseModel):
    """De-identified patient data safe for LLM consumption.

    Contains ONLY clinical values, trends, meds, and dates.
    No identifiers (name, ID, contact details) are present.
    """

    model_config = ConfigDict(extra="forbid")

    age: int
    sex: str
    dx: str
    meds: list[str]
    bp: list[BPPoint]
    hba1c: list[TimePoint]
    egfr: list[TimePoint]
    acr: list[TimePoint]
    ldl: list[TimePoint]

    @model_validator(mode="after")
    def _no_identifiers(self) -> ClinicalPayload:
        """Enforce that no identifier fields leaked through."""
        forbidden = {"name", "id", "patient_id", "patient_name"}
        fields = set(ClinicalPayload.model_fields.keys())
        overlap = fields & forbidden
        if overlap:
            raise ValueError(
                f"ClinicalPayload must not contain identifier fields: {overlap}"
            )
        return self


def deidentify(patient: Patient) -> ClinicalPayload:
    """Strip all patient identifiers before any LLM call.

    This is a hard gate — the orchestrator MUST call this function
    and never pass a raw Patient object to a prompt builder.

    Stripped: id, name, missing_fields (non-clinical metadata).
    Passed through: age, sex, dx, meds, bp, hba1c, egfr, acr, ldl.
    """
    return ClinicalPayload(
        age=patient.age,
        sex=patient.sex,
        dx=patient.dx,
        meds=patient.meds,
        bp=patient.bp,
        hba1c=patient.hba1c,
        egfr=patient.egfr,
        acr=patient.acr,
        ldl=patient.ldl,
    )
