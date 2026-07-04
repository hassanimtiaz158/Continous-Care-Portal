"""Backend agent orchestrator — TDD §2.16.

This is the ONLY module that calls the Anthropic API.
All LLM communication flows through here; the frontend never touches
an API key or a raw system prompt.

Flow:
  Patient → Archivist (deterministic) → De-identify → Specialist Agents
  (parallel, return_exceptions=True) → Double Grounding Validation →
  Board Chair Agent (synthesis) → Confidence Scoring → response
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import anthropic

from app.agents import AGENTS, CHAIR_SYSTEM, AgentDef
from app.archivist import compute_archivist_summary
from app.audit import create_session
from app.deidentify import ClinicalPayload, deidentify
from app.grounding import validate_findings
from app.models import Patient, StructuredClinicalSummary

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Fallback payloads — patient never disappears from the UI (TDD §2.6)
# ---------------------------------------------------------------------------

_AGENT_FAILURE_PAYLOAD: dict[str, Any] = {
    "risk_level": "watch",
    "findings": [
        {"text": "Agent response unavailable.", "metric": None}
    ],
    "recommendation": "Retry the board. Raw archivist data remains available below.",
    "_fallback": True,
}

_CHAIR_FAILURE_PAYLOAD: dict[str, Any] = {
    "joint_plan": "Board Chair agent unavailable. Specialist opinions are displayed above for manual review.",
    "priority_actions": [
        "Review individual specialist opinions above.",
        "Retry the board for a synthesized plan.",
    ],
    "conflicts": [],
    "_fallback": True,
}

# ---------------------------------------------------------------------------
# Manual review queue — TDD §2.6
# In production this would be a database table; for the hackathon an
# in-memory list suffices.  Each entry is created when an agent fails.
# ---------------------------------------------------------------------------

_manual_review_queue: list[dict[str, Any]] = []


def get_review_queue() -> list[dict[str, Any]]:
    """Return a snapshot of the current manual review queue."""
    return list(_manual_review_queue)


def _enqueue_review(
    patient_id: str,
    agent_key: str,
    error: str,
) -> str:
    """Create a manual review queue entry and return its ID."""
    entry_id = f"REVIEW-{uuid.uuid4().hex[:8]}"
    entry = {
        "id": entry_id,
        "patient_id": patient_id,
        "agent_key": agent_key,
        "error": error,
        "queued_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
    }
    _manual_review_queue.append(entry)
    logger.warning("Manual review queue: %s", entry)
    return entry_id


# ---------------------------------------------------------------------------
# Confidence Scoring — TDD §2.7, ported from ClinicalBoard.jsx §2.7
# ---------------------------------------------------------------------------

def confidence_for(
    archivist: StructuredClinicalSummary,
    risk_level: str,
) -> int:
    """Compute a numeric confidence percentage driven by data completeness.

    Base = 40 + completeness * 0.55, adjusted by risk tier.
    Clamped to [35, 97].
    """
    base = 40 + archivist.completeness * 0.55
    adj = {"urgent": 4, "watch": 0, "stable": 6}.get(risk_level, 0)
    return max(35, min(97, round(base + adj)))


def _annotate_findings_with_confidence(
    result: dict[str, Any],
    archivist: StructuredClinicalSummary,
) -> dict[str, Any]:
    """Add a confidence score to each individual finding in a specialist result.

    Each finding's confidence is driven by:
    - The archivist's data completeness (§2.8)
    - The specialist's overall risk level (§2.7)

    This lets the frontend display confidence per finding without
    recomputing anything client-side.
    """
    risk_level = result.get("risk_level", "watch")
    base_confidence = confidence_for(archivist, risk_level)

    annotated_findings = []
    for finding in result.get("findings", []):
        # Findings that were withheld (grounded=False) don't get confidence
        if finding.get("grounded") is False:
            annotated_findings.append(finding)
            continue
        annotated_findings.append({**finding, "confidence": base_confidence})

    return {**result, "findings": annotated_findings}


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------

def _build_specialist_prompt(
    clinical: ClinicalPayload,
    archivist: StructuredClinicalSummary,
) -> str:
    """Compose the user message sent to each specialist agent."""
    patient_summary = json.dumps(clinical.model_dump(mode="json"), indent=2)
    archivist_brief = json.dumps(
        {k: v.model_dump(mode="json") for k, v in archivist.metrics.items()},
        indent=2,
    )
    return (
        f"De-identified clinical record:\n{patient_summary}\n\n"
        f"Archivist's computed trends (use these numbers — do not recompute):\n"
        f"{archivist_brief}\n\n"
        f"Give your specialist opinion."
    )


def _build_chair_prompt(
    specialist_results: dict[str, dict[str, Any]],
) -> str:
    """Compose the user message for the Board Chair agent.

    Input: patient record summary + JSON of all three specialist results
    (TDD §2.3).
    """
    specialist_summary = json.dumps(
        {
            k: {
                "risk_level": v.get("risk_level"),
                "findings": [
                    f.get("text", "") for f in v.get("findings", [])
                ],
                "recommendation": v.get("recommendation"),
            }
            for k, v in specialist_results.items()
        },
        indent=2,
    )
    return (
        f"Specialist opinions from the clinical board:\n{specialist_summary}\n\n"
        f"Synthesize these into one joint plan for the physician."
    )


# ---------------------------------------------------------------------------
# Agent communication
# ---------------------------------------------------------------------------

def _parse_agent_response(raw: str) -> dict[str, Any]:
    """Strip markdown fences and parse JSON from an agent response."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()
    return json.loads(cleaned)


