import React, { useEffect, useState } from "react";
import { Card, CardContent } from "../ui/card";
import { SectionHeader } from "../shared/SectionHeader";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { healthCheck } from "@/lib/api";

export function AIHealthPanel() {
  const [status, setStatus] = useState<"Operational" | "Offline" | "Checking...">("Checking...");
  const [ping, setPing] = useState<string>("---");
  const [qwen, setQwen] = useState<"Connected" | "No Key" | "Checking...">("Checking...");

  useEffect(() => {
    const check = async () => {
      const start = Date.now();
      try {
        const h = await healthCheck();
        const ms = Date.now() - start;
        setStatus("Operational");
        setPing(`${ms}ms`);
        setQwen(h.qwen_key_set ? "Connected" : "No Key");
      } catch (e) {
        setStatus("Offline");
        setPing("ERR");
        setQwen("No Key");
      }
    };
    check();
    const interval = setInterval(check, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const systems = [
    { name: "SHURA Core", status: status, ping: ping },
    { name: "Qwen LLM (DashScope)", status: qwen, ping: "---" },
  ];

  return (
    <div className="mb-8">
      <SectionHeader title="Infrastructure Status" subtitle="AI subsystems" />
      <Card className="bg-void border-line">
        <CardContent className="p-0 divide-y divide-line">
          {systems.map((sys, i) => {
            const healthy = sys.status === "Operational" || sys.status === "Connected";
            return (
              <div
                key={i}
                className="flex items-center justify-between p-4 hover:bg-void-2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex h-2 w-2">
                    <span
                      className={cn(
                        "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                        healthy ? "bg-teal" : "bg-rose",
                      )}
                    ></span>
                    <span
                      className={cn(
                        "relative inline-flex rounded-full h-2 w-2",
                        healthy ? "bg-teal" : "bg-rose",
                      )}
                    ></span>
                  </div>
                  <span className="text-sm font-medium text-cream">{sys.name}</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest">
                  <span className="text-muted">{sys.ping}</span>
                  <span
                    className={cn(
                      "w-20 text-right",
                      healthy ? "text-teal" : "text-rose",
                    )}
                  >
                    {sys.status}
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
