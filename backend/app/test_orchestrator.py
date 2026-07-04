"""Integration tests for the board orchestrator.

Mocks the Anthropic client so no real API calls are made.
Asserts the response shape matches CCP_TDD.md §5 API contract.
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.main import CCP014
from app.orchestrator import (
    confidence_for,
    get_review_queue,
    run_board,
    _manual_review_queue,
)


# ---------------------------------------------------------------------------
# Helpers — mock Anthropic response factory
# ---------------------------------------------------------------------------


def _make_text_block(text: str) -> MagicMock:
    block = MagicMock()
    block.type = "text"
    block.text = text
    return block


def _make_assistant_response(payload: dict[str, Any]) -> MagicMock:
    msg = MagicMock()
    msg.content = [_make_text_block(json.dumps(payload))]
    return msg


_MOCK_CHAIR_RESPONSE: dict[str, Any] = {
    "joint_plan": "Synthesized plan: intensify glycemic and BP control; urgent nephrology referral for CKD Stage 3.",
    "priority_actions": [
        "Increase metformin monitoring given declining renal function.",
        "Escalate antihypertensive therapy to target SBP <130.",
        "Urgent nephrology referral for CKD Stage 3 staging.",
    ],
    "conflicts": [
        "Cardiology may recommend ACEi/ARB which requires nephrology dose coordination.",
    ],
}

# Fixed specialist responses for deterministic testing
_MOCK_SPECIALIST_RESPONSES: dict[str, dict[str, Any]] = {
    "endocrine": {
        "risk_level": "watch",
        "findings": [
            {"text": "HbA1c at 8.6% — above target", "metric": "hba1c"}
        ],
        "recommendation": "Intensify glycemic control; consider metformin dose adjustment given renal function.",
    },
    "cardiology": {
        "risk_level": "watch",
        "findings": [
            {"text": "Systolic BP 158 mmHg — above goal", "metric": "bp"},
            {"text": "LDL 134 mg/dL — above target", "metric": "ldl"},
        ],
        "recommendation": "Optimize antihypertensive therapy; assess statin adequacy.",
    },
    "nephrology": {
        "risk_level": "urgent",
        "findings": [
            {"text": "eGFR 58 mL/min — crossed CKD Stage 3", "metric": "egfr"},
            {"text": "ACR 61 mg/g — moderately increased", "metric": "acr"},
        ],
        "recommendation": "Urgent nephrology referral; review renally-cleared medications.",
    },
}


def _build_mock_client(
    specialist_responses: dict[str, dict[str, Any]] | None = None,
    chair_response: dict[str, Any] | None = None,
    fail_keys: set[str] | None = None,
    fail_chair: bool = False,
    global_error: Exception | None = None,
) -> AsyncMock:
    """Build a mock AsyncAnthropic client with 4 calls (3 specialists + 1 chair).

    - specialist_responses: per-agent responses (default: _MOCK_SPECIALIST_RESPONSES)
    - chair_response: Chair agent response (default: _MOCK_CHAIR_RESPONSE)
    - fail_keys: set of specialist agent keys that should raise
    - fail_chair: if True, the Chair call raises
    - global_error: if set, every call raises this
    """
    client = AsyncMock()
    call_count = {"n": 0}
    agent_order = ["endocrine", "cardiology", "nephrology"]
    resps = specialist_responses or _MOCK_SPECIALIST_RESPONSES
    chair_resp = chair_response or _MOCK_CHAIR_RESPONSE
    fails = fail_keys or set()

    async def _create(**kwargs: Any) -> MagicMock:
        if global_error:
            raise global_error
        idx = call_count["n"]
        call_count["n"] += 1
        # Call 0-2: specialists, call 3: chair
        if idx < 3:
            key = agent_order[idx]
            if key in fails:
                raise RuntimeError(f"Agent {key} timeout")
            return _make_assistant_response(resps[key])
        else:
            if fail_chair:
                raise RuntimeError("Chair agent timeout")
            return _make_assistant_response(chair_resp)

    client.messages.create = AsyncMock(side_effect=_create)
    return client


# ---------------------------------------------------------------------------
# Tests — TDD §5 API contract shape
# ---------------------------------------------------------------------------


class TestAPIContract:
    @pytest.mark.asyncio
    async def test_response_has_all_required_keys(self):
        """POST /api/board/run must return every field in TDD §5."""
        client = _build_mock_client()
        result = await run_board(CCP014, client)

        assert result["patient_id"] == "CCP-014"
        assert "archivist_summary" in result
        assert "specialist_results" in result
        assert "consensus" in result
        assert "data_completeness" in result
        assert "missing_fields" in result
        assert "confidence_scores" in result

    @pytest.mark.asyncio
    async def test_archivist_summary_shape(self):
        client = _build_mock_client()
        result = await run_board(CCP014, client)
        summary = result["archivist_summary"]

        assert summary["risk_tier"] == "High"
        assert summary["completeness"] == 75
        assert summary["risk_points"] == 8
        assert isinstance(summary["threshold_crossings"], list)
        assert isinstance(summary["rule_log"], list)
        for key in ("hba1c", "egfr", "acr", "ldl", "bp"):
            assert key in summary["metrics"]

    @pytest.mark.asyncio
    async def test_specialist_results_keyed_by_agent(self):
        client = _build_mock_client()
        result = await run_board(CCP014, client)
        assert set(result["specialist_results"].keys()) == {
            "endocrine", "cardiology", "nephrology",
        }

    @pytest.mark.asyncio
    async def test_specialist_results_match_mock(self):
        client = _build_mock_client()
        result = await run_board(CCP014, client)

        endo = result["specialist_results"]["endocrine"]
        assert endo["risk_level"] == "watch"
        assert len(endo["findings"]) == 1
        assert "recommendation" in endo

        cardio = result["specialist_results"]["cardiology"]
        assert cardio["risk_level"] == "watch"
        assert len(cardio["findings"]) == 2

        nephro = result["specialist_results"]["nephrology"]
        assert nephro["risk_level"] == "urgent"

    @pytest.mark.asyncio
    async def test_data_completeness_matches_archivist(self):
        client = _build_mock_client()
        result = await run_board(CCP014, client)
        assert result["data_completeness"] == result["archivist_summary"]["completeness"]

    @pytest.mark.asyncio
    async def test_4_messages_create_calls(self):
        """3 specialists + 1 chair = 4 messages.create calls."""
        client = _build_mock_client()
        await run_board(CCP014, client)
        assert client.messages.create.call_count == 4


# ---------------------------------------------------------------------------
# Tests — Board Chair consensus (§2.3)
# ---------------------------------------------------------------------------


class TestConsensus:
    @pytest.mark.asyncio
    async def test_consensus_has_required_fields(self):
        client = _build_mock_client()
        result = await run_board(CCP014, client)
        c = result["consensus"]

        assert "joint_plan" in c
        assert "priority_actions" in c
        assert "conflicts" in c
        assert isinstance(c["priority_actions"], list)
        assert isinstance(c["conflicts"], list)

    @pytest.mark.asyncio
    async def test_consensus_matches_mock(self):
        client = _build_mock_client()
        result = await run_board(CCP014, client)
        c = result["consensus"]

        assert "intensify" in c["joint_plan"].lower()
        assert len(c["priority_actions"]) == 3
        assert len(c["conflicts"]) == 1

    @pytest.mark.asyncio
    async def test_consensus_preserves_empty_conflicts(self):
        """If Chair returns no conflicts, the array is empty (not missing)."""
        chair_no_conflicts = {**_MOCK_CHAIR_RESPONSE, "conflicts": []}
        client = _build_mock_client(chair_response=chair_no_conflicts)
        result = await run_board(CCP014, client)

        assert result["consensus"]["conflicts"] == []


# ---------------------------------------------------------------------------
# Tests — Confidence Scoring (§2.7)
# ---------------------------------------------------------------------------


class TestConfidenceScores:
    @pytest.mark.asyncio
    async def test_confidence_scores_for_all_agents(self):
        client = _build_mock_client()
        result = await run_board(CCP014, client)
        scores = result["confidence_scores"]

        assert set(scores.keys()) == {"endocrine", "cardiology", "nephrology"}
        for key in scores:
            assert isinstance(scores[key], int)
            assert 35 <= scores[key] <= 97

    @pytest.mark.asyncio
    async def test_urgent_gets_higher_confidence_than_watch(self):
        """Urgent gets +4 adj vs watch gets +0, so urgency → higher confidence."""
        # Both use same archivist (CCP-014, completeness=75)
        client = _build_mock_client()
        result = await run_board(CCP014, client)

        # endocrine=watch, nephrology=urgent
        assert result["confidence_scores"]["nephrology"] > result["confidence_scores"]["endocrine"]

    def test_confidence_for_low_completeness(self):
        """Low completeness should pull confidence toward the floor."""
        from app.models import StructuredClinicalSummary
        low = StructuredClinicalSummary(
            generated_at="2026-01-01T00:00:00Z",
            metrics={},
            threshold_crossings=[],
            completeness=0,
            missing_fields=["a", "b", "c", "d", "c", "d"],
            risk_points=0,
            risk_tier="Low",
            rule_log=[],
        )
        # base = 40 + 0 * 0.55 = 40, watch adj = 0 → 40, above floor of 35
        assert confidence_for(low, "watch") == 40

    def test_confidence_for_high_completeness(self):
        """High completeness + stable → near ceiling."""
        from app.models import StructuredClinicalSummary
        high = StructuredClinicalSummary(
            generated_at="2026-01-01T00:00:00Z",
            metrics={},
            threshold_crossings=[],
            completeness=100,
            missing_fields=[],
            risk_points=0,
            risk_tier="Low",
            rule_log=[],
        )
        assert confidence_for(high, "stable") == 97  # clamped to ceiling

    @pytest.mark.asyncio
    async def test_each_finding_has_confidence(self):
        """Every grounded finding in every specialist must carry a confidence field."""
        client = _build_mock_client()
        result = await run_board(CCP014, client)

        for key, specialist in result["specialist_results"].items():
            for finding in specialist.get("findings", []):
                assert "confidence" in finding, f"{key} finding missing confidence"
                assert isinstance(finding["confidence"], int)
                assert 35 <= finding["confidence"] <= 97

    @pytest.mark.asyncio
    async def test_finding_confidence_matches_agent_confidence(self):
        """Per-finding confidence must equal the per-agent confidence (same risk level)."""
        client = _build_mock_client()
        result = await run_board(CCP014, client)

        for key in ("endocrine", "cardiology", "nephrology"):
            agent_conf = result["confidence_scores"][key]
            specialist = result["specialist_results"][key]
            for finding in specialist.get("findings", []):
                if "confidence" in finding:
                    assert finding["confidence"] == agent_conf

    @pytest.mark.asyncio
    async def test_missing_fields_in_response(self):
        """missing_fields must be surfaced at the top level of the response."""
        client = _build_mock_client()
        result = await run_board(CCP014, client)

        assert "missing_fields" in result
        assert isinstance(result["missing_fields"], list)
        assert len(result["missing_fields"]) == 2
        assert any("lipid" in f.lower() for f in result["missing_fields"])

    @pytest.mark.asyncio
    async def test_withheld_finding_has_no_confidence(self):
        """Findings withheld by grounding validation should not get a confidence score."""
        # Inject a fabricated finding that will be withheld
        fabricated = {
            "endocrine": {
                "risk_level": "watch",
                "findings": [
                    {"text": "HbA1c at 8.6%", "metric": "hba1c"},       # grounded
                    {"text": "HbA1c is 11.2% — critical", "metric": "hba1c"},  # fabricated
                ],
                "recommendation": "Adjust.",
            },
            "cardiology": _MOCK_SPECIALIST_RESPONSES["cardiology"],
            "nephrology": _MOCK_SPECIALIST_RESPONSES["nephrology"],
        }
        client = _build_mock_client(specialist_responses=fabricated)
        result = await run_board(CCP014, client)

        findings = result["specialist_results"]["endocrine"]["findings"]
        # Only the grounded finding should remain (withheld one removed)
        assert len(findings) == 1
        assert findings[0]["confidence"] > 0


# ---------------------------------------------------------------------------
# Tests — AI Failure Handling (§2.6)
# ---------------------------------------------------------------------------


class TestAIFailureHandling:
    @pytest.mark.asyncio
    async def test_single_specialist_failure(self):
        """One specialist fails → fallback + others succeed + review entry."""
        _manual_review_queue.clear()
        client = _build_mock_client(fail_keys={"nephrology"})
        result = await run_board(CCP014, client)

        assert result["specialist_results"]["endocrine"]["risk_level"] == "watch"
        assert result["specialist_results"]["cardiology"]["risk_level"] == "watch"
        assert result["specialist_results"]["nephrology"]["risk_level"] == "watch"
        assert "Agent response unavailable" in result["specialist_results"]["nephrology"]["findings"][0]["text"]

        # Review queue entry created
        queue = get_review_queue()
        assert any(e["agent_key"] == "nephrology" for e in queue)

    @pytest.mark.asyncio
    async def test_all_specialists_fail(self):
        """All specialists fail → all get fallback + review entries."""
        _manual_review_queue.clear()
        client = _build_mock_client(fail_keys={"endocrine", "cardiology", "nephrology"})
        result = await run_board(CCP014, client)

        for key in ("endocrine", "cardiology", "nephrology"):
            assert result["specialist_results"][key]["risk_level"] == "watch"
            assert "Agent response unavailable" in result["specialist_results"][key]["findings"][0]["text"]

        queue = get_review_queue()
        assert len(queue) >= 3

    @pytest.mark.asyncio
    async def test_chair_failure_returns_fallback_consensus(self):
        """Chair fails → fallback consensus + patient still in response."""
        _manual_review_queue.clear()
        client = _build_mock_client(fail_chair=True)
        result = await run_board(CCP014, client)

        c = result["consensus"]
        assert "unavailable" in c["joint_plan"].lower()
        assert isinstance(c["priority_actions"], list)
        assert c["conflicts"] == []

        queue = get_review_queue()
        assert any(e["agent_key"] == "chair" for e in queue)

    @pytest.mark.asyncio
    async def test_patient_never_disappears(self):
        """Even with all agents failing, the response always has patient_id + archivist data."""
        client = _build_mock_client(
            fail_keys={"endocrine", "cardiology", "nephrology"},
            fail_chair=True,
        )
        result = await run_board(CCP014, client)

        assert result["patient_id"] == "CCP-014"
        assert "archivist_summary" in result
        assert result["data_completeness"] == 75
        assert "confidence_scores" in result

    @pytest.mark.asyncio
    async def test_global_provider_failure(self):
        """Entire provider down → all fallback, patient still returned."""
        _manual_review_queue.clear()
        client = _build_mock_client(global_error=RuntimeError("Provider down"))
        result = await run_board(CCP014, client)

        assert result["patient_id"] == "CCP-014"
        assert result["archivist_summary"]["risk_tier"] == "High"
        for key in ("endocrine", "cardiology", "nephrology"):
            assert result["specialist_results"][key]["risk_level"] == "watch"
        assert "unavailable" in result["consensus"]["joint_plan"].lower()


# ---------------------------------------------------------------------------
# Tests — manual review queue
# ---------------------------------------------------------------------------


class TestReviewQueue:
    def test_queue_is_list(self):
        queue = get_review_queue()
        assert isinstance(queue, list)

    @pytest.mark.asyncio
    async def test_queue_entries_have_required_fields(self):
        _manual_review_queue.clear()
        client = _build_mock_client(fail_keys={"endocrine"})
        await run_board(CCP014, client)

        entries = [e for e in get_review_queue() if e["agent_key"] == "endocrine"]
        assert len(entries) >= 1
        e = entries[0]
        assert "id" in e
        assert e["patient_id"] == "CCP-014"
        assert "error" in e
        assert "queued_at" in e
        assert e["status"] == "pending"


# ---------------------------------------------------------------------------
# Tests — Timing Instrumentation
# ---------------------------------------------------------------------------


class TestTiming:
    @pytest.mark.asyncio
    async def test_response_has_timing(self):
        client = _build_mock_client()
        result = await run_board(CCP014, client)
        assert "timing" in result
        t = result["timing"]
        assert "board_total_seconds" in t
        assert "archivist_seconds" in t
        assert "specialist_seconds" in t
        assert "chair_seconds" in t
        assert "per_agent_seconds" in t

    @pytest.mark.asyncio
    async def test_timing_values_are_positive(self):
        client = _build_mock_client()
        result = await run_board(CCP014, client)
        t = result["timing"]
        assert t["board_total_seconds"] > 0
        assert t["archivist_seconds"] >= 0
        assert t["specialist_seconds"] >= 0
        assert t["chair_seconds"] >= 0

    @pytest.mark.asyncio
    async def test_per_agent_has_all_keys(self):
        client = _build_mock_client()
        result = await run_board(CCP014, client)
        per_agent = result["timing"]["per_agent_seconds"]
        assert set(per_agent.keys()) == {"endocrine", "cardiology", "nephrology"}
        for key in per_agent:
            assert isinstance(per_agent[key], float)
            assert per_agent[key] >= 0

    @pytest.mark.asyncio
    async def test_board_total_is_sum_of_parts(self):
        """board_total ≈ archivist + specialist + chair (within rounding)."""
        client = _build_mock_client()
        result = await run_board(CCP014, client)
        t = result["timing"]
        parts_sum = t["archivist_seconds"] + t["specialist_seconds"] + t["chair_seconds"]
        assert abs(t["board_total_seconds"] - parts_sum) < 0.05

    @pytest.mark.asyncio
    async def test_timing_present_even_on_failure(self):
        """Timing should still be returned when agents fail."""
        client = _build_mock_client(fail_keys={"nephrology"}, fail_chair=True)
        result = await run_board(CCP014, client)
        assert "timing" in result
        assert result["timing"]["board_total_seconds"] > 0
        assert result["timing"]["per_agent_seconds"]["nephrology"] >= 0


# ---------------------------------------------------------------------------
# Tests — no identifiers in prompts
# ---------------------------------------------------------------------------


class TestPromptSecurity:
    @pytest.mark.asyncio
    async def test_no_identifiers_in_any_prompt(self):
        prompts: list[str] = []
        from app import orchestrator

        orig_specialist = orchestrator._build_specialist_prompt
        orig_chair = orchestrator._build_chair_prompt

        def _track_specialist(clinical, archivist):
            p = orig_specialist(clinical, archivist)
            prompts.append(p)
            return p

        def _track_chair(specialist_results):
            p = orig_chair(specialist_results)
            prompts.append(p)
            return p

        orchestrator._build_specialist_prompt = _track_specialist
        orchestrator._build_chair_prompt = _track_chair
        try:
            client = _build_mock_client()
            await run_board(CCP014, client)
        finally:
            orchestrator._build_specialist_prompt = orig_specialist
            orchestrator._build_chair_prompt = orig_chair

        for p in prompts:
            assert "CCP-014" not in p
            assert "Synthetic Patient" not in p
