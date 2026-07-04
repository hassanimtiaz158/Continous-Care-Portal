"""Tests for the Structured Audit Trail — TDD §2.10.

Uses in-memory SQLite so tests never touch the real audit.db.
"""

from __future__ import annotations

import sqlite3
from typing import Any
from unittest.mock import patch

import pytest

from app import audit
from app.audit import (
    create_session,
    get_audit_trail,
    init_audit_db,
    record_decision,
)


@pytest.fixture(autouse=True)
def _isolated_db():
    """Each test gets a fresh in-memory SQLite database."""
    init_audit_db(":memory:")
    yield
    audit.close_audit_db()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SAMPLE_SPECIALIST_RESULTS: dict[str, dict[str, Any]] = {
    "endocrine": {
        "risk_level": "watch",
        "findings": [{"text": "HbA1c 8.6%", "metric": "hba1c", "confidence": 82}],
        "recommendation": "Intensify glycemic control.",
    },
    "cardiology": {
        "risk_level": "watch",
        "findings": [{"text": "BP 158/96", "metric": "bp", "confidence": 82}],
        "recommendation": "Optimize antihypertensive therapy.",
    },
    "nephrology": {
        "risk_level": "urgent",
        "findings": [{"text": "eGFR 58", "metric": "egfr", "confidence": 86}],
        "recommendation": "Urgent nephrology referral.",
    },
}

_SAMPLE_CONSENSUS: dict[str, Any] = {
    "joint_plan": "Synthesized plan: intensify glycemic and BP control.",
    "priority_actions": ["Action 1", "Action 2"],
    "conflicts": ["Cardiology vs nephrology drug choice."],
}

_SAMPLE_CONFIDENCE: dict[str, int] = {
    "endocrine": 82,
    "cardiology": 82,
    "nephrology": 86,
}


# ---------------------------------------------------------------------------
# create_session
# ---------------------------------------------------------------------------


class TestCreateSession:
    def test_returns_session_id(self):
        sid = create_session(
            patient_id="CCP-014",
            specialist_results=_SAMPLE_SPECIALIST_RESULTS,
            consensus=_SAMPLE_CONSENSUS,
            data_completeness=75,
            confidence_scores=_SAMPLE_CONFIDENCE,
        )
        assert sid.startswith("CCP-SESSION-")

    def test_session_is_retrievable(self):
        sid = create_session(
            patient_id="CCP-014",
            specialist_results=_SAMPLE_SPECIALIST_RESULTS,
            consensus=_SAMPLE_CONSENSUS,
            data_completeness=75,
            confidence_scores=_SAMPLE_CONFIDENCE,
        )
        trail = get_audit_trail(sid)
        assert trail is not None
        assert trail["patient_id"] == "CCP-014"

    def test_agent_status_recorded(self):
        sid = create_session(
            patient_id="CCP-014",
            specialist_results=_SAMPLE_SPECIALIST_RESULTS,
            consensus=_SAMPLE_CONSENSUS,
            data_completeness=75,
            confidence_scores=_SAMPLE_CONFIDENCE,
        )
        trail = get_audit_trail(sid)
        assert trail["agent_status"]["endocrine"] == "responded"
        assert trail["agent_status"]["cardiology"] == "responded"
        assert trail["agent_status"]["nephrology"] == "responded"

    def test_failed_agent_recorded(self):
        """Agent with fallback payload should be marked failed."""
        failed = {
            "risk_level": "watch",
            "findings": [{"text": "Agent response unavailable.", "metric": None}],
            "recommendation": "Retry.",
            "failed": True,
        }
        results = {
            "endocrine": _SAMPLE_SPECIALIST_RESULTS["endocrine"],
            "cardiology": failed,
            "nephrology": _SAMPLE_SPECIALIST_RESULTS["nephrology"],
        }
        sid = create_session(
            patient_id="CCP-014",
            specialist_results=results,
            consensus=_SAMPLE_CONSENSUS,
            data_completeness=75,
            confidence_scores=_SAMPLE_CONFIDENCE,
        )
        trail = get_audit_trail(sid)
        assert trail["agent_status"]["cardiology"] == "failed"

    def test_recommendations_recorded(self):
        sid = create_session(
            patient_id="CCP-014",
            specialist_results=_SAMPLE_SPECIALIST_RESULTS,
            consensus=_SAMPLE_CONSENSUS,
            data_completeness=75,
            confidence_scores=_SAMPLE_CONFIDENCE,
        )
        trail = get_audit_trail(sid)
        assert "endocrine" in trail["recommendations"]
        assert "intensify" in trail["recommendations"]["endocrine"].lower()

    def test_confidence_scores_recorded(self):
        sid = create_session(
            patient_id="CCP-014",
            specialist_results=_SAMPLE_SPECIALIST_RESULTS,
            consensus=_SAMPLE_CONSENSUS,
            data_completeness=75,
            confidence_scores=_SAMPLE_CONFIDENCE,
        )
        trail = get_audit_trail(sid)
        assert trail["confidence_scores"]["nephrology"] == 86

    def test_decision_initially_null(self):
        sid = create_session(
            patient_id="CCP-014",
            specialist_results=_SAMPLE_SPECIALIST_RESULTS,
            consensus=_SAMPLE_CONSENSUS,
            data_completeness=75,
            confidence_scores=_SAMPLE_CONFIDENCE,
        )
        trail = get_audit_trail(sid)
        assert trail["decision"] is None
        assert trail["decided_at"] is None


