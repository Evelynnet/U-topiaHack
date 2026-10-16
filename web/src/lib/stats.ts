import { query } from "./db";
import { addDays, bangkokToIso, todayBangkok, weekStartOf } from "./format";
import type { StatTotals } from "./types";

/**
 * Dashboard numbers. All periods are Thailand-time days/weeks (Mon-Sun). A booking that
 * straddles a boundary is counted in both periods, but its hours and money are split in
 * proportion to the hours that fall inside each one.
 */

export interface Period {
  key: string;
  from: string; // ISO instants
  to: string;
}

export function currentPeriods() {
  const today = todayBangkok();
  const weekStart = weekStartOf(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const periods: Period[] = [
    { key: "today", from: bangkokToIso(today, 0), to: bangkokToIso(addDays(today, 1), 0) },
    { key: "week", from: bangkokToIso(weekStart, 0), to: bangkokToIso(addDays(weekStart, 7), 0) },
    ...days.map((d, i) => ({ key: `d${i}`, from: bangkokToIso(d, 0), to: bangkokToIso(addDays(d, 1), 0) })),
  ];
  return { today, weekStart, days, periods };
}

export const emptyTotals = (): StatTotals => ({
  cars: 0,
  motorcycles: 0,
  hours: 0,
  gross: 0,
  commission: 0,
  net: 0,
});

const round2 = (n: number) => Math.round(n * 100) / 100;

export function addTotals(a: StatTotals, b: StatTotals): StatTotals {
  return finish({
    cars: a.cars + b.cars,
    motorcycles: a.motorcycles + b.motorcycles,
    hours: a.hours + b.hours,
    gross: a.gross + b.gross,
    commission: a.commission + b.commission,
    net: 0,
  });
}

function finish(t: StatTotals): StatTotals {
  return {
    cars: t.cars,
    motorcycles: t.motorcycles,
    hours: round2(t.hours),
    gross: round2(t.gross),
    commission: round2(t.commission),
    net: round2(t.gross - t.commission),
  };
}

// Hours of a booking that fall inside the period (ov) and the booking's full length (bh).
const OVERLAP = `
  CROSS JOIN LATERAL (
    SELECT extract(epoch FROM (least(b.end_at, p.to_at) - greatest(b.start_at, p.from_at))) / 3600.0 AS ov,
           extract(epoch FROM (b.end_at - b.start_at)) / 3600.0 AS bh
  ) x`;

const PERIOD_JOIN = `
  FROM unnest($2::text[], $3::timestamptz[], $4::timestamptz[]) AS p(k, from_at, to_at)
  JOIN bookings b ON b.status = 'confirmed' AND b.start_at < p.to_at AND b.end_at > p.from_at`;

function periodParams(periods: Period[]) {
  return [periods.map((p) => p.key), periods.map((p) => p.from), periods.map((p) => p.to)];
}

interface OwnerRow {
  k: string;
  listing_id: string;
  vehicle_type: "car" | "motorcycle";
  bookings: number;
  hours: number;
  gross: number;
  commission: number;
}

/** Per period and per listing totals for one owner. Keys: period key -> listing id -> totals. */
export async function ownerStats(ownerId: string, periods: Period[]) {
  const rows = await query<OwnerRow>(
    `SELECT p.k, b.listing_id, b.vehicle_type,
            count(*)::int AS bookings,
            sum(x.ov)::float8 AS hours,
            sum(b.total_price * x.ov / x.bh)::float8 AS gross,
            sum(b.commission * x.ov / x.bh)::float8 AS commission
     ${PERIOD_JOIN}
     JOIN listings l ON l.id = b.listing_id AND l.owner_id = $1
     ${OVERLAP}
     GROUP BY p.k, b.listing_id, b.vehicle_type`,
    [ownerId, ...periodParams(periods)],
  );

  const byPeriod = new Map<string, StatTotals>();
  const byListing = new Map<string, Map<string, StatTotals>>(); // period -> listing -> totals
  for (const r of rows) {
    const piece = {
      cars: r.vehicle_type === "car" ? r.bookings : 0,
      motorcycles: r.vehicle_type === "motorcycle" ? r.bookings : 0,
      hours: r.hours,
      gross: r.gross,
      commission: r.commission,
      net: 0,
    };
    byPeriod.set(r.k, addTotals(byPeriod.get(r.k) ?? emptyTotals(), piece));
    const inner = byListing.get(r.k) ?? new Map<string, StatTotals>();
    inner.set(r.listing_id, addTotals(inner.get(r.listing_id) ?? emptyTotals(), piece));
    byListing.set(r.k, inner);
  }
  return { byPeriod, byListing };
}

interface AdminRow {
  k: string;
  users: number;
  cars: number;
  motorcycles: number;
  hours: number;
  gross: number;
  commission: number;
}

/** Platform-wide totals per period (plus distinct customers, which can't be summed). */
export async function platformStats(periods: Period[]) {
  const rows = await query<AdminRow>(
    `SELECT p.k,
            count(DISTINCT b.user_id)::int AS users,
            (count(*) FILTER (WHERE b.vehicle_type = 'car'))::int AS cars,
            (count(*) FILTER (WHERE b.vehicle_type = 'motorcycle'))::int AS motorcycles,
            sum(x.ov)::float8 AS hours,
            sum(b.total_price * x.ov / x.bh)::float8 AS gross,
            sum(b.commission * x.ov / x.bh)::float8 AS commission
     FROM unnest($1::text[], $2::timestamptz[], $3::timestamptz[]) AS p(k, from_at, to_at)
     JOIN bookings b ON b.status = 'confirmed' AND b.start_at < p.to_at AND b.end_at > p.from_at
     ${OVERLAP}
     GROUP BY p.k`,
    periodParams(periods),
  );
  const out = new Map<string, StatTotals & { users: number }>();
  for (const r of rows) {
    out.set(r.k, { ...finish({ ...r, net: 0 }), users: r.users });
  }
  return out;
}

/** Customers and vehicles on site in each hour (0-23) of a Thailand-time date. */
export async function hourlyUsage(date: string) {
  return query<{ hour: number; users: number; cars: number; motorcycles: number }>(
    `SELECT g.i AS hour,
            count(DISTINCT b.user_id)::int AS users,
            (count(b.id) FILTER (WHERE b.vehicle_type = 'car'))::int AS cars,
            (count(b.id) FILTER (WHERE b.vehicle_type = 'motorcycle'))::int AS motorcycles
       FROM generate_series(0, 23) AS g(i)
       LEFT JOIN bookings b
              ON b.status = 'confirmed'
             AND b.start_at <= $1::timestamptz + g.i * interval '1 hour'
             AND b.end_at   >  $1::timestamptz + g.i * interval '1 hour'
      GROUP BY g.i ORDER BY g.i`,
    [bangkokToIso(date, 0)],
  );
}

export async function usageRightNow() {
  const rows = await query<{ users: number; cars: number; motorcycles: number }>(
    `SELECT count(DISTINCT user_id)::int AS users,
            (count(*) FILTER (WHERE vehicle_type = 'car'))::int AS cars,
            (count(*) FILTER (WHERE vehicle_type = 'motorcycle'))::int AS motorcycles
       FROM bookings
      WHERE status = 'confirmed' AND start_at <= now() AND end_at > now()`,
  );
  return rows[0];
}

export async function platformCounts() {
  const rows = await query<{
    users: number;
    owners: number;
    pending: number;
    approved: number;
    rejected: number;
  }>(
    `SELECT (SELECT count(*) FROM users)::int AS users,
            (SELECT count(DISTINCT owner_id) FROM listings)::int AS owners,
            (SELECT count(*) FROM listings WHERE status = 'pending')::int AS pending,
            (SELECT count(*) FROM listings WHERE status = 'approved')::int AS approved,
            (SELECT count(*) FROM listings WHERE status = 'rejected')::int AS rejected`,
  );
  return rows[0];
}
