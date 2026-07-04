# Continuous Care Portal (CCP) — Technical Design Document

**Version:** 1.0 (Draft for team review)
**Date:** July 2026
**Authors:** Sarah (architecture/clinical logic) · Hasan Ali (backend/AI integration) · Nosa (frontend)

---

## 1. Architecture Overview

```
Patient Record
    ↓
Archivist Agent (Deterministic — no LLM)
    ↓
Structured Clinical Summary (+ Data Completeness Score)
    ↓
Specialist Agents (Endocrinology / Cardiology / Nephrology — LLM)
    ↓
Double Grounding Validation (reject unsupported findings)
    ↓
Board Chair Agent (synthesis + conflict detection — LLM)
    ↓
Human Review Workspace (Physician: Approve / Edit / Reject)
    ↓
Structured Audit Trail + Exportable Review Packet
```

### 1.1 Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React (single-page, styled inline in current prototype) | Existing prototype: `ClinicalBoard.jsx` |
| Backend | FastAPI or Django | New in this redesign — currently missing; all LLM calls happen client-side in the prototype and must move here |
| LLM Providers | Anthropic (Claude Sonnet), fallback: Kimi/Moonshot | Called via `askAgent(system, userContent)` helper |
| Knowledge base | WHO / MOHP Egypt clinical protocol | Reference only, not embedded in LLM calls |

**Critical fix required:** In the current prototype, `askAgent()` calls `https://api.anthropic.com/v1/messages` directly from the browser. This exposes API keys and system prompts. Phase 1 requires moving this call to the backend, with the frontend calling an internal `/api/board/run` endpoint instead.

## 2. Component Breakdown

### 2.1 Archivist Agent (Phase 1, Priority 1)

**Purpose:** Deterministically compute clinical trends before any LLM sees the data, so agents interpret numbers rather than calculate them (reduces hallucination risk).

**Inputs:** Raw `PATIENT` record (see §5 for schema).

**Outputs (Structured Clinical Summary):**
- HbA1c trend and delta
- Blood pressure (systolic/diastolic) trend and delta
- eGFR trend and decline rate
- ACR progression
- LDL progression
- Data completeness score (%)
- Missing-data flags
- Clinical threshold crossings (e.g., "eGFR crossed CKD stage 3 threshold")

**Implementation note:** Pure backend function, no LLM call. Should be unit-testable independent of any agent.

### 2.2 Specialist Agents

Defined in an `AGENTS` array, each with:

```js
{
  key: "endocrine" | "cardiology" | "nephrology",
  tab: "Dr. Amara" | "Dr. Rousseau" | "Dr. Osei",
  role: string,
  accent: string (hex),
  accentSoft: string (hex),
  system: string // system prompt scoping the agent to one clinical domain
}
```

Each agent's system prompt:
- Scopes it to ONE domain only (e.g., cardiology focuses only on BP/LDL/glycemic burden → CV risk).
- Explicitly states it does not make final decisions — it produces a specialist opinion for physician review.
- Requires a strict JSON response shape (no markdown fences, no preamble):

```json
{"risk_level":"stable|watch|urgent","findings":["short finding 1","short finding 2","short finding 3"],"recommendation":"one or two sentence recommendation"}
```

**Call pattern:** `Promise.allSettled()` across all three agents in parallel. If an agent fails (rejected promise), it is replaced with a fallback object:

```json
{"risk_level":"watch","findings":["Agent response unavailable."],"recommendation":"Retry the board."}
```

This satisfies the AI Failure Handling requirement (§2.6) — the patient never disappears from the UI.

### 2.3 Board Chair Agent (Synthesis)

**Purpose:** Combine the three specialist JSON outputs into one joint plan.

**System prompt responsibilities:**
- Synthesize endocrinology, cardiology, and nephrology opinions into one plan for a patient with type 2 diabetes and hypertension.
- Explicitly flag cross-specialty conflicts (e.g., a cardiology drug choice that nephrology would need to dose-adjust).
- State clearly that the joint plan is a DRAFT for physician approval, edit, or rejection — not a final order.
- Return strict JSON:

```json
{"joint_plan":"2-3 sentence synthesized plan","priority_actions":["action 1","action 2","action 3"],"conflicts":["conflict 1"]}
```

(`conflicts` may be an empty array.)

**Input to Chair:** Patient record + JSON of all three specialist results.

### 2.4 Evidence & Provenance Layer (Phase 1, Priority 2)

Every displayed finding must carry:
- Source values (raw numbers used)
- Trend values
- Date/timeline reference
- Calculation method
- Evidence trace back to the Archivist Agent's output

**Example:** Finding: "Kidney function is worsening" → Evidence: eGFR 78 → 69 → 58, Confidence: High, Source: Archivist Agent.

