import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SectionHeader } from "./SectionHeader";
import { auditTrail } from "@/data/clinical";

gsap.registerPlugin(ScrollTrigger);

export function AuditTrail() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      const line = ref.current?.querySelector<HTMLDivElement>("[data-timeline-line]");
      if (line) {
        gsap.from(line, {
          scaleY: 0,
          transformOrigin: "top center",
          duration: 1.8,
          ease: "power2.inOut",
          scrollTrigger: { trigger: ref.current, start: "top 70%" },
        });
      }
      gsap.from(".at-row", {
        opacity: 0, x: -30, duration: 0.6, stagger: 0.09, ease: "power2.out",
        scrollTrigger: { trigger: ref.current, start: "top 70%" },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id="audit" className="relative px-6 py-32 md:px-12 md:py-40">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          eyebrow="Section 08 · Audit Trail"
          title={<>Every step, <span className="italic gold-text">time-stamped.</span></>}
          intro="A complete record of who acted, when, and with what confidence. Non-repudiable by design."
        />

        <ol className="relative mt-16 space-y-6">
          <div data-timeline-line className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-[--gold] via-[--gold-dim] to-transparent" />
          {auditTrail.map(a => (
            <li key={a.time + a.event} className="at-row card-luxe judge-highlight relative flex flex-col gap-3 p-6 pl-16 sm:flex-row sm:items-center sm:justify-between">
              <span className="judge-badge">Audit Trail</span>
              <div
                className={`absolute left-[10px] top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full border-2 ${a.status === "pending" ? "border-[--gold] bg-[--void] dot-pulse" : "border-[--done] bg-[--done]/20"}`}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.status === "pending" ? "#C9A227" : "#4F7A5A" }} />
              </div>
              <div className="min-w-0">
                <div className="font-serif text-base text-cream">{a.event}</div>
                <div className="mono mt-1 text-[10px] uppercase tracking-[1.5px] text-muted">{a.actor}</div>
              </div>
              <div className="flex items-center gap-4 sm:justify-end">
                <span className="mono text-[11px] text-cream">{a.time}</span>
                <span
                  className="chip"
                  style={{
                    color: a.status === "pending" ? "#C9A227" : "#4F7A5A",
                    borderColor: a.status === "pending" ? "rgba(201,162,39,0.5)" : "rgba(79,122,90,0.5)",
                  }}
                >
                  {a.status}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
