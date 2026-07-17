"""Integration tests for /api/cardiology/* — Cardiology module TDD §4."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestDissectionFullFlow:
    """Walks the aortic dissection case through intake -> labs -> ownership,
    the same end-to-end path a real ER admission would take."""

    def test_full_flow(self):
        r = client.post(
            "/api/cardiology/intake",
            json={
                "case_id": "C-DISSECT-99",
                "diagnosis_id": "AORTIC_DISSECTION",
                "source": "emergency",
                "is_concurrent_with": ["cardiothoracic_surgery"],
            },
        )
        assert r.status_code == 200
        assert sorted(r.json()["pathways"]) == ["A", "C", "D"]

        labs = client.get("/api/cardiology/cases/C-DISSECT-99/labs").json()
        assert any(o["test"] == "troponin" for o in labs)

        troponin_order = next(o for o in labs if o["test"] == "troponin")
        r2 = client.post(
            "/api/cardiology/cases/C-DISSECT-99/labs/result",
            json={"order_id": troponin_order["id"], "value": 0.09},
        )
        assert r2.status_code == 200
        assert r2.json()["critical"] is True
        assert r2.json()["acknowledged_by"] is None

        r2b = client.post(
            f"/api/cardiology/cases/C-DISSECT-99/labs/{troponin_order['id']}/acknowledge",
            json={"physician_name": "Dr. Rousseau"},
        )
        assert r2b.status_code == 200
        assert r2b.json()["acknowledged_by"] == "Dr. Rousseau"

        ownership = client.get("/api/cardiology/cases/C-DISSECT-99/ownership").json()
        assert ownership["current_owner"] == "emergency"
        assert "cardiothoracic_surgery" in ownership["consulting_departments"]

        # a transfer with no confirming physician is rejected
        bad = client.post(
            "/api/cardiology/cases/C-DISSECT-99/ownership/transfer",
            json={
                "to_department": "cardiothoracic_surgery",
                "reason": "CT angiography confirmed dissection.",
                "confirmed_by": "  ",
            },
        )
        assert bad.status_code == 400

        r3 = client.post(
            "/api/cardiology/cases/C-DISSECT-99/ownership/transfer",
            json={
                "to_department": "cardiothoracic_surgery",
                "reason": "CT angiography confirmed dissection.",
                "confirmed_by": "Dr. Rousseau",
            },
        )
        assert r3.status_code == 200
        assert r3.json()["current_owner"] == "cardiothoracic_surgery"
        assert len(r3.json()["history"]) == 2
        assert r3.json()["history"][1]["confirmed_by"] == "Dr. Rousseau"


class TestUnknownCaseReturns404:
    def test_labs_for_unknown_case(self):
        r = client.get("/api/cardiology/cases/NOPE/labs")
        assert r.status_code == 404