### 2.5 Double Grounding Validation (Phase 1, Priority 3)

**Purpose:** Prevent hallucinated clinical values from reaching the physician.

**Process (before displaying any finding):**
1. Extract referenced values from the agent's text output.
2. Verify each value exists in the structured patient record (from the Archivist Agent).
3. Reject or flag any unsupported statement.

**Example:** Agent says "HbA1c is 9.2%" but the actual record shows 8.6% → finding is rejected, not shown to physician.

**Implementation note:** This is backend logic that runs between agent response and UI render — likely a validation function that diffs numeric claims against the structured summary object.

### 2.6 AI Failure Handling (Phase 2, Priority 7)

**Trigger conditions:** Anthropic unavailable, Kimi unavailable, request timeout.

**Required behavior:**
- Patient record remains visible and reviewable.
- Physician can still access raw evidence directly (bypassing the failed agent).
- A manual review queue entry is created.
- No patient should ever disappear from the workflow because of an AI failure.

**Current prototype behavior to build on:** `runBoard()` already uses `Promise.allSettled` with a fallback object per agent (see §2.2) — this needs to be extended with the manual review queue and full audit logging.

### 2.7 Confidence Scoring System (Phase 2, Priority 6)

Move from a 3-label system (Stable/Watch/Urgent only) to labels plus a numeric confidence percentage, driven by data completeness.

**Example:**
- Risk: Urgent, Confidence: 92%, Data Completeness: 100%
- Risk: Watch, Confidence: 54%, Reason: Recent renal labs unavailable

### 2.8 Data Completeness Assessment (Phase 2, Priority 9)

Explicitly evaluate and surface missing records (e.g., "Data Completeness: 63% — Missing: Recent HbA1c, Lipid profile, Renal panel"). This score should directly modulate the Confidence Score in §2.7.

### 2.9 Deterministic Risk Engine (Phase 2, Priority 8)

**Purpose:** Move risk-level determination out of LLM judgment and into backend rule-based scoring.

**Example rule set:**
- HbA1c > 8.5 → +3 points
- eGFR decline > 15 → +2 points
- ACR increase > 40 → +2 points
- Thresholds map to Low / Moderate / High risk.

The LLM's role shifts to explaining the deterministic score rather than generating it independently.

### 2.10 Structured Audit Trail (Phase 2, Priority 10)

**Tracked fields per board session:**
- Timestamp
- Which agents responded (and which failed)
- Generated recommendations
- Physician decision (approved/edited/rejected)
- Physician edits (diff or final text)
- User responsible (physician identifier)

**Purpose:** Traceability, compliance, explainability.

### 2.11 De-identification Layer (Phase 1 dependency, cross-cutting)

- Before any LLM call, remove: patient name, patient ID, contact details, other identifiers.
- Send only: clinical values, trends, dates/timestamps.
- **Implementation:** Enforce in backend code (not frontend) — this is a hard gate before the orchestrator constructs any prompt. Given synthetic data is currently used, this must be built as enforced infrastructure now so it's ready if real data is ever introduced.

### 2.12 Explicit Non-Goals Statement (Phase 1 dependency)

Must be displayed in: dashboard, demo, presentation, documentation:

> "The Clinical Board does not diagnose, prescribe, or make final treatment decisions. All recommendations require physician review."

### 2.13 Human Review Workspace (Phase 1, Priority 4)

**UI sections (per current prototype, to be preserved/extended):**
- Board recommendation (joint plan)
- Supporting evidence (trends, calculations, clinical indicators)
- Specialist opinions (Endocrinology, Cardiology, Nephrology tabs)
- Physician actions: Approve / Modify (edit) / Reject / Add notes / Export review record

**Existing prototype behavior:**
- `decision` state: `null | "approved" | "edited" | "rejected"`
- Editing flow: textarea pre-filled with `consensus.joint_plan`; "Save edit & sign" transitions to `"edited"`.
- A visible "stamp" renders APPROVED / APPROVED — EDITED / REJECTED — no orders placed, signed by `{physician name or "reviewing physician"}` + timestamp.
- Conflicts (from Chair output) rendered in a distinct warning box: "⚠ Cross-specialty conflicts flagged."

**Required fix (Phase 3, Priority 13):** Human review should become a feature, not a bottleneck — this likely means streamlining the approve/edit/reject flow so it doesn't block on multiple round trips, and considering batch review of stable-risk patients.

### 2.14 Physician Notes & Override Reasoning (Phase 3, Priority 12)

Optional note field for edits/rejections, e.g.: "Recommendation modified due to recent external imaging results." Improves accountability and audit quality.

### 2.15 Exportable Review Packet (Phase 3, Priority 11)

