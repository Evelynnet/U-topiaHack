"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { postJson } from "@/lib/api-client";
import { useI18n } from "@/i18n/provider";

interface Props {
  user: { name: string; role: "user" | "admin" } | null;
}

export default function Navbar({ user }: Props) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  const other = locale === "th" ? "en" : "th";
  const switchHref = pathname.replace(/^\/(th|en)(?=\/|$)/, `/${other}`);

  const links = user
    ? [
        { href: `/${locale}/map`, label: t.nav.map },
        { href: `/${locale}/owner/new`, label: t.nav.addListing },
        { href: `/${locale}/owner`, label: t.nav.myListings },
        { href: `/${locale}/bookings`, label: t.nav.myBookings },
        ...(user.role === "admin" ? [{ href: `/${locale}/admin`, label: t.nav.admin }] : []),
      ]
    : [];

  async function logout() {
    await postJson("/api/auth/logout").catch(() => null);
    router.push(`/${locale}/login`);
    router.refresh();
  }

  return (
    <header className="navbar">
      <Link className="brand" href={`/${locale}`}>
        🅿️ {t.common.appName}
      </Link>
      <nav>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="right">
        <Link href={switchHref} className="btn secondary small" aria-label={t.common.language}>
          {other.toUpperCase()}
        </Link>
        {user ? (
          <button className="btn secondary small" onClick={logout}>
            {t.common.logout}
          </button>
        ) : (
          <Link href={`/${locale}/login`} className="btn small">
            {t.common.login}
          </Link>
        )}
      </div>
    </header>
  );
}
