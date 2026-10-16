"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, postJson } from "@/lib/api-client";
import type { AuthUser } from "@/lib/types";
import { useI18n } from "@/i18n/provider";
import AuthModal from "./AuthModal";

interface LoginRequest {
  reason?: string;
  mode?: "login" | "register";
  /** Runs once, right after a successful login/sign-up from the pop-up. */
  onSuccess?: () => void;
}

interface AuthValue {
  user: AuthUser | null;
  /**
   * Returns true when already signed in. Otherwise opens the login pop-up (over a blurred
   * page) and returns false; `onSuccess` runs after the person signs in.
   */
  requireLogin: (reason?: string, onSuccess?: () => void) => boolean;
  openLogin: (req?: LoginRequest) => void;
  logout: () => Promise<void>;
  /** Re-reads the account from the server (e.g. after the person becomes an owner). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: AuthUser | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [modal, setModal] = useState<{ mode: "login" | "register"; reason?: string } | null>(null);

  const userRef = useRef(user);
  userRef.current = user;
  const onSuccessRef = useRef<(() => void) | undefined>(undefined);

  const openLogin = useCallback((req: LoginRequest = {}) => {
    onSuccessRef.current = req.onSuccess;
    setModal({ mode: req.mode ?? "login", reason: req.reason });
  }, []);

  const requireLogin = useCallback(
    (reason?: string, onSuccess?: () => void) => {
      if (userRef.current) return true;
      openLogin({ reason, onSuccess });
      return false;
    },
    [openLogin],
  );

  const closeModal = useCallback(() => {
    onSuccessRef.current = undefined;
    setModal(null);
  }, []);

  const handleAuthed = useCallback(
    (u: AuthUser) => {
      setUser(u);
      setModal(null);
      const callback = onSuccessRef.current;
      onSuccessRef.current = undefined;
      router.refresh(); // server components pick up the new session cookie
      if (callback) setTimeout(callback, 0);
    },
    [router],
  );

  const logout = useCallback(async () => {
    await postJson("/api/auth/logout").catch(() => null);
    setUser(null);
    router.push(`/${locale}`);
    router.refresh();
  }, [locale, router]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api<{ user: AuthUser }>("/api/auth/me");
      setUser(data.user);
    } catch {
      /* keep what we have; the next full page load will sync it */
    }
  }, []);

  // Links like /th?login=1&next=/th/owner/new (the middleware sends guests here) open the pop-up.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("login") && !params.has("signup")) return;

    const rawNext = params.get("next");
    const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;

    if (!userRef.current) {
      openLogin({
        mode: params.has("signup") ? "register" : "login",
        reason: next ? t.auth.loginRequired : undefined,
        onSuccess: next ? () => router.push(next) : undefined,
      });
    } else if (next) {
      router.replace(next);
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, [openLogin, router, t]);

  const value = useMemo<AuthValue>(
    () => ({ user, requireLogin, openLogin, logout, refreshUser }),
    [user, requireLogin, openLogin, logout, refreshUser],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {modal && (
        <AuthModal mode={modal.mode} reason={modal.reason} onClose={closeModal} onAuthed={handleAuthed} />
      )}
    </AuthContext.Provider>
  );
}
