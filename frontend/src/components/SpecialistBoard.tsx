import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SectionHeader } from "./SectionHeader";
import { specialists } from "@/data/clinical";
import { Stethoscope, Heart, Droplet } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const iconFor: Record<string, React.ReactNode> = {
  endo: <Stethoscope className="h-5 w-5" />,
  cardio: <Heart className="h-5 w-5" />,
  neph: <Droplet className="h-5 w-5" />,
};

export function SpecialistBoard() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".spec-card", {
        opacity: 0, y: 40, duration: 0.9, stagger: 0.15, ease: "power3.out",
        scrollTrigger: { trigger: ref.current, start: "top 75%" },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id="specialists" className="relative px-6 py-32 md:px-12 md:py-40">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Section 04 · Specialist Board"
          title={<>Three domains. <span className="italic gold-text">One deliberation.</span></>}
          intro="Each specialist reviews the archivist's brief within their domain, publishes findings, and stakes a confidence rating that the board can audit."
        />

        <div className="mt-16 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {specialists.map(s => (
            <article key={s.id} className="spec-card card-luxe card-luxe-hover judge-highlight relative overflow-hidden p-8 md:p-10">
              <span className="judge-badge">Confidence</span>
              <div
                className="absolute inset-x-0 top-0 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent, ${s.riskColor === "rose" ? "#B23A48" : "#3D8B8B"}, transparent)`,
                }}
              />

              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="grid h-14 w-14 place-items-center rounded-full border font-serif text-lg text-cream"
                    style={{
                      borderColor: s.riskColor === "rose" ? "rgba(178,58,72,0.5)" : "rgba(61,139,139,0.5)",
                      background: "radial-gradient(circle at 30% 30%, rgba(201,162,39,0.15), rgba(11,17,25,0.9))",
                    }}
                  >
                    {iconFor[s.id]}
                  </div>
                  <div>
                    <div className="mono text-[9px] uppercase tracking-[2px] text-muted">Agent</div>
                    <div className="font-serif text-xl text-cream">{s.name}</div>
                  </div>
                </div>
                <span
                  className="chip"
                  style={{
                    color: s.riskColor === "rose" ? "#B23A48" : "#3D8B8B",
                    borderColor: s.riskColor === "rose" ? "rgba(178,58,72,0.5)" : "rgba(61,139,139,0.5)",
                  }}
                >
                  {s.riskLevel}
                </span>
              </div>

              <div className="hairline my-6" />

              <div className="mono mb-3 text-[10px] uppercase tracking-[2px] text-muted">Findings</div>
              <ul className="space-y-3">
                {s.findings.map((f, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-[#D6D2C4]">
                    <span className="mono mt-0.5 text-[10px] text-[--gold]">0{i + 1}</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 rounded-lg border border-[--gold-dim]/60 bg-[--amber-bg] p-5">
                <div className="mono text-[9px] uppercase tracking-[1.5px] text-[--gold]">Recommendation</div>
                <p className="mt-2 text-sm leading-relaxed text-cream">{s.recommendation}</p>
              </div>

              <div className="mt-6 flex items-end justify-between">
                <div>
                  <div className="mono text-[9px] uppercase tracking-[1.5px] text-muted">Confidence</div>
                  <div className="mt-1 font-serif text-3xl text-cream">{s.confidence}%</div>
                </div>
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-[--void-3]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${s.confidence}%`, background: "linear-gradient(90deg, #8A731E, #E9C558)" }}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
