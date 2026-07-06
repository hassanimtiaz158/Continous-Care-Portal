import { DISCLAIMER } from "@/data/clinical";

export function Footer() {
  return (
    <footer className="relative border-t border-[--line] px-6 py-16 md:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="mono text-[10px] uppercase tracking-[3px] text-muted">Continuous Care Portal</div>
            <div className="mt-4 font-serif text-2xl text-cream">
              Multi-agent clinical review, <span className="italic gold-text">built for physicians.</span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">{DISCLAIMER}</p>
          </div>

          <div>
            <div className="mono text-[10px] uppercase tracking-[2px] text-muted">Sections</div>
            <ul className="mt-4 space-y-2 text-sm text-cream">
              <li><a href="#overview" className="hover:text-[--gold]">Patient Overview</a></li>
              <li><a href="#archivist" className="hover:text-[--gold]">Archivist Analysis</a></li>
              <li><a href="#specialists" className="hover:text-[--gold]">Specialist Board</a></li>
              <li><a href="#consensus" className="hover:text-[--gold]">Consensus</a></li>
              <li><a href="#review" className="hover:text-[--gold]">Review Workspace</a></li>
              <li><a href="#audit" className="hover:text-[--gold]">Audit Trail</a></li>
            </ul>
          </div>

          <div>
            <div className="mono text-[10px] uppercase tracking-[2px] text-muted">Principles</div>
            <ul className="mt-4 space-y-2 text-sm text-cream">
              <li>Provenance</li>
              <li>Grounding Validation</li>
              <li>Human Oversight</li>
              <li>Full Audit Trail</li>
              <li>Measured Confidence</li>
            </ul>
          </div>
        </div>

        <div className="hairline my-10" />

        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="mono text-[10px] uppercase tracking-[2px] text-muted">
            © 2026 · Continuous Care Portal · Hackathon Prototype
          </div>
          <div className="mono text-[10px] uppercase tracking-[2px] text-muted">
            v1.0 · Frontend Only · Mock Data
          </div>
        </div>
      </div>
    </footer>
  );
}
