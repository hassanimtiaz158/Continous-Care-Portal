import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { heroMetrics, DISCLAIMER } from "@/data/clinical";
import { Background } from "./Background";
import { ArrowRight, ShieldCheck } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

export function Hero() {
  const rootRef = useRef<HTMLElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero-tag", { opacity: 0, y: 20, duration: 0.8 })
        .from(".hero-title-line", { opacity: 0, y: 40, duration: 1.1, stagger: 0.12 }, "-=0.4")
        .from(".hero-sub", { opacity: 0, y: 20, duration: 0.9 }, "-=0.6")
        .from(".hero-cta", { opacity: 0, y: 15, duration: 0.7, stagger: 0.1 }, "-=0.5")
        .from(".hero-disclaimer", { opacity: 0, duration: 0.8 }, "-=0.3")
        .from(".hero-metric", { opacity: 0, y: 30, duration: 0.9, stagger: 0.12 }, "-=0.5");

      // Counters
      const els = metricsRef.current?.querySelectorAll<HTMLElement>("[data-count]");
      els?.forEach(el => {
        const target = parseFloat(el.dataset.count || "0");
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 2.2,
          ease: "power2.out",
          delay: 1.2,
          onUpdate: () => {
            el.textContent = String(Math.round(obj.v));
          },
        });
      });

      // Parallax
      gsap.to(".hero-parallax-a", {
        yPercent: -20,
        ease: "none",
        scrollTrigger: { trigger: rootRef.current, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(".hero-parallax-b", {
        yPercent: -35,
        ease: "none",
        scrollTrigger: { trigger: rootRef.current, start: "top top", end: "bottom top", scrub: true },
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative flex min-h-screen items-center overflow-hidden px-6 pb-24 pt-32 md:px-12 md:pt-40"
    >
      <div className="hero-parallax-a"><Background /></div>

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="hero-tag mono flex items-center gap-3 text-[10px] uppercase tracking-[3px] text-muted">
          <span className="h-px w-10 bg-[--gold]" />
          Continuous Care Portal · v1.0
        </div>

        <h1 className="mt-8 font-serif text-5xl leading-[1.02] tracking-tight text-cream sm:text-6xl md:text-7xl lg:text-8xl">
          <span className="hero-title-line block">Continuous</span>
          <span className="hero-title-line block gold-text italic">Care Portal</span>
        </h1>

        <p className="hero-sub mt-8 max-w-2xl text-lg leading-relaxed text-[#C7C2B4] md:text-xl">
          A transparent multi-agent clinical review system designed to support
          physician decision-making across complex chronic disease cases.
        </p>

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <button className="hero-cta gold-btn inline-flex items-center gap-3">
            Convene Clinical Board
            <ArrowRight className="h-4 w-4" />
          </button>
          <button className="hero-cta ghost-btn inline-flex items-center gap-3">
            View Live Case
          </button>
        </div>

        <div className="hero-disclaimer mt-10 flex max-w-2xl items-start gap-3 rounded-lg border border-[--line] bg-[--void-2]/60 p-4 backdrop-blur">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[--gold]" />
          <p className="text-xs leading-relaxed text-muted md:text-[13px]">{DISCLAIMER}</p>
        </div>

        <div
          ref={metricsRef}
          className="hero-parallax-b mt-20 grid grid-cols-2 gap-6 sm:gap-8 md:mt-24 md:grid-cols-4"
        >
          {heroMetrics.map(m => (
            <div key={m.label} className="hero-metric">
              <div className="mono text-[10px] uppercase tracking-[2px] text-muted">{m.label}</div>
              <div className="mt-3 flex items-baseline gap-1 font-serif text-4xl text-cream md:text-5xl">
                <span data-count={m.value}>0</span>
                <span className="text-2xl text-[--gold] md:text-3xl">{m.suffix}</span>
              </div>
              <div className="mt-4 h-px w-full bg-[--line]" />
            </div>
          ))}
        </div>

        <div className="mt-24 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="mono text-[10px] uppercase tracking-[3px] text-muted">Scroll</div>
            <div className="h-10 w-px bg-gradient-to-b from-[--gold] to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
