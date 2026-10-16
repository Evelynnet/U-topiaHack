"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { formatDay, formatMoney } from "@/lib/format";
import type { StatTotals } from "@/lib/types";
import { useI18n } from "@/i18n/provider";

interface OwnerStats {
  today: string;
  totals: { today: StatTotals; week: StatTotals };
  listings: {
    id: string;
    title: string;
    status: "pending" | "approved" | "rejected";
    today: StatTotals;
    week: StatTotals;
  }[];
  days: (StatTotals & { date: string })[];
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <span className="muted small">{label}</span>
      <strong>{value}</strong>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}

function Summary({ title, totals }: { title: string; totals: StatTotals }) {
  const { t } = useI18n();
  const d = t.ownerDash;
  return (
    <section className="card">
      <h2>{title}</h2>
      <div className="stats">
        <Stat
          label={d.vehicles}
          value={`${totals.cars + totals.motorcycles} ${d.unitVehicle}`}
          sub={`🚗 ${totals.cars} · 🏍️ ${totals.motorcycles}`}
        />
        <Stat label={d.hours} value={`${totals.hours} ${d.unitHour}`} sub={d.hoursNote} />
        <Stat label={d.gross} value={formatMoney(totals.gross)} sub={`${d.commission} ${formatMoney(totals.commission)}`} />
        <Stat label={d.net} value={formatMoney(totals.net)} />
      </div>
    </section>
  );
}

export default function OwnerDashboard() {
  const { locale, t } = useI18n();
  const d = t.ownerDash;
  const [data, setData] = useState<OwnerStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<OwnerStats>("/api/owner/stats")
      .then(setData)
      .catch((err) => setError(errorMessage(t, err)));
  }, [t]);

  const maxNet = Math.max(1, ...(data?.days.map((x) => x.net) ?? [0]));

  return (
    <div className="page">
      <div className="spread" style={{ marginBottom: 4 }}>
        <h1>{d.title}</h1>
        <Link className="btn secondary" href={`/${locale}/owner`}>
          {t.nav.myListings}
        </Link>
      </div>
      <p className="muted">{d.subtitle}</p>

      {error && <div className="alert error">{error}</div>}
      {!data && !error && <p className="muted">{t.common.loading}</p>}

      {data && (
        <>
          <Summary title={d.today} totals={data.totals.today} />
          <Summary title={d.week} totals={data.totals.week} />

          <section className="card">
            <h2>{d.daily}</h2>
            <div className="bars">
              {data.days.map((day) => (
                <div className={`bar-row${day.date === data.today ? " today" : ""}`} key={day.date}>
                  <span className="bar-label">{formatDay(day.date, locale)}</span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${(day.net / maxNet) * 100}%` }} />
                  </span>
                  <span className="bar-value">
                    {day.cars + day.motorcycles} {d.unitVehicle} · {day.hours} {d.unitHour} · {formatMoney(day.net)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2>{d.perListing}</h2>
            {data.listings.length === 0 && <p className="muted">{d.noListings}</p>}
            {data.listings.map((l) => (
              <div className="card" key={l.id}>
                <div className="spread">
                  <h3>{l.title}</h3>
                  <span className={`badge ${l.status}`}>{t.owner.status[l.status]}</span>
                </div>
                {l.status !== "approved" ? (
                  <p className="muted" style={{ marginBottom: 0 }}>{d.notLive}</p>
                ) : (
                  <table className="mini-table">
                    <thead>
                      <tr>
                        <th />
                        <th>{d.vehicles}</th>
                        <th>{d.hours}</th>
                        <th>{d.net}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          [d.today, l.today],
                          [d.week, l.week],
                        ] as const
                      ).map(([label, s]) => (
                        <tr key={label}>
                          <th scope="row">{label}</th>
                          <td>
                            {s.cars + s.motorcycles} <span className="muted small">(🚗 {s.cars} · 🏍️ {s.motorcycles})</span>
                          </td>
                          <td>{s.hours}</td>
                          <td>{formatMoney(s.net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </section>

          <p className="muted small">{d.note}</p>
        </>
      )}
    </div>
  );
}
