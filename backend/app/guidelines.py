"""Clinical guidelines reference loader.

Loads ``clinical_guidelines.json`` once at import time and provides
helpers to look up relevant entries for a patient's medication list,
and to format them as a citation-ready excerpt for injection into an
agent prompt.

This is the "Guidelines Agent" grounding source described in the PRD:
every drug-related recommendation must cite one of these entries by
``id`` rather than being asserted from the model's own training data.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_GUIDELINES_PATH = Path(__file__).parent / "clinical_guidelines.json"

with open(_GUIDELINES_PATH, encoding="utf-8") as _f:
    _GUIDELINES: dict[str, Any] = json.load(_f)

ENTRIES: list[dict[str, Any]] = _GUIDELINES["entries"]
ENTRY_MAP: dict[str, dict[str, Any]] = {e["id"]: e for e in ENTRIES}


def relevant_entries_for_meds(meds: list[str]) -> list[dict[str, Any]]:
    """Return guideline entries whose drug_keywords match the patient's med list.

    Entries with an empty ``drug_keywords`` list (e.g. BP/glycemic targets
    that aren't drug-specific) are always included, since they still ground
    dose-adjustment and monitoring recommendations.
    """
    meds_lower = " ".join(meds).lower()
    matched = []
    for entry in ENTRIES:
        keywords = entry.get("drug_keywords", [])
        if not keywords:
            matched.append(entry)
            continue
        if any(kw.lower() in meds_lower for kw in keywords):
            matched.append(entry)
    return matched


def format_entries_for_prompt(entries: list[dict[str, Any]]) -> str:
    """Format a list of guideline entries as a numbered, citation-ready block."""
    if not entries:
        return "No specific guideline entries matched this patient's medication list."
    lines = []
    for e in entries:
        lines.append(f'- [{e["id"]}] ({e["source"]}): {e["text"]}')
    return "\n".join(lines)


def get_guideline_excerpt_for_meds(meds: list[str]) -> str:
    """Convenience wrapper: relevant entries for *meds*, formatted for a prompt."""
    return format_entries_for_prompt(relevant_entries_for_meds(meds))


def entry_exists(guideline_id: str | None) -> bool:
    """Return True if *guideline_id* is a real, known guideline entry id."""
    return bool(guideline_id) and guideline_id in ENTRY_MAP
