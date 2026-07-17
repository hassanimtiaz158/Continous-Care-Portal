# Shura — Cardiology Department Module — PRD

**Version:** 1.0 (Draft for team review)
**Owner:** Sarah (Clinical Lead)
**Team:** Hasan Ali (Backend/AI) · Nosa (Frontend)
**Context:** Qwen Cloud Hackathon 2026 — Cardiology is the first department module built on top of the existing Shura cross-audit board.
**Deadline:** July 20, 2026

---

## 1. Problem Statement

The existing Shura board (Rousseau/Osei/Amara + Board Chair) handles a **single, self-contained** chronic-disease case reviewed inside one virtual board. Real hospital cardiology work is not that clean — a case can:

- arrive already carrying a working diagnosis from Emergency,
- arrive as a referral from an external physician who is waiting for a specific test and a reply,
- need to be actively co-managed with another department at the same time (not sequentially),
- or need Cardiology to request a result/opinion from another department.

None of these four patterns exist in the current system. Building the Cardiology module means generalizing the cross-audit board so it can represent **where a case came from, who else is touching it right now, and what has been ordered on its behalf** — without weakening any of the anti-hallucination guarantees already in place.

## 2. Six Reference Cases (drives every design decision below)

| # | Case | Age | Pathway(s) | Partner department(s) |
|---|---|---|---|---|
| 1 | Aortic dissection | 60 | A + C + D | CT Surgery, Radiology |
| 2 | Suspected HOCM | 20 | B | Family Medicine (referring) |
| 3 | Acute MI, heavy smoker | 40 | A | — |
| 4 | Kawasaki disease | 5 | D | Radiology |
| 5 | Stroke + chronic HTN/DM | 50 | C | Neurology |
| 6 | SLE with pericarditis | adult | C | Nephrology |

Case 1 is the acceptance-test case: it must exercise all three non-single-department pathways at once.

## 3. Intake Pathway Taxonomy

- **A — ER Admission/Transfer:** case arrives from Emergency with a working diagnosis.
- **B — Referral-in (external):** an outside physician refers the case and requests a specific test in the same message; Cardiology must reply back with a structured note, not just a result.
- **C — Concurrent Shared Care:** another department is actively co-managing the case right now; ownership of the case can move between departments over time and every move must be logged.
- **D — Outbound Consult:** Cardiology needs a result or opinion from another department (most often Radiology imaging).

A case can carry more than one pathway simultaneously.

## 4. Functional Requirements

1. **Intake Classifier** — deterministically assigns pathway(s) A/B/C/D and an urgency level (`stat`/`urgent`/`routine`) to every new case, from a fixed rule set, not an LLM guess.
2. **Lab Orders Agent** — suggests the lab panel for a diagnosis from a guideline table (not invented by an LLM), tracks each order through `ordered → collected → resulting → resulted`, and flags critical values against explicit numeric thresholds.
3. **Imaging Orders Agent** — same shape as the Lab Orders Agent, for CT/echo/etc., with per-study urgency (e.g. CT angiography for dissection is `stat`).
4. **Care Coordination Agent** — drafts (never auto-sends) a structured reply to an external referring physician (pathway B) or a consult request to another department (pathway D); every draft is grounded only in findings it was actually given.
5. **Ownership State Machine** — tracks which department currently owns a concurrent case (pathway C), with a full, append-only history of transfers and their reasons.
6. **OCR/manual result distinction preserved** — any lab/imaging result entered via mobile OCR is created as `is_draft=true` and requires explicit physician confirmation before it can be treated as trustworthy, exactly like the existing camera-OCR and ambient-recording rules elsewhere in Shura.

## 5. Explicit Non-Goals (this iteration)

- ECG waveform interpretation (flagged as Phase 2 — the `ecg` field already exists on `ShuraPatient`; a dedicated ECG Interpretation Agent, deterministic-rhythm-analysis + LLM narration, is a natural next department capability, but is out of scope for the July 20 deadline).
- Admission/discharge bed-logistics scheduling — this is hospital ADT (Admission-Discharge-Transfer) system territory, not clinical decision support, and is explicitly deprioritized behind Qwen API verification.
- Arrhythmia-specific severity scoring — the guideline table is designed to be extended with new `diagnoses[]` entries (e.g. `heart_failure`, `arrhythmia`) without touching any agent code; adding those entries is a content task, not an engineering task.

## 6. Success Criteria for the Demo

- All six reference cases can be intaken, classified, and produce a correct lab/imaging panel.
- The aortic dissection case visibly shows all three pathways (A/C/D) and an ownership transfer from Emergency → Cardiology → CT Surgery, with the transfer reason preserved.
- At least one critical lab value (e.g. troponin in the MI case) is flagged and visually distinct in the UI.
- At least one OCR-sourced result is shown in `DRAFT` state and requires a confirm action before it stops being a draft.
