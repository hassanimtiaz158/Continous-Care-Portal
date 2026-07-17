"""Tests for app.cardio_orders — Cardiology module TDD §2."""

from __future__ import annotations

import pytest

from app.cardio_orders import (
    acknowledge_critical_value,
    advance_status,
    build_imaging_orders,
    build_lab_orders,
    confirm_draft_result,
    record_lab_result,
)


class TestOrderGeneration:
    def test_mi_lab_panel_matches_guideline_count(self):
        orders = build_lab_orders("C-MI-1", "ACUTE_MI")
        tests = {o.test for o in orders}
        assert tests == {
            "troponin_serial",
            "ck_mb",
            "lipid_panel",
            "cbc",
            "coags",
            "renal_function",
        }
        assert all(o.status == "ordered" for o in orders)
        assert all(o.guideline_diagnosis_id == "ACUTE_MI" for o in orders)

    def test_dissection_imaging_is_stat(self):
        orders = build_imaging_orders("C-DISSECT-1", "AORTIC_DISSECTION")
        assert len(orders) == 1
        assert orders[0].urgency == "stat"
        assert orders[0].study == "ct_angiography"

    def test_unknown_diagnosis_raises(self):
        with pytest.raises(ValueError):
            build_lab_orders("C-X", "NOT_REAL")


class TestStatusStateMachine:
    def test_forward_transition_allowed(self):
        assert advance_status("ordered", "collected") == "collected"

    def test_backward_transition_rejected(self):
        with pytest.raises(ValueError):
            advance_status("resulted", "ordered")

    def test_unknown_status_rejected(self):
        with pytest.raises(ValueError):
            advance_status("ordered", "not_a_status")  # type: ignore[arg-type]


class TestCriticalValueFlagging:
    def test_elevated_troponin_flagged_critical(self):
        [order] = [o for o in build_lab_orders("C-MI-1", "ACUTE_MI") if o.test == "troponin_serial"]
        resulted = record_lab_result(order, value=0.12)
        assert resulted.critical is True
        assert resulted.status == "resulted"
        assert resulted.critical_note is not None

    def test_normal_troponin_not_flagged(self):
        [order] = [o for o in build_lab_orders("C-MI-1", "ACUTE_MI") if o.test == "troponin_serial"]
        resulted = record_lab_result(order, value=0.01)
        assert resulted.critical is False
        assert resulted.critical_note is None

    def test_lab_with_no_critical_rule_never_flags(self):
        [order] = [o for o in build_lab_orders("C-MI-1", "ACUTE_MI") if o.test == "cbc"]
        resulted = record_lab_result(order, value=999999)
        assert resulted.critical is False


class TestOCRDraftRule:
    def test_ocr_sourced_result_is_draft(self):
        [order] = [o for o in build_lab_orders("C-KAWA-1", "KAWASAKI_DISEASE") if o.test == "crp"]
        resulted = record_lab_result(order, value=45, source="ocr")
        assert resulted.is_draft is True
        assert resulted.critical is True  # crp > 30

    def test_manual_entry_is_never_draft(self):
        [order] = [o for o in build_lab_orders("C-KAWA-1", "KAWASAKI_DISEASE") if o.test == "crp"]
        resulted = record_lab_result(order, value=45, source="manual_entry")
        assert resulted.is_draft is False

    def test_confirming_a_draft_clears_the_flag(self):
        [order] = [o for o in build_lab_orders("C-KAWA-1", "KAWASAKI_DISEASE") if o.test == "crp"]
        draft = record_lab_result(order, value=45, source="ocr")
        confirmed = confirm_draft_result(draft)
        assert confirmed.is_draft is False
        # value/critical are preserved, only the draft flag changes
        assert confirmed.value == 45
        assert confirmed.critical is True


class TestCriticalValueAcknowledgement:
    def test_critical_result_starts_unacknowledged(self):
        [order] = [o for o in build_lab_orders("C-MI-1", "ACUTE_MI") if o.test == "troponin_serial"]
        resulted = record_lab_result(order, value=0.12)
        assert resulted.acknowledged_by is None

    def test_acknowledging_records_the_physician(self):
        [order] = [o for o in build_lab_orders("C-MI-1", "ACUTE_MI") if o.test == "troponin_serial"]
        resulted = record_lab_result(order, value=0.12)
        acked = acknowledge_critical_value(resulted, "Dr. Rousseau")
        assert acked.acknowledged_by == "Dr. Rousseau"

    def test_cannot_acknowledge_a_non_critical_result(self):
        [order] = [o for o in build_lab_orders("C-MI-1", "ACUTE_MI") if o.test == "troponin_serial"]
        resulted = record_lab_result(order, value=0.01)  # normal, not critical
        with pytest.raises(ValueError):
            acknowledge_critical_value(resulted, "Dr. Rousseau")

    def test_cannot_acknowledge_with_empty_name(self):
        [order] = [o for o in build_lab_orders("C-MI-1", "ACUTE_MI") if o.test == "troponin_serial"]
        resulted = record_lab_result(order, value=0.12)
        with pytest.raises(ValueError):
            acknowledge_critical_value(resulted, "   ")

    def test_new_result_resets_prior_acknowledgement(self):
        [order] = [o for o in build_lab_orders("C-MI-1", "ACUTE_MI") if o.test == "troponin_serial"]
        first = record_lab_result(order, value=0.12)
        acked = acknowledge_critical_value(first, "Dr. Rousseau")
        # a later re-draw comes back in with a new critical value
        second = record_lab_result(acked, value=0.20)
        assert second.acknowledged_by is None
