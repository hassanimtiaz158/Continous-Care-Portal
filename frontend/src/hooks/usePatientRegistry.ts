import { useState, useCallback, useEffect } from "react";
import { fetchPatients, fetchPatient, createPatient } from "../lib/api";
import { PatientData } from "../types/patient";

export function usePatientRegistry(openPatient: (p: PatientData) => void) {
  const [allPatients, setAllPatients] = useState<PatientData[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [intakeSubmitting, setIntakeSubmitting] = useState(false);

  useEffect(() => {
    setPatientsLoading(true);
    setPatientsError(false);
    fetchPatients()
      .then(
        async (
          list: {
            id: string;
            name: string;
            age: number;
            sex: string;
            dx: string;
            status: string;
          }[],
        ) => {
          const full = await Promise.all(list.map((p) => fetchPatient(p.id).catch(() => null)));
          const valid = full.filter(Boolean) as PatientData[];
          setAllPatients(valid);
        },
      )
      .catch((e) => {
        console.error("Failed to fetch backend patients:", e);
        setPatientsError(true);
      })
      .finally(() => {
        setPatientsLoading(false);
      });
  }, []);

  const handleCreatePatient = useCallback(
    async (form: {
      name: string;
      age: string;
      sex: string;
      chiefComplaint: string;
      dx: string;
      meds: string;
      bpSys: string;
      bpDia: string;
      hba1c: string;
      egfr: string;
      acr: string;
      ldl: string;
      creat: string;
      k: string;
      hr: string;
    }) => {
      setIntakeError(null);
      setIntakeSubmitting(true);
      const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
      try {
        const created = await createPatient({
          name: form.name.trim(),
          age: Number(form.age),
          sex: form.sex,
          chief_complaint: form.chiefComplaint.trim(),
          dx: form.dx.trim() || undefined,
          meds: form.meds
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean),
          bp_sys: num(form.bpSys),
          bp_dia: num(form.bpDia),
          hba1c: num(form.hba1c),
          egfr: num(form.egfr),
          acr: num(form.acr),
          ldl: num(form.ldl),
          creat: num(form.creat),
          k: num(form.k),
          hr: num(form.hr),
        });
        setAllPatients((prev) => [...prev, created as PatientData]);
        setIntakeOpen(false);
        openPatient(created as PatientData);
      } catch (err) {
        setIntakeError(err instanceof Error ? err.message : "Failed to create patient.");
      } finally {
        setIntakeSubmitting(false);
      }
    },
    [openPatient],
  );

  return {
    allPatients,
    setAllPatients,
    patientsLoading,
    patientsError,
    intakeOpen,
    setIntakeOpen,
    intakeError,
    intakeSubmitting,
    handleCreatePatient,
  };
}
