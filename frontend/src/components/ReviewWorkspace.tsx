import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SectionHeader } from "./SectionHeader";
import { consensus, specialists, DISCLAIMER } from "@/data/clinical";
import { Check, Pencil, XCircle, StickyNote, Download, ShieldCheck, Stamp } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

export function ReviewWorkspace() {
  const ref = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<"pending" | "approved" | "modified" | "rejected">("pending");
  const stampRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".rw-left, .rw-right", {
        opacity: 0, y: 30, duration: 0.9, stagger: 0.15, ease: "power3.out",
        scrollTrigger: { trigger: ref.current, start: "top 75%" },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (status !== "pending" && stampRef.current) {
      gsap.fromTo(
        stampRef.current,
        { scale: 3, opacity: 0, rotate: -20 },
        { scale: 1, opacity: 1, rotate: -8, duration: 0.7, ease: "back.out(2)" }
      );
    }
  }, [status]);

  const stampColor = status === "approved" ? "#4F7A5A" : status === "rejected" ? "#B23A48" : "#C9A227";
  const stampLabel = status === "approved" ? "APPROVED" : status === "rejected" ? "REJECTED" : "MODIFIED";

  return (
    <section ref={ref} id="review" className="relative px-6 py-32 md:px-12 md:py-40">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Section 07 · Human Review Workspace"
          title={<>The physician <span className="italic gold-text">decides.</span></>}
          intro="The board's work is a briefing, not a directive. The physician approves, modifies, rejects, or annotates — and the audit trail records every choice."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <div className="rw-left card-luxe judge-highlight relative p-8 md:p-10">
            <span className="judge-badge">Human Oversight</span>

            {status !== "pending" && (
              <div
                ref={stampRef}
                className="pointer-events-none absolute right-8 top-24 z-10 font-serif text-4xl md:text-5xl"
                style={{
                  color: stampColor,
                  border: `3px solid ${stampColor}`,
                  padding: "8px 24px",
                  borderRadius: "6px",
                  letterSpacing: "0.15em",
                  textShadow: `0 0 20px ${stampColor}40`,
                }}
              >
                {stampLabel}
              </div>
            )}

            <div className="mono text-[10px] uppercase tracking-[2px] text-muted">Board Recommendation</div>
            <p className="mt-4 font-serif text-xl leading-relaxed text-cream md:text-2xl">
              {consensus.jointPlan}
            </p>

            <div className="hairline my-8" />

            <div className="mono mb-4 text-[10px] uppercase tracking-[2px] text-muted">Supporting Evidence</div>
            <ul className="space-y-3">
              {consensus.priorityActions.slice(0, 3).map(a => (
                <li key={a.order} className="flex items-start gap-3 rounded-lg border border-[--line] bg-[--void-3]/50 p-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[--gold]" />
                  <span className="text-sm text-cream">{a.text}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex items-start gap-3 rounded-lg border border-[--line] bg-[--amber-bg] p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[--gold]" />
              <p className="text-xs leading-relaxed text-muted">{DISCLAIMER}</p>
            </div>
          </div>

          <div className="rw-right card-luxe p-8 md:p-10">
            <div className="mono mb-4 text-[10px] uppercase tracking-[2px] text-muted">Specialist Opinions</div>
            <ul className="space-y-3">
              {specialists.map(s => (
                <li key={s.id} className="rounded-lg border border-[--line] bg-[--void-3]/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-serif text-sm text-cream">{s.name}</div>
                    <span className="mono text-[10px] text-[--gold]">{s.confidence}%</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted">{s.recommendation}</p>
                </li>
              ))}
            </ul>

            <div className="hairline my-8" />

            <div className="mono mb-3 text-[10px] uppercase tracking-[2px] text-muted">Physician Notes</div>
            <textarea
              rows={4}
              placeholder="Add clinical reasoning, patient preferences, or modifications…"
              className="w-full resize-none rounded-lg border border-[--line] bg-[--void] p-4 text-sm text-cream placeholder:text-muted/50 focus:border-[--gold-dim] focus:outline-none"
            />

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => setStatus("approved")}
                className="mono flex items-center justify-center gap-2 rounded-lg border border-[--done]/60 bg-[--done]/10 py-3 text-[11px] uppercase tracking-[1.5px] text-[--done] transition hover:bg-[--done]/20"
              >
                <Check className="h-4 w-4" /> Approve
              </button>
              <button
                onClick={() => setStatus("modified")}
                className="mono flex items-center justify-center gap-2 rounded-lg border border-[--gold-dim] bg-[--amber-bg] py-3 text-[11px] uppercase tracking-[1.5px] text-[--gold] transition hover:bg-[--gold]/15"
              >
                <Pencil className="h-4 w-4" /> Modify
              </button>
              <button
                onClick={() => setStatus("rejected")}
                className="mono flex items-center justify-center gap-2 rounded-lg border border-[--rose]/60 bg-[--rose]/5 py-3 text-[11px] uppercase tracking-[1.5px] text-[--rose] transition hover:bg-[--rose]/15"
              >
                <XCircle className="h-4 w-4" /> Reject
              </button>
              <button className="mono flex items-center justify-center gap-2 rounded-lg border border-[--line] bg-[--void-3] py-3 text-[11px] uppercase tracking-[1.5px] text-cream transition hover:border-[--gold-dim]">
                <StickyNote className="h-4 w-4" /> Add Notes
              </button>
            </div>
            <button className="mono mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[--line] bg-[--void-3] py-3 text-[11px] uppercase tracking-[1.5px] text-cream transition hover:border-[--gold-dim]">
              <Download className="h-4 w-4" /> Export Review Packet
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
