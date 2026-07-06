export const patient = {
  id: "CCP-4471",
  initials: "E.G.",
  age: 58,
  sex: "Female",
  ethnicity: "South Asian",
  bmi: 31.2,
  conditions: [
    { name: "Type 2 Diabetes Mellitus", since: "2018", control: "Poor" },
    { name: "Stage 3a Chronic Kidney Disease", since: "2024", control: "Declining" },
    { name: "Hypertension", since: "2019", control: "Uncontrolled" },
    { name: "Dyslipidemia", since: "2020", control: "Partial" },
  ],
  medications: [
    { name: "Metformin", dose: "1000mg BID", adherence: 68 },
    { name: "Losartan", dose: "50mg OD", adherence: 91 },
    { name: "Atorvastatin", dose: "40mg OD", adherence: 84 },
    { name: "Empagliflozin", dose: "10mg OD", adherence: 76 },
  ],
  context: "Missed evening doses ~3x/week due to transport cost. Mild GI upset with current Metformin dose.",
};

export const trends = [
  {
    label: "HbA1c",
    unit: "%",
    values: [7.2, 7.4, 7.6, 7.9, 8.2, 8.6],
    dates: ["Jul '25", "Sep '25", "Nov '25", "Jan '26", "Mar '26", "Jun '26"],
    target: 7.0,
    status: "critical" as const,
    delta: "+1.4",
  },
  {
    label: "Blood Pressure",
    unit: "mmHg",
    values: [138, 142, 146, 150, 154, 158],
    dates: ["Jul '25", "Sep '25", "Nov '25", "Jan '26", "Mar '26", "Jun '26"],
    target: 130,
    status: "critical" as const,
    delta: "+20",
  },
  {
    label: "eGFR",
    unit: "mL/min",
    values: [78, 74, 71, 68, 63, 58],
    dates: ["Jul '25", "Sep '25", "Nov '25", "Jan '26", "Mar '26", "Jun '26"],
    target: 90,
    status: "warning" as const,
    delta: "−20",
    invertGood: true,
  },
  {
    label: "ACR",
    unit: "mg/g",
    values: [18, 22, 27, 34, 48, 61],
    dates: ["Jul '25", "Sep '25", "Nov '25", "Jan '26", "Mar '26", "Jun '26"],
    target: 30,
    status: "critical" as const,
    delta: "+43",
  },
  {
    label: "LDL",
    unit: "mg/dL",
    values: [128, 122, 118, 114, 108, 102],
    dates: ["Jul '25", "Sep '25", "Nov '25", "Jan '26", "Mar '26", "Jun '26"],
    target: 70,
    status: "ok" as const,
    delta: "−26",
  },
];

export const heroMetrics = [
  { label: "Evidence Verified", value: 98, suffix: "%" },
  { label: "Specialist Reviews", value: 3, suffix: "" },
  { label: "Data Completeness", value: 100, suffix: "%" },
  { label: "Review Confidence", value: 94, suffix: "%" },
];

export const archivistFindings = [
  {
    label: "HbA1c trajectory",
    values: "7.2 → 7.9 → 8.6",
    trend: "Sustained rise across 18 months",
    confidence: 98,
    evidence: "Lab CSV · 6 verified samples · PHC Registry",
  },
  {
    label: "eGFR decline",
    values: "78 → 69 → 58",
    trend: "Loss of 20 mL/min — Stage 3a threshold crossed",
    confidence: 96,
    evidence: "Renal Panel · Consecutive quarterly readings",
  },
  {
    label: "Albuminuria progression",
    values: "18 → 34 → 61",
    trend: "Moderately increased — A2 category",
    confidence: 94,
    evidence: "ACR test log · Reference: KDIGO 2024",
  },
];

export const thresholdCrossings = [
  { label: "HbA1c > 8.0%", crossed: "Jan 2026", severity: "critical" },
  { label: "eGFR < 60 mL/min", crossed: "Jun 2026", severity: "critical" },
  { label: "BP > 140/90", crossed: "Nov 2025", severity: "warning" },
  { label: "ACR > 30 mg/g", crossed: "Mar 2026", severity: "warning" },
];

export const missingFlags = [
  { field: "Retinal exam", lastSeen: "Never on file" },
  { field: "Foot exam", lastSeen: "2023 — overdue 18 months" },
];

export const evidenceSources = [
  { name: "PHC Registry", records: 47 },
  { name: "Lab Interface HL7", records: 128 },
  { name: "GP Continuity Notes", records: 9 },
  { name: "Pharmacy Refill Log", records: 22 },
];

