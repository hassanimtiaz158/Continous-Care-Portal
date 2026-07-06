import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SectionHeader } from "./SectionHeader";
import { evidenceChain } from "@/data/clinical";

gsap.registerPlugin(ScrollTrigger);

export function EvidenceChain() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const nodes = ref.current?.querySelectorAll(".chain-node");
      const line = ref.current?.querySelector<SVGPathElement>("[data-chain-line]");
      if (line) {
        const len = line.getTotalLength();
        gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(line, {
          strokeDashoffset: 0, duration: 2.4, ease: "power2.inOut",
          scrollTrigger: { trigger: ref.current, start: "top 70%" },
        });
      }
      if (nodes) {
        gsap.from(nodes, {
          opacity: 0, y: 20, duration: 0.6, stagger: 0.14, ease: "power2.out",
          scrollTrigger: { trigger: ref.current, start: "top 70%" },
        });
      }
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id="chain" className="relative px-6 py-32 md:px-12 md:py-40">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Section 03 · Evidence Chain"
          title={<>An unbroken line, <span className="italic gold-text">from record to review.</span></>}
          intro="Every recommendation travels through seven checkpoints. Break any link, and the board cannot proceed."
          align="center"
        />

        <div className="relative mt-20 hidden lg:block">
          <svg viewBox="0 0 1000 60" className="absolute left-0 top-8 w-full" preserveAspectRatio="none">
            <path
              data-chain-line
              d="M 40 30 L 960 30"
              fill="none"
              stroke="url(#chainGrad)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="4 6"
            />
            <defs>
              <linearGradient id="chainGrad" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#8A731E" />
                <stop offset="50%" stopColor="#E9C558" />
                <stop offset="100%" stopColor="#8A731E" />
              </linearGradient>
            </defs>
          </svg>
          <ol className="relative grid grid-cols-7 gap-4">
            {evidenceChain.map((step, i) => (
              <li key={step.key} className="chain-node flex flex-col items-center text-center">
                <div className="relative z-10 grid h-16 w-16 place-items-center rounded-full border border-[--gold-dim] bg-[--void-2] shadow-[0_0_30px_-5px_rgba(201,162,39,0.4)]">
                  <span className="font-serif text-lg text-[--gold]">{i + 1}</span>
                </div>
                <div className="mt-4 font-serif text-sm text-cream">{step.label}</div>
                <div className="mono mt-2 text-[9px] uppercase tracking-[1.5px] text-muted">{step.detail}</div>
              </li>
            ))}
          </ol>
        </div>

        {/* Mobile / vertical */}
        <ol className="relative mt-16 space-y-8 lg:hidden">
          <div className="absolute left-[31px] top-0 bottom-0 w-px bg-gradient-to-b from-[--gold-dim] via-[--gold] to-[--gold-dim]" />
          {evidenceChain.map((step, i) => (
            <li key={step.key} className="chain-node relative flex items-start gap-5">
              <div className="relative z-10 grid h-16 w-16 shrink-0 place-items-center rounded-full border border-[--gold-dim] bg-[--void-2]">
                <span className="font-serif text-lg text-[--gold]">{i + 1}</span>
              </div>
              <div className="pt-3">
                <div className="font-serif text-lg text-cream">{step.label}</div>
                <div className="mono mt-1 text-[10px] uppercase tracking-[1.5px] text-muted">{step.detail}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
