import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SectionHeader } from "./SectionHeader";
import {
  archivistFindings,
  thresholdCrossings,
  missingFlags,
  evidenceSources,
} from "@/data/clinical";
import { Archive, AlertTriangle, Database, FileWarning, TrendingUp } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

export function ArchivistPanel() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".arc-hero", {
        opacity: 0, y: 30, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: ref.current, start: "top 75%" },
      });
      gsap.from(".arc-item", {
        opacity: 0, y: 30, duration: 0.7, stagger: 0.1, ease: "power3.out",
        scrollTrigger: { trigger: ".arc-findings", start: "top 80%" },
      });
      gsap.from(".arc-sub", {
        opacity: 0, y: 20, duration: 0.7, stagger: 0.08, ease: "power3.out",
        scrollTrigger: { trigger: ".arc-grid", start: "top 80%" },
      });
      // pulse the completeness ring
      const ring = ref.current?.querySelector<SVGCircleElement>("[data-ring]");
      if (ring) {
        const len = 2 * Math.PI * 54;
        gsap.set(ring, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(ring, {
          strokeDashoffset: 0, duration: 2, ease: "power2.out",
          scrollTrigger: { trigger: ref.current, start: "top 70%" },
        });
      }
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id="archivist" className="relative px-6 py-32 md:px-12 md:py-40">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(201,162,39,0.35), transparent 60%)" }} />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="arc-hero">
          <SectionHeader
            eyebrow="Section 02 · Archivist Agent"
            title={<>Before specialists speak, <span className="italic gold-text">the record is understood.</span></>}
            intro="The Archivist is the star of the portal. It ingests raw records, computes deterministic trends, flags gaps, and hands specialists a fully-provenanced brief. AI did not invent these findings — every value is traced to its source."
          />
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          {/* Completeness hero card */}
          <div className="arc-hero card-luxe judge-highlight relative p-10 md:p-12">
            <span className="judge-badge">Provenance</span>
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-[--line] bg-[--void-3]">
                <Archive className="h-4 w-4 text-[--gold]" />
              </div>
              <div className="mono text-[10px] uppercase tracking-[2px] text-muted">Data Completeness</div>
            </div>

            <div className="flex items-center gap-8">
              <div className="relative h-32 w-32 shrink-0">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(201,162,39,0.15)" strokeWidth="4" />
                  <circle
                    data-ring cx="60" cy="60" r="54" fill="none"
                    stroke="url(#ringGrad)" strokeWidth="4" strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="ringGrad" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor="#E9C558" />
                      <stop offset="100%" stopColor="#C9A227" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="font-serif text-3xl text-cream">100%</div>
                    <div className="mono text-[9px] uppercase tracking-[1.5px] text-muted">Complete</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="font-serif text-2xl text-cream">206 data points ingested</div>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Every field in the case brief maps back to a source record.
                  Nothing has been inferred, hallucinated, or filled by generative synthesis.
                </p>
              </div>
            </div>

            <div className="hairline my-8" />

            <div className="mb-4 mono text-[10px] uppercase tracking-[2px] text-muted">Threshold Crossings</div>
            <ul className="space-y-3">
              {thresholdCrossings.map(t => (
                <li key={t.label} className="flex items-center justify-between rounded-lg border border-[--line] bg-[--void-3]/60 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4" style={{ color: t.severity === "critical" ? "#B23A48" : "#E9C558" }} />
                    <span className="text-sm text-cream">{t.label}</span>
                  </div>
                  <span className="mono text-[10px] uppercase tracking-[1.5px] text-muted">Crossed · {t.crossed}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Computed trends */}
          <div className="arc-findings card-luxe p-10 md:p-12">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-[--line] bg-[--void-3]">
                <TrendingUp className="h-4 w-4 text-[--gold]" />
              </div>
              <div className="mono text-[10px] uppercase tracking-[2px] text-muted">Computed Trends · with Provenance</div>
            </div>

            <ul className="space-y-6">
              {archivistFindings.map(f => (
                <li key={f.label} className="arc-item">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-serif text-lg text-cream">{f.label}</div>
                      <div className="mono mt-2 text-sm text-[--gold]">{f.values}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-2xl text-cream">{f.confidence}%</div>
                      <div className="mono text-[9px] uppercase tracking-[1.5px] text-muted">Confidence</div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[#D6D2C4]">{f.trend}</p>
                  <div className="mono mt-3 text-[10px] uppercase tracking-[1.5px] text-muted">
                    ↳ {f.evidence}
                  </div>
                  <div className="mt-5 h-px w-full bg-[--line] last:hidden" />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="arc-grid mt-8 grid gap-6 md:grid-cols-2">
          <div className="arc-sub card-luxe p-8">
            <div className="mb-4 flex items-center gap-3">
              <FileWarning className="h-4 w-4 text-[--rose]" />
              <div className="mono text-[10px] uppercase tracking-[2px] text-muted">Missing Data · Flagged</div>
            </div>
            <ul className="space-y-3">
              {missingFlags.map(m => (
                <li key={m.field} className="flex items-center justify-between border-b border-[--line] pb-3 last:border-none last:pb-0">
                  <span className="text-sm text-cream">{m.field}</span>
                  <span className="mono text-[10px] uppercase tracking-[1.5px] text-[--rose]">{m.lastSeen}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="arc-sub card-luxe p-8">
            <div className="mb-4 flex items-center gap-3">
              <Database className="h-4 w-4 text-[--teal]" />
              <div className="mono text-[10px] uppercase tracking-[2px] text-muted">Evidence Sources</div>
            </div>
            <ul className="space-y-3">
              {evidenceSources.map(s => (
                <li key={s.name} className="flex items-center justify-between border-b border-[--line] pb-3 last:border-none last:pb-0">
                  <span className="text-sm text-cream">{s.name}</span>
                  <span className="mono text-[10px] uppercase tracking-[1.5px] text-muted">{s.records} records</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
