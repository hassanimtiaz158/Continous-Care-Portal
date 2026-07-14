import React from "react";
import { motion } from "framer-motion";

const metrics = [
  { label: "Active AI Specialists", value: "3", suffix: "" },
  { label: "Evidence Traceability", value: "100", suffix: "%" },
  { label: "Data Hallucination Tolerance", value: "0", suffix: "%" },
  { label: "Required Human Sign-offs", value: "1", suffix: " per plan" },
];

export function Metrics() {
  return (
    <section className="py-24 border-y border-line bg-void-2 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 divide-x divide-line">
          {metrics.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center text-center px-4"
            >
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl md:text-5xl font-serif text-cream">{m.value}</span>
                <span className="text-gold font-mono text-lg">{m.suffix}</span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-muted font-mono leading-tight max-w-[120px]">
                {m.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
