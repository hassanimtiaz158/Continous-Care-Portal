"""Integration tests for the board orchestrator.

Mocks the Anthropic client so no real API calls are made.
Asserts the response shape matches CCP_TDD.md §5 API contract.
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.main import CCP014
from app.orchestrator import run_board


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
    responses: dict[str, dict[str, Any]] | None = None,
    side_effect: Exception | None = None,
) -> AsyncMock:
    """Build a mock AsyncAnthropic client.

    If *responses* is provided, ``messages.create`` returns the matching
    specialist response for each call (in order).  If *side_effect* is
    given, every call raises that exception.
    """
    client = AsyncMock()
    call_count = {"n": 0}
    agent_keys = ["endocrine", "cardiology", "nephrology"]
    resps = responses or _MOCK_SPECIALIST_RESPONSES

    async def _create(**kwargs: Any) -> MagicMock:
        if side_effect:
            raise side_effect
        idx = call_count["n"]
        call_count["n"] += 1
        key = agent_keys[idx] if idx < len(agent_keys) else agent_keys[-1]
        return _make_assistant_response(resps[key])

    client.messages.create = AsyncMock(side_effect=_create)
    return client


# ---------------------------------------------------------------------------
# Tests — TDD §5 API contract shape
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_response_has_required_keys():
    """POST /api/board/run must return the fields specified in TDD §5."""
    client = _build_mock_client()
    result = await run_board(CCP014, client)

    assert result["patient_id"] == "CCP-014"
    assert "archivist_summary" in result
    assert "specialist_results" in result
    assert "data_completeness" in result


@pytest.mark.asyncio
async def test_archivist_summary_shape():
    """Archivist summary must contain all fields from the StructuredClinicalSummary model."""
    client = _build_mock_client()
    result = await run_board(CCP014, client)
    summary = result["archivist_summary"]

    assert summary["risk_tier"] == "High"
    assert summary["completeness"] == 75
    assert summary["risk_points"] == 8
    assert isinstance(summary["threshold_crossings"], list)
    assert isinstance(summary["rule_log"], list)
    assert "metrics" in summary
    for key in ("hba1c", "egfr", "acr", "ldl", "bp"):
        assert key in summary["metrics"]


@pytest.mark.asyncio
async def test_specialist_results_keyed_by_agent():
    """Each specialist result must be keyed by agent key."""
    client = _build_mock_client()
    result = await run_board(CCP014, client)
    specialists = result["specialist_results"]

    assert set(specialists.keys()) == {"endocrine", "cardiology", "nephrology"}


@pytest.mark.asyncio
async def test_specialist_results_match_mock():
    """Specialist results must contain the raw JSON from the mocked agents."""
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
async def test_data_completeness_matches_archivist():
    """data_completeness must equal the archivist's completeness score."""
    client = _build_mock_client()
    result = await run_board(CCP014, client)

    archivist_completeness = result["archivist_summary"]["completeness"]
    assert result["data_completeness"] == archivist_completeness


@pytest.mark.asyncio
async def test_no_identifiers_in_prompt():
    """The prompt built by the orchestrator must never contain patient identifiers."""
    built_prompts: list[str] = []

    original_build = None
    from app import orchestrator

    original_build = orchestrator._build_prompt

    def _tracking_build(clinical, archivist):
        prompt = original_build(clinical, archivist)
        built_prompts.append(prompt)
        return prompt

    orchestrator._build_prompt = _tracking_build
    try:
        client = _build_mock_client()
        await run_board(CCP014, client)
    finally:
        orchestrator._build_prompt = original_build

    for prompt in built_prompts:
        assert "CCP-014" not in prompt
        assert "Synthetic Patient" not in prompt


# ---------------------------------------------------------------------------
# Tests — AI Failure Handling (TDD §2.6)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_single_agent_failure_returns_fallback():
    """If one agent raises, the other two still return real results."""
    call_count = {"n": 0}
    agent_keys = ["endocrine", "cardiology", "nephrology"]

    async def _mixed_create(**kwargs: Any) -> MagicMock:
        idx = call_count["n"]
        call_count["n"] += 1
        key = agent_keys[idx]
        if key == "nephrology":
            raise RuntimeError("Anthropic API timeout")
        return _make_assistant_response(_MOCK_SPECIALIST_RESPONSES[key])

    client = AsyncMock()
    client.messages.create = AsyncMock(side_effect=_mixed_create)

    result = await run_board(CCP014, client)
    specialists = result["specialist_results"]

    # Two agents succeeded with real data
    assert specialists["endocrine"]["risk_level"] == "watch"
    assert specialists["cardiology"]["risk_level"] == "watch"

    # One agent got the fallback payload
    assert specialists["nephrology"]["risk_level"] == "watch"
    assert "Agent response unavailable" in specialists["nephrology"]["findings"][0]["text"]


@pytest.mark.asyncio
async def test_all_agents_fail_returns_all_fallbacks():
    """If every agent raises, all three get fallback payloads."""
    client = AsyncMock()
    client.messages.create = AsyncMock(side_effect=RuntimeError("Provider down"))

    result = await run_board(CCP014, client)
    specialists = result["specialist_results"]

    for key in ("endocrine", "cardiology", "nephrology"):
        assert specialists[key]["risk_level"] == "watch"
        assert "Agent response unavailable" in specialists[key]["findings"][0]["text"]


# ---------------------------------------------------------------------------
# Tests — prompt construction
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_prompt_includes_archivist_metrics():
    """The specialist prompt must include the archivist's computed metrics."""
    prompts: list[str] = []
    from app import orchestrator
    original = orchestrator._build_prompt

    def _capture(clinical, archivist):
        p = original(clinical, archivist)
        prompts.append(p)
        return p

    orchestrator._build_prompt = _capture
    try:
        client = _build_mock_client()
        await run_board(CCP014, client)
    finally:
        orchestrator._build_prompt = original

    for p in prompts:
        assert "HbA1c" in p or "hba1c" in p
        assert "eGFR" in p or "egfr" in p
        assert "Archivist" in p


@pytest.mark.asyncio
async def test_prompt_3_calls_made():
    """Exactly 3 messages.create calls — one per specialist agent."""
    client = _build_mock_client()
    await run_board(CCP014, client)

    assert client.messages.create.call_count == 3
