import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type JudgeCtx = { judgeMode: boolean; toggle: () => void };
const Ctx = createContext<JudgeCtx>({ judgeMode: false, toggle: () => {} });

export function JudgeModeProvider({ children }: { children: ReactNode }) {
  const [judgeMode, setJudgeMode] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("judge-mode", judgeMode);
  }, [judgeMode]);
  return (
    <Ctx.Provider value={{ judgeMode, toggle: () => setJudgeMode(v => !v) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useJudgeMode = () => useContext(Ctx);