# ---------------------------------------------------------------------------
# record_decision
# ---------------------------------------------------------------------------


class TestRecordDecision:
    def _make_session(self) -> str:
        return create_session(
            patient_id="CCP-014",
            specialist_results=_SAMPLE_SPECIALIST_RESULTS,
            consensus=_SAMPLE_CONSENSUS,
            data_completeness=75,
            confidence_scores=_SAMPLE_CONFIDENCE,
        )

    def test_approve_decision(self):
        sid = self._make_session()
        record_decision(sid, decision="approved", physician_name="Dr. Smith")
        trail = get_audit_trail(sid)
        assert trail["decision"] == "approved"
        assert trail["physician_name"] == "Dr. Smith"
        assert trail["decided_at"] is not None

    def test_edit_decision_with_text(self):
        sid = self._make_session()
        record_decision(
            sid,
            decision="edited",
            edited_text="Modified plan: lower metformin dose.",
            physician_note="Adjusted for renal function.",
            physician_name="Dr. Jones",
        )
        trail = get_audit_trail(sid)
        assert trail["decision"] == "edited"
        assert "lower metformin" in trail["edited_text"]
        assert "renal" in trail["physician_note"]

    def test_reject_decision(self):
        sid = self._make_session()
        record_decision(sid, decision="rejected", physician_note="Patient refused.")
        trail = get_audit_trail(sid)
        assert trail["decision"] == "rejected"

    def test_nonexistent_session_raises(self):
        with pytest.raises(ValueError, match="not found"):
            record_decision("CCP-SESSION-nonexistent", decision="approved")


# ---------------------------------------------------------------------------
# get_audit_trail
# ---------------------------------------------------------------------------


class TestGetAuditTrail:
    def test_nonexistent_returns_none(self):
        assert get_audit_trail("CCP-SESSION-does-not-exist") is None

    def test_full_trail_shape(self):
        sid = create_session(
            patient_id="CCP-014",
            specialist_results=_SAMPLE_SPECIALIST_RESULTS,
            consensus=_SAMPLE_CONSENSUS,
            data_completeness=75,
            confidence_scores=_SAMPLE_CONFIDENCE,
        )
        trail = get_audit_trail(sid)
        expected_keys = {
            "session_id", "patient_id", "created_at",
            "agent_status", "recommendations", "specialist_risk_levels",
            "specialist_findings", "consensus", "data_completeness",
            "confidence_scores", "decision", "edited_text",
            "physician_note", "physician_name", "decided_at",
        }
        assert set(trail.keys()) == expected_keys

    def test_session_id_matches(self):
        sid = create_session(
            patient_id="CCP-014",
            specialist_results=_SAMPLE_SPECIALIST_RESULTS,
            consensus=_SAMPLE_CONSENSUS,
            data_completeness=75,
            confidence_scores=_SAMPLE_CONFIDENCE,
        )
        trail = get_audit_trail(sid)
        assert trail["session_id"] == sid
