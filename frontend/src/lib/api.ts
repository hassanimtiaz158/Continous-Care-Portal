const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ---- Patients ----
export async function fetchPatients() {
  const res = await fetch(`${API_BASE}/api/patients`);
  if (!res.ok) throw new Error("Failed to fetch patients");
  return res.json();
}

export async function createPatient(intake: {
  name: string;
  age: number;
  sex: string;
  chief_complaint: string;
  dx?: string;
  status?: string;
  gp_note?: string;
  meds?: string[];
  bp_sys?: number;
  bp_dia?: number;
  hba1c?: number;
  egfr?: number;
  acr?: number;
  ldl?: number;
  creat?: number;
  k?: number;
  hr?: number;
}) {
  const res = await fetch(`${API_BASE}/api/patients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(intake),
  });
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Patient registry is at capacity.");
  }
  if (!res.ok) throw new Error("Failed to create patient");
  return res.json();
}

export async function fetchPatient(id: string) {
  const res = await fetch(`${API_BASE}/api/patients/${id}`);
  if (!res.ok) throw new Error(`Patient ${id} not found`);
  return res.json();
}

export async function transferToBoard(patientId: string) {
  const res = await fetch(`${API_BASE}/api/patients/${patientId}/transfer-board`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Transfer failed");
  return res.json();
}

export async function askShura(patientId: string, question: string, agent?: string) {
  const res = await fetch(`${API_BASE}/api/board/ask-shura`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patientId, question, agent: agent ?? null }),
  });
  if (!res.ok) throw new Error("Ask Shura failed");
  return res.json();
}

// ---- AI Board ----
export async function runBoard(patientId: string) {
  const res = await fetch(`${API_BASE}/api/board/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patientId }),
  });
  if (!res.ok) throw new Error("Board run failed");
  return res.json();
}

export async function recordDecision(data: {
  session_id: string;
  decision: "approved" | "edited" | "rejected";
  edited_text?: string;
  physician_note?: string;
  physician_name?: string;
}) {
  const res = await fetch(`${API_BASE}/api/board/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Decision recording failed");
  return res.json();
}

export async function fetchAuditTrail(sessionId: string) {
  const res = await fetch(`${API_BASE}/api/board/audit/${sessionId}`);
  if (!res.ok) throw new Error("Audit trail not found");
  return res.json();
}

export async function fetchReviewQueue() {
  const res = await fetch(`${API_BASE}/api/review-queue`);
  if (!res.ok) throw new Error("Review queue unavailable");
  return res.json();
}

export function getExportPdfUrl(sessionId: string) {
  return `${API_BASE}/api/board/export/${sessionId}`;
}

// ---- Marketing/Overview Page Data ----
export async function fetchPatientMetrics(patientId: string) {
  const res = await fetch(`${API_BASE}/api/patients/${patientId}/metrics`);
  if (!res.ok) throw new Error("Metrics not found");
  return res.json();
}

export async function fetchPatientTrends(patientId: string) {
  const res = await fetch(`${API_BASE}/api/patients/${patientId}/trends`);
  if (!res.ok) throw new Error("Trends not found");
  return res.json();
}

export async function fetchArchivistSummary(patientId: string) {
  const res = await fetch(`${API_BASE}/api/patients/${patientId}/archivist`);
  if (!res.ok) throw new Error("Archivist data not found");
  return res.json();
}

export async function fetchSpecialistResults(patientId: string) {
  const res = await fetch(`${API_BASE}/api/patients/${patientId}/specialists`);
  if (!res.ok) throw new Error("Specialist results not found");
  return res.json();
}

// ---- Doctor-to-Doctor Chat ----
export async function fetchChat(patientId: string) {
  const res = await fetch(`${API_BASE}/api/patients/${patientId}/chat`);
  if (!res.ok) throw new Error("Failed to fetch chat");
  return res.json();
}

export async function sendChat(
  patientId: string,
  senderName: string,
  senderRole: string,
  text: string,
) {
  const res = await fetch(`${API_BASE}/api/patients/${patientId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender_name: senderName, sender_role: senderRole, text }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

export async function fetchConsensus(patientId: string) {
  const res = await fetch(`${API_BASE}/api/patients/${patientId}/consensus`);
  if (!res.ok) throw new Error("Consensus not found");
  return res.json();
}

export async function fetchGroundingValidation(patientId: string) {
  const res = await fetch(`${API_BASE}/api/patients/${patientId}/grounding`);
  if (!res.ok) throw new Error("Grounding data not found");
  return res.json();
}

export async function fetchAuditLog(patientId: string) {
  const res = await fetch(`${API_BASE}/api/patients/${patientId}/audit-log`);
  if (!res.ok) throw new Error("Audit log not found");
  return res.json();
}

// ---- Active Care Team (derived server-side from real case data) ----
export type CareTeamAgentStatus = "active" | "pending" | "complete";

export interface CareTeamAgent {
  agent_id: string;
  name: string;
  specialty: string;
  status: CareTeamAgentStatus;
  reason: string;
  last_updated: string;
}

export interface CareTeamResponse {
  case_id: string;
  board_chair_active: boolean;
  agents: CareTeamAgent[];
}

export async function fetchCareTeam(caseId: string): Promise<CareTeamResponse> {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/care-team`);
  if (!res.ok) throw new Error(`Care team for ${caseId} not found`);
  return res.json();
}

// ---- Health ----
export async function healthCheck() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Backend unavailable");
  return res.json();
}