async def _call_agent(
    client: anthropic.AsyncAnthropic,
    agent: AgentDef,
    user_content: str,
) -> dict[str, Any]:
    """Call a single specialist agent and return its parsed JSON response."""
    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system=agent.system,
        messages=[{"role": "user", "content": user_content}],
    )
    raw = "".join(
        block.text for block in message.content if block.type == "text"
    )
    return _parse_agent_response(raw)


async def _call_chair(
    client: anthropic.AsyncAnthropic,
    user_content: str,
) -> dict[str, Any]:
    """Call the Board Chair agent and return its parsed JSON response."""
    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system=CHAIR_SYSTEM,
        messages=[{"role": "user", "content": user_content}],
    )
    raw = "".join(
        block.text for block in message.content if block.type == "text"
    )
    return _parse_agent_response(raw)


# ---------------------------------------------------------------------------
# Specialist orchestration
# ---------------------------------------------------------------------------

async def run_specialists(
    client: anthropic.AsyncAnthropic,
    clinical: ClinicalPayload,
    archivist: StructuredClinicalSummary,
    patient_id: str,
) -> tuple[dict[str, dict[str, Any]], dict[str, float]]:
    """Call all specialist agents in parallel, then apply Double Grounding.

    Returns (results, per_agent_seconds).
    """
    user_content = _build_specialist_prompt(clinical, archivist)

    async def _safe_call(agent: AgentDef) -> tuple[dict[str, Any], float]:
        t0 = time.perf_counter()
        try:
            result = await _call_agent(client, agent, user_content)
            elapsed = time.perf_counter() - t0
            return result, elapsed
        except Exception as exc:
            elapsed = time.perf_counter() - t0
            logger.exception("Agent %s failed", agent.key)
            _enqueue_review(patient_id, agent.key, str(exc))
            return dict(_AGENT_FAILURE_PAYLOAD), elapsed

    tasks = [_safe_call(agent) for agent in AGENTS]
    raw_pairs = await asyncio.gather(*tasks)

    per_agent_seconds: dict[str, float] = {}
    raw_results = []
    for agent, (raw, elapsed) in zip(AGENTS, raw_pairs):
        per_agent_seconds[agent.key] = round(elapsed, 3)
        raw_results.append(raw)

    # --- Double Grounding Validation (§2.5) ---
    validated: dict[str, dict[str, Any]] = {}
    for agent, raw in zip(AGENTS, raw_results):
        if raw.get("_fallback"):
            validated[agent.key] = {k: v for k, v in raw.items() if not k.startswith("_")}
            continue
        grounded = validate_findings(raw, archivist)
        withheld = grounded.pop("withheld_count", 0)
        if withheld:
            logger.warning(
                "Agent %s: %d finding(s) withheld (unsupported numbers)",
                agent.key,
                withheld,
            )
        validated[agent.key] = grounded

    return validated, per_agent_seconds


