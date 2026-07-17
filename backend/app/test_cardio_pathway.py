"""Tests for app.cardio_pathway — Cardiology module TDD §1.

Covers all six worked cases from the department design brief, plus edge
cases (unknown diagnosis, no concurrent departments).
"""

from __future__ import annotations

import pytest

from app.cardio_pathway import IntakeRequest, classify_pathway, diagnosis_exists


class TestKnownDiagnoses:
    def test_all_six_case_diagnoses_exist(self):
        for dx in [
            "AORTIC_DISSECTION",
            "HOCM_SUSPECTED",
            "ACUTE_MI",
            "KAWASAKI_DISEASE",
            "ACUTE_STROKE_HTN_DM",
            "SLE_PERICARDITIS",
        ]:
            assert diagnosis_exists(dx), dx

    def test_unknown_diagnosis_raises(self):
        req = IntakeRequest(case_id="C1", diagnosis_id="NOT_A_REAL_DX", source="emergency")
        with pytest.raises(ValueError):
            classify_pathway(req)


class TestAorticDissection:
    def test_er_admission_with_surgery_and_radiology_is_A_C_D(self):
        req = IntakeRequest(
            case_id="C-DISSECT-1",
            diagnosis_id="AORTIC_DISSECTION",
            source="emergency",
            is_concurrent_with=["cardiothoracic_surgery"],
        )
        result = classify_pathway(req)
        assert result.pathways == ["A", "C", "D"]
        assert result.urgency == "stat"
        assert "radiology" in result.consulting_departments


class TestHOCMReferral:
    def test_external_referral_is_pathway_B(self):
        req = IntakeRequest(
            case_id="C-HOCM-1",
            diagnosis_id="HOCM_SUSPECTED",
            source="external_referral",
            referring_department="family_medicine",
        )
        result = classify_pathway(req)
        assert "B" in result.pathways
        assert result.urgency == "urgent"
        assert "family_medicine" in result.reason


class TestMISingleDepartment:
    def test_mi_transfer_has_no_outbound_consult(self):
        req = IntakeRequest(case_id="C-MI-1", diagnosis_id="ACUTE_MI", source="emergency")
        result = classify_pathway(req)
        assert result.pathways == ["A"]
        assert result.consulting_departments == []
        assert result.urgency == "stat"


class TestKawasakiOutboundConsult:
    def test_clinic_diagnosis_needs_radiology_consult_pathway_D(self):
        req = IntakeRequest(
            case_id="C-KAWA-1", diagnosis_id="KAWASAKI_DISEASE", source="internal_clinic"
        )
        result = classify_pathway(req)
        assert "D" in result.pathways
        assert "radiology" in result.consulting_departments


class TestConcurrentSharedCare:
    def test_stroke_with_neuro_is_pathway_C(self):
        req = IntakeRequest(
            case_id="C-STROKE-1",
            diagnosis_id="ACUTE_STROKE_HTN_DM",
            source="emergency",
            is_concurrent_with=["neurology"],
        )
        result = classify_pathway(req)
        assert "C" in result.pathways
        assert "A" in result.pathways  # also came via ER

    def test_sle_pericarditis_with_nephro_is_pathway_C(self):
        req = IntakeRequest(
            case_id="C-SLE-1",
            diagnosis_id="SLE_PERICARDITIS",
            source="other_department",
            is_concurrent_with=["nephrology"],
        )
        result = classify_pathway(req)
        assert "C" in result.pathways
        assert "nephrology" in result.consulting_departments


class TestPathwayNeverDropsGuidelineDefault:
    def test_default_pathway_present_even_without_extra_signals(self):
        req = IntakeRequest(
            case_id="C-HOCM-2", diagnosis_id="HOCM_SUSPECTED", source="internal_clinic"
        )
        result = classify_pathway(req)
        assert "B" in result.pathways  # from default_pathway, even though source != external_referral
