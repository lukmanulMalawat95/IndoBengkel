"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/lib/api/client";
import type {
  RegisterCustomerInput,
  RegisterWorkshopInput,
  Session,
  User,
  UserRole,
} from "@/lib/api/types";
import {
  clearStoredSession,
  createSession,
  getStoredSession,
  setStoredSession,
  updateStoredUser,
} from "@/lib/auth/session";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  registerCustomer: (input: RegisterCustomerInput) => Promise<User>;
  registerWorkshop: (input: RegisterWorkshopInput) => Promise<User>;
  verifyEmail: () => Promise<User>;
  logout: () => void;
  switchDemoRole: (role: UserRole) => Promise<User>;
  updateUser: (user: User) => void;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const demoEmails: Record<UserRole, string> = {
  customer: "rina@indobengkel.test",
  workshop_owner: "andi@kawahmotor.test",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSession(getStoredSession());
    setIsLoading(false);
  }, []);

  const persist = useCallback(
    (nextSession: Session) => {
      setStoredSession(nextSession);
      setSession(nextSession);
      queryClient.clear();
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const user = await api.login({ email, password });
      persist(createSession(user));
      return user;
    },
    [persist],
  );

  const registerCustomer = useCallback(
    async (input: RegisterCustomerInput) => {
      const user = await api.registerCustomer(input);
      persist(createSession(user));
      return user;
    },
    [persist],
  );

  const registerWorkshop = useCallback(
    async (input: RegisterWorkshopInput) => {
      const user = await api.registerWorkshop(input);
      persist(createSession(user));
      return user;
    },
    [persist],
  );

  const verifyEmail = useCallback(async () => {
    if (!session) throw new Error("No session");
    const user = await api.verifyEmail(session.user.id);
    updateStoredUser(user);
    setSession({ ...session, user });
    return user;
  }, [session]);

  const logout = useCallback(() => {
    clearStoredSession();
    setSession(null);
    queryClient.clear();
  }, [queryClient]);

  const switchDemoRole = useCallback(
    async (role: UserRole) => {
      return login(demoEmails[role], "password123");
    },
    [login],
  );

  const updateUser = useCallback((user: User) => {
    updateStoredUser(user);
    setSession((current) => (current ? { ...current, user } : current));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isAuthenticated: Boolean(session),
      login,
      registerCustomer,
      registerWorkshop,
      verifyEmail,
      logout,
      switchDemoRole,
      updateUser,
      hasRole: (role: UserRole) => session?.user.role === role,
    }),
    [
      session,
      isLoading,
      login,
      registerCustomer,
      registerWorkshop,
      verifyEmail,
      logout,
      switchDemoRole,
      updateUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
