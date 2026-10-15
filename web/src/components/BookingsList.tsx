"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, postJson } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useI18n } from "@/i18n/provider";

interface MyBooking {
  id: string;
  title: string;
  address: string;
  vehicleType: "car" | "motorcycle";
  startAt: string;
  endAt: string;
  status: "confirmed" | "cancelled";
  totalPrice: number;
}

export default function BookingsList() {
  const { locale, t } = useI18n();
  const [items, setItems] = useState<MyBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ bookings: MyBooking[] }>("/api/bookings");
      setItems(d.bookings);
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancel(id: string) {
    setError(null);
    try {
      await postJson(`/api/bookings/${id}/cancel`);
      await load();
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

  const now = Date.now();

  return (
    <div className="page">
      <h1>{t.bookings.title}</h1>
      {error && <div className="alert error">{error}</div>}
      {!items && !error && <p className="muted">{t.common.loading}</p>}
      {items?.length === 0 && <p className="muted">{t.bookings.empty}</p>}

      {items?.map((b) => (
        <div className="card" key={b.id}>
          <div className="spread">
            <div>
              <h2>{b.title}</h2>
              <p className="muted" style={{ marginBottom: 4 }}>{b.address}</p>
              <p style={{ marginBottom: 0 }}>
                {b.vehicleType === "car" ? "🚗" : "🏍️"} {formatDateTime(b.startAt, locale)} →{" "}
                {formatDateTime(b.endAt, locale)} · {formatMoney(b.totalPrice)}
              </p>
            </div>
            <span className={`badge ${b.status}`}>{t.bookings.status[b.status]}</span>
          </div>
          {b.status === "confirmed" && new Date(b.startAt).getTime() > now && (
            <button className="btn secondary small" style={{ marginTop: 10 }} onClick={() => cancel(b.id)}>
              {t.bookings.cancel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
