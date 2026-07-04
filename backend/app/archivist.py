from __future__ import annotations

from datetime import datetime, timezone

from app.models import MetricSummary, Patient, StructuredClinicalSummary

# ---------------------------------------------------------------------------
# Threshold crossings — clinical red flags detected from the timeline
# ---------------------------------------------------------------------------

_THRESHOLD_CHECKS: list[tuple[str, callable, callable]] = [
    (
        "eGFR crossed CKD Stage 3 threshold (<60 mL/min)",
        lambda p: p.egfr[0].v >= 60,
        lambda p: p.egfr[-1].v < 60,
    ),
    (
        "HbA1c crossed 8.0% (above ADA individualized target range)",
        lambda p: p.hba1c[0].v < 8.0,
        lambda p: p.hba1c[-1].v >= 8.0,
    ),
    (
        "ACR crossed 30 mg/g (moderately increased albuminuria)",
        lambda p: p.acr[0].v <= 30,
        lambda p: p.acr[-1].v > 30,
    ),
]

# ---------------------------------------------------------------------------
# Deterministic Risk Engine (TDD §2.9) — point-based rule system
# ---------------------------------------------------------------------------

_RISK_RULES: list[tuple[str, callable, int]] = [
    ("HbA1c > 8.5 → +3", lambda p, d: p.hba1c[-1].v > 8.5, 3),
    ("eGFR decline > 15 over 12mo → +2", lambda p, d: d["egfr"] < -15, 2),
    ("ACR increase > 40 → +2", lambda p, d: d["acr"] > 40, 2),
    ("Systolic BP increase > 15 → +1", lambda p, d: d["sys"] > 15, 1),
]

# ---------------------------------------------------------------------------
# Data completeness — total expected clinical fields that should be present
# ---------------------------------------------------------------------------

_TOTAL_CLINICAL_CHECKS = 8


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _delta(series: list[float]) -> float:
    return round(series[-1] - series[0], 1)


def _trend(delta: float) -> str:
    if delta > 0.05:
        return "rising"
    if delta < -0.05:
        return "falling"
    return "stable"


def _metric_summary(
    history: list[dict],
    key: str | None,
    unit: str,
) -> MetricSummary:
    """Build a MetricSummary from a time-series list."""
    if key is not None:
        values = [p[key] for p in history]
    else:
        values = [p["v"] for p in history]
    d = _delta(values)
    return MetricSummary(
        latest=values[-1],
        delta=d,
        trend=_trend(d),
        unit=unit,
        history=history,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_archivist_summary(patient: Patient) -> StructuredClinicalSummary:
    """Deterministically compute clinical trends, risk, and completeness.

    This is a pure function — no LLM calls, no I/O.  It mirrors the JS
    ``computeArchivistSummary`` from the ClinicalBoard prototype exactly.
    """
    # --- deltas ----------------------------------------------------------
    hba1c_delta = _delta([p.v for p in patient.hba1c])
    egfr_delta = _delta([p.v for p in patient.egfr])
    acr_delta = _delta([p.v for p in patient.acr])
    ldl_delta = _delta([p.v for p in patient.ldl])
    sys_delta = round(patient.bp[-1].sys - patient.bp[0].sys)
    dia_delta = round(patient.bp[-1].dia - patient.bp[0].dia)

    deltas = {
        "hba1c": hba1c_delta,
        "egfr": egfr_delta,
        "acr": acr_delta,
        "ldl": ldl_delta,
        "sys": sys_delta,
        "dia": dia_delta,
    }

    # --- threshold crossings ---------------------------------------------
    crossings = [
        msg
        for msg, was_ok, is_now in _THRESHOLD_CHECKS
        if was_ok(patient) and is_now(patient)
    ]

    # --- deterministic risk engine ---------------------------------------
    points = 0
    rule_log: list[str] = []
    for desc, check, pts in _RISK_RULES:
        if check(patient, deltas):
            points += pts
            rule_log.append(desc)

    if points >= 5:
        risk_tier = "High"
    elif points >= 2:
        risk_tier = "Moderate"
    else:
        risk_tier = "Low"

    # --- data completeness ------------------------------------------------
    missing = list(patient.missing_fields)
    completeness = round(
        ((_TOTAL_CLINICAL_CHECKS - len(missing)) / _TOTAL_CLINICAL_CHECKS) * 100
    )

    # --- metrics ----------------------------------------------------------
    metrics = {
        "hba1c": _metric_summary(
            [p.model_dump() for p in patient.hba1c], None, "%"
        ),
        "egfr": _metric_summary(
            [p.model_dump() for p in patient.egfr], None, "mL/min"
        ),
        "acr": _metric_summary(
            [p.model_dump() for p in patient.acr], None, "mg/g"
        ),
        "ldl": _metric_summary(
            [p.model_dump() for p in patient.ldl], None, "mg/dL"
        ),
        "bp": MetricSummary(
            latest=patient.bp[-1].sys,
            delta=sys_delta,
            trend=_trend(sys_delta),
            unit="mmHg",
            history=[p.model_dump() for p in patient.bp],
            latest_sys=patient.bp[-1].sys,
            latest_dia=patient.bp[-1].dia,
            dia_delta=dia_delta,
        ),
    }

    return StructuredClinicalSummary(
        generated_at=datetime.now(timezone.utc).isoformat(),
        metrics=metrics,
        threshold_crossings=crossings,
        completeness=completeness,
        missing_fields=missing,
        risk_points=points,
        risk_tier=risk_tier,
        rule_log=rule_log,
    )
