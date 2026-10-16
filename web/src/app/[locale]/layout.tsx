import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import { getDictionary, isLocale, locales } from "@/i18n/config";
import { I18nProvider } from "@/i18n/provider";
import { getSession } from "@/lib/auth";
import { isListingOwner } from "@/lib/users";
import "../globals.css";

export const metadata: Metadata = {
  title: "ParkSpot",
  description: "Find and book parking spaces / ค้นหาและจองที่จอดรถ",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await getSession();
  const initialUser = session
    ? {
        id: session.userId,
        name: session.name,
        role: session.role,
        isOwner: await isListingOwner(session.userId).catch(() => false),
      }
    : null;

  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale} dict={getDictionary(locale)}>
          <AuthProvider initialUser={initialUser}>
            <Navbar />
            {children}
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