**Export contents:** Patient summary, specialist opinions, consensus recommendation, physician decision, audit log.
**Formats:** PDF, clinical review report.

### 2.16 Backend Agent Orchestration (Phase 1, Priority 5)

**Current state (prototype):** React → Anthropic API directly.

**Target state:**

```
React Frontend → Django/FastAPI Backend → Agent Orchestrator → Anthropic / Kimi → Results → React Frontend
```

All agent communication should occur server-side. The orchestrator is responsible for: de-identification (§2.11), parallel specialist calls, double grounding (§2.5), and passing validated results to the Board Chair.

## 3. Data Model (from prototype, to formalize in backend)

```js
PATIENT = {
  id: "CCP-014",
  name: "Synthetic Patient — Case CCP-014",
  age: 58,
  sex: "Female",
  dx: "Type 2 Diabetes (6y) · Essential Hypertension (9y)",
  meds: ["Metformin 1000mg BID", "Amlodipine 5mg OD", "Atorvastatin 20mg OD"],
  bp: [{t:"12mo",sys:138,dia:86}, {t:"6mo",sys:146,dia:90}, {t:"Now",sys:158,dia:96}],
  hba1c: [{t:"12mo",v:7.2}, {t:"6mo",v:7.9}, {t:"Now",v:8.6}],
  egfr: [{t:"12mo",v:78}, {t:"6mo",v:69}, {t:"Now",v:58}],
  acr: [{t:"12mo",v:18}, {t:"6mo",v:34}, {t:"Now",v:61}],
  ldl: [{t:"12mo",v:118}, {t:"6mo",v:126}, {t:"Now",v:134}]
}
```

This is fully synthetic (12-month deterioration timeline), containing no real PHI — a deliberate design decision carried over from the CCP planning phase.

## 4. Frontend Components (existing prototype, to extend)

| Component | Responsibility |
|---|---|
| `ClinicalBoard` (main) | Orchestrates state (`status`, `results`, `consensus`, `decision`), header/patient chart, run control, agent tabs, consensus strip, physician decision UI |
| `AgentTab` | Per-specialist card: loading/idle/loaded states, risk badge, flagged findings, recommendation box |
| `TrendCell` | Displays a single vital's label, latest value, unit, and sparkline |
| `Sparkline` | Minimal inline SVG line chart for trend visualization |

**State machine for `status`:** `idle → running → synthesizing → done | error`

## 5. API Contract (to be built — currently missing)

Suggested endpoint for backend orchestration (replacing direct frontend LLM calls):

```
POST /api/board/run
Body: { patient_id: string }
Response: {
  archivist_summary: {...},       // §2.1 output
  specialist_results: {           // §2.2, post double-grounding
    endocrine: {...}, cardiology: {...}, nephrology: {...}
  },
  consensus: {...},                // §2.3 output
  data_completeness: number,
  confidence_scores: {...}
}

POST /api/board/decision
Body: { session_id, decision: "approved"|"edited"|"rejected", edited_text?, physician_note?, physician_name? }
Response: { audit_entry_id }

GET /api/board/export/{session_id}
Response: PDF binary (§2.15)
```

Exact schemas to be finalized by Hasan during backend implementation.

## 6. Implementation Phasing (Priority Ranking)

**Phase 1 — Critical:**
1. Archivist Agent
2. Evidence & Provenance
3. Double Grounding
4. Human Review Workspace
5. Backend Agent Orchestration

**Phase 2 — Strongly Recommended:**
6. Confidence Scores
7. AI Failure Handling
8. Deterministic Risk Engine
9. Data Completeness Scoring
10. Audit Trail

**Phase 3 — Hackathon Polish:**
11. Export Review Packet
12. Physician Notes
13. Performance Metrics
14. Enhanced Presentation Layer
15. Additional Explainability Features

## 7. Known Risks & Open Questions

- **Phase 1 scope vs. timeline:** 5 non-trivial items (including a full backend build-out) before July 10 is ambitious. Recommend Hasan and Sarah confirm daily checkpoints against the task breakdown.
- **Ownership split:** Backend orchestration + de-identification + grounding validation (Hasan) vs. Human Review Workspace UI (Nosa) — needs explicit confirmation to avoid gaps at the API contract boundary.
- **LLM provider fallback:** Kimi is referenced as a fallback provider in the prototype's failure-handling notes but is not yet implemented — needs a decision on whether this is in scope for Phase 1 or deferred.
- **Metric selection (Phase 3):** Team should pick 1–2 metrics (e.g., board response time, evidence verification rate) that are actually measurable with current instrumentation.

---

*This document should be read alongside the Product Requirements Document (`CCP_PRD.md`).*
