import React from "react";
import { Button } from "../ui/button";

export function FinalCTA({ onEnter }: { onEnter: () => void }) {
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-gold/10 via-void to-void pointer-events-none" />

      <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
        <h2 className="text-4xl md:text-5xl font-serif text-cream mb-6">
          The new standard of clinical truth.
        </h2>
        <p className="text-muted mb-12 text-lg">
          Experience a transparent multi-agent review board that guarantees provenance, enforces
          human oversight, and eliminates hallucination.
        </p>

        <Button
          variant="default"
          size="lg"
          onClick={onEnter}
          className="text-base px-8 h-12 shadow-[0_0_30px_rgba(201,162,39,0.3)] hover:shadow-[0_0_40px_rgba(201,162,39,0.5)] transition-shadow"
        >
          Enter the Platform
        </Button>
      </div>
    </section>
  );
}
