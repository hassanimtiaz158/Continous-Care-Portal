export type Status = "crit" | "stable" | "review";

export interface PatientData {
  id: string;
  name: string;
  age: number;
  sex: string;
  dx: string;
  status: Status;
  medications?: string[];
  allergies?: string[];
  screening: Record<string, string>;
  glycemic: Record<string, string>;
  vitals: Record<string, string>;
  renal: Record<string, string>;
  cardiac: Record<string, string>;
  ecg: Record<string, string>;
  gpNote: string;
  chiefComplaint: string;
  icd10?: {
    code: string;
    label: string;
    confidence: number;
    alternates: { code: string; label: string; confidence: number }[];
  };
  agents: {
    endo: { rec: string; conf: number; warn?: boolean; conflictNote?: string };
    neph: { rec: string; conf: number; warn?: boolean; conflictNote?: string };
    card: { rec: string; conf: number; warn?: boolean; conflictNote?: string };
  };
  plan: string;
  edu: string;
  caseProgress?: string; // "Intake" | "Physician Review" | "Monitoring"
  registeredAt?: string; // ISO timestamp
}
