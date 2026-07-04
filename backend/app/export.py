"""Exportable Review Packet — TDD §2.15.

Generates a PDF containing: patient summary, specialist opinions,
consensus recommendation, physician decision, and audit log.

Uses reportlab (no system-level dependencies).
"""

from __future__ import annotations

import io
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)

# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------

_STYLES = getSampleStyleSheet()

_TITLE = ParagraphStyle(
    "CCP_Title",
    parent=_STYLES["Title"],
    fontSize=16,
    spaceAfter=4 * mm,
    textColor=colors.HexColor("#2B3A55"),
)

_SECTION = ParagraphStyle(
    "CCP_Section",
    parent=_STYLES["Heading2"],
    fontSize=12,
    spaceBefore=6 * mm,
    spaceAfter=2 * mm,
    textColor=colors.HexColor("#2B3A55"),
    borderPadding=(0, 0, 2, 0),
)

_BODY = ParagraphStyle(
    "CCP_Body",
    parent=_STYLES["Normal"],
    fontSize=9.5,
    leading=13,
    spaceAfter=2 * mm,
)

_SMALL = ParagraphStyle(
    "CCP_Small",
    parent=_STYLES["Normal"],
    fontSize=8,
    leading=10,
    textColor=colors.HexColor("#6B6152"),
)

_STAMP = ParagraphStyle(
    "CCP_Stamp",
    parent=_STYLES["Normal"],
    fontSize=11,
    leading=14,
    textColor=colors.HexColor("#2B3A55"),
    alignment=TA_CENTER,
    spaceBefore=4 * mm,
    spaceAfter=4 * mm,
)

_FOOTER = ParagraphStyle(
    "CCP_Footer",
    parent=_STYLES["Normal"],
    fontSize=7.5,
    textColor=colors.HexColor("#9A917E"),
    alignment=TA_CENTER,
)

_RISK_COLORS = {
    "stable": colors.HexColor("#3F6B4F"),
    "watch": colors.HexColor("#B8823C"),
    "urgent": colors.HexColor("#A23B3B"),
}

