import React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "../ui/card";

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({
  title,
  value,
  trend,
  trendDirection,
  icon,
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn("bg-void-2 border-line hover:border-gold-dim transition-colors", className)}
    >
      <CardContent className="p-4 flex flex-col justify-between h-full gap-2">
        <div className="flex justify-between items-start">
          <span className="text-[10px] uppercase tracking-widest text-muted font-mono">
            {title}
          </span>
          {icon && <div className="text-muted">{icon}</div>}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-serif text-cream">{value}</span>
          {trend && (
            <span
              className={cn(
                "text-[10px] font-mono",
                trendDirection === "up"
                  ? "text-rose"
                  : trendDirection === "down"
                    ? "text-teal"
                    : "text-muted",
              )}
            >
              {trendDirection === "up" ? "↑" : trendDirection === "down" ? "↓" : ""} {trend}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
