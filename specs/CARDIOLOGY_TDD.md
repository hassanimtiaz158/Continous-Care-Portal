# Shura — Cardiology Department Module — Technical Design Document

**Version:** 1.0
**Authors:** Sarah (architecture/clinical logic) · Hasan Ali (backend/AI integration) · Nosa (frontend)
**Companion doc:** `CARDIOLOGY_PRD.md`

---

## 1. Architecture Overview

```
New case arrives
    ↓
Intake Classifier (Deterministic — no LLM)   → pathway(s) A/B/C/D + urgency
    ↓                                    ↓
Lab Orders Agent                Imaging Orders Agent
(Deterministic panel lookup     (Deterministic study lookup
 + critical-value flag)          + urgency tagging)
    ↓                                    ↓
     \___________  merges into  ________/
                     ↓
     Specialist reasoning (Rousseau, existing) + Board Chair (existing)
                     ↓
     Care Coordination Agent (LLM — drafts referral reply /
     consult request; NEVER auto-sends)
                     ↓
     Ownership State Machine (Deterministic — tracks current
     department "owner" of a concurrent case + full history)
                     ↓
     Doctor-to-Doctor Chat (existing) — physician sends the draft
                     ↓
     Archivist (existing) — records full provenance chain
```

The module reuses every existing anti-hallucination mechanism (double-grounding, DRAFT-only OCR results, guideline-id citation) rather than inventing new ones — this is a **generalization** of the existing cross-audit board, not a parallel system.

## 2. New Backend Modules

All added under `backend/app/`, none of the existing files were modified except `main.py` (one import + one `app.include_router(...)` line).

| File | Responsibility | LLM involved? |
|---|---|---|
| `cardiology_guidelines.json` | Diagnosis → labs / imaging / urgency / consulting-departments reference table. Same shape as `clinical_guidelines.json`. | No |
| `cardio_pathway.py` | `classify_pathway()` — deterministic pathway A/B/C/D + urgency assignment. | No |
| `cardio_orders.py` | `build_lab_orders()`, `build_imaging_orders()`, order status state machine, `record_lab_result()` with critical-value flagging, OCR draft rule. | No |
| `cardio_coordination.py` | Ownership state machine (deterministic) + `CARE_COORDINATION_AGENT` `AgentDef` and prompt builder (LLM, follows the exact `AgentDef` pattern from `agents.py`). | Yes, for message drafting only |
| `cardio_routes.py` | `APIRouter` exposing `/api/cardiology/*`, mounted onto the existing FastAPI `app`. | No |

### 2.1 Intake Classifier — `cardio_pathway.py`

Pure function `classify_pathway(IntakeRequest) -> IntakeClassification`. Rules are evaluated in a fixed order and are additive: a case's pathway set is the diagnosis's `default_pathway` (floor) plus any pathway triggered by the actual intake circumstances (`source`, `is_concurrent_with`, guideline `consulting_departments`). No pathway is ever silently dropped.

### 2.2 Lab / Imaging Orders — `cardio_orders.py`

- Order **suggestion** is a table lookup against `cardiology_guidelines.json` — never an LLM decision. This mirrors the existing ICD-10 agent's "deterministic candidate retrieval, LLM only ranks/selects within it" pattern; here there isn't even an LLM ranking step, since the panel is fixed per diagnosis.
- Status transitions (`ordered → collected → resulting → resulted`) are forward-only; `advance_status()` raises on any backward move.
- Critical-value evaluation (`_evaluate_critical_rule`) parses a restricted `"<name> <op> <number>"` grammar from the guideline JSON — this is intentionally NOT a general `eval()`, to keep the rule source auditable and injection-safe even though the JSON is a trusted, checked-in file.
- `record_lab_result(..., source="ocr")` always sets `is_draft=True`. The only way to clear it is `confirm_draft_result()`, called explicitly by a clinician action — nothing does this automatically, matching the DRAFT-only rule used for camera OCR and ambient recording elsewhere in Shura.

### 2.3 Care Coordination Agent — `cardio_coordination.py`

- **Ownership state machine** (`start_ownership`, `transfer_ownership`, `add_consulting_department`) is pure/deterministic and append-only: every `transfer_ownership()` call adds an `OwnershipEvent` to `history`, never overwrites it. This directly answers the "missing document provenance" criticism EpiLink received — the full chain of custody for a concurrent case (e.g. Emergency → Cardiology → CT Surgery) is always reconstructable.
- **Message drafting** (`CARE_COORDINATION_AGENT`) follows the exact `AgentDef` shape used by `PHARMACOLOGY_AGENT`/`ICD10_AGENT` in `agents.py`: raw-JSON-only response contract, explicit instruction not to invent findings, and an explicit `pending_items` field so an incomplete workup is stated honestly rather than the model padding it out with a fabricated conclusion. This agent's output is a **draft** the frontend must route through the existing Doctor-to-Doctor Chat approval step — it is intentionally NOT wired to any auto-send path.

### 2.4 API Surface — `cardio_routes.py`

