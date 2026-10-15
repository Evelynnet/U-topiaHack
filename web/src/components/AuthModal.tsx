"use client";

import { useEffect, useState, type FormEvent } from "react";
import { errorMessage, postJson } from "@/lib/api-client";
import type { AuthUser } from "@/lib/types";
import { useI18n } from "@/i18n/provider";

// Quick-fill buttons for the mock accounts created by `npm run db:seed -- --demo`.
// Turn off in production by leaving NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS unset (it's read at build time).
const SHOW_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true";

const DEMO_ACCOUNTS = [
  { key: "user", email: "demo@example.com", password: "demo1234" },
  { key: "owner", email: "owner@example.com", password: "owner1234" },
  { key: "admin", email: "admin@example.com", password: "admin1234" },
] as const;

interface Props {
  mode: "login" | "register";
  reason?: string;
  onClose: () => void;
  onAuthed: (user: AuthUser) => void;
}

export default function AuthModal({ mode: initialMode, reason, onClose, onAuthed }: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";
  const demoLabel = { user: t.auth.demoUser, owner: t.auth.demoOwner, admin: t.auth.demoAdmin };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<{ user: AuthUser }>(
        isRegister ? "/api/auth/register" : "/api/auth/login",
        { ...(isRegister ? { name } : {}), email, password },
      );
      onAuthed(res.user);
    } catch (err) {
      setError(errorMessage(t, err));
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={isRegister ? t.auth.registerTitle : t.auth.loginTitle}>
        <button type="button" className="modal-close" onClick={onClose} aria-label={t.map.close}>
          ×
        </button>

        <div className="tabs">
          <button type="button" className={!isRegister ? "on" : ""} onClick={() => switchMode("login")}>
            {t.common.login}
          </button>
          <button type="button" className={isRegister ? "on" : ""} onClick={() => switchMode("register")}>
            {t.common.register}
          </button>
        </div>

        <h2>{isRegister ? t.auth.registerTitle : t.auth.loginTitle}</h2>
        <p className="muted">{isRegister ? t.auth.registerSubtitle : t.auth.loginSubtitle}</p>

        {reason && <div className="alert info">{reason}</div>}
        {error && <div className="alert error">{error}</div>}

        <form onSubmit={onSubmit}>
          {isRegister && (
            <div className="field">
              <label htmlFor="auth-name">{t.common.name}</label>
              <input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">{t.common.email}</label>
            <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus={!isRegister} />
          </div>
          <div className="field">
            <label htmlFor="auth-password">{t.common.password}</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isRegister ? 8 : 1}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
            {isRegister && <div className="hint">{t.auth.passwordHint}</div>}
          </div>
          <button className="btn block" disabled={busy}>
            {busy ? t.common.loading : isRegister ? t.common.register : t.common.login}
          </button>
        </form>

        {SHOW_DEMO && !isRegister && (
          <div className="demo">
            <div className="hint" style={{ marginBottom: 8 }}>{t.auth.demoTitle}</div>
            <div className="chips">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(a.password);
                    setError(null);
                  }}
                >
                  {demoLabel[a.key]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
