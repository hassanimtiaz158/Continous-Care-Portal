"""Tests for Double Grounding Validation — TDD §2.5.

Verifies that:
- A finding referencing a fabricated number is withheld.
- A finding referencing a correct number passes through with evidence.
"""

from __future__ import annotations

import pytest

from app.archivist import compute_archivist_summary
from app.grounding import (
    extract_numbers,
    known_values_for_metric,
    validate_finding,
    validate_findings,
)
from app.main import CCP014
from app.models import StructuredClinicalSummary


@pytest.fixture(scope="module")
def archivist() -> StructuredClinicalSummary:
    return compute_archivist_summary(CCP014)


# ---------------------------------------------------------------------------
# extract_numbers
# ---------------------------------------------------------------------------


class TestExtractNumbers:
    def test_integers_and_floats(self):
        assert extract_numbers("BP is 158/96 mmHg") == [158.0, 96.0]

    def test_negative_values(self):
        assert extract_numbers("eGFR dropped by -20.0") == [-20.0]

    def test_no_numbers(self):
        assert extract_numbers("no numbers here") == []

    def test_multiple_findings(self):
        nums = extract_numbers("HbA1c 8.6% with delta 1.4")
        assert nums == [8.6, 1.4]


# ---------------------------------------------------------------------------
# known_values_for_metric
# ---------------------------------------------------------------------------


class TestKnownValues:
    def test_hba1c_known_values(self, archivist: StructuredClinicalSummary):
        known = known_values_for_metric("hba1c", archivist)
        # Must include latest (8.6), delta (1.4), and all history values
        assert 8.6 in known
        assert 1.4 in known
        assert 7.2 in known
        assert 7.9 in known

    def test_bp_known_values(self, archivist: StructuredClinicalSummary):
        known = known_values_for_metric("bp", archivist)
        # Must include sys + dia for each timepoint
        assert 158 in known
        assert 96 in known
        assert 138 in known
        assert 86 in known

    def test_unknown_metric_returns_empty(self, archivist: StructuredClinicalSummary):
        assert known_values_for_metric("spo2", archivist) == []


# ---------------------------------------------------------------------------
# validate_finding — the core tests requested
# ---------------------------------------------------------------------------


class TestValidateFinding:
    def test_fabricated_number_is_withheld(self, archivist: StructuredClinicalSummary):
        """A finding claiming HbA1c is 9.2% (fabricated) must be grounded=False."""
        finding = {
            "text": "HbA1c is 9.2% — poorly controlled",
            "metric": "hba1c",
        }
        result = validate_finding(finding, archivist)

        assert result["grounded"] is False
        assert result["evidence"] is None
        assert 9.2 in result["unsupported_values"]

    def test_correct_number_passes_with_evidence(self, archivist: StructuredClinicalSummary):
        """A finding referencing the real HbA1c value (8.6%) must pass with evidence."""
        finding = {
            "text": "HbA1c at 8.6% — above target range",
            "metric": "hba1c",
        }
        result = validate_finding(finding, archivist)

        assert result["grounded"] is True
        assert result["evidence"] is not None
        assert "source_values" in result["evidence"]
        assert len(result["unsupported_values"]) == 0

    def test_correct_egfr_passes(self, archivist: StructuredClinicalSummary):
        """eGFR 58 matches the Archivist's latest — should be grounded."""
        finding = {
            "text": "eGFR 58 mL/min — crossed CKD Stage 3",
            "metric": "egfr",
        }
        result = validate_finding(finding, archivist)
        assert result["grounded"] is True
        assert result["evidence"] is not None

    def test_fabricated_egfr_withheld(self, archivist: StructuredClinicalSummary):
        """eGFR 42 does not exist in the record — must be withheld."""
        finding = {
            "text": "eGFR dropped to 42 mL/min — severe decline",
            "metric": "egfr",
        }
        result = validate_finding(finding, archivist)
        assert result["grounded"] is False
        assert 42.0 in result["unsupported_values"]

    def test_bp_finding_with_real_values(self, archivist: StructuredClinicalSummary):
        """BP finding referencing real sys/dia values should pass."""
        finding = {
            "text": "Systolic BP 158 mmHg, diastolic 96 mmHg",
            "metric": "bp",
        }
        result = validate_finding(finding, archivist)
        assert result["grounded"] is True

    def test_missing_metric_is_withheld(self, archivist: StructuredClinicalSummary):
        """A finding with no metric key cannot be validated — withheld."""
        finding = {"text": "Something about HbA1c 8.6%"}
        result = validate_finding(finding, archivist)
        assert result["grounded"] is False

    def test_invalid_metric_is_withheld(self, archivist: StructuredClinicalSummary):
        """A finding referencing a metric not in the Archivist — withheld."""
        finding = {"text": "SpO2 94%", "metric": "spo2"}
        result = validate_finding(finding, archivist)
        assert result["grounded"] is False

    def test_tolerance_allows_close_values(self, archivist: StructuredClinicalSummary):
        """Values within tolerance (±0.6) of known values should pass."""
        finding = {
            "text": "HbA1c is 8.5% — near threshold",
            "metric": "hba1c",
        }
        result = validate_finding(finding, archivist)
        # 8.5 is within 0.6 of 8.6 (actual latest)
        assert result["grounded"] is True


# ---------------------------------------------------------------------------
# validate_findings (batch)
# ---------------------------------------------------------------------------


class TestValidateFindings:
    def test_mixed_findings_some_withheld(self, archivist: StructuredClinicalSummary):
        """One grounded + one fabricated → only grounded finding returned."""
        specialist_result = {
            "risk_level": "watch",
            "findings": [
                {"text": "HbA1c at 8.6%", "metric": "hba1c"},          # grounded
                {"text": "HbA1c is 11.2% — critical", "metric": "hba1c"},  # fabricated
            ],
            "recommendation": "Adjust therapy.",
        }
        result = validate_findings(specialist_result, archivist)

        assert len(result["findings"]) == 1
        assert result["findings"][0]["text"] == "HbA1c at 8.6%"
        assert result["withheld_count"] == 1

    def test_all_groundings_pass(self, archivist: StructuredClinicalSummary):
        """All findings grounded → none withheld."""
        specialist_result = {
            "risk_level": "watch",
            "findings": [
                {"text": "HbA1c 8.6%", "metric": "hba1c"},
                {"text": "eGFR 58", "metric": "egfr"},
            ],
            "recommendation": "Monitor.",
        }
        result = validate_findings(specialist_result, archivist)
        assert len(result["findings"]) == 2
        assert result["withheld_count"] == 0

    def test_raw_findings_preserved_for_audit(self, archivist: StructuredClinicalSummary):
        """_raw_findings keeps original findings for audit trail."""
        specialist_result = {
            "risk_level": "watch",
            "findings": [
                {"text": "HbA1c 11.2%", "metric": "hba1c"},
            ],
            "recommendation": "Review.",
        }
        result = validate_findings(specialist_result, archivist)
        # The fabricated finding is in _raw_findings but not in findings
        assert len(result["_raw_findings"]) == 1
        assert len(result["findings"]) == 0

    def test_no_findings(self, archivist: StructuredClinicalSummary):
        """Empty findings list → no error."""
        specialist_result = {
            "risk_level": "stable",
            "findings": [],
            "recommendation": "No issues.",
        }
        result = validate_findings(specialist_result, archivist)
        assert result["findings"] == []
        assert result["withheld_count"] == 0
