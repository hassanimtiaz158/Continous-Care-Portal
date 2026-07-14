import React from "react";
import { PatientData } from "../../types/patient";
import { SectionHeader } from "../shared/SectionHeader";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Check, Clock, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClinicalEvidenceProps {
  patient: PatientData;
  onFieldChange: (
    section: "screening" | "glycemic" | "vitals" | "renal" | "cardiac" | "ecg",
    field: string,
    value: string,
  ) => void;
  isLocked?: boolean;
  proveItMode?: boolean;
  hoveredMetric?: string | null;
}

const SECTIONS: {
  id: "screening" | "glycemic" | "vitals" | "renal" | "cardiac" | "ecg";
  label: string;
  fields: { key: string; label: string }[];
}[] = [
  {
    id: "vitals",
    label: "Vital Signs",
    fields: [
      { key: "bp", label: "Blood Pressure" },
      { key: "hr", label: "Heart Rate" },
      { key: "temp", label: "Temperature" },
      { key: "o2", label: "O2 Saturation" },
    ],
  },
  {
    id: "screening",
    label: "Initial Screening",
    fields: [
      { key: "symptoms", label: "Reported Symptoms" },
      { key: "duration", label: "Duration" },
    ],
  },
  {
    id: "glycemic",
    label: "Glycemic Panel",
    fields: [
      { key: "hba1c", label: "HbA1c" },
      { key: "fasting", label: "Fasting Glucose" },
    ],
  },
  {
    id: "renal",
    label: "Renal Function",
    fields: [
      { key: "gfr", label: "eGFR" },
      { key: "creatinine", label: "Creatinine" },
    ],
  },
  {
    id: "cardiac",
    label: "Cardiac Markers",
    fields: [
      { key: "trop", label: "Troponin" },
      { key: "bnp", label: "BNP" },
    ],
  },
  {
    id: "ecg",
    label: "ECG Report",
    fields: [
      { key: "rhythm", label: "Rhythm" },
      { key: "notes", label: "Interpretation" },
    ],
  },
];

export function ClinicalEvidence({
  patient,
  onFieldChange,
  isLocked,
  proveItMode,
  hoveredMetric,
}: ClinicalEvidenceProps) {
  return (
    <div className="flex flex-col gap-px bg-line border-y border-line">
      {SECTIONS.map((section) => {
        const hasData = section.fields.some((f) => patient[section.id]?.[f.key]);

        return (
          <div
            key={section.id}
            className={cn("bg-void-2 flex flex-col md:flex-row", !hasData && "opacity-70")}
          >
            <div className="w-full md:w-48 shrink-0 bg-void border-r border-line p-3 flex flex-col justify-center">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1">
                {section.label}
              </span>
              {hasData ? (
                <div className="flex items-center gap-1 text-teal">
                  <Check className="w-3 h-3" />
                  <span className="text-[9px] font-mono uppercase">Verified</span>
                </div>
              ) : (
                <span className="text-[9px] font-mono uppercase text-muted">Pending</span>
              )}
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-px bg-line">
              {section.fields.map((field) => {
                const val = (patient as any)[section.id]?.[field.key] || "";
                const metricId = `${section.id}.${field.key}`;
                const isHighlighted = proveItMode && hoveredMetric === metricId;
                const isDimmed = proveItMode && hoveredMetric && !isHighlighted;

                return (
                  <div
                    key={field.key}
                    className={cn(
                      "p-3 flex flex-col gap-1.5 transition-all duration-500",
                      isHighlighted
                        ? "bg-gold/10 shadow-[inset_0_0_20px_rgba(201,162,39,0.15)] ring-1 ring-gold/50 relative z-10"
                        : "bg-void-2",
                      isDimmed ? "opacity-20 grayscale" : "",
                    )}
                  >
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-mono uppercase text-muted tracking-wide">
                        {field.label}
                      </label>
                      <div className="flex gap-2 text-[9px] font-mono text-muted/50">
                        {val && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />{" "}
                            {new Date().toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                        {val && (
                          <span className="flex items-center gap-1">
                            <Database className="w-2.5 h-2.5" /> EMR
                          </span>
                        )}
                      </div>
                    </div>
                    {isLocked ? (
                      <div className="text-sm text-cream font-mono py-1">{val || "—"}</div>
                    ) : (
                      <Input
                        value={val}
                        onChange={(e) => onFieldChange(section.id, field.key, e.target.value)}
                        className="h-7 text-sm font-mono bg-void border-line text-cream focus:ring-1 focus:ring-gold/50 px-2"
                        placeholder="—"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
