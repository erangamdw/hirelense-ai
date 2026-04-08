"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { fetchCurrentUser, loginUser, registerUser } from "@/lib/api/auth";
import type { CurrentUser, LoginPayload, RegisterPayload } from "@/lib/api/types";
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from "@/lib/auth/storage";

type AuthStatus = "loading" | "authenticated" | "guest";

type AuthContextValue = {
  accessToken: string | null;
  status: AuthStatus;
  user: CurrentUser | null;
  signIn: (payload: LoginPayload) => Promise<CurrentUser>;
  register: (payload: RegisterPayload) => Promise<CurrentUser>;
  signOut: () => void;
  refresh: () => Promise<CurrentUser | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  async function hydrateSession(token: string) {
    const currentUser = await fetchCurrentUser(token);
    setUser(currentUser);
    setAccessToken(token);
    setStatus("authenticated");
    writeStoredSession({ accessToken: token, user: currentUser });
    return currentUser;
  }

  useEffect(() => {
    const storedSession = readStoredSession();
    if (!storedSession) {
      setStatus("guest");
      return;
    }

    hydrateSession(storedSession.accessToken).catch(() => {
      clearStoredSession();
      setAccessToken(null);
      setUser(null);
      setStatus("guest");
    });
  }, []);

  async function signIn(payload: LoginPayload) {
    const auth = await loginUser(payload);
    return hydrateSession(auth.access_token);
  }

  async function register(payload: RegisterPayload) {
    await registerUser(payload);
    const auth = await loginUser({
      email: payload.email,
      password: payload.password,
    });

    return hydrateSession(auth.access_token);
  }

  async function refresh() {
    if (!accessToken) {
      setStatus("guest");
      return null;
    }

    try {
      return await hydrateSession(accessToken);
    } catch {
      clearStoredSession();
      setAccessToken(null);
      setUser(null);
      setStatus("guest");
      return null;
    }
  }

  function signOut() {
    clearStoredSession();
    setAccessToken(null);
    setUser(null);
    setStatus("guest");
  }

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        status,
        user,
        signIn,
        register,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
