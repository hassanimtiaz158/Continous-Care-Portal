import os

import pytest
from fastapi.testclient import TestClient

from app import audit
from app.audit import create_session, init_audit_db, record_decision
from app.main import app


@pytest.fixture(autouse=True)
def _isolated_db():
    """Each test gets a fresh in-memory SQLite database."""
    init_audit_db(":memory:")
    yield
    audit.close_audit_db()


client = TestClient(app)

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert isinstance(data["qwen_key_set"], bool)


# ---------------------------------------------------------------------------
# POST /api/board/run
# ---------------------------------------------------------------------------


def test_board_run_without_key_returns_503():
    key = os.environ.pop("DASHSCOPE_API_KEY", None)
    try:
        r = client.post("/api/board/run", json={"patient_id": "CCP-014"})
        assert r.status_code == 503
    finally:
        if key is not None:
            os.environ["DASHSCOPE_API_KEY"] = key


def test_board_run_unknown_patient_returns_404():
    r = client.post("/api/board/run", json={"patient_id": "NONEXISTENT"})
    assert r.status_code in (404, 503)


# ---------------------------------------------------------------------------
# POST /api/board/decision
# ---------------------------------------------------------------------------


def test_decision_valid_approve():
    sid = create_session(
        patient_id="CCP-014",
        specialist_results={
            "endocrine": {"risk_level": "watch", "findings": [], "recommendation": "R1"},
            "cardiology": {"risk_level": "watch", "findings": [], "recommendation": "R2"},
            "nephrology": {"risk_level": "urgent", "findings": [], "recommendation": "R3"},
        },
        consensus={"joint_plan": "Plan", "priority_actions": [], "conflicts": []},
        data_completeness=75,
        confidence_scores={"endocrine": 82, "cardiology": 82, "nephrology": 86},
    )
    r = client.post("/api/board/decision", json={
        "session_id": sid,
        "decision": "approved",
        "physician_name": "Dr. Test",
    })
    assert r.status_code == 200
    assert r.json()["audit_entry_id"] == sid


def test_decision_valid_edit():
    sid = create_session(
        patient_id="CCP-014",
        specialist_results={
            "endocrine": {"risk_level": "watch", "findings": [], "recommendation": "R1"},
            "cardiology": {"risk_level": "watch", "findings": [], "recommendation": "R2"},
            "nephrology": {"risk_level": "urgent", "findings": [], "recommendation": "R3"},
        },
        consensus={"joint_plan": "Plan", "priority_actions": [], "conflicts": []},
        data_completeness=75,
        confidence_scores={"endocrine": 82, "cardiology": 82, "nephrology": 86},
    )
    r = client.post("/api/board/decision", json={
        "session_id": sid,
        "decision": "edited",
        "edited_text": "Modified plan.",
        "physician_note": "Adjusted for renal function.",
    })
    assert r.status_code == 200


def test_decision_invalid_value_returns_400():
    r = client.post("/api/board/decision", json={
        "session_id": "CCP-SESSION-fake",
        "decision": "invalid",
    })
    assert r.status_code == 400


def test_decision_nonexistent_session_returns_404():
    r = client.post("/api/board/decision", json={
        "session_id": "CCP-SESSION-does-not-exist",
        "decision": "approved",
    })
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/board/audit/{session_id}
# ---------------------------------------------------------------------------


def test_audit_trail_returns_data():
    sid = create_session(
        patient_id="CCP-014",
        specialist_results={
            "endocrine": {"risk_level": "watch", "findings": [], "recommendation": "R1"},
            "cardiology": {"risk_level": "watch", "findings": [], "recommendation": "R2"},
            "nephrology": {"risk_level": "urgent", "findings": [], "recommendation": "R3"},
        },
        consensus={"joint_plan": "Plan", "priority_actions": [], "conflicts": []},
        data_completeness=75,
        confidence_scores={"endocrine": 82, "cardiology": 82, "nephrology": 86},
    )
    r = client.get(f"/api/board/audit/{sid}")
    assert r.status_code == 200
    data = r.json()
    assert data["session_id"] == sid
    assert data["patient_id"] == "CCP-014"
    assert "agent_status" in data
    assert "recommendations" in data


