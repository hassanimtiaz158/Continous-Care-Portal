import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { AIStatusBadge } from '../shared/AIStatusBadge';
import { ConfidenceMeter } from '../shared/ConfidenceMeter';
import { SectionHeader } from '../shared/SectionHeader';
import { motion } from 'framer-motion';

// Using PatientData interface from index.tsx shape
interface PatientQueueItem {
  id: string;
  name: string;
  status: 'crit' | 'stable' | 'review';
  dx: string;
}

export function PriorityQueue({ patients, onOpenPatient }: { patients: PatientQueueItem[], onOpenPatient: (p: PatientQueueItem) => void }) {
  const criticalPatients = patients.filter(p => p.status === 'crit' || p.status === 'review').slice(0, 5);

  if (criticalPatients.length === 0) {
    return (
      <div className="mb-8">
        <SectionHeader title="Priority Queue" subtitle="Cases requiring immediate attention" />
        <Card className="bg-void-2 border-line border-dashed">
          <CardContent className="p-8 text-center text-muted font-mono text-sm">
            No critical cases in the queue.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <SectionHeader title="Priority Queue" subtitle="Cases requiring immediate attention" />
      <div className="flex flex-col gap-2">
        {criticalPatients.map((patient, i) => (
          <motion.div 
            key={patient.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="bg-void-2 border-line hover:border-gold/30 hover:bg-void-3 transition-all group overflow-hidden">
              <CardContent className="p-3 md:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-full bg-void flex items-center justify-center border border-line text-cream font-serif text-sm">
                    {patient.name.substring(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-cream">{patient.name}</span>
                      <span className="text-[10px] font-mono text-muted">#{patient.id}</span>
                      {patient.status === 'crit' && <Badge variant="destructive">Critical</Badge>}
                      {patient.status === 'review' && <Badge variant="outline" className="border-gold text-gold">Review</Badge>}
                    </div>
                    <div className="text-xs text-muted truncate max-w-md">{patient.dx}</div>
                  </div>
                </div>

                <div className="flex items-center gap-6 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                  <div className="flex flex-col gap-1 min-w-[120px]">
                    <span className="text-[9px] uppercase tracking-widest text-muted font-mono">Consensus</span>
                    <AIStatusBadge status={patient.status === 'crit' ? 'error' : 'verified'} />
                  </div>
                  <div className="flex flex-col gap-1 min-w-[100px]">
                    <span className="text-[9px] uppercase tracking-widest text-muted font-mono">Confidence</span>
                    <ConfidenceMeter score={patient.status === 'crit' ? 65 : 92} />
                  </div>
                  <div className="shrink-0">
                    <Button variant="outline" size="sm" onClick={() => onOpenPatient(patient)} className="h-8 text-xs font-mono uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                      Open Case
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
