import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '../ui/card';

interface StatCardProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  className?: string;
}

export function StatCard({ label, value, highlight, className }: StatCardProps) {
  return (
    <Card className={cn(
      "bg-void-2 border-line", 
      highlight && "border-gold bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gold/10 to-transparent",
      className
    )}>
      <CardContent className="p-4 flex flex-col gap-1 text-center">
        <span className={cn("text-[10px] uppercase tracking-widest font-mono", highlight ? "text-gold" : "text-muted")}>{label}</span>
        <span className="text-lg font-serif text-cream">{value}</span>
      </CardContent>
    </Card>
  );
}