_AGENT_NAMES = {
    "endocrine": "Endocrinology (Dr. Amara)",
    "cardiology": "Cardiology (Dr. Rousseau)",
    "nephrology": "Nephrology (Dr. Osei)",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _hr() -> HRFlowable:
    return HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#DEDACB"), spaceAfter=3 * mm)


def _risk_label(level: str) -> str:
    return {"stable": "Stable", "watch": "Watch", "urgent": "Urgent"}.get(level, level)


def _build_table(headers: list[str], rows: list[list[str]]) -> Table:
    data = [headers] + rows
    t = Table(data, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2B3A55")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 8.5),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("LEADING", (0, 0), (-1, -1), 11),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#DEDACB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FBFAF5")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def generate_export_pdf(
    *,
    patient_id: str,
    patient_name: str,
    patient_age: int,
    patient_sex: str,
    patient_dx: str,
    patient_meds: list[str],
    archivist_summary: dict[str, Any],
    specialist_results: dict[str, dict[str, Any]],
    consensus: dict[str, Any],
    decision: str | None = None,
    edited_text: str | None = None,
    physician_note: str | None = None,
    physician_name: str | None = None,
    decided_at: str | None = None,
    data_completeness: int | None = None,
    confidence_scores: dict[str, int] | None = None,
    audit_log: list[dict[str, Any]] | None = None,
) -> bytes:
    """Build the review-packet PDF and return raw bytes."""

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        title=f"CCP Review Packet — {patient_id}",
        author="Continuous Care Portal",
    )

    story: list[Any] = []

    # ── Header ──────────────────────────────────────────────────────
    story.append(Paragraph("Continuous Care Portal — Clinical Board Review", _TITLE))
    story.append(_hr())

    # ── Patient Summary ─────────────────────────────────────────────
    story.append(Paragraph("Patient Summary", _SECTION))
    story.append(Paragraph(f"<b>{patient_name}</b> ({patient_id})", _BODY))
    story.append(Paragraph(f"Age: {patient_age} &nbsp;|&nbsp; Sex: {patient_sex}", _BODY))
    story.append(Paragraph(f"Diagnosis: {patient_dx}", _BODY))
    story.append(Paragraph(f"Medications: {' · '.join(patient_meds)}", _BODY))

    # ── Archivist Summary ───────────────────────────────────────────
    story.append(Paragraph("Archivist Summary (deterministic, no model)", _SECTION))

    metrics = archivist_summary.get("metrics", {})
    metric_rows = []
    for key in ("hba1c", "egfr", "acr", "ldl", "bp"):
        m = metrics.get(key)
        if not m:
            continue
        if key == "bp":
            latest = f"{m.get('latestSys', '?')}/{m.get('latestDia', '?')}"
            delta = f"+{m.get('sysDelta', 0)}/{m.get('diaDelta', 0)}"
            history = " → ".join(f"{h['t']}: {h['sys']}/{h['dia']}" for h in m.get("history", []))
        else:
            latest = f"{m.get('latest', '?')}{m.get('unit', '')}"
            delta = f"{m.get('delta', 0):+.1f}"
            history = " → ".join(f"{h['t']}: {h['v']}{m.get('unit', '')}" for h in m.get("history", []))
        metric_rows.append([key.upper(), latest, delta, m.get("trend", ""), history])

    if metric_rows:
        story.append(_build_table(["Metric", "Latest", "Δ", "Trend", "History"], metric_rows))
        story.append(Spacer(1, 3 * mm))

    crossings = archivist_summary.get("threshold_crossings", [])
    if crossings:
        story.append(Paragraph("<b>Threshold Crossings:</b>", _BODY))
        for c in crossings:
            story.append(Paragraph(f"• {c}", _BODY))

    if data_completeness is not None:
        story.append(Paragraph(f"Data completeness: <b>{data_completeness}%</b>", _BODY))

    missing = archivist_summary.get("missing_fields", [])
    if missing:
        story.append(Paragraph(f"Missing fields: {' · '.join(missing)}", _SMALL))

    # ── Specialist Opinions ─────────────────────────────────────────
    story.append(Paragraph("Specialist Opinions", _SECTION))

    for key in ("endocrine", "cardiology", "nephrology"):
        result = specialist_results.get(key, {})
        name = _AGENT_NAMES.get(key, key)
        risk = result.get("risk_level", "stable")
        conf = confidence_scores.get(key) if confidence_scores else None
        status = "responded" if not result.get("failed") else "FAILED"

        header = f"{name} — {_risk_label(risk)} ({status})"
        if conf is not None:
            header += f" · Confidence {conf}%"
        story.append(Paragraph(f"<b>{header}</b>", _BODY))

        findings = result.get("findings", [])
        if findings:
            for f in findings:
                text = f.get("text", "")
                grounded = f.get("grounded")
                if grounded is False:
                    story.append(Paragraph(f"  [WITHHELD] {text}", _SMALL))
                else:
                    story.append(Paragraph(f"  • {text}", _BODY))

        rec = result.get("recommendation", "")
        if rec:
            story.append(Paragraph(f"<i>Recommendation:</i> {rec}", _BODY))

        story.append(Spacer(1, 2 * mm))

    # ── Board Consensus ─────────────────────────────────────────────
    story.append(Paragraph("Board Consensus", _SECTION))

    joint = consensus.get("joint_plan", "")
    if joint:
        story.append(Paragraph(joint, _BODY))

    actions = consensus.get("priority_actions", [])
    if actions:
        story.append(Paragraph("<b>Priority Actions:</b>", _BODY))
        for a in actions:
            story.append(Paragraph(f"• {a}", _BODY))

    conflicts = consensus.get("conflicts", [])
    if conflicts:
        story.append(Paragraph("<b>Cross-specialty Conflicts:</b>", _BODY))
        for c in conflicts:
            story.append(Paragraph(f"⚠ {c}", _BODY))

    # ── Physician Decision ──────────────────────────────────────────
    story.append(Paragraph("Physician Decision", _SECTION))

    if decision:
        stamp = {"approved": "APPROVED", "edited": "APPROVED — EDITED", "rejected": "REJECTED"}.get(decision, decision.upper())
        story.append(Paragraph(f"<b>{stamp}</b>", _STAMP))

        signer = physician_name or "reviewing physician"
        ts = decided_at or ""
        story.append(Paragraph(f"Signed by {signer} · {ts}", _BODY))

        if decision == "edited" and edited_text:
            story.append(Paragraph("<b>Edited plan:</b>", _BODY))
            story.append(Paragraph(edited_text, _BODY))

        if physician_note:
            story.append(Paragraph(f"<b>Note:</b> {physician_note}", _BODY))
    else:
        story.append(Paragraph("<i>No physician decision recorded.</i>", _BODY))

    # ── Audit Log ───────────────────────────────────────────────────
    if audit_log:
        story.append(Paragraph("Audit Log", _SECTION))
        audit_rows = []
        for entry in audit_log:
            ts = entry.get("ts", entry.get("created_at", ""))
            event = entry.get("event", "")
            details = " · ".join(
                f"{k}={v}" for k, v in entry.items() if k not in ("ts", "event", "created_at")
            )
            audit_rows.append([ts, event, details])
        story.append(_build_table(["Timestamp", "Event", "Details"], audit_rows))

    # ── Footer ──────────────────────────────────────────────────────
    story.append(Spacer(1, 8 * mm))
    story.append(_hr())
    story.append(Paragraph(
        "This document is a synthetic demo review packet. No real clinical data. "
        "AI agents surface signals only — a human physician retains final decision authority.",
        _FOOTER,
    ))

    doc.build(story)
    return buf.getvalue()
