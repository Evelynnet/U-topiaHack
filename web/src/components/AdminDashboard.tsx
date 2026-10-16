"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney, todayBangkok } from "@/lib/format";
import type { StatTotals } from "@/lib/types";
import { useI18n } from "@/i18n/provider";
import { Stat } from "./OwnerDashboard";

type Totals = StatTotals & { users: number };

interface AdminStats {
  date: string;
  counts: { users: number; owners: number; pending: number; approved: number; rejected: number };
  now: { users: number; cars: number; motorcycles: number };
  hourly: { hour: number; users: number; cars: number; motorcycles: number }[];
  totals: { today: Totals; week: Totals };
}

function PeriodCard({ title, totals }: { title: string; totals: Totals }) {
  const { t } = useI18n();
  const d = t.adminDash;
  return (
    <section className="card">
      <h2>{title}</h2>
      <div className="stats">
        <Stat label={d.customers} value={String(totals.users)} />
        <Stat label={d.vehicles} value={String(totals.cars + totals.motorcycles)} sub={`🚗 ${totals.cars} · 🏍️ ${totals.motorcycles}`} />
        <Stat label={d.gross} value={formatMoney(totals.gross)} />
        <Stat label={d.agencyIncome} value={formatMoney(totals.commission)} />
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const { locale, t } = useI18n();
  const d = t.adminDash;
  const [date, setDate] = useState(todayBangkok());
  const [data, setData] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<AdminStats>(`/api/admin/stats?date=${encodeURIComponent(date)}`)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(t, err));
      });
    return () => {
      cancelled = true;
    };
  }, [date, t]);

  const peak = data
    ? data.hourly.reduce((best, h) => (h.cars + h.motorcycles > best.cars + best.motorcycles ? h : best), data.hourly[0])
    : undefined;
  const maxVehicles = Math.max(1, ...(data?.hourly.map((h) => h.cars + h.motorcycles) ?? [0]));

  return (
    <div className="page">
      <div className="spread" style={{ marginBottom: 12 }}>
        <h1>{d.title}</h1>
        <Link className="btn" href={`/${locale}/admin`}>
          ✅ {d.reviewButton}
          {data && data.counts.pending > 0 && <span className="count-pill">{data.counts.pending}</span>}
        </Link>
      </div>

      {error && <div className="alert error">{error}</div>}
      {!data && !error && <p className="muted">{t.common.loading}</p>}

      {data && (
        <>
          <section className="card">
            <h2>{d.now}</h2>
            <div className="stats">
              <Stat label={d.customersNow} value={String(data.now.users)} />
              <Stat label={d.vehicles} value={String(data.now.cars + data.now.motorcycles)} sub={`🚗 ${data.now.cars} · 🏍️ ${data.now.motorcycles}`} />
              <Stat label={d.totalUsers} value={String(data.counts.users)} sub={`${d.owners}: ${data.counts.owners}`} />
              <Stat
                label={d.listings}
                value={String(data.counts.approved)}
                sub={`${d.pending}: ${data.counts.pending} · ${d.rejected}: ${data.counts.rejected}`}
              />
            </div>
          </section>

          <PeriodCard title={t.ownerDash.today} totals={data.totals.today} />
          <PeriodCard title={t.ownerDash.week} totals={data.totals.week} />

          <section className="card">
            <div className="spread">
              <h2>{d.hourlyTitle}</h2>
              <label className="inline-field">
                <span className="muted small">{d.pickDate}</span>
                <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
              </label>
            </div>

            <div className="legend" style={{ marginTop: 0 }}>
              <span><i style={{ background: "var(--primary)" }} />🚗 {t.common.car}</span>
              <span><i style={{ background: "var(--warn)" }} />🏍️ {t.common.motorcycle}</span>
            </div>

            <div className="hchart" role="img" aria-label={d.hourlyTitle}>
              {data.hourly.map((h) => {
                const total = h.cars + h.motorcycles;
                return (
                  <div
                    className="hcol"
                    key={h.hour}
                    title={`${String(h.hour).padStart(2, "0")}:00 — ${d.customers}: ${h.users} · 🚗 ${h.cars} · 🏍️ ${h.motorcycles}`}
                  >
                    <span className="hnum">{total > 0 ? h.users : ""}</span>
                    <span className="hstack" style={{ height: `${(total / maxVehicles) * 100}%` }}>
                      <span style={{ flexGrow: h.motorcycles, background: "var(--warn)" }} />
                      <span style={{ flexGrow: h.cars, background: "var(--primary)" }} />
                    </span>
                    <span className="hlabel">{h.hour % 3 === 0 ? String(h.hour).padStart(2, "0") : ""}</span>
                  </div>
                );
              })}
            </div>
            <p className="muted small" style={{ marginBottom: 0 }}>
              {peak && peak.cars + peak.motorcycles > 0
                ? `${d.peak}: ${String(peak.hour).padStart(2, "0")}:00 (${peak.users} ${d.customersUnit}, ${peak.cars + peak.motorcycles} ${t.ownerDash.unitVehicle})`
                : d.noUsage}
              {" · "}
              {d.chartNote}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
