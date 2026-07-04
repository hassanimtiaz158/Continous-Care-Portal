from __future__ import annotations

import pytest

from app.archivist import compute_archivist_summary
from app.models import Patient, TimePoint

# ---------------------------------------------------------------------------
# Fixture — CCP-014 synthetic patient (TDD §3)
# ---------------------------------------------------------------------------

CCP014 = Patient(
    id="CCP-014",
    name="Synthetic Patient — Case CCP-014",
    age=58,
    sex="Female",
    dx="Type 2 Diabetes (6y) · Essential Hypertension (9y)",
    meds=["Metformin 1000mg BID", "Amlodipine 5mg OD", "Atorvastatin 20mg OD"],
    bp=[
        {"t": "12mo", "sys": 138, "dia": 86},
        {"t": "6mo", "sys": 146, "dia": 90},
        {"t": "Now", "sys": 158, "dia": 96},
    ],
    hba1c=[{"t": "12mo", "v": 7.2}, {"t": "6mo", "v": 7.9}, {"t": "Now", "v": 8.6}],
    egfr=[{"t": "12mo", "v": 78}, {"t": "6mo", "v": 69}, {"t": "Now", "v": 58}],
    acr=[{"t": "12mo", "v": 18}, {"t": "6mo", "v": 34}, {"t": "Now", "v": 61}],
    ldl=[{"t": "12mo", "v": 118}, {"t": "6mo", "v": 126}, {"t": "Now", "v": 134}],
    missing_fields=[
        "Recent lipid panel (last drawn 6mo ago)",
        "Urine microalbumin confirmatory test",
    ],
)


# ---------------------------------------------------------------------------
# 1. Normal trend computation
# ---------------------------------------------------------------------------


class TestTrendComputation:
    def test_hba1c_rising(self):
        s = compute_archivist_summary(CCP014)
        m = s.metrics["hba1c"]
        assert m.latest == 8.6
        assert m.delta == 1.4
        assert m.trend == "rising"
        assert m.unit == "%"

    def test_egfr_falling(self):
        s = compute_archivist_summary(CCP014)
        m = s.metrics["egfr"]
        assert m.latest == 58
        assert m.delta == -20.0
        assert m.trend == "falling"
        assert m.unit == "mL/min"

    def test_acr_rising(self):
        s = compute_archivist_summary(CCP014)
        m = s.metrics["acr"]
        assert m.latest == 61
        assert m.delta == 43.0
        assert m.trend == "rising"

    def test_ldl_rising(self):
        s = compute_archivist_summary(CCP014)
        m = s.metrics["ldl"]
        assert m.latest == 134
        assert m.delta == 16.0
        assert m.trend == "rising"

    def test_bp_deltas(self):
        s = compute_archivist_summary(CCP014)
        bp = s.metrics["bp"]
        assert bp.latest == 158
        assert bp.latest_sys == 158
        assert bp.latest_dia == 96
        assert bp.delta == 20  # sys delta
        assert bp.dia_delta == 10
        assert bp.trend == "rising"

    def test_history_preserved(self):
        s = compute_archivist_summary(CCP014)
        assert len(s.metrics["hba1c"].history) == 3
        assert s.metrics["hba1c"].history[0]["t"] == "12mo"

    def test_generated_at_is_iso(self):
        s = compute_archivist_summary(CCP014)
        assert "T" in s.generated_at  # basic ISO format check


# ---------------------------------------------------------------------------
# 2. Threshold crossings
# ---------------------------------------------------------------------------


class TestThresholdCrossings:
    def test_ccp014_has_all_three_crossings(self):
        s = compute_archivist_summary(CCP014)
        assert len(s.threshold_crossings) == 3
        assert any("eGFR" in c for c in s.threshold_crossings)
        assert any("HbA1c" in c for c in s.threshold_crossings)
        assert any("ACR" in c for c in s.threshold_crossings)

    def test_no_crossing_when_values_already_abnormal(self):
        """If the baseline was already above threshold, no crossing is flagged."""
        p = CCP014.model_copy(
            update={
                "egfr": [TimePoint(t="12mo", v=55), TimePoint(t="6mo", v=52), TimePoint(t="Now", v=48)],
            }
        )
        s = compute_archivist_summary(p)
        assert not any("eGFR" in c for c in s.threshold_crossings)

    def test_no_crossing_when_values_stay_normal(self):
        """If the latest value is still within range, no crossing is flagged."""
        p = CCP014.model_copy(
            update={
                "hba1c": [TimePoint(t="12mo", v=6.5), TimePoint(t="6mo", v=7.0), TimePoint(t="Now", v=7.5)],
            }
        )
        s = compute_archivist_summary(p)
        assert not any("HbA1c" in c for c in s.threshold_crossings)


# ---------------------------------------------------------------------------
# 3. Deterministic Risk Engine
# ---------------------------------------------------------------------------


