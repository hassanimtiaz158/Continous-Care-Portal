import React from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  subtitle,
  className,
  action,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("flex justify-between items-end mb-4 border-b border-line pb-2", className)}>
      <div>
        <h3 className="text-sm uppercase tracking-widest text-gold font-semibold">{title}</h3>
        {subtitle && <p className="text-[10px] text-muted font-mono mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
