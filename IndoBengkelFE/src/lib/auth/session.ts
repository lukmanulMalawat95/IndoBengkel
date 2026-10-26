import type { Session, User } from "@/lib/api/types";

const SESSION_KEY = "ib_session_v1";

function isBrowser() {
  return typeof window !== "undefined";
}

export function createSession(user: User): Session {
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  return {
    user,
    accessTokenExpiresAt: expires,
    csrfToken: `csrf-${Math.random().toString(36).slice(2)}`,
  };
}

export function getStoredSession(): Session | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function setStoredSession(session: Session) {
  if (!isBrowser()) return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function getSessionUser(): User | null {
  return getStoredSession()?.user ?? null;
}

export function updateStoredUser(user: User) {
  const session = getStoredSession();
  if (!session) return;
  setStoredSession({ ...session, user });
}
