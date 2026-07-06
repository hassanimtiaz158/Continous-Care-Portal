import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SectionHeader } from "./SectionHeader";
import { groundingValidation } from "@/data/clinical";
import { Check, X } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

export function GroundingValidation() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".val-row", {
        opacity: 0, x: -20, duration: 0.6, stagger: 0.08, ease: "power2.out",
        scrollTrigger: { trigger: ref.current, start: "top 75%" },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id="grounding" className="relative px-6 py-32 md:px-12 md:py-40">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Section 05 · Grounding Validation"
          title={<>Findings are <span className="italic gold-text">verified or rejected.</span></>}
          intro="Every specialist claim is cross-checked against the archivist's record. Anything without a traceable source is rejected before the board convenes."
        />

        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          <div className="card-luxe judge-highlight relative p-8 md:p-10">
            <span className="judge-badge">Validation</span>
            <div className="mb-6 flex items-center justify-between">
              <div className="mono text-[10px] uppercase tracking-[2px] text-[--done]">Verified Findings</div>
              <div className="font-serif text-2xl text-cream">{groundingValidation.verified.length}</div>
            </div>
            <ul className="space-y-4">
              {groundingValidation.verified.map(v => (
                <li key={v.label} className="val-row flex items-start gap-4 rounded-lg border border-[--line] bg-[--void-3]/60 p-4">
                  <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[--done] bg-[--done]/10">
                    <Check className="h-3.5 w-3.5 text-[--done]" />
                  </div>
                  <div>
                    <div className="text-sm text-cream">{v.label}</div>
                    <div className="mono mt-1 text-[10px] uppercase tracking-[1.5px] text-muted">
                      ↳ {v.source} · {v.by}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-luxe judge-highlight relative p-8 md:p-10">
            <span className="judge-badge">Validation</span>
            <div className="mb-6 flex items-center justify-between">
              <div className="mono text-[10px] uppercase tracking-[2px] text-[--rose]">Rejected Findings</div>
              <div className="font-serif text-2xl text-cream">{groundingValidation.rejected.length}</div>
            </div>
            <ul className="space-y-4">
              {groundingValidation.rejected.map(v => (
                <li key={v.label} className="val-row flex items-start gap-4 rounded-lg border border-[--rose]/40 bg-[--rose]/5 p-4">
                  <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[--rose] bg-[--rose]/10">
                    <X className="h-3.5 w-3.5 text-[--rose]" />
                  </div>
                  <div>
                    <div className="text-sm text-cream">{v.label}</div>
                    <div className="mono mt-1 text-[10px] uppercase tracking-[1.5px] text-muted">↳ {v.reason}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-lg border border-[--line] bg-[--void-3]/60 p-4">
              <p className="text-xs leading-relaxed text-muted">
                Rejected findings never reach consensus. This is how the portal prevents ungrounded claims from influencing the joint plan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
