"""ICD-10 reference loader — TDD §2.7 ICD-10 Coding Agent grounding.

Loads ``icd10_reference.json`` once at import time. Provides:
- keyword-based candidate retrieval for a chief complaint (deterministic,
  no LLM) — this narrows the field BEFORE the agent ever runs, so the
  agent is choosing from a short, real, pre-filtered list rather than
  free-generating a code from its training data.
- code-existence validation, used the same way ``entry_exists`` is used
  for guideline ids: a code the agent proposes that isn't in the
  provided candidate list is treated as unsupported and withheld.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

_ICD10_PATH = Path(__file__).parent / "icd10_reference.json"

with open(_ICD10_PATH, encoding="utf-8") as _f:
    _ICD10: dict[str, Any] = json.load(_f)

CODES: list[dict[str, Any]] = _ICD10["codes"]
CODE_MAP: dict[str, dict[str, Any]] = {c["code"]: c for c in CODES}


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z]+", text.lower()))


def candidates_for_complaint(chief_complaint: str, limit: int = 6) -> list[dict[str, Any]]:
    """Return the top *limit* ICD-10 candidates for a free-text complaint.

    Deterministic keyword overlap scoring — a complaint's tokens are
    matched against each code's keyword list. This is intentionally
    simple (no LLM) so the candidate SET the agent sees is auditable
    and reproducible; the agent's job is only to rank/select within it,
    not to invent codes from scratch.
    """
    complaint_tokens = _tokenize(chief_complaint)
    scored: list[tuple[int, dict[str, Any]]] = []
    for entry in CODES:
        keyword_tokens: set[str] = set()
        for kw in entry["keywords"]:
            keyword_tokens |= _tokenize(kw)
        overlap = len(complaint_tokens & keyword_tokens)
        if overlap > 0:
            scored.append((overlap, entry))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    if not scored:
        # No keyword hit at all — fall back to the generic "general exam"
        # code so the agent always has at least one grounded option
        # rather than nothing to choose from.
        return [CODE_MAP["Z00.00"]]
    return [entry for _, entry in scored[:limit]]


def format_candidates_for_prompt(candidates: list[dict[str, Any]]) -> str:
    """Format candidate codes as a numbered, citation-ready block."""
    lines = []
    for c in candidates:
        lines.append(f'- {c["code"]}: {c["label"]}')
    return "\n".join(lines)


def code_exists(code: str | None) -> bool:
    """Return True if *code* is a real, known code in the reference set."""
    return bool(code) and code in CODE_MAP


def code_in_candidates(code: str | None, candidates: list[dict[str, Any]]) -> bool:
    """Return True if *code* is one of the specific candidates offered.

    Stricter than ``code_exists`` — the agent must pick from the list it
    was actually shown, not any valid code anywhere in the reference set.
    """
    return bool(code) and any(c["code"] == code for c in candidates)