class TestRiskEngine:
    def test_ccp014_is_high_risk(self):
        """CCP-014 hits HbA1c>8.5(+3), eGFR decline>15(+2), ACR>40(+2), sys>15(+1) = 8 pts."""
        s = compute_archivist_summary(CCP014)
        assert s.risk_points == 8
        assert s.risk_tier == "High"
        assert len(s.rule_log) == 4

    def test_low_risk_patient(self):
        """A stable patient with no threshold breaches scores 0 → Low."""
        p = Patient(
            id="LOW-001",
            name="Low Risk",
            age=40,
            sex="Male",
            dx="None",
            meds=[],
            bp=[
                {"t": "12mo", "sys": 120, "dia": 80},
                {"t": "6mo", "sys": 122, "dia": 81},
                {"t": "Now", "sys": 118, "dia": 78},
            ],
            hba1c=[{"t": "12mo", "v": 5.4}, {"t": "6mo", "v": 5.5}, {"t": "Now", "v": 5.6}],
            egfr=[{"t": "12mo", "v": 95}, {"t": "6mo", "v": 93}, {"t": "Now", "v": 92}],
            acr=[{"t": "12mo", "v": 8}, {"t": "6mo", "v": 9}, {"t": "Now", "v": 10}],
            ldl=[{"t": "12mo", "v": 90}, {"t": "6mo", "v": 88}, {"t": "Now", "v": 85}],
        )
        s = compute_archivist_summary(p)
        assert s.risk_points == 0
        assert s.risk_tier == "Low"
        assert s.rule_log == []

    def test_moderate_risk_patient(self):
        """eGFR decline of exactly -16 (just over threshold) → +2 → Moderate."""
        p = Patient(
            id="MOD-001",
            name="Moderate Risk",
            age=60,
            sex="Female",
            dx="T2DM",
            meds=["Metformin"],
            bp=[
                {"t": "12mo", "sys": 130, "dia": 82},
                {"t": "6mo", "sys": 132, "dia": 83},
                {"t": "Now", "sys": 133, "dia": 84},
            ],
            hba1c=[{"t": "12mo", "v": 7.0}, {"t": "6mo", "v": 7.2}, {"t": "Now", "v": 7.4}],
            egfr=[{"t": "12mo", "v": 80}, {"t": "6mo", "v": 70}, {"t": "Now", "v": 64}],
            acr=[{"t": "12mo", "v": 15}, {"t": "6mo", "v": 18}, {"t": "Now", "v": 20}],
            ldl=[{"t": "12mo", "v": 100}, {"t": "6mo", "v": 102}, {"t": "Now", "v": 105}],
        )
        s = compute_archivist_summary(p)
        assert s.risk_points == 2
        assert s.risk_tier == "Moderate"


# ---------------------------------------------------------------------------
# 4. Data completeness
# ---------------------------------------------------------------------------


class TestDataCompleteness:
    def test_ccp014_completeness(self):
        """2 missing fields out of 8 total → 75%."""
        s = compute_archivist_summary(CCP014)
        assert s.completeness == 75
        assert len(s.missing_fields) == 2

    def test_full_completeness(self):
        """No missing fields → 100%."""
        p = CCP014.model_copy(update={"missing_fields": []})
        s = compute_archivist_summary(p)
        assert s.completeness == 100
        assert s.missing_fields == []

    def test_empty_completeness(self):
        """All 8 fields missing → 0%."""
        p = CCP014.model_copy(
            update={
                "missing_fields": [
                    "HbA1c",
                    "eGFR",
                    "ACR",
                    "LDL",
                    "BP",
                    "Medication list",
                    "Diagnosis history",
                    "Lipid panel",
                ]
            }
        )
        s = compute_archivist_summary(p)
        assert s.completeness == 0

    def test_one_missing_field(self):
        """1 missing field out of 8 → 88%."""
        p = CCP014.model_copy(update={"missing_fields": ["Recent HbA1c"]})
        s = compute_archivist_summary(p)
        assert s.completeness == 88


# ---------------------------------------------------------------------------
# 5. Edge cases
# ---------------------------------------------------------------------------


class TestEdgeCases:
    def test_stable_metric(self):
        """All values identical → delta 0, trend 'stable'."""
        p = Patient(
            id="STABLE-001",
            name="Stable",
            age=50,
            sex="Male",
            dx="None",
            meds=[],
            bp=[
                {"t": "12mo", "sys": 120, "dia": 80},
                {"t": "6mo", "sys": 120, "dia": 80},
                {"t": "Now", "sys": 120, "dia": 80},
            ],
            hba1c=[{"t": "12mo", "v": 6.0}, {"t": "6mo", "v": 6.0}, {"t": "Now", "v": 6.0}],
            egfr=[{"t": "12mo", "v": 90}, {"t": "6mo", "v": 90}, {"t": "Now", "v": 90}],
            acr=[{"t": "12mo", "v": 10}, {"t": "6mo", "v": 10}, {"t": "Now", "v": 10}],
            ldl=[{"t": "12mo", "v": 100}, {"t": "6mo", "v": 100}, {"t": "Now", "v": 100}],
        )
        s = compute_archivist_summary(p)
        assert s.metrics["hba1c"].delta == 0.0
        assert s.metrics["hba1c"].trend == "stable"
        assert s.metrics["bp"].delta == 0
        assert s.metrics["bp"].trend == "stable"
        assert s.risk_tier == "Low"
        assert s.threshold_crossings == []

    def test_two_data_points(self):
        """Function works with exactly two timepoints (minimum)."""
        p = Patient(
            id="TWO-001",
            name="Two Points",
            age=45,
            sex="Female",
            dx="HTN",
            meds=["Lisinopril"],
            bp=[
                {"t": "6mo", "sys": 140, "dia": 90},
                {"t": "Now", "sys": 150, "dia": 95},
            ],
            hba1c=[{"t": "6mo", "v": 7.0}, {"t": "Now", "v": 8.8}],
            egfr=[{"t": "6mo", "v": 70}, {"t": "Now", "v": 55}],
            acr=[{"t": "6mo", "v": 25}, {"t": "Now", "v": 50}],
            ldl=[{"t": "6mo", "v": 110}, {"t": "Now", "v": 120}],
        )
        s = compute_archivist_summary(p)
        assert s.metrics["hba1c"].delta == 1.8
        assert s.risk_points > 0
