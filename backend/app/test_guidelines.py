"""Tests for app.guidelines — the guideline reference loader used to ground
the Pharmacology agent's recommendations."""

from __future__ import annotations

from app.guidelines import (
    ENTRY_MAP,
    entry_exists,
    format_entries_for_prompt,
    get_guideline_excerpt_for_meds,
    relevant_entries_for_meds,
)


def test_entries_loaded_and_have_required_fields():
    assert len(ENTRY_MAP) > 0
    for entry_id, entry in ENTRY_MAP.items():
        assert entry["id"] == entry_id
        assert entry["source"]
        assert entry["text"]
        assert "drug_keywords" in entry
        assert "metric" in entry


def test_relevant_entries_matches_metformin():
    meds = ["Metformin 1000mg BID", "Amlodipine 5mg OD", "Atorvastatin 20mg OD"]
    matched_ids = {e["id"] for e in relevant_entries_for_meds(meds)}
    assert "ADA_2024_METFORMIN_EGFR30" in matched_ids
    assert "ADA_2024_STATIN_ASCVD_RISK" in matched_ids


def test_relevant_entries_always_includes_no_drug_keyword_entries():
    """Entries with empty drug_keywords (e.g. BP/glycemic targets) apply to
    every patient regardless of their medication list."""
    matched_ids = {e["id"] for e in relevant_entries_for_meds(["Insulin glargine"])}
    assert "ACC_AHA_2017_BP_TARGET_CKD" in matched_ids
    assert "ADA_2024_HBA1C_TARGET" in matched_ids


def test_relevant_entries_excludes_unrelated_drug_specific_entries():
    """A patient not on an ACEi/ARB shouldn't get the ACEi/ARB monitoring entry."""
    meds = ["Metformin 1000mg BID"]
    matched_ids = {e["id"] for e in relevant_entries_for_meds(meds)}
    assert "KDIGO_2024_ACEI_ARB_HYPERKALEMIA" not in matched_ids
    assert "KDIGO_2024_SGLT2I_RENAL" not in matched_ids


def test_format_entries_for_prompt_includes_id_and_source():
    entries = relevant_entries_for_meds(["Metformin 1000mg BID"])
    text = format_entries_for_prompt(entries)
    assert "ADA_2024_METFORMIN_EGFR30" in text
    assert "ADA 2024" in text


def test_format_entries_for_prompt_handles_empty_list():
    text = format_entries_for_prompt([])
    assert "No specific guideline entries" in text


def test_get_guideline_excerpt_for_meds_is_a_string():
    excerpt = get_guideline_excerpt_for_meds(["Metformin 1000mg BID"])
    assert isinstance(excerpt, str)
    assert len(excerpt) > 0


def test_entry_exists_true_for_real_id():
    assert entry_exists("ADA_2024_METFORMIN_EGFR30") is True


def test_entry_exists_false_for_hallucinated_id():
    assert entry_exists("MADE_UP_GUIDELINE_ID_123") is False


def test_entry_exists_false_for_none():
    assert entry_exists(None) is False
