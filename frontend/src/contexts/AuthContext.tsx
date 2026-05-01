import { createContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import type { AuthResponse, User } from "../types";

interface AuthContextValue {
  token: string | null;
  user: User | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  token: null,
  user: null,
  ready: false,
  login: async () => undefined,
  logout: () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("oncf_token"));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("oncf_user");
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) {
      setReady(true);
      return;
    }
    api
      .me(token)
      .then(setUser)
      .catch(() => logout())
      .finally(() => setReady(true));
  }, [token]);

  async function login(username: string, password: string) {
    const result: AuthResponse = await api.login(username, password);
    setToken(result.access_token);
    setUser(result.user);
    localStorage.setItem("oncf_token", result.access_token);
    localStorage.setItem("oncf_user", JSON.stringify(result.user));
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("oncf_token");
    localStorage.removeItem("oncf_user");
    setReady(true);
  }

  return <AuthContext.Provider value={{ token, user, ready, login, logout }}>{children}</AuthContext.Provider>;
}
