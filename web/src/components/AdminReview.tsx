"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, postJson } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useI18n } from "@/i18n/provider";

interface PendingListing {
  id: string;
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  areaSqm: number | null;
  carCapacity: number;
  motorcycleCapacity: number;
  carPricePerHour: number;
  motoPricePerHour: number;
  aiReview: { summary?: string } | null;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
  photos: string[];
}

function ReviewCard({ item, onDone }: { item: PendingListing; onDone: () => void }) {
  const { locale, t } = useI18n();
  const [commission, setCommission] = useState("15");
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: unknown) {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/admin/listings/${item.id}`, body);
      onDone();
    } catch (err) {
      setError(errorMessage(t, err));
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="spread">
        <h2>{item.title}</h2>
        <span className="muted">{formatDateTime(item.createdAt, locale)}</span>
      </div>
      <p className="muted">{item.address}</p>
      {item.description && <p>{item.description}</p>}
      <p style={{ marginBottom: 4 }}>
        {t.admin.owner}: {item.ownerName} ({item.ownerEmail})
      </p>
      <p style={{ marginBottom: 4 }}>
        {t.admin.capacity}: 🚗 {item.carCapacity} · 🏍️ {item.motorcycleCapacity}
        {item.areaSqm !== null && <> · {t.admin.area}: {item.areaSqm} m²</>}
      </p>
      <p style={{ marginBottom: 4 }}>
        {t.admin.price}: 🚗 {formatMoney(item.carPricePerHour)}
        {t.common.perHour} · 🏍️ {formatMoney(item.motoPricePerHour)}
        {t.common.perHour}
      </p>
      <p>
        <a href={`https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lng}#map=18/${item.lat}/${item.lng}`} target="_blank" rel="noreferrer">
          {item.lat.toFixed(5)}, {item.lng.toFixed(5)} ↗
        </a>
      </p>
      {item.photos.length > 0 && (
        <div className="thumbs">
          {item.photos.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" />
            </a>
          ))}
        </div>
      )}
      {item.aiReview?.summary && (
        <div className="alert success">
          <strong>{t.admin.aiReview}:</strong> {item.aiReview.summary}
        </div>
      )}

      {error && <div className="alert error">{error}</div>}

      {rejecting ? (
        <div>
          <div className="field">
            <label htmlFor={`r-${item.id}`}>{t.admin.reason}</label>
            <textarea id={`r-${item.id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn danger" disabled={busy || !reason.trim()} onClick={() => send({ action: "reject", reason })}>
              {t.admin.reject}
            </button>
            <button className="btn secondary" disabled={busy} onClick={() => setRejecting(false)}>
              {t.common.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ width: 150 }}>
            <label htmlFor={`c-${item.id}`}>{t.admin.commission}</label>
            <input id={`c-${item.id}`} type="number" min="0" max="100" step="0.5" value={commission} onChange={(e) => setCommission(e.target.value)} />
          </div>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              send({
                action: "approve",
                commissionRate: Math.min(Math.max(Number(commission) || 0, 0), 100) / 100,
              })
            }
          >
            {t.admin.approve}
          </button>
          <button className="btn secondary" disabled={busy} onClick={() => setRejecting(true)}>
            {t.admin.reject}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminReview() {
  const { t } = useI18n();
  const [items, setItems] = useState<PendingListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ listings: PendingListing[] }>("/api/admin/listings?status=pending");
      setItems(d.listings);
      setError(null);
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="page">
      <h1>{t.admin.title}</h1>
      {error && <div className="alert error">{error}</div>}
      {!items && !error && <p className="muted">{t.common.loading}</p>}
      {items?.length === 0 && <p className="muted">{t.admin.empty}</p>}
      {items?.map((item) => (
        <ReviewCard key={item.id} item={item} onDone={load} />
      ))}
    </div>
  );
}
