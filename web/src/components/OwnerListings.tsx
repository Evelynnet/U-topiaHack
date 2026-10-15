"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/i18n/provider";

interface MyListing {
  id: string;
  title: string;
  address: string;
  status: "pending" | "approved" | "rejected";
  rejectReason: string | null;
  carCapacity: number;
  motorcycleCapacity: number;
  commissionRate: number;
  createdAt: string;
}

export default function OwnerListings() {
  const { locale, t } = useI18n();
  const [items, setItems] = useState<MyListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ listings: MyListing[] }>("/api/listings/mine")
      .then((d) => setItems(d.listings))
      .catch((err) => setError(errorMessage(t, err)));
  }, [t]);

  return (
    <div className="page">
      <div className="spread" style={{ marginBottom: 12 }}>
        <h1>{t.owner.title}</h1>
        <Link className="btn" href={`/${locale}/owner/new`}>
          + {t.nav.addListing}
        </Link>
      </div>

      {error && <div className="alert error">{error}</div>}
      {!items && !error && <p className="muted">{t.common.loading}</p>}
      {items?.length === 0 && <p className="muted">{t.owner.empty}</p>}

      {items?.map((l) => (
        <div className="card" key={l.id}>
          <div className="spread">
            <div>
              <h2>{l.title}</h2>
              <p className="muted" style={{ marginBottom: 4 }}>{l.address}</p>
              <p className="muted" style={{ marginBottom: 0 }}>
                {t.owner.capacity}: 🚗 {l.carCapacity} · 🏍️ {l.motorcycleCapacity} ·{" "}
                {formatDateTime(l.createdAt, locale)}
              </p>
            </div>
            <span className={`badge ${l.status}`}>{t.owner.status[l.status]}</span>
          </div>
          {l.status === "approved" && (
            <p className="muted" style={{ margin: "8px 0 0" }}>
              {t.owner.commission}: {Math.round(l.commissionRate * 1000) / 10}%
            </p>
          )}
          {l.status === "rejected" && l.rejectReason && (
            <div className="alert error" style={{ margin: "10px 0 0" }}>
              {t.owner.reason}: {l.rejectReason}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
