from __future__ import annotations

import pytest

from app.deidentify import ClinicalPayload, deidentify
from app.models import Patient

CCP014 = Patient(
    id="CCP-014",
    name="Synthetic Patient — Case CCP-014",
    age=58,
    sex="Female",
    dx="Type 2 Diabetes (6y) · Essential Hypertension (9y)",
    meds=["Metformin 1000mg BID", "Amlodipine 5mg OD", "Atorvastatin 20mg OD"],
    bp=[
        {"t": "12mo", "sys": 138, "dia": 86},
        {"t": "6mo", "sys": 146, "dia": 90},
        {"t": "Now", "sys": 158, "dia": 96},
    ],
    hba1c=[{"t": "12mo", "v": 7.2}, {"t": "6mo", "v": 7.9}, {"t": "Now", "v": 8.6}],
    egfr=[{"t": "12mo", "v": 78}, {"t": "6mo", "v": 69}, {"t": "Now", "v": 58}],
    acr=[{"t": "12mo", "v": 18}, {"t": "6mo", "v": 34}, {"t": "Now", "v": 61}],
    ldl=[{"t": "12mo", "v": 118}, {"t": "6mo", "v": 126}, {"t": "Now", "v": 134}],
    missing_fields=[
        "Recent lipid panel (last drawn 6mo ago)",
        "Urine microalbumin confirmatory test",
    ],
)


class TestStripsIdentifiers:
    def test_no_name_in_payload(self):
        payload = deidentify(CCP014)
        dump = payload.model_dump()
        assert "name" not in dump
        assert "id" not in dump

    def test_name_not_in_serialised_json(self):
        payload = deidentify(CCP014)
        raw = payload.model_dump_json()
        assert "Synthetic Patient" not in raw
        assert "CCP-014" not in raw

    def test_missing_fields_stripped(self):
        """missing_fields is non-clinical metadata — not sent to LLM."""
        payload = deidentify(CCP014)
        dump = payload.model_dump()
        assert "missing_fields" not in dump

    def test_no_identifier_keys_in_dump(self):
        """Exhaustive check: no key in the serialised dict is an identifier."""
        payload = deidentify(CCP014)
        dump = payload.model_dump()
        forbidden_keys = {"name", "id", "patient_id", "patient_name"}
        assert not (set(dump.keys()) & forbidden_keys)


class TestPreservesClinicalData:
    def test_clinical_values_intact(self):
        payload = deidentify(CCP014)
        assert payload.age == 58
        assert payload.sex == "Female"
        assert "Type 2 Diabetes" in payload.dx
        assert len(payload.meds) == 3

    def test_vital_series_intact(self):
        payload = deidentify(CCP014)
        assert len(payload.hba1c) == 3
        assert payload.hba1c[-1].v == 8.6
        assert len(payload.egfr) == 3
        assert payload.egfr[-1].v == 58
        assert len(payload.bp) == 3
        assert payload.bp[-1].sys == 158

    def test_all_metric_series_present(self):
        payload = deidentify(CCP014)
        assert hasattr(payload, "bp")
        assert hasattr(payload, "hba1c")
        assert hasattr(payload, "egfr")
        assert hasattr(payload, "acr")
        assert hasattr(payload, "ldl")


class TestModelValidator:
    def test_cannot_construct_payload_with_name(self):
        """ClinicalPayload rejects any construction that includes a 'name' field."""
        with pytest.raises(Exception):
            ClinicalPayload(
                name="should fail",
                age=58,
                sex="Female",
                dx="T2DM",
                meds=[],
                bp=[],
                hba1c=[],
                egfr=[],
                acr=[],
                ldl=[],
            )


class TestNoIdentifierInAnySerialisation:
    @pytest.mark.parametrize("serialise", ["model_dump", "model_dump_json"])
    def test_payload_never_leaks_identifiers(self, serialise: str):
        """Neither dict nor JSON serialisation contains identifier content."""
        payload = deidentify(CCP014)
        result = getattr(payload, serialise)()
        text = str(result)
        assert "CCP-014" not in text
        assert "Synthetic Patient" not in text
        assert '"name"' not in text
        assert '"id"' not in text
