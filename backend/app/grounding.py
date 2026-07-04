"""Double Grounding Validation — TDD §2.5.

Every numeric claim in a specialist finding is checked against the
Archivist Agent's structured values.  Unsupported findings are
withheld from the API response but logged for audit.

This replaces NLP-guesswork grounding with deterministic, metric-keyed
verification.
"""

from __future__ import annotations

import re
from typing import Any

from app.models import MetricSummary, StructuredClinicalSummary

# Tolerance for floating-point comparison (matches JS prototype)
_TOLERANCE = 0.59

# Match clinical numeric values: integers (≥2 digits) or decimals.
# Requires ≥2 digits or a decimal point to avoid matching stage labels ("Stage 3"),
# version numbers, and stray single digits inside clinical terms.
# Handles BP fractions (158/96) via the "or" branch for slash-separated values.
# Negative lookahead excludes time-period words (months, years, etc.) that aren't clinical values.
DecimalOrLargeInt = r"-?\d+\.\d+|-?\d{2,}"
_TIME_WORDS = r"months?|years?|days?|weeks?|hours?|minutes?|times?"
_NUMBER_RE = re.compile(
    rf"(?:^|(?<=\s)|(?<=/))({DecimalOrLargeInt})(?!\s*(?:{_TIME_WORDS}))(?=[\s/%,;:)\w]|$)"
)


def extract_numbers(text: str) -> list[float]:
    """Extract numeric values from free-text, excluding time-period references."""
    return [float(m) for m in _NUMBER_RE.findall(text)]


def known_values_for_metric(
    metric: str,
    archivist: StructuredClinicalSummary,
) -> list[float]:
    """Return every numeric value the Archivist has for *metric*.

    For BP this includes sys, dia, and their deltas across all timepoints.
    For scalar metrics it includes latest, |delta|, and every history value.
    """
    key = "bp" if metric == "bp" else metric
    m: MetricSummary | None = archivist.metrics.get(key)
    if m is None:
        return []

    if metric == "bp":
        values: list[float] = []
        if m.latest_sys is not None:
            values.append(float(m.latest_sys))
        if m.latest_dia is not None:
            values.append(float(m.latest_dia))
        if m.dia_delta is not None:
            values.append(float(abs(m.dia_delta)))
        values.append(float(abs(m.delta)))  # sys delta
        for h in m.history:
            values.append(float(h["sys"]))
            values.append(float(h["dia"]))
        return values

    values = [m.latest, abs(m.delta)]
    for h in m.history:
        values.append(float(h["v"]))
    return values


def validate_finding(
    finding: dict[str, Any],
    archivist: StructuredClinicalSummary,
) -> dict[str, Any]:
    """Validate a single finding against the Archivist's structured record.

    Returns a new dict with added keys:
    - grounded: bool — True if all numbers in the finding text are supported
    - evidence: dict | None — source values, method, date (if grounded)
    - unsupported_values: list[float] — numbers that could not be verified
    """
    metric = finding.get("metric")
    valid_metrics = set(archivist.metrics.keys())

    if not metric or metric not in valid_metrics:
        return {**finding, "grounded": False, "evidence": None, "unsupported_values": []}

    nums = extract_numbers(finding.get("text", ""))
    known = known_values_for_metric(metric, archivist)

    unsupported = [
        n for n in nums
        if not any(abs(k - n) <= _TOLERANCE for k in known)
    ]

    grounded = len(unsupported) == 0

    m = archivist.metrics["bp" if metric == "bp" else metric]
    if metric == "bp":
        evidence = {
            "source_values": [f"{h['t']}: {h['sys']}/{h['dia']}" for h in m.history],
            "method": "Δ vs. earliest reading",
            "date": "Now",
        }
    else:
        evidence = {
            "source_values": [f"{h['t']}: {h['v']}{m.unit}" for h in m.history],
            "method": "Δ vs. earliest reading",
            "date": "Now",
        }

    return {
        **finding,
        "grounded": grounded,
        "evidence": evidence if grounded else None,
        "unsupported_values": unsupported,
    }


def validate_findings(
    result: dict[str, Any],
    archivist: StructuredClinicalSummary,
) -> dict[str, Any]:
    """Validate all findings in a specialist result.

    Findings that fail grounding are marked withheld (grounded=False)
    and their text is NOT returned to the frontend.  The raw agent
    output is preserved in the audit log (Prompt 7) separately.

    Returns a new dict with validated findings.
    """
    raw_findings = result.get("findings", [])
    validated = [validate_finding(f, archivist) for f in raw_findings]

    # Separate grounded from withheld
    grounded_findings = [f for f in validated if f.get("grounded")]
    withheld_count = len(validated) - len(grounded_findings)

    return {
        **result,
        "findings": grounded_findings,
        "withheld_count": withheld_count,
        "_raw_findings": raw_findings,  # preserved for audit trail, stripped before API response
    }
