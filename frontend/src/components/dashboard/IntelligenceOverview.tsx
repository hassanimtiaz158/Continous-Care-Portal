import React from "react";
import { StatCard } from "../shared/StatCard";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";

export function IntelligenceOverview({
  totalPatients,
  criticalCount,
  reviewCount,
  patients = [],
}: {
  totalPatients: number;
  criticalCount: number;
  reviewCount: number;
  patients?: any[];
}) {
  const statusData = [
    { name: "Critical", value: criticalCount, color: "#f43f5e" }, // rose-500
    { name: "Review", value: reviewCount, color: "#eab308" }, // gold/yellow
    { name: "Stable", value: totalPatients - criticalCount - reviewCount, color: "#14b8a6" }, // teal-500
  ];

  // Compute average AI confidence from real patient backend data
  let totalConf = 0;
  let confCount = 0;
  patients.forEach((p) => {
    if (p.agents) {
      Object.values(p.agents).forEach((agent: any) => {
        if (agent && agent.conf) {
          totalConf += agent.conf;
          confCount += 1;
        }
      });
    }
  });
  const avgConfidence = confCount > 0 ? Math.round(totalConf / confCount) : 0;

  return (
    <div className="flex flex-col gap-4 mb-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Patients" value={totalPatients} />
        <StatCard label="Critical Cases" value={criticalCount} highlight={criticalCount > 0} />
        <StatCard label="Pending Review" value={reviewCount} />
        {avgConfidence > 0 ? (
          <StatCard label="Avg AI Confidence" value={`${avgConfidence}%`} />
        ) : (
          <StatCard label="Avg AI Confidence" value="--" />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-void-2 border border-line p-4 h-64 flex flex-col">
          <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted mb-4">
            Cohort Distribution
          </h4>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="none"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #262626",
                    borderRadius: 0,
                  }}
                  itemStyle={{ fontSize: "12px", fontFamily: "monospace" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-void-2 border border-line p-4 h-64 flex flex-col justify-center items-center text-center">
          <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">
            Board Processing Time
          </h4>
          <p className="text-xs text-muted/70 max-w-[200px] font-mono leading-relaxed mt-4">
            Processing history requires at least 7 days of clinical deliberation data to render.
          </p>
        </div>
      </div>
    </div>
  );
}
