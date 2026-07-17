# SHURA Hackathon Demo Script

**Target Duration:** 5–7 Minutes  
**Objective:** Present SHURA not as a typical hackathon prototype, but as a premium, enterprise-ready clinical decision support platform. Focus heavily on transparency, human-in-the-loop oversight, and the unique multi-agent architecture.

---

## 1. The Hook (0:00 - 1:00)

**Screen:** Landing Page (`LandingPage.tsx`)

**Action:** 
Start on the Hero section. Scroll slowly to reveal the "Clinical Workflow" animation sequence.

**Talking Points:**
- "Welcome to SHURA. In clinical settings, black-box AI is dangerous. Doctors don't want an oracle that just gives them an answer; they want an auditable colleague."
- "SHURA is an enterprise-grade Clinical Decision Support platform that transforms raw patient data into structured clinical consensus."
- "Unlike standard LLM wrappers, SHURA utilizes a multi-agent 'Specialist Board' architecture. But crucially: the AI debates, while the human decides. Let me show you."

**Backend/Capabilities Showcased:**
- Visual communication of the data pipeline.

---

## 2. Situational Awareness (1:00 - 2:00)

**Screen:** Clinical Command Center (`ClinicalOverview.tsx`) - Signed in as Specialist.

**Action:**
Log in as an Internal Medicine Specialist. Point out the *Clinical Focus* natural language summary. Scroll the *Priority Queue*.

**Talking Points:**
- "This is the Clinical Command Center. Notice we aren't overwhelming the physician with endless data grids. The UI translates raw metrics into an immediate executive summary: *'3 cases require your immediate sign-off.'*"
- "Down here, our Priority Queue highlights which patients need attention based on the AI's confidence and risk assessment, not just chronological order."

**Backend/Capabilities Showcased:**
- Intelligent data fetching and sorting.
- Real-time status mapping from the backend.

---

## 3. The Clinical Workspace (2:00 - 3:30)

**Screen:** Clinical Case Workspace (`ClinicalWorkspace.tsx`)

**Action:**
Click on a high-priority patient. Observe the split-pane layout.

**Talking Points:**
- "When a doctor opens a case, they enter the Clinical Workspace. We designed this to reduce cognitive load. The patient context is immutably locked on the left."
- "On the right, we see the Clinical Evidence dossier. All raw data ingested from Family Medicine or HL7 feeds is clearly presented. Nothing is hidden."
- *(Point to the Progress Tracker)* "The UI enforces a strict clinical workflow. You can't just skip to the end."

**Backend/Capabilities Showcased:**
- Data aggregation.
- Real-time ICD-10 Agent coding suggestion (demonstrate the auto-coding capability).

---

## 4. The Wow Moment: AI Deliberation (3:30 - 5:00)

**Screen:** Clinical Case Workspace (Scrolling down to `AIBoardSection.tsx`)

**Action:**
Click **"Convene Clinical Board"**. Allow the animation sequence to run.

**Talking Points:**
- "This is where SHURA shines. I'm going to convene the Specialist Board."
- *(As the animation plays)* "Behind the scenes, we aren't just pinging one prompt. We are spinning up distinct AI agents—Endocrinology, Cardiology, Nephrology."
- "They are reading the evidence independently, scoring their confidence based on data completeness, and checking for cross-disciplinary conflicts."
- *(When the board resolves)* "Here is the result. Notice the transparency. If Nephrology and Cardiology disagree on a fluid management plan, SHURA explicitly highlights that conflict for the human doctor to resolve."

**Backend/Capabilities Showcased:**
- Parallel multi-agent execution (`runBoard` API).
- Conflict detection and consensus generation logic.

---

## 5. The Grounding & Sign-Off Ritual (5:00 - 6:30)

**Screen:** Grounding Validation & Physician Decision (`GroundingValidation.tsx` and `PhysicianDecision.tsx`)

**Action:**
Highlight the Grounding section. Then, interact with the Slide-to-Sign mechanism.

**Talking Points:**
- "Before I sign off, I need to know *why* the AI suggested this. SHURA's Grounding Validation links every claim directly back to the raw lab values."
- "Once I'm satisfied, it's time for human sign-off. High-stakes actions require intentional friction."
- *(Perform the slide-to-sign action. Let the success animation play)*
- "This isn't just a UI flourish. The moment I approve, SHURA generates an immutable Audit Ledger. It permanently seals exactly what data was viewed and what the AI recommended at the time of my decision."

**Backend/Capabilities Showcased:**
- The signature interaction state change.
- Database mutation (`recordDecision` API).

---

## 6. Wrap Up (6:30 - 7:00)

**Screen:** Dashboard or Audit Ledger view.

**Action:**
Return to the dashboard. The priority queue updates automatically.

**Talking Points:**
- "The case is now cleared from the queue and pushed back to Family Medicine for implementation."
- "SHURA proves that AI in healthcare doesn't have to be a black box. By combining multi-agent consensus with rigid human oversight and a premium user experience, we build clinical trust."
- "Thank you."

---

## Contingency Plans

**If the Backend / LLM API is slow or down:**
- The frontend UI optimistically handles long loads with elegant spinners. 
- *Talking point fallback:* "We are hitting a heavy live LLM cluster right now, but SHURA's asynchronous architecture means the physician can navigate away to other cases while the board deliberates."
- If the API completely fails, rely on the pre-loaded mock patient data which will still render the UI components flawlessly based on cached board results.
