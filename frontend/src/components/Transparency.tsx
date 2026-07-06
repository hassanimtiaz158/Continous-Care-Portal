import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SectionHeader } from "./SectionHeader";
import { transparencyGauges } from "@/data/clinical";

gsap.registerPlugin(ScrollTrigger);

function Gauge({ label, value, raw, suffix }: { label: string; value: number; raw?: string; suffix?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const radius = 46;
  const circ = 2 * Math.PI * radius;

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (arc.current) {
        gsap.set(arc.current, { strokeDasharray: circ, strokeDashoffset: circ });
        gsap.to(arc.current, {
          strokeDashoffset: circ - (value / 100) * circ,
          duration: 1.8,
          ease: "power2.out",
          scrollTrigger: { trigger: ref.current, start: "top 85%" },
        });
      }
      if (num.current) {
        const obj = { v: 0 };
        ScrollTrigger.create({
          trigger: ref.current, start: "top 85%", once: true,
          onEnter: () => {
            gsap.to(obj, {
              v: value, duration: 1.8, ease: "power2.out",
              onUpdate: () => (num.current!.textContent = String(Math.round(obj.v))),
            });
          },
        });
      }
    }, ref);
    return () => ctx.revert();
  }, [value, circ]);

  return (
    <div ref={ref} className="card-luxe judge-highlight relative flex flex-col items-center p-8">
      <span className="judge-badge">Confidence</span>
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(201,162,39,0.12)" strokeWidth="6" />
          <circle
            ref={arc}
            cx="60" cy="60" r={radius}
            fill="none" stroke={`url(#gg-${label.replace(/\s/g, "")})`}
            strokeWidth="6" strokeLinecap="round"
          />
          <defs>
            <linearGradient id={`gg-${label.replace(/\s/g, "")}`} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#E9C558" />
              <stop offset="100%" stopColor="#8A731E" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="font-serif text-3xl text-cream">
              {raw ? raw : (<><span ref={num}>0</span>{suffix ?? "%"}</>)}
            </div>
          </div>
        </div>
      </div>
      <div className="mono mt-5 text-center text-[10px] uppercase tracking-[2px] text-muted">{label}</div>
    </div>
  );
}

export function Transparency() {
  return (
    <section id="transparency" className="relative px-6 py-32 md:px-12 md:py-40">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Section 09 · System Transparency"
          title={<>Trust is <span className="italic gold-text">measured, not asserted.</span></>}
          intro="Every clinical board run publishes its own quality signals. Physicians see exactly how confident the system is — and why."
          align="center"
        />

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {transparencyGauges.map(g => (
            <Gauge key={g.label} label={g.label} value={g.value} raw={g.raw} suffix={g.suffix} />
          ))}
        </div>
      </div>
    </section>
  );
}
