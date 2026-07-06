import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SectionHeader } from "./SectionHeader";
import { consensus } from "@/data/clinical";
import { GitMerge, Sparkles } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

export function Consensus() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: ref.current, start: "top 70%" },
        defaults: { ease: "power3.out" },
      });
      tl.from(".cs-plan", { opacity: 0, y: 30, duration: 0.9 })
        .from(".cs-plan-text", { opacity: 0, y: 20, duration: 0.9 }, "-=0.5")
        .from(".cs-action", { opacity: 0, x: -20, duration: 0.6, stagger: 0.15 }, "-=0.3")
        .from(".cs-conflict", { opacity: 0, y: 20, duration: 0.7 }, "-=0.3");
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id="consensus" className="relative px-6 py-32 md:px-12 md:py-40">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(201,162,39,0.3), transparent 60%)" }} />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Section 06 · Consensus Recommendation"
          title={<>One <span className="italic gold-text">joint plan.</span></>}
          intro="The board reconciles specialist recommendations, resolves conflicts by clinical priority, and outputs a single actionable plan for the physician."
          align="center"
        />

        <div className="cs-plan card-luxe mt-16 border-[--gold-dim] p-10 md:p-14"
          style={{
            background: "linear-gradient(180deg, rgba(201,162,39,0.06), rgba(11,17,25,0.9))",
            borderColor: "rgba(201,162,39,0.5)",
            boxShadow: "0 40px 100px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(233,197,88,0.1), 0 0 60px -20px rgba(201,162,39,0.25)",
          }}
        >
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-[--gold]" />
            <div className="mono text-[10px] uppercase tracking-[2px] text-[--gold]">Joint Plan</div>
          </div>
          <p className="cs-plan-text mt-6 font-serif text-2xl leading-relaxed text-cream md:text-3xl">
            {consensus.jointPlan}
          </p>

          <div className="hairline my-10" />

          <div className="mono mb-6 text-[10px] uppercase tracking-[2px] text-muted">Priority Actions</div>
          <ol className="space-y-4">
            {consensus.priorityActions.map(a => (
              <li key={a.order} className="cs-action flex items-start gap-5 rounded-lg border border-[--line] bg-[--void-3]/60 p-5 md:p-6">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[--gold-dim] bg-[--void-2] font-serif text-[--gold]">
                  {a.order}
                </div>
                <div className="flex-1">
                  <p className="text-sm leading-relaxed text-cream md:text-base">{a.text}</p>
                  <span className="mono mt-2 inline-block text-[9px] uppercase tracking-[1.5px] text-[--gold]">{a.tag}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-8 grid gap-6">
          {consensus.conflicts.map(c => (
            <div key={c.about} className="cs-conflict card-luxe p-8">
              <div className="flex items-center gap-3">
                <GitMerge className="h-4 w-4 text-[--rose]" />
                <div className="mono text-[10px] uppercase tracking-[2px] text-[--rose]">Conflict Resolved</div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[auto_1fr] md:gap-8">
                <div>
                  <div className="mono text-[9px] uppercase tracking-[1.5px] text-muted">Between</div>
                  <div className="mt-1 font-serif text-lg text-cream">{c.between}</div>
                  <div className="mono mt-3 text-[9px] uppercase tracking-[1.5px] text-muted">About</div>
                  <div className="mt-1 text-sm text-cream">{c.about}</div>
                </div>
                <div className="rounded-lg border border-[--line] bg-[--void-3]/60 p-5">
                  <div className="mono text-[9px] uppercase tracking-[1.5px] text-[--done]">Resolution</div>
                  <p className="mt-2 text-sm leading-relaxed text-cream">{c.resolution}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
