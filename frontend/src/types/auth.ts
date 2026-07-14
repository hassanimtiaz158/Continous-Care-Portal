export type Role = "family" | "specialist" | "patient";

export interface User {
  name: string;
  id: string;
  role: Role;
}
