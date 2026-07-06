import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Props = {
  label: string;
  unit: string;
  values: number[];
  dates: string[];
  target: number;
  status: "critical" | "warning" | "ok";
  delta: string;
  invertGood?: boolean;
};

const statusColor = {
  critical: "#B23A48",
  warning: "#E9C558",
  ok: "#4F7A5A",
};

export function TrendCard({ label, unit, values, dates, target, status, delta }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const valRef = useRef<HTMLSpanElement>(null);

  const min = Math.min(...values, target);
  const max = Math.max(...values, target);
  const range = max - min || 1;
  const w = 300;
  const h = 90;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = "M" + points.join(" L");
  const areaPath = path + ` L${w},${h} L0,${h} Z`;
  const targetY = h - ((target - min) / range) * h;
  const latest = values[values.length - 1];
  const color = statusColor[status];

  useEffect(() => {
    const ctx = gsap.context(() => {
      const p = pathRef.current;
      if (p) {
        const len = p.getTotalLength();
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(p, {
          strokeDashoffset: 0,
          duration: 1.6,
          ease: "power2.inOut",
          scrollTrigger: { trigger: ref.current, start: "top 80%" },
        });
      }
      // count-up
      const el = valRef.current;
      if (el) {
        const obj = { v: 0 };
        ScrollTrigger.create({
          trigger: ref.current,
          start: "top 80%",
          once: true,
          onEnter: () => {
            gsap.to(obj, {
              v: latest,
              duration: 1.4,
              ease: "power2.out",
              onUpdate: () => (el.textContent = obj.v.toFixed(latest < 20 ? 1 : 0)),
            });
          },
        });
      }
    }, ref);
    return () => ctx.revert();
  }, [latest]);

  return (
    <div ref={ref} className="card-luxe card-luxe-hover judge-highlight relative p-7 md:p-8">
      <span className="judge-badge">Provenance</span>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mono text-[10px] uppercase tracking-[2px] text-muted">{label}</div>
          <div className="mt-3 flex items-baseline gap-2 font-serif text-3xl text-cream md:text-4xl">
            <span ref={valRef}>0</span>
            <span className="text-base text-muted">{unit}</span>
          </div>
        </div>
        <div
          className="chip"
          style={{
            color,
            borderColor: `${color}80`,
            background: `${color}12`,
          }}
        >
          {delta}
        </div>
      </div>

      <svg viewBox={`0 0 ${w} ${h + 20}`} className="mt-6 h-24 w-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1="0" x2={w} y1={targetY} y2={targetY}
          stroke="rgba(201,162,39,0.4)" strokeWidth="1" strokeDasharray="3 4"
        />
        <path d={areaPath} fill={`url(#grad-${label})`} />
        <path ref={pathRef} d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((v, i) => {
          const x = (i / (values.length - 1)) * w;
          const y = h - ((v - min) / range) * h;
          return <circle key={i} cx={x} cy={y} r={i === values.length - 1 ? 3.5 : 1.8} fill={color} />;
        })}
      </svg>

      <div className="mono mt-4 flex justify-between text-[9px] uppercase tracking-[1.5px] text-muted">
        <span>{dates[0]}</span>
        <span>Target {target}{unit === "%" ? "%" : ""}</span>
        <span>{dates[dates.length - 1]}</span>
      </div>
    </div>
  );
}
