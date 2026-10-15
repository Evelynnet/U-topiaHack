"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { errorMessage, postJson } from "@/lib/api-client";
import { useI18n } from "@/i18n/provider";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson(isRegister ? "/api/auth/register" : "/api/auth/login", {
        ...(isRegister ? { name } : {}),
        email,
        password,
      });
      router.push(`/${locale}/map`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(t, err));
      setBusy(false);
    }
  }

  return (
    <div className="card auth-card">
      <h1>{isRegister ? t.auth.registerTitle : t.auth.loginTitle}</h1>
      <p className="muted">{isRegister ? t.auth.registerSubtitle : t.auth.loginSubtitle}</p>

      {error && <div className="alert error">{error}</div>}

      <form onSubmit={onSubmit}>
        {isRegister && (
          <div className="field">
            <label htmlFor="name">{t.common.name}</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">{t.common.email}</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">{t.common.password}</label>
          <input
            id="password"
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

      <p className="muted" style={{ marginTop: 16, marginBottom: 0 }}>
        {isRegister ? t.auth.haveAccount : t.auth.noAccount}{" "}
        <Link href={`/${locale}/${isRegister ? "login" : "register"}`}>
          {isRegister ? t.common.login : t.common.register}
        </Link>
      </p>
    </div>
  );
}
