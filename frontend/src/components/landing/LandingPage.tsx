import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { HeroWorkflow } from './HeroWorkflow';
import { WhyShura } from './WhyShura';
import { Capabilities } from './Capabilities';
import { Metrics } from './Metrics';
import { FinalCTA } from './FinalCTA';

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] w-full min-h-screen bg-void flex flex-col items-center justify-start overflow-y-auto overflow-x-hidden">
      {/* Navigation / Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-void-2 border border-gold flex items-center justify-center">
            <span className="text-gold font-serif text-sm font-bold tracking-widest">S</span>
          </div>
          <span className="font-serif text-xl tracking-widest text-cream">SHURA</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://github.com/hassan-imtiaz/CCP-v.1" target="_blank" rel="noreferrer" className="text-xs uppercase tracking-widest text-muted hover:text-cream transition-colors font-mono hidden md:block">
            View Architecture
          </a>
          <Button variant="outline" size="sm" onClick={onEnter} className="text-xs">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full max-w-7xl mx-auto px-6 pt-20 pb-16 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/30 bg-gold/5 text-gold text-[10px] font-mono uppercase tracking-widest mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            Clinical Decision Support Engine
          </div>
          <h1 className="text-5xl md:text-7xl font-serif text-cream leading-[1.1] mb-6">
            The anti-hallucination engine for <span className="text-gold italic">modern medicine.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted mb-10 max-w-2xl mx-auto leading-relaxed">
            A multi-agent review board that proves every claim, enforces human oversight, and locks clinical decisions into an immutable audit trail.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button variant="primary" size="lg" onClick={onEnter} className="h-12 px-8">
              Access the Platform
            </Button>
            <Button variant="outline" size="lg" onClick={onEnter} className="h-12 px-8">
              View Demo Patient
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Animated Workflow Hero Element */}
      <section className="w-full max-w-7xl mx-auto px-6 pb-24">
        <HeroWorkflow />
      </section>

      <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-line to-transparent" />

      {/* Product Storytelling */}
      <WhyShura />

      {/* Platform Capabilities Grid */}
      <Capabilities />

      {/* Metrics Section */}
      <Metrics />

      {/* Final Call to Action */}
      <FinalCTA onEnter={onEnter} />

      {/* Footer */}
      <footer className="w-full py-8 border-t border-line text-center">
        <p className="text-[10px] uppercase tracking-widest text-muted font-mono">
          Built for clinical truth. Not for convenience.
        </p>
      </footer>
    </div>
  );
}
