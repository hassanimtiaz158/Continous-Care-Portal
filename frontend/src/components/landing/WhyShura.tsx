import React from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

export function WhyShura() {
  return (
    <section className="py-24 border-y border-line bg-slate relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-5 pointer-events-none mix-blend-overlay" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-sm font-mono uppercase tracking-widest text-gold mb-4">
            The Shura Standard
          </h2>
          <p className="text-3xl md:text-4xl font-serif text-cream leading-tight">
            We build for truth, not convenience. The era of the black-box clinical oracle is over.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-void border border-line rounded-2xl p-8 shadow-2xl relative"
          >
            <div className="absolute top-0 right-8 -translate-y-1/2 bg-rose text-void px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full">
              Traditional AI
            </div>
            <ul className="space-y-6">
              {[
                "Generates an answer from a hidden neural network.",
                "Presents conclusions without citing original sources.",
                "Hallucinates data when context is missing.",
                "Forces the physician to guess the reasoning path.",
              ].map((item, i) => (
                <li key={i} className="flex gap-4 items-start text-muted">
                  <X className="w-5 h-5 text-rose shrink-0 mt-0.5" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-void-2 border border-gold/30 rounded-2xl p-8 shadow-[0_0_40px_rgba(201,162,39,0.05)] relative"
          >
            <div className="absolute top-0 right-8 -translate-y-1/2 bg-gold text-void px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full shadow-[0_0_15px_rgba(201,162,39,0.4)]">
              The Shura Model
            </div>
            <ul className="space-y-6">
              {[
                "Multiple specialized agents debate and reach consensus.",
                "Every claim is physically highlighted in the raw patient record.",
                "Missing data triggers a hard stop, not a hallucination.",
                "The physician holds the final, unyielding lock on approval.",
              ].map((item, i) => (
                <li key={i} className="flex gap-4 items-start text-cream">
                  <Check className="w-5 h-5 text-gold shrink-0 mt-0.5" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
