"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "./api";
import { CurrentUser } from "./types";

interface AuthContextType {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      const me = await apiFetch<CurrentUser>("/api/v1/auth/me");
      setUser(me);
      setError(null);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch<{ access_token: string }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: pass }),
      });
      await refreshUser();
      router.push("/");
    } catch (err: any) {
      setLoading(false);
      const msg = err instanceof ApiError ? err.message : "Failed to sign in";
      setError(msg);
      throw err;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } catch (err) {
      // Ignore logout errors
    } finally {
      setUser(null);
      setLoading(false);
      router.push("/login");
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        refreshUser,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
