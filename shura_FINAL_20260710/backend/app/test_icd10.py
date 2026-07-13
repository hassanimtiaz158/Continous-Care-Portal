"""Tests for app.icd10 (keyword retrieval + validation) and
app.orchestrator.run_icd10_coding (the agent orchestration step)."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.icd10 import (
    CODE_MAP,
    candidates_for_complaint,
    code_exists,
    code_in_candidates,
    format_candidates_for_prompt,
)
from app.orchestrator import run_icd10_coding


def _make_chat_response(payload: dict[str, Any]) -> MagicMock:
    choice = MagicMock()
    choice.message.content = json.dumps(payload)
    response = MagicMock()
    response.choices = [choice]
    return response


def _single_call_client(payload: dict[str, Any]) -> AsyncMock:
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(
        return_value=_make_chat_response(payload)
    )
    return client


class TestIcd10Reference:
    def test_codes_loaded_with_required_fields(self):
        assert len(CODE_MAP) > 0
        for code, entry in CODE_MAP.items():
            assert entry["code"] == code
            assert entry["label"]
            assert isinstance(entry["keywords"], list)

    def test_candidates_for_diabetes_complaint(self):
        candidates = candidates_for_complaint(
            "Increased thirst and urination for 3 weeks, ankle swelling for 1 week."
        )
        codes = {c["code"] for c in candidates}
        assert "E11.22" in codes  # diabetes + kidney/swelling keywords

    def test_candidates_for_routine_visit_falls_back_to_general_exam(self):
        candidates = candidates_for_complaint("Routine follow-up, no complaints.")
        # "routine" and "no complaints" both map to Z00.00's keywords
        codes = {c["code"] for c in candidates}
        assert "Z00.00" in codes

    def test_candidates_for_gibberish_falls_back_to_general_exam(self):
        candidates = candidates_for_complaint("asdkfjhqwoeiruzxcvbnm")
        assert candidates == [CODE_MAP["Z00.00"]]

    def test_format_candidates_for_prompt(self):
        candidates = candidates_for_complaint("chest pain")
        text = format_candidates_for_prompt(candidates)
        assert "I20.9" in text or "R07.9" in text

    def test_code_exists_true_for_real_code(self):
        assert code_exists("I10") is True

    def test_code_exists_false_for_hallucinated_code(self):
        assert code_exists("Z99.99") is False

    def test_code_in_candidates_strict_check(self):
        candidates = candidates_for_complaint("chest pain")
        # A real ICD-10 code that exists overall, but wasn't offered for
        # THIS complaint, must fail the stricter candidate check.
        assert code_in_candidates("N39.0", candidates) is False


class TestRunIcd10Coding:
    @pytest.mark.asyncio
    async def test_valid_ranked_code_is_kept(self):
        candidates = candidates_for_complaint("burning urination and frequent urination")
        top_code = candidates[0]["code"]
        payload = {"ranked": [{"code": top_code, "confidence": 90}]}
        client = _single_call_client(payload)

        result, elapsed = await run_icd10_coding(
            client, "burning urination and frequent urination", "EG-TEST",
        )

        assert elapsed >= 0
        assert len(result["ranked"]) == 1
        assert result["ranked"][0]["code"] == top_code
        assert result["ranked"][0]["confidence"] == 90
        assert result["ranked"][0]["label"]  # label filled in from reference

    @pytest.mark.asyncio
    async def test_hallucinated_code_outside_candidates_is_withheld(self):
        payload = {"ranked": [{"code": "Z99.99", "confidence": 95}]}
        client = _single_call_client(payload)

        result, _ = await run_icd10_coding(client, "headache", "EG-TEST")

        assert result["ranked"] == []
        # Candidates are still returned so the physician can pick manually
        assert len(result["candidates"]) > 0

    @pytest.mark.asyncio
    async def test_agent_failure_falls_back_gracefully(self):
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(side_effect=RuntimeError("timeout"))

        result, elapsed = await run_icd10_coding(client, "fever and cough", "EG-TEST")

        assert result["ranked"] == []
        assert len(result["candidates"]) > 0
        assert elapsed >= 0