def test_audit_trail_nonexistent_returns_404():
    r = client.get("/api/board/audit/CCP-SESSION-does-not-exist")
    assert r.status_code == 404


def test_full_decision_flow():
    """Create session → record decision → verify audit trail shows it."""
    sid = create_session(
        patient_id="CCP-014",
        specialist_results={
            "endocrine": {"risk_level": "watch", "findings": [], "recommendation": "R1"},
            "cardiology": {"risk_level": "watch", "findings": [], "recommendation": "R2"},
            "nephrology": {"risk_level": "urgent", "findings": [], "recommendation": "R3"},
        },
        consensus={"joint_plan": "Plan", "priority_actions": [], "conflicts": []},
        data_completeness=75,
        confidence_scores={"endocrine": 82, "cardiology": 82, "nephrology": 86},
    )
    # Record decision
    r = client.post("/api/board/decision", json={
        "session_id": sid,
        "decision": "edited",
        "edited_text": "Revised plan.",
        "physician_note": "Changed dosage.",
        "physician_name": "Dr. Reviewer",
    })
    assert r.status_code == 200

    # Verify audit trail
    r = client.get(f"/api/board/audit/{sid}")
    assert r.status_code == 200
    data = r.json()
    assert data["decision"] == "edited"
    assert data["edited_text"] == "Revised plan."
    assert data["physician_note"] == "Changed dosage."
    assert data["physician_name"] == "Dr. Reviewer"
    assert data["decided_at"] is not None


# ---------------------------------------------------------------------------
# GET /api/board/export/{session_id}
# ---------------------------------------------------------------------------


def _make_session_with_findings() -> str:
    return create_session(
        patient_id="CCP-014",
        specialist_results={
            "endocrine": {
                "risk_level": "watch",
                "findings": [{"text": "HbA1c 8.6%", "metric": "hba1c"}],
                "recommendation": "Intensify glycemic control.",
            },
            "cardiology": {
                "risk_level": "watch",
                "findings": [{"text": "BP 158/96", "metric": "bp"}],
                "recommendation": "Optimize antihypertensive therapy.",
            },
            "nephrology": {
                "risk_level": "urgent",
                "findings": [{"text": "eGFR 58", "metric": "egfr"}],
                "recommendation": "Urgent nephrology referral.",
            },
        },
        consensus={
            "joint_plan": "Synthesized plan: intensify glycemic and BP control.",
            "priority_actions": ["Action 1", "Action 2"],
            "conflicts": ["Cardiology vs nephrology drug choice."],
        },
        data_completeness=75,
        confidence_scores={"endocrine": 82, "cardiology": 82, "nephrology": 86},
    )


def test_export_returns_pdf():
    sid = _make_session_with_findings()
    r = client.get(f"/api/board/export/{sid}")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert b"%PDF" in r.content


def test_export_has_content_disposition():
    sid = _make_session_with_findings()
    r = client.get(f"/api/board/export/{sid}")
    assert "review-packet.pdf" in r.headers.get("content-disposition", "")


def test_export_nonexistent_returns_404():
    r = client.get("/api/board/export/CCP-SESSION-does-not-exist")
    assert r.status_code == 404


def test_export_with_decision_includes_stamp():
    sid = _make_session_with_findings()
    record_decision(sid, decision="approved", physician_name="Dr. Smith")
    r = client.get(f"/api/board/export/{sid}")
    assert r.status_code == 200
    assert b"%PDF" in r.content


def test_export_with_all_sections():
    """PDF should be generated with all sections of the review."""
    sid = _make_session_with_findings()
    record_decision(
        sid,
        decision="edited",
        edited_text="Revised plan.",
        physician_note="Adjusted for renal function.",
        physician_name="Dr. Reviewer",
    )
    r = client.get(f"/api/board/export/{sid}")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:5] == b"%PDF-"
    assert b"CCP-014" in r.content