export const specialists = [
  {
    id: "endo",
    name: "Endocrinology Agent",
    initials: "EN",
    riskLevel: "High",
    riskColor: "rose",
    findings: [
      "Uncontrolled T2DM with HbA1c 8.6% — glucotoxicity risk",
      "Metformin adherence below therapeutic threshold (68%)",
      "SGLT2i already in regimen — renal-protective, retain",
    ],
    recommendation: "Do not up-titrate Metformin given renal decline. Consider GLP-1 RA with adherence support; evaluate CGM candidacy.",
    confidence: 93,
  },
  {
    id: "cardio",
    name: "Cardiology Agent",
    initials: "CA",
    riskLevel: "High",
    riskColor: "rose",
    findings: [
      "Stage 2 hypertension trending upward across 12 months",
      "Losartan monotherapy insufficient — dual RAAS blockade contraindicated",
      "No LVH on prior ECG; repeat ECG recommended",
    ],
    recommendation: "Add amlodipine 5mg with 4-week BP re-check. Continue statin. Cardiovascular risk requires quarterly review.",
    confidence: 91,
  },
  {
    id: "neph",
    name: "Nephrology Agent",
    initials: "NE",
    riskLevel: "Elevated",
    riskColor: "teal",
    findings: [
      "eGFR 58 with 20 mL/min decline — Stage 3a CKD confirmed",
      "ACR 61 mg/g — moderately increased albuminuria (A2)",
      "Renal-safe medication reconciliation required",
    ],
    recommendation: "Hold any Metformin increase. Maintain Empagliflozin (renal-protective). Refer for renal ultrasound. Repeat eGFR and ACR in 6 weeks.",
    confidence: 95,
  },
];

export const groundingValidation = {
  verified: [
    { label: "HbA1c 8.6% (Jun 2026)", source: "Lab HL7 · Sample #L-2288", by: "Archivist trace" },
    { label: "eGFR 58 mL/min (Jun 2026)", source: "Renal Panel · CKD-EPI 2021", by: "Deterministic recompute" },
    { label: "ACR 61 mg/g (Jun 2026)", source: "Urinalysis · Lab #L-2291", by: "Archivist trace" },
    { label: "Metformin adherence 68%", source: "Pharmacy refill · 12mo window", by: "Deterministic calc" },
  ],
  rejected: [
    { label: "'Recent hypoglycemic episode'", reason: "No supporting glucose reading or clinical note in record" },
    { label: "'Family history of ESRD'", reason: "Not present in intake or continuity notes" },
  ],
};

export const consensus = {
  jointPlan:
    "Prioritize renal preservation while intensifying glycemic control through adherence support rather than dose escalation. Coordinated cardiovascular management with quarterly reassessment.",
  priorityActions: [
    { order: 1, text: "Do NOT increase Metformin (Nephrology overrides Endocrinology titration)", tag: "Renal-safety" },
    { order: 2, text: "Initiate adherence intervention: transport voucher + evening reminder protocol", tag: "Adherence" },
    { order: 3, text: "Add Amlodipine 5mg — re-check BP at 4 weeks", tag: "Cardiovascular" },
    { order: 4, text: "Repeat eGFR + ACR at 6 weeks; renal ultrasound referral", tag: "Monitoring" },
    { order: 5, text: "Schedule retinal and foot exams — overdue", tag: "Preventive" },
  ],
  conflicts: [
    {
      between: "Endocrinology ↔ Nephrology",
      about: "Metformin titration",
      resolution: "Resolved in favor of renal safety — hold titration; pursue adherence-first strategy.",
    },
  ],
};

export const auditTrail = [
  { time: "14:02:11", actor: "System", event: "Board Run Initiated", status: "complete" },
  { time: "14:02:14", actor: "Archivist Agent", event: "Record ingested · 206 data points", status: "complete" },
  { time: "14:02:19", actor: "Archivist Agent", event: "Trend computation · 5 metrics", status: "complete" },
  { time: "14:02:23", actor: "Grounding Layer", event: "Provenance verified · 98% coverage", status: "complete" },
  { time: "14:02:28", actor: "Endocrinology", event: "Analysis delivered · confidence 93%", status: "complete" },
  { time: "14:02:31", actor: "Cardiology", event: "Analysis delivered · confidence 91%", status: "complete" },
  { time: "14:02:34", actor: "Nephrology", event: "Analysis delivered · confidence 95%", status: "complete" },
  { time: "14:02:41", actor: "Consensus Engine", event: "Conflict detected · resolved via renal-safety priority", status: "complete" },
  { time: "14:02:44", actor: "Consensus Engine", event: "Joint plan generated · 5 priority actions", status: "complete" },
  { time: "—", actor: "Physician", event: "Awaiting human review", status: "pending" },
];

export const transparencyGauges = [
  { label: "Confidence Score", value: 94 },
  { label: "Evidence Verification", value: 98 },
  { label: "Data Completeness", value: 100 },
  { label: "Board Response", value: 87, suffix: "s", raw: "32s" },
  { label: "Agent Agreement", value: 82 },
];

export const evidenceChain = [
  { key: "raw", label: "Raw Patient Data", detail: "206 data points ingested" },
  { key: "arch", label: "Archivist Agent", detail: "Trends, thresholds, gaps" },
  { key: "prov", label: "Provenance Layer", detail: "Every value traced to source" },
  { key: "spec", label: "Specialist Agents", detail: "3 domain reviewers" },
  { key: "grd", label: "Grounding Validation", detail: "Verify + reject findings" },
  { key: "cons", label: "Board Consensus", detail: "Joint plan · conflicts resolved" },
  { key: "human", label: "Physician Review", detail: "Human decides · always" },
];

export const DISCLAIMER =
  "The Clinical Board does not diagnose, prescribe, or make final treatment decisions. All recommendations require physician review.";
