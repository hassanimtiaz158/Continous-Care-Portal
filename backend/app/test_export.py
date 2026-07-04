"""Tests for the Export Review Packet — TDD §2.15.

Validates that the PDF is well-formed and the endpoint works correctly.
PDF body is FlateDecode-compressed, so we validate structure + metadata
rather than raw text search.
"""

from __future__ import annotations

from app.export import generate_export_pdf


def test_pdf_starts_with_magic_bytes():
    pdf = generate_export_pdf(
        patient_id="CCP-014",
        patient_name="Test Patient",
        patient_age=58,
        patient_sex="Female",
        patient_dx="T2DM",
        patient_meds=["Metformin"],
        archivist_summary={"metrics": {}, "threshold_crossings": [], "missing_fields": []},
        specialist_results={},
        consensus={},
    )
    assert pdf[:5] == b"%PDF-"


def test_pdf_ends_with_eof():
    pdf = generate_export_pdf(
        patient_id="CCP-014",
        patient_name="Test Patient",
        patient_age=58,
        patient_sex="Female",
        patient_dx="T2DM",
        patient_meds=["Metformin"],
        archivist_summary={"metrics": {}, "threshold_crossings": [], "missing_fields": []},
        specialist_results={},
        consensus={},
    )
    assert pdf.rstrip().endswith(b"%%EOF")


def test_pdf_metadata_contains_patient_id():
    pdf = generate_export_pdf(
        patient_id="CCP-014",
        patient_name="Test Patient",
        patient_age=58,
        patient_sex="Female",
        patient_dx="T2DM",
        patient_meds=["Metformin"],
        archivist_summary={"metrics": {}, "threshold_crossings": [], "missing_fields": []},
        specialist_results={},
        consensus={},
    )
    # Title is set in PDF metadata (uncompressed)
    assert b"CCP-014" in pdf
    assert b"Continuous Care Portal" in pdf


def test_pdf_has_page_structure():
    pdf = generate_export_pdf(
        patient_id="CCP-014",
        patient_name="Test",
        patient_age=58,
        patient_sex="F",
        patient_dx="T2DM",
        patient_meds=[],
        archivist_summary={"metrics": {}, "threshold_crossings": [], "missing_fields": []},
        specialist_results={},
        consensus={},
    )
    assert b"/Type /Page" in pdf
    assert b"/Type /Pages" in pdf
    assert b"/Type /Catalog" in pdf


def test_pdf_with_specialist_results():
    pdf = generate_export_pdf(
        patient_id="CCP-014",
        patient_name="Test",
        patient_age=58,
        patient_sex="F",
        patient_dx="T2DM",
        patient_meds=[],
        archivist_summary={"metrics": {}, "threshold_crossings": [], "missing_fields": []},
        specialist_results={
            "endocrine": {"risk_level": "watch", "findings": [{"text": "HbA1c 8.6%"}], "recommendation": "Rec1"},
            "cardiology": {"risk_level": "stable", "findings": [], "recommendation": "Rec2"},
            "nephrology": {"risk_level": "urgent", "findings": [], "recommendation": "Rec3"},
        },
        consensus={"joint_plan": "Joint plan text.", "priority_actions": ["A1"], "conflicts": ["C1"]},
    )
    # PDF should be larger when more content is included
    assert len(pdf) > 1000
    assert b"%PDF-" in pdf


def test_pdf_with_decision():
    pdf = generate_export_pdf(
        patient_id="CCP-014",
        patient_name="Test",
        patient_age=58,
        patient_sex="F",
        patient_dx="T2DM",
        patient_meds=[],
        archivist_summary={"metrics": {}, "threshold_crossings": [], "missing_fields": []},
        specialist_results={},
        consensus={},
        decision="edited",
        edited_text="Revised plan.",
        physician_note="Note text.",
        physician_name="Dr. Reviewer",
    )
    # Larger PDF due to decision section
    assert len(pdf) > 1000
    assert b"CCP-014" in pdf


def test_pdf_with_metrics_and_crossings():
    pdf = generate_export_pdf(
        patient_id="CCP-014",
        patient_name="Test",
        patient_age=58,
        patient_sex="F",
        patient_dx="T2DM",
        patient_meds=[],
        archivist_summary={
            "metrics": {
                "hba1c": {"latest": 8.6, "delta": 1.4, "trend": "rising", "unit": "%", "history": [{"t": "12mo", "v": 7.2}, {"t": "Now", "v": 8.6}]},
            },
            "threshold_crossings": ["HbA1c crossed 8.0%"],
            "missing_fields": ["Lipid panel"],
            "completeness": 75,
        },
        specialist_results={},
        consensus={},
    )
    # PDF with metrics table should be larger
    assert len(pdf) > 1500
    assert b"CCP-014" in pdf


def test_pdf_with_audit_log():
    pdf = generate_export_pdf(
        patient_id="CCP-014",
        patient_name="Test",
        patient_age=58,
        patient_sex="F",
        patient_dx="T2DM",
        patient_meds=[],
        archivist_summary={"metrics": {}, "threshold_crossings": [], "missing_fields": []},
        specialist_results={},
        consensus={},
        audit_log=[
            {"ts": "2025-01-01T00:00:00", "event": "session_created"},
            {"ts": "2025-01-01T00:00:01", "event": "agent_responded", "agent": "endocrine"},
        ],
    )
    # PDF with audit log table should be larger
    assert len(pdf) > 1500
    assert b"CCP-014" in pdf


def test_pdf_with_failed_agent():
    pdf = generate_export_pdf(
        patient_id="CCP-014",
        patient_name="Test",
        patient_age=58,
        patient_sex="F",
        patient_dx="T2DM",
        patient_meds=[],
        archivist_summary={"metrics": {}, "threshold_crossings": [], "missing_fields": []},
        specialist_results={
            "endocrine": {"risk_level": "watch", "findings": [], "recommendation": "Rec", "failed": True},
        },
        consensus={},
    )
    assert len(pdf) > 1000
    assert b"CCP-014" in pdf


def test_pdf_no_meds():
    pdf = generate_export_pdf(
        patient_id="TEST",
        patient_name="No Meds Patient",
        patient_age=30,
        patient_sex="Male",
        patient_dx="None",
        patient_meds=[],
        archivist_summary={"metrics": {}, "threshold_crossings": [], "missing_fields": []},
        specialist_results={},
        consensus={},
    )
    assert pdf[:5] == b"%PDF-"
    assert b"TEST" in pdf
