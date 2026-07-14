import { useState, useCallback } from "react";
import { Role, User } from "../types/auth";
import { PatientData } from "../types/patient";

export function useAppState() {
  const [screen, setScreen] = useState<"cover" | "login" | "grid" | "record">("cover");
  const [role, setRole] = useState<Role>("family");
  const [user, setUser] = useState<User | null>(null);
  const [loginErr, setLoginErr] = useState(false);

  const selectRole = useCallback((r: Role) => setRole(r), []);
  const enterApp = useCallback(() => setScreen("login"), []);

  const doLogin = useCallback(
    (
      name: string,
      id: string,
      allPatients: PatientData[],
      setActivePatient: (p: PatientData) => void,
      setActivePage: (n: number) => void,
    ) => {
      if (!name || !id) {
        setLoginErr(true);
        return;
      }
      setLoginErr(false);
      const u = { name, id, role };
      setUser(u);
      if (role === "patient") {
        setActivePatient(allPatients[0]);
        setActivePage(1);
        setScreen("record");
      } else {
        setScreen("grid");
      }
    },
    [role],
  );

  const logout = useCallback(() => {
    setUser(null);
    setScreen("cover");
  }, []);

  const showGrid = useCallback(() => setScreen("grid"), []);

  return {
    screen,
    setScreen,
    role,
    selectRole,
    user,
    loginErr,
    enterApp,
    doLogin,
    logout,
    showGrid,
  };
}
