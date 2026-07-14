import React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn("flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8", className)}
    >
      <div>
        <h1 className="text-3xl font-serif text-cream mb-2 tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted font-mono">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
