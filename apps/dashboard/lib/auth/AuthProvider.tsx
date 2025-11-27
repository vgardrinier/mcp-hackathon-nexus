"use client";

import { createContext, useContext, useEffect, useState } from "react";

type LocalUser = {
  id: string;
  email: string | null;
};

interface AuthContextType {
  user: LocalUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Local-only mode: always signed in as a single user
    setUser({ id: "local-user", email: null });
    setLoading(false);
  }, []);

  const signOut = async () => {
    // No-op in local mode, but keep signature for components
    setUser({ id: "local-user", email: null });
  };

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

