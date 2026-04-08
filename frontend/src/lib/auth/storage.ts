import type { CurrentUser } from "@/lib/api/types";

const STORAGE_KEY = "hirelense.auth";

export type StoredSession = {
  accessToken: string;
  user: CurrentUser;
};

function hasWindow() {
  return typeof window !== "undefined";
}

export function readStoredSession(): StoredSession | null {
  if (!hasWindow()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredSession;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function writeStoredSession(session: StoredSession) {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
