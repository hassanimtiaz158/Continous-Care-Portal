import React from 'react';
import { motion } from 'framer-motion';
import { Network, Database, ShieldAlert, History, Key, FileCheck2 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/card';

const features = [
  {
    icon: Network,
    title: "Multi-Agent Deliberation",
    description: "Endocrinology, Cardiology, and Nephrology models concurrently analyze the patient before reaching a unified consensus plan."
  },
  {
    icon: Database,
    title: "Evidence Grounding",
    description: "Every AI claim is mathematically mapped to a specific sentence in the raw patient record to eliminate hallucination."
  },
  {
    icon: ShieldAlert,
    title: "Missing Data Hard-Stop",
    description: "If a crucial lab value is missing, the Archivist engine halts the recommendation pipeline and flags the physician immediately."
  },
  {
    icon: History,
    title: "Immutable Audit Trail",
    description: "Every agent interaction, internal conflict, and final resolution is cryptographically sealed in the patient's review history."
  },
  {
    icon: FileCheck2,
    title: "ICD-10 Intelligence",
    description: "Automatically maps chief complaints and raw notes to exact ICD-10 billing codes alongside clinical confidence scores."
  },
  {
    icon: Key,
    title: "Human-in-the-Loop",
    description: "No plan is activated without a physical, audited sign-off from the attending physician."
  }
];

export function Capabilities() {
  return (
    <section className="py-24 bg-void relative">
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-16">
          <h2 className="text-sm font-mono uppercase tracking-widest text-gold mb-4">Platform Capabilities</h2>
          <p className="text-3xl font-serif text-cream max-w-2xl leading-tight">
            An uncompromising architecture designed exclusively for clinical precision.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <Card className="h-full bg-void-2 border-line hover:border-gold-dim transition-colors group">
                <CardHeader className="pb-4">
                  <div className="w-12 h-12 rounded-xl bg-void border border-line flex items-center justify-center mb-4 group-hover:bg-gold/5 group-hover:border-gold transition-colors">
                    <feat.icon className="w-5 h-5 text-gold" />
                  </div>
                  <h3 className="text-lg font-serif text-cream">{feat.title}</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted leading-relaxed">
                    {feat.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
