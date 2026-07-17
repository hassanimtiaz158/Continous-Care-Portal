# Demo Script — Continuous Care Portal

**Duration:** ~5 minutes (fits standard judging slot)

---

## 0. Setup (30s)

**Start the backend:**
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

**Start the frontend:**
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`. The dashboard loads with CCP-014 synthetic patient data.

**Say:**
> "This is a multi-agent clinical assistant for chronic-disease care. All AI runs on the backend — the browser has zero API keys, zero system prompts. The patient is CCP-014, a 58-year-old with 6-year diabetes and 9-year hypertension showing a 12-month deterioration timeline."

Point out the **non-goals banner** at the top:
> "Not a diagnosis. Not an order. A human physician retains full decision authority."

---

## 1. Convene the Board (~60s)

Click **"Convene the board"**.

**While it runs (~3-5s), narrate the pipeline:**
> "Three things happen: First, the Archivist — a deterministic function, no LLM — computes clinical trends, detects threshold crossings, and scores risk. Then three specialist agents (Endocrinology, Cardiology, Nephrology) run in parallel on the backend. Each finding is double-grounded against the patient record. Finally, the Board Chair synthesizes everything into a joint plan."

**When results appear, point out:**
- **Archivist box:** "Data completeness 75% — missing lipid panel and urine microalbumin. Risk tier: High (8 points). Three threshold crossings detected."
- **Specialist tabs:** "Each agent shows its risk level, confidence score, findings with source provenance, and recommendation. Unverifiable findings are withheld — you'll see a striped 'withheld' badge if any were caught."
- **Consensus strip:** "The Chair synthesized a joint plan with priority actions and flagged one cross-specialty conflict."

Point out the **timing display:**
> "Board completed in ~4.8 seconds. Per-agent breakdown shown below."

---

## 2. Review the Evidence (~60s)

**Click into each specialist tab:**

- **Endocrinology (Dr. Amara):** "HbA1c 8.6% — rising. Each finding shows the verified source values and calculation method."
- **Cardiology (Dr. Rousseau):** "BP 158/96 — above goal. LDL 134 — above target."
- **Nephrology (Dr. Osei):** "eGFR 58 — crossed CKD Stage 3. This is flagged as urgent."

**If a finding was withheld** (striped red background):
> "Double Grounding caught a fabricated number. The LLM claimed a value not in the patient record — it's been withheld. The raw output is logged in the audit trail for physician review."

**Show the audit trail:**
Click **"View audit trail"** to show the session event log from the backend.

---

## 3. Physician Decision (~60s)

**Option A — Approve:**
1. Type a physician name (e.g., "Dr. Demo")
2. Click **"Approve"**
3. Point out the stamp: "APPROVED — Signed by Dr. Demo"

**Option B — Edit & Sign:**
1. Click **"Edit plan"** — the textarea becomes editable
2. Modify the plan text (e.g., "Lower metformin dose given renal function.")
3. Add a note: "Adjusted for eGFR decline."
4. Click **"Save edit & sign"**
5. Point out the stamp: "APPROVED — EDITED"

**Option C — Reject:**
1. Add a note: "Patient refused changes."
2. Click **"Reject"**
3. Point out: "REJECTED — no orders placed"

> "Every decision is persisted in the audit trail with timestamp, physician name, and notes."

---

## 4. Export (~30s)

Click **"Export review packet (.json)"**.

**Say:**
> "This generates a PDF containing the full review: patient summary, archivist metrics, specialist opinions, consensus, physician decision, and audit log. All in one downloadable document."

Open the PDF to show the sections.

---

## 5. Security & Architecture (~30s)

**Say:**
> "Three security guarantees:
> 1. **Zero secrets in the browser** — grep the built JS bundle: no API keys, no system prompts.
> 2. **All LLM calls backend-only** — the frontend calls POST /api/board/run, the backend handles the LLM (Alibaba DashScope / Qwen).
> 3. **Double Grounding** — every numeric claim is verified; hallucinated values are withheld and logged."

> "201 automated tests pass, including adversarial tests that simulate LLM hallucination patterns — fabricated HbA1c, fake eGFR, invented BP values — all blocked."

---

## Key Metrics to Mention

| Metric | Value |
|--------|-------|
| Board response time | ~4-5s (end-to-end) |
| Per-agent time | ~1-1.5s each (parallel) |
| Tests passing | 129 |
| Adversarial tests | 12 (all hallucination patterns blocked) |
| Data completeness | 75% (2/8 fields missing) |
| Risk tier | High (8 points) |

---

## Closing

> "The Clinical Board is a transparent, evidence-linked clinical assistant where every AI finding is grounded, every decision is auditable, and a physician is always in the loop. No autonomy. Full provenance."

---

## Troubleshooting

- **Port 8000 busy:** Kill existing process or use `--port 8001` and update `vite.config.js` proxy.
- **No DASHSCOPE_API_KEY:** The board returns 503. Add the international-host key to `backend/.env` (see below).
- **Slow first run:** Qwen cold start ~5-8s. Subsequent runs are faster.

---

## 6. Cardiology Module — 30-Second Walkthrough

> Use this when a judge asks to see the department-by-department rebuild, or
> wants to see a different patient flow than the chronic-disease board.

**Open patient `EG-7701`** (R.T., 63M — suspected aortic dissection). The
right-hand panel auto-renders the **Cardiology Board** because the working DX
matches a cardiology guideline.

**Say (point at the 4-ring astrolabe):**
> "Every cardiology case is classified into one or more of four intake
> pathways — A (ER admission), B (referral-in), C (concurrent shared care),
> D (outbound consult). This patient is A + C + D simultaneously: came in via
> Emergency, is co-managed with Cardiothoracic Surgery, and needs a consult
> from Radiology. The astrolabe lights one ring per active pathway."

**Walk the orders:**
1. **Lab Orders** — "The panel is looked up from a guideline table, never
   invented by an LLM. Post a troponin result of `0.09` → it flags
   **critical** automatically. Click **Acknowledge** to sign off — that's the
   human-in-the-loop control closing the loop."
2. **OCR draft** — "A result scanned from paper is created as **DRAFT** and
   can't enter the record until a clinician clicks **Confirm Result**."
3. **Imaging Orders** — "Advance CT Angiography through
   ordered → collected → resulting → resulted. The state machine is
   forward-only — you can't silently roll a resulted order backwards."
4. **Ownership Chain** — "For concurrent cases, the state machine tracks who
   owns the case with an append-only history. Transfer to Cardiothoracic
   Surgery and you see the full chain of custody with the confirming
   physician attributed."

**Open `EG-7812`** (L.B., 4M — suspected Kawasaki) to show a *different*
pathway mix — **D only** (outbound consult to Radiology for coronary echo),
no ER admission, no concurrent ownership. Proves the classifier isn't
hardcoded to dissection.

**Key Cardiology talking points:**
- Intake classification, order generation, and the ownership state machine are
  **100% deterministic** — no LLM, fully auditable.
- Critical-value thresholds are explicit numeric rules, evaluated by a
  restricted safe comparator (never `eval`).
- In-memory during the demo: cardio state (classifications, orders, ownership)
  resets if the backend restarts — **restart the server fresh before
  presenting**.

---

## Cardiology Test Counts (for reference)

| Suite | Tests |
|-------|-------|
| `test_cardio_pathway.py` | 11 |
| `test_cardio_orders.py` | 13 |
| `test_cardio_coordination.py` | 6 |
| `test_cardio_routes.py` | 4 |
| **Cardiology total** | **34** |
| Full backend suite | 201 |
