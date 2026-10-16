"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/provider";
import { useAuth } from "./AuthProvider";

export default function Navbar() {
  const { locale, t } = useI18n();
  const { user, requireLogin, openLogin, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const other = locale === "th" ? "en" : "th";
  const switchHref = pathname.replace(/^\/(th|en)(?=\/|$)/, `/${other}`);
  const listHref = `/${locale}/owner/new`;

  function onList() {
    if (requireLogin(t.auth.loginRequiredList, () => router.push(listHref))) router.push(listHref);
  }

  const initial = user?.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="navbar">
      <Link className="brand" href={`/${locale}`}>
        <img src="/logo.png" alt="Jodni" style={{ height: 32, objectFit: "contain" }} />
      </Link>
      <div className="spacer" />
      <div className="right">
        <button type="button" className="btn secondary small" onClick={onList}>
          <span aria-hidden="true">+</span>
          <span className="hide-sm">{t.nav.addListing}</span>
        </button>
        {/* Owners only: people who have never listed a space don't see this. */}
        {user?.isOwner && (
          <Link href={`/${locale}/owner/dashboard`} className="btn secondary small">
            <span aria-hidden="true">📊</span>
            <span className="hide-sm">{t.nav.ownerDashboard}</span>
          </Link>
        )}
        {user?.role === "admin" && (
          <>
            <Link href={`/${locale}/admin/dashboard`} className="btn secondary small">
              <span aria-hidden="true">📈</span>
              <span className="hide-sm">{t.nav.adminDashboard}</span>
            </Link>
            <Link href={`/${locale}/admin`} className="btn secondary small">
              <span aria-hidden="true">✅</span>
              <span className="hide-sm">{t.nav.review}</span>
            </Link>
          </>
        )}
        {user && (
          <Link href={`/${locale}/parking`} className="btn secondary small">
            <span aria-hidden="true">🅿️</span>
            <span className="hide-sm">{t.nav.parking}</span>
          </Link>
        )}
        <Link href={switchHref} className="btn secondary small" aria-label={t.common.language}>
          {other.toUpperCase()}
        </Link>

        {user ? (
          <div className="menu" ref={menuRef}>
            <button
              type="button"
              className="avatar-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t.nav.account}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {initial}
            </button>
            {menuOpen && (
              <div className="dropdown" role="menu">
                <div className="who">
                  <strong>{user.name}</strong>
                  {user.role === "admin" && <span className="badge approved" style={{ marginLeft: 8 }}>{t.nav.admin}</span>}
                </div>
                <Link href={`/${locale}`} role="menuitem">{t.nav.map}</Link>
                <Link href={`/${locale}/bookings`} role="menuitem">{t.nav.myBookings}</Link>
                <Link href={`/${locale}/parking`} role="menuitem">🅿️ {t.nav.parking}</Link>
                <Link href={`/${locale}/owner`} role="menuitem">{t.nav.myListings}</Link>
                {user.isOwner && (
                  <Link href={`/${locale}/owner/dashboard`} role="menuitem">{t.nav.ownerDashboard}</Link>
                )}
                <Link href={listHref} role="menuitem">{t.nav.addListing}</Link>
                {user.role === "admin" && (
                  <>
                    <Link href={`/${locale}/admin/dashboard`} role="menuitem">{t.nav.adminDashboard}</Link>
                    <Link href={`/${locale}/admin`} role="menuitem">{t.nav.review}</Link>
                  </>
                )}
                <button type="button" role="menuitem" onClick={logout}>
                  {t.common.logout}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button type="button" className="btn small" onClick={() => openLogin()}>
            {t.common.login}
          </button>
        )}
      </div>
    </header>
  );
}
