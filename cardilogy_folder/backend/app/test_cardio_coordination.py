"""Tests for app.cardio_coordination — Cardiology module TDD §3.

Covers only the deterministic ownership state machine here; the
LLM-assisted drafting path is exercised through the orchestrator/route
integration tests (mocked), same pattern as test_orchestrator.py does
for the existing specialist agents.
"""

from __future__ import annotations

import pytest

from app.cardio_coordination import (
    add_consulting_department,
    start_ownership,
    transfer_ownership,
)


class TestOwnershipStateMachine:
    def test_case_opens_with_a_single_history_event(self):
        state = start_ownership("C-DISSECT-1", "cardiology")
        assert state.current_owner == "cardiology"
        assert len(state.history) == 1
        assert state.history[0].from_department is None

    def test_transfer_appends_not_overwrites_history(self):
        state = start_ownership("C-DISSECT-1", "cardiology")
        state = transfer_ownership(
            state,
            "cardiothoracic_surgery",
            "CT angiography confirmed dissection.",
            confirmed_by="Dr. Rousseau",
        )
        assert state.current_owner == "cardiothoracic_surgery"
        assert len(state.history) == 2
        assert state.history[1].from_department == "cardiology"
        assert state.history[1].to_department == "cardiothoracic_surgery"
        assert state.history[1].confirmed_by == "Dr. Rousseau"

    def test_multiple_transfers_preserve_full_chain(self):
        state = start_ownership("C-DISSECT-1", "emergency")
        state = transfer_ownership(
            state, "cardiology", "Admitted to cardiology for workup.", confirmed_by="Dr. Rousseau"
        )
        state = transfer_ownership(
            state,
            "cardiothoracic_surgery",
            "Diagnosis confirmed on CT angio.",
            confirmed_by="Dr. Rousseau",
        )
        owners = [e.to_department for e in state.history]
        assert owners == ["emergency", "cardiology", "cardiothoracic_surgery"]

    def test_transfer_without_confirmed_by_is_rejected(self):
        state = start_ownership("C-DISSECT-1", "cardiology")
        with pytest.raises(ValueError):
            transfer_ownership(state, "cardiothoracic_surgery", "Some reason.", confirmed_by="  ")

    def test_add_consulting_department_is_idempotent(self):
        state = start_ownership("C-DISSECT-1", "cardiology")
        state = add_consulting_department(state, "radiology")
        state = add_consulting_department(state, "radiology")
        assert state.consulting_departments == ["radiology"]

    def test_current_owner_not_added_as_consulting(self):
        state = start_ownership("C-DISSECT-1", "cardiology")
        state = add_consulting_department(state, "cardiology")
        assert state.consulting_departments == []