# ---------------------------------------------------------------------------
# Board Chair orchestration
# ---------------------------------------------------------------------------

async def run_chair(
    client: anthropic.AsyncAnthropic,
    specialist_results: dict[str, dict[str, Any]],
    patient_id: str,
) -> tuple[dict[str, Any], float]:
    """Call the Board Chair agent for synthesis.

    Returns (result, elapsed_seconds).
    """
    user_content = _build_chair_prompt(specialist_results)
    t0 = time.perf_counter()
    try:
        result = await _call_chair(client, user_content)
        elapsed = time.perf_counter() - t0
        return {k: v for k, v in result.items() if not k.startswith("_")}, elapsed
    except Exception as exc:
        elapsed = time.perf_counter() - t0
        logger.exception("Board Chair agent failed")
        _enqueue_review(patient_id, "chair", str(exc))
        return {k: v for k, v in _CHAIR_FAILURE_PAYLOAD.items() if not k.startswith("_")}, elapsed


# ---------------------------------------------------------------------------
# Top-level orchestrator
# ---------------------------------------------------------------------------

async def run_board(
    patient: Patient,
    client: anthropic.AsyncAnthropic,
) -> dict[str, Any]:
    """Top-level async orchestrator — full TDD §5 response shape.

    1. Deterministic archivist summary (no LLM).
    2. De-identify the patient record.
    3. Fire all specialist agents in parallel.
    4. Apply Double Grounding Validation to each result.
    5. Call Board Chair for synthesis.
    6. Compute confidence scores per specialist.
    7. Return the full validated response payload.
    """
    t_board_start = time.perf_counter()

    t_archivist = time.perf_counter()
    archivist = compute_archivist_summary(patient)
    elapsed_archivist = round(time.perf_counter() - t_archivist, 3)

    clinical = deidentify(patient)
    specialist_results, per_agent_seconds = await run_specialists(client, clinical, archivist, patient.id)

    # --- Board Chair Agent (§2.3) ---
    consensus, elapsed_chair = await run_chair(client, specialist_results, patient.id)

    elapsed_board_total = round(time.perf_counter() - t_board_start, 3)

    # --- Confidence Scoring (§2.7) — per-finding + per-agent ---
    confidence_scores: dict[str, int] = {}
    annotated_specialists: dict[str, dict[str, Any]] = {}
    for key, result in specialist_results.items():
        risk = result.get("risk_level", "watch")
        confidence_scores[key] = confidence_for(archivist, risk)
        annotated_specialists[key] = _annotate_findings_with_confidence(
            result, archivist,
        )

    # --- Strip internal audit fields before sending to client ---
    clean_specialists: dict[str, dict[str, Any]] = {}
    for key, result in annotated_specialists.items():
        clean = {k: v for k, v in result.items() if not k.startswith("_")}
        clean_specialists[key] = clean

    # --- Write audit trail (§2.10) ---
    session_id = create_session(
        patient_id=patient.id,
        specialist_results=specialist_results,
        consensus=consensus,
        data_completeness=archivist.completeness,
        confidence_scores=confidence_scores,
    )

    return {
        "session_id": session_id,
        "patient_id": patient.id,
        "archivist_summary": archivist.model_dump(mode="json"),
        "specialist_results": clean_specialists,
        "consensus": consensus,
        "data_completeness": archivist.completeness,
        "missing_fields": archivist.missing_fields,
        "confidence_scores": confidence_scores,
        "timing": {
            "board_total_seconds": elapsed_board_total,
            "archivist_seconds": elapsed_archivist,
            "specialist_seconds": round(elapsed_board_total - elapsed_archivist - elapsed_chair, 3),
            "chair_seconds": elapsed_chair,
            "per_agent_seconds": per_agent_seconds,
        },
    }
