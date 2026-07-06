import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SectionHeader } from "./SectionHeader";
import { TrendCard } from "./TrendCard";
import { patient, trends } from "@/data/clinical";
import { Activity, Pill, User } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

export function PatientOverview() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".po-card", {
        opacity: 0,
        y: 40,
        duration: 0.9,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: ref.current, start: "top 75%" },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id="overview" className="relative px-6 py-32 md:px-12 md:py-40">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Section 01 · Patient Overview"
          title={<>The case, <span className="italic gold-text">at a glance.</span></>}
          intro="A consolidated view of chronic conditions, active medications, and the six longitudinal metrics that anchor this review."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          <div className="po-card card-luxe p-8 lg:col-span-1">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-[--line] bg-[--void-3]">
                <User className="h-4 w-4 text-[--gold]" />
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-[2px] text-muted">Patient</div>
                <div className="font-serif text-xl text-cream">{patient.initials} · #{patient.id}</div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="mono text-[10px] uppercase tracking-[1.5px] text-muted">Age</dt><dd className="mt-1 text-cream">{patient.age}</dd></div>
              <div><dt className="mono text-[10px] uppercase tracking-[1.5px] text-muted">Sex</dt><dd className="mt-1 text-cream">{patient.sex}</dd></div>
              <div><dt className="mono text-[10px] uppercase tracking-[1.5px] text-muted">Ethnicity</dt><dd className="mt-1 text-cream">{patient.ethnicity}</dd></div>
              <div><dt className="mono text-[10px] uppercase tracking-[1.5px] text-muted">BMI</dt><dd className="mt-1 text-cream">{patient.bmi}</dd></div>
            </dl>
            <div className="mt-6 rounded-lg border border-[--line] bg-[--amber-bg] p-4">
              <div className="mono text-[9px] uppercase tracking-[1.5px] text-[--gold]">Family Medicine Note</div>
              <p className="mt-2 text-[13px] leading-relaxed text-[#D6D2C4]">{patient.context}</p>
            </div>
          </div>

          <div className="po-card card-luxe p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-[--line] bg-[--void-3]">
                <Activity className="h-4 w-4 text-[--gold]" />
              </div>
              <div className="mono text-[10px] uppercase tracking-[2px] text-muted">Chronic Conditions</div>
            </div>
            <ul className="space-y-4">
              {patient.conditions.map(c => (
                <li key={c.name} className="flex items-start justify-between gap-3 border-b border-[--line] pb-4 last:border-none last:pb-0">
                  <div>
                    <div className="text-sm text-cream">{c.name}</div>
                    <div className="mono mt-1 text-[10px] uppercase tracking-[1.5px] text-muted">Since {c.since}</div>
                  </div>
                  <span
                    className="chip"
                    style={{
                      color: c.control === "Poor" || c.control === "Uncontrolled" || c.control === "Declining" ? "#B23A48" : "#4F7A5A",
                      borderColor: c.control === "Poor" || c.control === "Uncontrolled" || c.control === "Declining" ? "rgba(178,58,72,0.5)" : "rgba(79,122,90,0.5)",
                    }}
                  >
                    {c.control}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="po-card card-luxe p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-[--line] bg-[--void-3]">
                <Pill className="h-4 w-4 text-[--gold]" />
              </div>
              <div className="mono text-[10px] uppercase tracking-[2px] text-muted">Active Medications</div>
            </div>
            <ul className="space-y-5">
              {patient.medications.map(m => (
                <li key={m.name}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-cream">{m.name}</div>
                      <div className="mono text-[10px] uppercase tracking-[1.5px] text-muted">{m.dose}</div>
                    </div>
                    <div className="mono text-xs text-cream">{m.adherence}%</div>
                  </div>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[--void-3]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${m.adherence}%`,
                        background: m.adherence < 75 ? "#B23A48" : "linear-gradient(90deg, #C9A227, #E9C558)",
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16">
          <div className="mono mb-6 text-[11px] uppercase tracking-[2.5px] text-muted">Longitudinal Metrics · 18 months</div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {trends.map(t => (
              <TrendCard key={t.label} {...t} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
