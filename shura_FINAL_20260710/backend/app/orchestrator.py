"""Backend agent orchestrator — TDD §2.16.

This is the ONLY module that calls the LLM API (Groq via OpenAI SDK).
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
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from openai import AsyncOpenAI, RateLimitError

from app.agents import AGENTS, CHAIR_SYSTEM, ICD10_AGENT, PHARMACOLOGY_AGENT, AgentDef
from app.archivist import compute_archivist_summary
from app.audit import create_session
from app.deidentify import ClinicalPayload, deidentify
from app.grounding import validate_findings
from app.guidelines import entry_exists, get_guideline_excerpt_for_meds
from app.icd10 import candidates_for_complaint, code_in_candidates, format_candidates_for_prompt
from app.models import Patient, StructuredClinicalSummary

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Retry helper for rate-limit (429) errors — TDD robustness
# ---------------------------------------------------------------------------

MAX_RETRIES = 3
RETRY_BASE_DELAY = 10  # seconds
RETRY_MAX_DELAY = 30   # never wait longer than this


async def _retry_on_rate_limit(coro_factory):
    """Call an async coroutine factory with retry + exponential backoff on 429.

    ``coro_factory`` is a zero-argument callable that returns a fresh
    coroutine each time (so the request can be safely retried).
    """
    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            return await coro_factory()
        except RateLimitError as exc:
            last_exc = exc
            error_body = getattr(exc, "response", None)
            error_json = getattr(error_body, "json", lambda: {})() if error_body else {}
            error_msg = (error_json.get("error", {}) or {}).get("message", "")

            # Daily token-per-day limits cannot be fixed by retrying — fail fast
            if "tokens per day" in error_msg or "TPD" in error_msg:
                logger.error("Daily token limit reached — cannot retry: %s", error_msg)
                raise

            delay = min(RETRY_BASE_DELAY * (2 ** attempt), RETRY_MAX_DELAY)
            retry_header = getattr(error_body, "headers", {}) or {}
            raw_retry = retry_header.get("retry-after")
            if raw_retry:
                try:
                    delay = min(max(delay, float(raw_retry)), RETRY_MAX_DELAY)
                except (ValueError, TypeError):
                    pass
            logger.warning(
                "Rate limited (attempt %d/%d). Retrying in %.0fs …",
                attempt + 1,
                MAX_RETRIES,
                delay,
            )
            await asyncio.sleep(delay)
    raise last_exc  # type: ignore[misc]

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


def _build_pharmacology_prompt(
    clinical: ClinicalPayload,
    archivist: StructuredClinicalSummary,
) -> str:
    """Compose the user message sent to the Pharmacology agent.

    Includes the same de-identified record + archivist trends as the other
    specialists, plus a guideline excerpt filtered to this patient's active
    medications (TDD §2.7 Guidelines Agent grounding).
    """
    patient_summary = json.dumps(clinical.model_dump(mode="json"), indent=2)
    archivist_brief = json.dumps(
        {k: v.model_dump(mode="json") for k, v in archivist.metrics.items()},
        indent=2,
    )
    guideline_excerpt = get_guideline_excerpt_for_meds(clinical.meds)
    return (
        f"De-identified clinical record:\n{patient_summary}\n\n"
        f"Archivist's computed trends (use these numbers — do not recompute):\n"
        f"{archivist_brief}\n\n"
        f"Guideline entries relevant to this patient's medications "
        f"(cite the exact id in brackets for any finding):\n{guideline_excerpt}\n\n"
        f"Give your pharmacology safety opinion."
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

# ---------------------------------------------------------------------------

def _parse_agent_response(raw: str) -> dict[str, Any]:
    """Strip markdown fences and parse JSON from an agent response.

    LLMs (especially open-source) often produce slightly malformed JSON:
    trailing commas, unescaped newlines in strings, or extra text around
    the JSON. This parser handles all of those.
    """
    cleaned = raw.strip()

    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    if "```" in cleaned:
        # Extract content between first pair of fences
        match = re.search(r"```(?:json)?\s*\n?(.*?)```", cleaned, re.DOTALL)
        if match:
            cleaned = match.group(1).strip()

    # If still not valid, try to find the outermost { ... } block
    if not cleaned.startswith("{"):
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end > start:
            cleaned = cleaned[start : end + 1]

    # Fix trailing commas before } or ]
    cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)

    # Fix unescaped newlines inside string values
    # Match content between quotes and fix newlines
    def _fix_newlines(m: re.Match) -> str:
        return m.group(0).replace("\n", "\\n")

    cleaned = re.sub(r'"[^"]*"', _fix_newlines, cleaned)

    return json.loads(cleaned)


async def _call_agent(
    client: AsyncOpenAI,
    agent: AgentDef,
    user_content: str,
) -> dict[str, Any]:
    """Call a single specialist agent and return its parsed JSON response."""
    async def _do_call():
        response = await client.chat.completions.create(
            model=agent.model,
            max_tokens=500,
            messages=[
                {"role": "system", "content": agent.system},
                {"role": "user", "content": user_content},
            ],
        )
        raw = (response.choices[0].message.content or "") if response.choices else ""
        return _parse_agent_response(raw)

    return await _retry_on_rate_limit(_do_call)


CHAIR_MODEL = "qwen-plus"


async def _call_chair(
    client: AsyncOpenAI,
    user_content: str,
) -> dict[str, Any]:
    """Call the Board Chair agent and return its parsed JSON response."""
    async def _do_call():
        response = await client.chat.completions.create(
            model=CHAIR_MODEL,
            max_tokens=500,
            messages=[
                {"role": "system", "content": CHAIR_SYSTEM},
                {"role": "user", "content": user_content},
            ],
        )
        raw = (response.choices[0].message.content or "") if response.choices else ""
        return _parse_agent_response(raw)

    return await _retry_on_rate_limit(_do_call)


# ---------------------------------------------------------------------------
# Specialist orchestration
# ---------------------------------------------------------------------------

async def run_specialists(
    client: AsyncOpenAI,
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
# Pharmacology Agent orchestration — TDD §2.16 pharmacology extension.
#
# Runs AFTER the Board Chair, as its own step, so the existing 3-specialist
# call order (used by the mocked test suite) never changes.
# ---------------------------------------------------------------------------

_PHARMACOLOGY_FAILURE_PAYLOAD: dict[str, Any] = {
    "risk_level": "watch",
    "findings": [
        {"text": "Pharmacology agent response unavailable.", "metric": None, "guideline": None}
    ],
    "recommendation": "Retry the board. Manual medication review recommended.",
    "_fallback": True,
}


def _validate_pharmacology_findings(
    result: dict[str, Any],
    archivist: StructuredClinicalSummary,
) -> dict[str, Any]:
    """Double-ground pharmacology findings: numeric grounding + guideline citation.

    A finding is only kept if BOTH:
    1. Its numeric claim is supported by the Archivist's structured record
       (same check as the other specialists, via ``validate_findings``).
    2. Its ``guideline`` field cites a real entry in clinical_guidelines.json —
       a hallucinated guideline id is treated exactly like an unsupported
       number and the finding is withheld.
    """
    grounded_result = validate_findings(result, archivist)
    kept: list[dict[str, Any]] = []
    extra_withheld = 0
    for finding in grounded_result["findings"]:
        if not entry_exists(finding.get("guideline")):
            extra_withheld += 1
            continue
        kept.append(finding)

    return {
        **grounded_result,
        "findings": kept,
        "withheld_count": grounded_result.get("withheld_count", 0) + extra_withheld,
    }


async def run_pharmacology(
    client: AsyncOpenAI,
    clinical: ClinicalPayload,
    archivist: StructuredClinicalSummary,
    patient_id: str,
) -> tuple[dict[str, Any], float]:
    """Call the Pharmacology agent and return its validated result.

    Returns (result, elapsed_seconds). Never raises — falls back to
    ``_PHARMACOLOGY_FAILURE_PAYLOAD`` and enqueues a manual review entry
    on any error, matching the resilience pattern used for the other
    specialist agents (TDD §2.6).
    """
    user_content = _build_pharmacology_prompt(clinical, archivist)
    t0 = time.perf_counter()
    try:
        raw = await _call_agent(client, PHARMACOLOGY_AGENT, user_content)
        elapsed = time.perf_counter() - t0
        validated = _validate_pharmacology_findings(raw, archivist)
        withheld = validated.pop("withheld_count", 0)
        if withheld:
            logger.warning(
                "Pharmacology agent: %d finding(s) withheld (unsupported number or "
                "uncited/invalid guideline)",
                withheld,
            )
        return validated, elapsed
    except Exception as exc:
        elapsed = time.perf_counter() - t0
        logger.exception("Pharmacology agent failed")
        _enqueue_review(patient_id, "pharmacology", str(exc))
        fallback = {k: v for k, v in _PHARMACOLOGY_FAILURE_PAYLOAD.items() if not k.startswith("_")}
        return fallback, elapsed


# ---------------------------------------------------------------------------
# ICD-10 Coding Agent orchestration — intake-time, complaint -> code.
#
# Deliberately independent of the specialist/pharmacology/chair flow: it
# operates on a chief-complaint string, not a Patient record, and can be
# called standalone from a Family Medicine intake screen.
# ---------------------------------------------------------------------------

_ICD10_FAILURE_PAYLOAD: dict[str, Any] = {
    "ranked": [],
    "_fallback": True,
}


def _build_icd10_prompt(chief_complaint: str, candidates: list[dict[str, Any]]) -> str:
    """Compose the user message sent to the ICD-10 Coding agent."""
    candidate_block = format_candidates_for_prompt(candidates)
    return (
        f"Chief complaint:\n{chief_complaint}\n\n"
        f"Candidate ICD-10 codes (choose ONLY from this list):\n{candidate_block}\n\n"
        f"Rank these candidates for this complaint."
    )


async def run_icd10_coding(
    client: AsyncOpenAI,
    chief_complaint: str,
    patient_id: str = "unknown",
) -> tuple[dict[str, Any], float]:
    """Call the ICD-10 Coding agent and return a validated, ranked result.

    Flow: deterministic keyword retrieval narrows the field to a handful
    of real candidates -> the agent only ranks/scores within that list ->
    any code the agent returns that ISN'T one of the offered candidates is
    dropped (same anti-hallucination pattern as the Pharmacology agent's
    guideline citation check).

    Returns ({"candidates": [...], "ranked": [...]}, elapsed_seconds).
    Never raises.
    """
    t0 = time.perf_counter()
    candidates = candidates_for_complaint(chief_complaint)
    user_content = _build_icd10_prompt(chief_complaint, candidates)
    try:
        raw = await _call_agent(client, ICD10_AGENT, user_content)
        elapsed = time.perf_counter() - t0
        ranked_raw = raw.get("ranked", [])
        kept = []
        withheld = 0
        for item in ranked_raw:
            code = item.get("code")
            if not code_in_candidates(code, candidates):
                withheld += 1
                continue
            entry = next(c for c in candidates if c["code"] == code)
            kept.append({
                "code": code,
                "label": entry["label"],
                "confidence": item.get("confidence", 0),
            })
        if withheld:
            logger.warning(
                "ICD-10 agent: %d ranked code(s) withheld (not in offered candidate list)",
                withheld,
            )
        return {
            "candidates": [{"code": c["code"], "label": c["label"]} for c in candidates],
            "ranked": kept,
        }, elapsed
    except Exception as exc:
        elapsed = time.perf_counter() - t0
        logger.exception("ICD-10 Coding agent failed")
        _enqueue_review(patient_id, "icd10_coding", str(exc))
        return {
            "candidates": [{"code": c["code"], "label": c["label"]} for c in candidates],
            "ranked": [],
        }, elapsed




# ---------------------------------------------------------------------------
# Board Chair orchestration
# ---------------------------------------------------------------------------

async def run_chair(
    client: AsyncOpenAI,
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
    client: AsyncOpenAI,
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

    # --- Pharmacology Agent (guideline-grounded drug safety check) ---
    pharmacology_result, elapsed_pharmacology = await run_pharmacology(
        client, clinical, archivist, patient.id,
    )
    pharmacology_confidence = confidence_for(
        archivist, pharmacology_result.get("risk_level", "watch"),
    )
    clean_pharmacology = {
        k: v for k, v in pharmacology_result.items() if not k.startswith("_")
    }

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
        "pharmacology_result": clean_pharmacology,
        "pharmacology_confidence": pharmacology_confidence,
        "data_completeness": archivist.completeness,
        "missing_fields": archivist.missing_fields,
        "confidence_scores": confidence_scores,
        "timing": {
            "board_total_seconds": elapsed_board_total,
            "archivist_seconds": elapsed_archivist,
            "specialist_seconds": round(elapsed_board_total - elapsed_archivist - elapsed_chair, 3),
            "chair_seconds": elapsed_chair,
            "pharmacology_seconds": round(elapsed_pharmacology, 3),
            "per_agent_seconds": per_agent_seconds,
        },
    }
