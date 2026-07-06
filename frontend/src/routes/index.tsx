import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/Hero";
import { PatientOverview } from "@/components/PatientOverview";
import { ArchivistPanel } from "@/components/ArchivistPanel";
import { EvidenceChain } from "@/components/EvidenceChain";
import { SpecialistBoard } from "@/components/SpecialistBoard";
import { GroundingValidation } from "@/components/GroundingValidation";
import { Consensus } from "@/components/Consensus";
import { ReviewWorkspace } from "@/components/ReviewWorkspace";
import { AuditTrail } from "@/components/AuditTrail";
import { Transparency } from "@/components/Transparency";
import { Footer } from "@/components/Footer";
import { JudgeModeToggle } from "@/components/JudgeModeToggle";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main className="relative min-h-screen bg-[--void] text-cream">
      <Hero />
      <PatientOverview />
      <ArchivistPanel />
      <EvidenceChain />
      <SpecialistBoard />
      <GroundingValidation />
      <Consensus />
      <ReviewWorkspace />
      <AuditTrail />
      <Transparency />
      <Footer />
      <JudgeModeToggle />
    </main>
  );
}
