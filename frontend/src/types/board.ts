export type WorkflowStage =
  | "intake"
  | "evidence"
  | "board"
  | "deliberation"
  | "consensus"
  | "grounding"
  | "review"
  | "finalized";

export interface SpecialistFinding {
  text: string;
  metric?: string | null;
  confidence?: number;
  grounded?: boolean;
}

export interface SpecialistResult {
  risk_level: string;
  findings: SpecialistFinding[];
  recommendation: string;
  confidence?: number;
  warn?: boolean;
}

export interface BoardResult {
  session_id: string;
  patient_id: string;
  specialist_results: Record<string, SpecialistResult>;
  consensus: {
    joint_plan: string;
    priority_actions: string[];
    conflicts: string[];
  };
  confidence_scores: Record<string, number>;
  data_completeness: number;
}
