import { useJudgeMode } from "@/lib/judge-mode";
import { Eye, EyeOff } from "lucide-react";

export function JudgeModeToggle() {
  const { judgeMode, toggle } = useJudgeMode();
  return (
    <button
      onClick={toggle}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border px-5 py-3 mono text-[10px] uppercase tracking-[2px] backdrop-blur-md transition-all"
      style={{
        background: judgeMode ? "linear-gradient(135deg, #E9C558, #C9A227)" : "rgba(11,17,25,0.85)",
        color: judgeMode ? "#070B12" : "#EFE9DA",
        borderColor: judgeMode ? "#C9A227" : "rgba(201,162,39,0.4)",
        boxShadow: judgeMode
          ? "0 20px 60px -10px rgba(201,162,39,0.6)"
          : "0 20px 40px -10px rgba(0,0,0,0.5)",
      }}
      aria-pressed={judgeMode}
    >
      {judgeMode ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      Judge Mode {judgeMode ? "On" : "Off"}
    </button>
  );
}
