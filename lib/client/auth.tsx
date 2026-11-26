"use client";

import type { User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Role } from "../accounts";
import { ApiError, api } from "./api";
import { getBrowserClient } from "./supabase";

export interface SignedInUser {
  id: string;
  email: string;
  role: Role;
  isSuperadmin: boolean;
}

interface AuthValue {
  /** True until the stored session has been read. */
  loading: boolean;
  user: SignedInUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function toSignedIn(user: User): SignedInUser {
  // UI hint only: the server re-checks the role on every request.
  const role: Role = user.app_metadata?.role === "superadmin" ? "superadmin" : "user";
  return { id: user.id, email: user.email ?? "", role, isSuperadmin: role === "superadmin" };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ loading: boolean; user: SignedInUser | null }>({
    loading: true,
    user: null,
  });

  useEffect(() => {
    const { data } = getBrowserClient().auth.onAuthStateChange((_event, session) => {
      setState({ loading: false, user: session?.user ? toSignedIn(session.user) : null });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getBrowserClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      throw new ApiError(error.status === 429 ? "too_many_requests" : "invalid_credentials", error.status ?? 400);
    }
  }, []);

  const signOut = useCallback(async () => {
    await getBrowserClient().auth.signOut({ scope: "local" });
  }, []);

  const value = useMemo(() => ({ ...state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Current access token (refreshed by supabase-js when needed), or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await getBrowserClient().auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Calls our API as the signed-in account. A rejected session is dropped locally,
 * which sends pages using useRequireAuth back to the login screen.
 */
export async function authApi<T>(path: string, options: Parameters<typeof api>[1] = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new ApiError("login_required", 401);
  try {
    return await api<T>(path, { ...options, token });
  } catch (err) {
    if (err instanceof ApiError && err.code === "login_required") {
      await getBrowserClient().auth.signOut({ scope: "local" });
    }
    throw err;
  }
}

/**
 * For pages that need an account: redirects to /login (then back here) when
 * signed out, and home when `superadmin` is required but missing.
 */
export function useRequireAuth(options: { superadmin?: boolean } = {}): AuthValue & { ready: boolean } {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const missing = !auth.loading && !auth.user;
  const notAllowed = Boolean(options.superadmin && auth.user && !auth.user.isSuperadmin);

  useEffect(() => {
    if (missing) {
      const next = `${pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    } else if (notAllowed) {
      router.replace("/");
    }
  }, [missing, notAllowed, pathname, router]);

  return { ...auth, ready: Boolean(auth.user) && !notAllowed };
}
