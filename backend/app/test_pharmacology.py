"""Tests for app.orchestrator.run_pharmacology and its integration into
run_board.

Mirrors the mocking style used in test_orchestrator.py but stays in its
own file since the Pharmacology agent is a deliberately separate code
path (see orchestrator.py comments) that must not disturb the existing
3-specialist + chair call sequence.
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.archivist import compute_archivist_summary
from app.deidentify import deidentify
from app.main import CCP014
from app.orchestrator import run_board, run_pharmacology


def _make_chat_response(payload: dict[str, Any]) -> MagicMock:
    choice = MagicMock()
    choice.message.content = json.dumps(payload)
    response = MagicMock()
    response.choices = [choice]
    return response


def _single_call_client(payload: dict[str, Any]) -> AsyncMock:
    """A mock client whose one and only call returns *payload*."""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(
        return_value=_make_chat_response(payload)
    )
    return client


@pytest.fixture
def archivist():
    return compute_archivist_summary(CCP014)


@pytest.fixture
def clinical():
    return deidentify(CCP014)


class TestRunPharmacology:
    @pytest.mark.asyncio
    async def test_valid_guideline_citation_is_kept(self, clinical, archivist):
        """A finding with a real guideline id and a grounded number survives."""
        payload = {
            "risk_level": "watch",
            "findings": [
                {
                    "text": "eGFR 58 mL/min — Metformin dose should be reviewed",
                    "metric": "egfr",
                    "guideline": "ADA_2024_METFORMIN_EGFR30",
                }
            ],
            "recommendation": "Continue monitoring renal function on Metformin.",
        }
        client = _single_call_client(payload)
        result, elapsed = await run_pharmacology(client, clinical, archivist, "CCP-014")

        assert elapsed >= 0
        assert len(result["findings"]) == 1
        assert result["findings"][0]["guideline"] == "ADA_2024_METFORMIN_EGFR30"
        assert result["findings"][0]["grounded"] is True

    @pytest.mark.asyncio
    async def test_hallucinated_guideline_id_is_withheld(self, clinical, archivist):
        """A finding citing a guideline id that doesn't exist must be dropped,
        even though its number is grounded — this is the anti-hallucination
        check unique to the Pharmacology agent."""
        payload = {
            "risk_level": "watch",
            "findings": [
                {
                    "text": "eGFR 58 mL/min — dose adjustment needed",
                    "metric": "egfr",
                    "guideline": "MADE_UP_GUIDELINE_ID",
                }
            ],
            "recommendation": "Review medications.",
        }
        client = _single_call_client(payload)
        result, _ = await run_pharmacology(client, clinical, archivist, "CCP-014")

        assert result["findings"] == []

    @pytest.mark.asyncio
    async def test_unsupported_number_is_still_withheld(self, clinical, archivist):
        """Existing numeric double-grounding still applies on top of the
        guideline-id check."""
        payload = {
            "risk_level": "watch",
            "findings": [
                {
                    "text": "eGFR 12 mL/min — contraindicated",  # not a real archivist value
                    "metric": "egfr",
                    "guideline": "ADA_2024_METFORMIN_EGFR30",
                }
            ],
            "recommendation": "Discontinue Metformin.",
        }
        client = _single_call_client(payload)
        result, _ = await run_pharmacology(client, clinical, archivist, "CCP-014")

        assert result["findings"] == []

    @pytest.mark.asyncio
    async def test_agent_failure_falls_back_gracefully(self, clinical, archivist):
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(side_effect=RuntimeError("timeout"))

        result, elapsed = await run_pharmacology(client, clinical, archivist, "CCP-014")

        assert result["recommendation"]
        assert elapsed >= 0
        assert "_fallback" not in result  # internal marker stripped by caller pattern


class TestRunBoardPharmacologyIntegration:
    """Guards against the Pharmacology agent leaking into, or disturbing,
    the original 3-specialist response shape."""

    @pytest.mark.asyncio
    async def test_run_board_includes_pharmacology_without_disturbing_specialists(self):
        from app.test_orchestrator import _build_mock_client  # reuse existing fixture

        client = _build_mock_client()
        result = await run_board(CCP014, client)

        assert "pharmacology_result" in result
        assert "pharmacology_confidence" in result
        assert isinstance(result["pharmacology_confidence"], int)

        # The original 3-specialist contract must be completely untouched.
        assert set(result["specialist_results"].keys()) == {
            "endocrine", "cardiology", "nephrology",
        }
        assert set(result["confidence_scores"].keys()) == {
            "endocrine", "cardiology", "nephrology",
        }
        assert "pharmacology_seconds" in result["timing"]
