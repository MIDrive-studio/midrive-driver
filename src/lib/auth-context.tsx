import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSession } from "@/lib/session";
import { useDriver } from "@/lib/driver";
import { supabase } from "@/lib/supabase";
import type { Driver } from "@/types/driver";

type AuthContextValue = {
  loading: boolean;
  /** Why the sign-in check failed, when it did. Shown rather than swallowed. */
  sessionError: string | null;
  isSignedIn: boolean;
  driver: Driver | null;
  driverError: string | null;
  reloadDriver: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading, error: sessionError } = useSession();
  const { driver, loading: driverLoading, error: driverError, reload } = useDriver(session?.user.id);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading: sessionLoading || (Boolean(session) && driverLoading),
      sessionError,
      isSignedIn: Boolean(session),
      driver,
      driverError,
      reloadDriver: reload,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, sessionLoading, sessionError, driver, driverError, driverLoading, reload]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
