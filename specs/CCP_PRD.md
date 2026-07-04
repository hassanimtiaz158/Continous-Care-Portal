# Continuous Care Portal (CCP) — Product Requirements Document

**Version:** 1.0 (Draft for team review)
**Date:** July 2026
**Owner:** Sarah (Clinical Lead & Project Coordinator)
**Team:** Hasan Ali (Backend/AI Integration) · Egharevba Nosakhare "Nosa" (Frontend)
**Context:** USAII Global AI Hackathon 2026 — redesign of EpiLink into CCP
**Deadline:** July 10, 2026

---

## 1. Problem Statement

Primary-care physicians managing patients with chronic conditions (e.g., type 2 diabetes, hypertension, chronic kidney disease) face two recurring problems:

1. **Fragmented specialist input.** A single patient's care touches multiple domains (endocrinology, cardiology, nephrology), but there is no lightweight way to get a synthesized, cross-specialty view before a visit.
2. **Trust gap in AI-assisted clinical tools.** Our prior project, EpiLink, was penalized by judges for weak solution design, a human-review bottleneck, and missing provenance — i.e., the AI made claims without showing where they came from, and there was no clear boundary between AI suggestion and physician decision.

CCP addresses this by building a multi-agent clinical assistant that produces a transparent, evidence-linked, physician-reviewed care recommendation — **not a diagnosis, not an order.**

## 2. Target User

- **Primary:** Primary care / internal medicine physicians managing chronic-disease patients (modeled on Sarah's DES Egypt / PHC context).
- **Secondary (future):** Residents and medical trainees reviewing complex cases.
- **Explicitly out of scope for this hackathon:** Patients themselves; emergency/acute care settings.

## 3. Product Vision

A physician opens a patient's chronic-disease record, clicks "Convene the board," and within seconds receives:

- Three specialist AI opinions (Endocrinology, Cardiology, Nephrology), each grounded in explicit patient data.
- A synthesized joint plan from a "Board Chair" agent that flags cross-specialty conflicts.
- A clear, auditable trail of what data was used, how confident the system is, and what a physician did with the recommendation (approved / edited / rejected).

The system never makes a final clinical decision. It surfaces signals for a human physician who retains full authority — this must be visible everywhere in the product (dashboard, demo, docs).

## 4. Core User Flow

1. Physician opens a patient record (synthetic demo patient for hackathon: 12-month deterioration timeline).
2. Physician clicks "Convene the board."
3. System runs the **Archivist Agent** to deterministically compute trends (HbA1c, BP, eGFR, ACR, LDL) and a data-completeness score from the raw record — no LLM involved in this step.
4. **Three Specialist Agents** (Endocrinology, Cardiology, Nephrology) each receive the structured summary and the de-identified patient record, and return a risk level (stable/watch/urgent), findings, and a recommendation — each grounded in cited data.
5. Every finding passes through **Double Grounding Validation**: referenced values are checked against the structured record; unsupported claims are rejected before display.
6. The **Board Chair Agent** synthesizes the three specialist opinions into one joint plan, explicitly flagging any conflicts between specialties (e.g., a cardiology drug choice that nephrology would need to dose-adjust).
7. Physician reviews the joint plan in the **Human Review Workspace**: sees supporting evidence, specialist opinions, and confidence/data-completeness scores.
8. Physician takes action: **Approve, Edit & sign, or Reject** — optionally with a note explaining the decision.
9. The full session (who ran it, what each agent said, what the physician decided, and why) is written to a **Structured Audit Trail** and can be exported as a PDF clinical review packet.

## 5. Functional Requirements

### 5.1 Must-Have (Phase 1 — Critical for hackathon submission)

| # | Feature | Description |
|---|---------|-------------|
| 1 | Archivist Agent | Deterministic (non-LLM) computation of clinical trends and data completeness before any specialist agent runs. |
| 2 | Evidence & Provenance | Every AI finding displays its source values, trend, calculation method, and date. |
| 3 | Double Grounding Validation | System verifies every referenced clinical value against the patient record; rejects unsupported statements. |
| 4 | Human Review Workspace | Dedicated UI for reviewing board recommendation, evidence, specialist opinions, and taking action (approve/modify/reject/notes/export). |
| 5 | Backend Agent Orchestration | All LLM calls (Anthropic/Kimi) move from frontend to backend (FastAPI/Django) — the current prototype calls the API directly from React, which is a security risk. |

### 5.2 Strongly Recommended (Phase 2)

| # | Feature | Description |
|---|---------|-------------|
| 6 | Confidence Scoring | Numeric confidence percentage per finding, not just Stable/Watch/Urgent labels. |
| 7 | AI Failure Handling | Formal fallback workflow — if an agent or provider fails, the patient stays visible/reviewable; no silent failures. |
| 8 | Deterministic Risk Engine | Rule-based point system (e.g., HbA1c > 8.5 = +3 points) computed in backend code, not left to LLM judgment. |
| 9 | Data Completeness Assessment | Explicit completeness score (e.g., 63% — missing recent HbA1c) that feeds into confidence. |
| 10 | Structured Audit Trail | Every board run logged: timestamp, agents involved, recommendation, physician decision/edits, user responsible. |

### 5.3 Nice-to-Have (Phase 3 — polish)

| # | Feature | Description |
|---|---------|-------------|
| 11 | Exportable Review Packet | PDF export of patient summary, specialist opinions, consensus, decision, and audit log. |
| 12 | Physician Notes & Override Reasoning | Optional free-text note explaining an edit or rejection. |
| 13 | Quantitative Performance Metrics | Measurable stats: board response time, agent response time, agreement rate between specialists. |
| 14 | Enhanced Presentation Layer | Visual polish for demo/judging. |
| 15 | Additional Explainability Features | Further transparency mechanisms as time allows. |

## 6. Non-Functional Requirements

- **De-identification:** Before any LLM call, patient name, ID, and contact details must be stripped; only clinical values, trends, and dates are sent.
- **Non-Goals statement:** The UI, demo, and documentation must state clearly: *"The Clinical Board does not diagnose, prescribe, or make final treatment decisions. All recommendations require physician review."*
- **Reliability:** No agent failure should cause a patient to disappear from the workflow; failed agents fall back to a flagged "watch" state with a manual review queue.
- **Security:** No LLM API calls from the frontend; all calls proxied through backend.
- **Performance:** Board convene-to-result should complete within a reasonable demo timeframe (target: under ~15–20 seconds for all three specialists + chair synthesis).

## 7. Success Metrics

- All Phase 1 items implemented and demonstrable by July 10.
- At least one quantitative metric published (e.g., board response time) — judges in prior rounds consistently rewarded projects with real numbers.
- Zero unverifiable/hallucinated clinical values shown in the demo (validated via Double Grounding).
- Clear, physician-in-the-loop framing visible in every user-facing surface.

## 8. Out of Scope (for this hackathon cycle)

- Real patient data / production PHI handling.
- Integration with live EHR/FHIR systems.
- Diagnostic or prescriptive automation.
- Mobile app (web only).
- Multi-patient population dashboards.

## 9. Open Risks

- **Timeline risk:** Phase 1 (5 items) is ambitious given the remaining days before July 10.
- **Ownership clarity:** Division of backend orchestration work (Hasan) vs. frontend review workspace (Nosa) needs explicit task assignment to avoid overlap.
- **Judging risk:** Missing provenance was a direct criticism of EpiLink; Evidence & Provenance (Phase 1, #2) and Double Grounding (#3) are non-negotiable for this reason.

---

*This document should be read alongside the Technical Design Document (`CCP_TDD.md`) for implementation details.*