```
POST /api/cardiology/intake                          -> classify + auto-open ownership + auto-build orders
GET  /api/cardiology/cases/{case_id}/intake
GET  /api/cardiology/cases/{case_id}/labs
POST /api/cardiology/cases/{case_id}/labs/result
POST /api/cardiology/cases/{case_id}/labs/{order_id}/confirm
GET  /api/cardiology/cases/{case_id}/imaging
POST /api/cardiology/cases/{case_id}/imaging/status
GET  /api/cardiology/cases/{case_id}/ownership
POST /api/cardiology/cases/{case_id}/ownership/transfer
```

In-memory stores for the hackathon demo (`_CLASSIFICATIONS`, `_LAB_ORDERS`, `_IMAGING_ORDERS`, `_OWNERSHIP`), same pattern as the existing `_REFERRALS` dict in `main.py`. A production deployment would back these with `audit.db` tables — flagged as a follow-up, not required for the demo.

## 3. Frontend

| File | Responsibility |
|---|---|
| `frontend/src/lib/cardioApi.ts` | Typed fetch wrappers for every `/api/cardiology/*` route, same shape as the existing `lib/api.ts`. |
| `frontend/src/components/dashboard/CardiologyBoard.tsx` | Department board view: pathway astrolabe, lab/imaging order lists, ownership timeline. |

### 3.1 Visual language — the astrolabe motif

The existing Shura visual identity (dark `--void` background, `--gold` accent, celestial-navigation styling from the earlier HTML prototypes) is extended here with a **four-ring astrolabe** (`PathwayAstrolabe` component): each concentric ring is one pathway (A outermost → D innermost). A ring is solid gold when that pathway is active for the case and a faint dashed gold-on-line ring when it isn't. A case like aortic dissection (A+C+D) visibly lights three of the four rings — making the multi-pathway nature of a case legible at a glance instead of buried in a status table, which was the actual design goal of the astrolabe metaphor from the start (an instrument for reading multiple simultaneous positions at once).

All colors/tokens used (`bg-gold`, `text-rose`, `bg-void-3`, `border-line`, `gold-dim`) already exist in `styles.css` / the Tailwind `@theme` block — no new design tokens were introduced.

## 4. Testing Strategy (TDD)

Tests were written alongside each module and run against the full existing suite before and after to guarantee zero regressions.

| Test file | Covers |
|---|---|
| `test_cardio_pathway.py` | All six reference-case diagnoses classify correctly; unknown diagnosis raises; guideline default pathway is never dropped. |
| `test_cardio_orders.py` | Panel generation matches guideline; forward-only status transitions; critical-value math (troponin, CRP); OCR → draft → confirm lifecycle. |
| `test_cardio_coordination.py` | Ownership opens with one history event; transfers append (never overwrite) history; consulting-department list is idempotent and excludes the current owner. |
| `test_cardio_routes.py` | End-to-end: intake → lab result → critical flag → ownership transfer, for the aortic dissection case; 404 handling for unknown cases. |

**Result at last run: 195/195 backend tests passing** (167 pre-existing + 28 new), plus a clean `tsc --noEmit` on the frontend. This does **not** replace the outstanding real-Qwen-API verification identified as the critical path item before July 20 — it is additive scope that does not touch any LLM-calling code path already in place.

## 4.5 Human-in-the-Loop Sign-off (added after review)

Two places in the module could previously act on the AI's output without an explicit, attributed physician decision. Both are now closed:

- **Critical lab values.** `LabOrder.acknowledged_by` is `None` until a physician calls `POST /cases/{case_id}/labs/{order_id}/acknowledge`. `acknowledge_critical_value()` refuses to acknowledge a non-critical result and refuses an empty name. A *new* result on the same order always resets `acknowledged_by` to `None` — a re-drawn troponin needs its own sign-off, an old acknowledgement can never carry forward onto a new value. The frontend surfaces this as a red "Awaiting physician sign-off" state on the lab row until acknowledged.
- **Ownership transfers.** `transfer_ownership()` now requires a non-empty `confirmed_by` and raises otherwise; the route returns `400` for an empty value. Every `OwnershipEvent` in the timeline carries who authorized that specific hand-off, not just that it happened.

Neither control blocks the AI from *proposing* — the Lab Orders Agent still flags critical values immediately, and ownership can still be proposed for transfer — but neither can complete without an attributed human action.

## 5. Extending to a New Diagnosis or a New Department

1. Add a new entry to `cardiology_guidelines.json` → `diagnoses[]` (id, default_pathway, urgency, labs, imaging, consulting_departments). No code change required.
2. If the new diagnosis needs a wholly new department (not Cardiology), copy `cardio_pathway.py` / `cardio_orders.py` / `cardio_routes.py`, point them at a new `<department>_guidelines.json`, and mount the new router with a different URL prefix. The module was deliberately kept dependency-free of anything Cardiology-specific in its code (only the JSON content is Cardiology-specific) to make this a copy-and-repoint operation.
3. ECG interpretation (Phase 2): add a deterministic rhythm-feature extractor (rate/interval/axis — no LLM) feeding a new `AgentDef` for narration only, following the same split used everywhere else in this document.
