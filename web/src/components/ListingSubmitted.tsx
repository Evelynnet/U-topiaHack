"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/i18n/provider";
import { useAuth } from "./AuthProvider";

/** Shown right after an owner submits a space: it now waits for the agency to confirm it. */
export default function ListingSubmitted() {
  const { locale, t } = useI18n();
  const { refreshUser } = useAuth();

  // Submitting a space makes the person an owner: reveal the owner dashboard button.
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2.6rem" }} aria-hidden="true">⏳</div>
        <h1>{t.listing.pendingTitle}</h1>
        <p className="muted">{t.listing.pendingBody}</p>

        <ol className="steps" style={{ textAlign: "left", margin: "24px auto", maxWidth: 340 }}>
          <li className="done">
            <span className="dot">✓</span>
            <strong>{t.listing.stepSent}</strong>
          </li>
          <li className="current">
            <span className="dot">2</span>
            <strong>{t.listing.stepReview}</strong>
          </li>
          <li>
            <span className="dot">3</span>
            <strong>{t.listing.stepLive}</strong>
          </li>
        </ol>

        <div className="stack">
          <Link className="btn block" href={`/${locale}/owner`}>
            {t.listing.viewMine}
          </Link>
          <Link className="btn secondary block" href={`/${locale}`}>
            {t.listing.backToMap}
          </Link>
        </div>
      </div>
    </div>
  );
}
