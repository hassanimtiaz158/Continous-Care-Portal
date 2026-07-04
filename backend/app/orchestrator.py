"""Backend agent orchestrator — TDD §2.16.

This is the ONLY module that calls the Anthropic API.
All LLM communication flows through here; the frontend never touches
an API key or a raw system prompt.

Flow:
  Patient → Archivist (deterministic) → De-identify → Specialist Agents
  (parallel, return_exceptions=True) → Double Grounding Validation → response
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import anthropic

from app.agents import AGENTS, AgentDef
from app.archivist import compute_archivist_summary
from app.deidentify import ClinicalPayload, deidentify
from app.grounding import validate_findings
from app.models import Patient, StructuredClinicalSummary

logger = logging.getLogger(__name__)

# Fallback when an agent fails — patient never disappears from the UI.
# Marked with _fallback=True so grounding validation skips it.
_AGENT_FAILURE_PAYLOAD: dict[str, Any] = {
    "risk_level": "watch",
    "findings": [
        {"text": "Agent response unavailable.", "metric": None}
    ],
    "recommendation": "Retry the board. Raw archivist data remains available below.",
    "_fallback": True,
}


def _build_prompt(
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


async def run_specialists(
    client: anthropic.AsyncAnthropic,
    clinical: ClinicalPayload,
    archivist: StructuredClinicalSummary,
) -> dict[str, dict[str, Any]]:
    """Call all specialist agents in parallel, then apply Double Grounding.

    Uses asyncio.gather(return_exceptions=True) so one agent failure
    does not kill the others — TDD §2.6 AI Failure Handling.

    After all agents respond, each result passes through grounding
    validation (TDD §2.5): every numeric claim is verified against
    the Archivist's structured values.  Unsupported findings are
    withheld from the API response.

    Returns a dict keyed by agent key, each value is the validated
    specialist result.
    """
    user_content = _build_prompt(clinical, archivist)

    async def _safe_call(agent: AgentDef) -> dict[str, Any]:
        try:
            return await _call_agent(client, agent, user_content)
        except Exception:
            logger.exception("Agent %s failed", agent.key)
            return dict(_AGENT_FAILURE_PAYLOAD)

    tasks = [_safe_call(agent) for agent in AGENTS]
    raw_results = await asyncio.gather(*tasks)

    # --- Double Grounding Validation (§2.5) ---
    validated: dict[str, dict[str, Any]] = {}
    for agent, raw in zip(AGENTS, raw_results):
        # Skip grounding for fallback payloads (system-generated, not LLM output)
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

    return validated


async def run_board(
    patient: Patient,
    client: anthropic.AsyncAnthropic,
) -> dict[str, Any]:
    """Top-level async orchestrator.

    1. Deterministic archivist summary (no LLM).
    2. De-identify the patient record.
    3. Fire all specialist agents in parallel.
    4. Apply Double Grounding Validation to each result.
    5. Return the validated response payload (TDD §5 API contract).

    The caller (FastAPI endpoint) awaits this directly.
    """
    archivist = compute_archivist_summary(patient)
    clinical = deidentify(patient)
    specialist_results = await run_specialists(client, clinical, archivist)

    # Strip internal audit fields before sending to client
    clean_specialists: dict[str, dict[str, Any]] = {}
    for key, result in specialist_results.items():
        clean = {k: v for k, v in result.items() if not k.startswith("_")}
        clean_specialists[key] = clean

    return {
        "patient_id": patient.id,
        "archivist_summary": archivist.model_dump(mode="json"),
        "specialist_results": clean_specialists,
        "data_completeness": archivist.completeness,
    }
