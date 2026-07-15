import React, { useEffect, useState } from "react";
import { StatCard } from "../shared/StatCard";
import { motion } from "framer-motion";
import { healthCheck } from "@/lib/api";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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

  // Real backend round-trip latency (replaces the old "7 days of data" placeholder)
  const [latency, setLatency] = useState<string>("—");
  useEffect(() => {
    let alive = true;
    const measure = async () => {
      const start = Date.now();
      try {
        await healthCheck();
        if (alive) setLatency(`${Date.now() - start}ms`);
      } catch {
        if (alive) setLatency("offline");
      }
    };
    measure();
    const id = setInterval(measure, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 mb-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Patients" value={totalPatients} />
        <StatCard label="Critical Cases" value={criticalCount} highlight={criticalCount > 0} />
        <StatCard label="Pending Review" value={reviewCount} />
        {avgConfidence > 0 ? (
          <StatCard label="Avg AI Confidence" value={`${avgConfidence}%`} />
        ) : (
          <StatCard label="Avg AI Confidence" value="N/A" />
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
          <div className="flex items-center justify-center gap-4 mt-2">
            {statusData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
                  {entry.name} {entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-void-2 border border-line p-4 h-64 flex flex-col justify-center items-center text-center">
          <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">
            SHURA Core Latency
          </h4>
          <div className="text-3xl font-mono text-gold tracking-tight">{latency}</div>
          <p className="text-[10px] text-muted/70 font-mono leading-relaxed mt-3 max-w-[200px]">
            Live backend round-trip. Board deliberation streams in real time when DASHSCOPE_API_KEY
            is configured.
          </p>
        </div>
      </div>
    </div>
  );
}
