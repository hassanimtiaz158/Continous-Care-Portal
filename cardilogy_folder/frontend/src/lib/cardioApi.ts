const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export type Pathway = "A" | "B" | "C" | "D";
export type OrderStatus = "ordered" | "collected" | "resulting" | "resulted";
export type Department =
  | "cardiology"
  | "cardiothoracic_surgery"
  | "radiology"
  | "neurology"
  | "nephrology"
  | "family_medicine"
  | "emergency";

export interface IntakeClassification {
  case_id: string;
  diagnosis_id: string;
  pathways: Pathway[];
  urgency: "stat" | "urgent" | "routine";
  consulting_departments: Department[];
  reason: string;
}

export interface LabOrder {
  id: string;
  case_id: string;
  test: string;
  label: string;
  status: OrderStatus;
  value: number | null;
  critical: boolean;
  critical_note: string | null;
  acknowledged_by: string | null;
  source: "manual_entry" | "ocr" | "lab_interface";
  is_draft: boolean;
  guideline_diagnosis_id: string;
}

export interface ImagingOrder {
  id: string;
  case_id: string;
  study: string;
  label: string;
  status: OrderStatus;
  urgency: string;
  result_summary: string | null;
  is_draft: boolean;
}

export interface OwnershipEvent {
  id: string;
  from_department: Department | null;
  to_department: Department;
  reason: string;
  confirmed_by: string | null;
  at: string;
}

export interface OwnershipState {
  case_id: string;
  current_owner: Department;
  consulting_departments: Department[];
  history: OwnershipEvent[];
}

export async function classifyIntake(payload: {
  case_id: string;
  diagnosis_id: string;
  source: "emergency" | "external_referral" | "internal_clinic" | "other_department";
  referring_department?: string;
  is_concurrent_with?: string[];
}): Promise<IntakeClassification> {
  const res = await fetch(`${API_BASE}/api/cardiology/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to classify intake");
  return res.json();
}

export async function fetchLabOrders(caseId: string): Promise<LabOrder[]> {
  const res = await fetch(`${API_BASE}/api/cardiology/cases/${caseId}/labs`);
  if (!res.ok) throw new Error("Failed to fetch lab orders");
  return res.json();
}

export async function fetchImagingOrders(caseId: string): Promise<ImagingOrder[]> {
  const res = await fetch(`${API_BASE}/api/cardiology/cases/${caseId}/imaging`);
  if (!res.ok) throw new Error("Failed to fetch imaging orders");
  return res.json();
}

export async function fetchOwnership(caseId: string): Promise<OwnershipState> {
  const res = await fetch(`${API_BASE}/api/cardiology/cases/${caseId}/ownership`);
  if (!res.ok) throw new Error("Failed to fetch ownership");
  return res.json();
}

export async function postLabResult(
  caseId: string,
  orderId: string,
  value: number,
  source: "manual_entry" | "ocr" = "manual_entry",
): Promise<LabOrder> {
  const res = await fetch(`${API_BASE}/api/cardiology/cases/${caseId}/labs/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId, value, source }),
  });
  if (!res.ok) throw new Error("Failed to post lab result");
  return res.json();
}

export async function transferOwnership(
  caseId: string,
  toDepartment: Department,
  reason: string,
  confirmedBy: string,
): Promise<OwnershipState> {
  const res = await fetch(`${API_BASE}/api/cardiology/cases/${caseId}/ownership/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to_department: toDepartment, reason, confirmed_by: confirmedBy }),
  });
  if (!res.ok) throw new Error("Failed to transfer ownership");
  return res.json();
}

export async function acknowledgeCriticalValue(
  caseId: string,
  orderId: string,
  physicianName: string,
): Promise<LabOrder> {
  const res = await fetch(
    `${API_BASE}/api/cardiology/cases/${caseId}/labs/${orderId}/acknowledge`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ physician_name: physicianName }),
    },
  );
  if (!res.ok) throw new Error("Failed to acknowledge critical value");
  return res.json();
}
