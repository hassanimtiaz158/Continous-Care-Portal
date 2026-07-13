"""Tests for POST /api/patients — real physician intake, not scripted data.

Verifies: minimal-required-field intake works, missing optional fields
are honestly flagged (never fabricated), the new patient is immediately
usable by the Archivist/agents, and the 50-patient capacity is enforced.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.archivist import compute_archivist_summary
from app.main import MAX_PATIENTS, _PATIENTS, _SHURA_PATIENTS, app

client = TestClient(app)

_MINIMAL_PAYLOAD = {
    "name": "T.I.",
    "age": 55,
    "sex": "Female",
    "chief_complaint": "Fatigue for 3 weeks.",
    "bp_sys": 130,
    "bp_dia": 84,
    "hba1c": 7.1,
    "egfr": 80,
}


def _reset_registry_to(n: int):
    """Test helper: truncate the module-level registries back to *n* seeded
    patients so capacity tests don't depend on execution order."""
    ids = list(_SHURA_PATIENTS.keys())
    for pid in ids[n:]:
        del _SHURA_PATIENTS[pid]
        _PATIENTS.pop(pid, None)


class TestPatientIntake:
    def test_create_with_full_data_succeeds(self):
        payload = {**_MINIMAL_PAYLOAD, "acr": 20, "ldl": 110, "creat": 0.9, "k": 4.2, "hr": 78, "meds": ["Metformin 500mg OD"]}
        r = client.post("/api/patients", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["chiefComplaint"] == payload["chief_complaint"]
        assert data["renal"]["acr"] == "20.0"

    def test_missing_optional_fields_are_flagged_not_fabricated(self):
        r = client.post("/api/patients", json=_MINIMAL_PAYLOAD)
        assert r.status_code == 200
        data = r.json()
        # Fields never entered must show as "—", not a plausible-looking number
        assert data["renal"]["acr"] == "—"
        assert data["renal"]["creat"] == "—"

        new_id = data["id"]
        p = _PATIENTS[new_id]
        assert any("ACR not entered" in m for m in p.missing_fields)
        assert any("Lipid panel" in m for m in p.missing_fields)
        assert any("No historical trend" in m for m in p.missing_fields)

    def test_new_patient_is_immediately_usable_by_archivist(self):
        r = client.post("/api/patients", json=_MINIMAL_PAYLOAD)
        new_id = r.json()["id"]
        summary = compute_archivist_summary(_PATIENTS[new_id])
        # Should compute without raising, and reflect incompleteness honestly
        assert 0 <= summary.completeness <= 100
        assert summary.completeness < 100  # several fields were never entered

    def test_new_patient_appears_in_list_endpoint(self):
        r = client.post("/api/patients", json=_MINIMAL_PAYLOAD)
        new_id = r.json()["id"]
        listing = client.get("/api/patients").json()
        assert any(p["id"] == new_id for p in listing)

    def test_capacity_is_enforced_at_50(self):
        _reset_registry_to(6)  # back to the 6 seeded demo patients
        try:
            to_add = MAX_PATIENTS - len(_SHURA_PATIENTS)
            for _ in range(to_add):
                r = client.post("/api/patients", json=_MINIMAL_PAYLOAD)
                assert r.status_code == 200
            assert len(_SHURA_PATIENTS) == MAX_PATIENTS

            r_over = client.post("/api/patients", json=_MINIMAL_PAYLOAD)
            assert r_over.status_code == 409
        finally:
            _reset_registry_to(6)  # leave the registry clean for other tests
