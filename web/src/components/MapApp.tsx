"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError, api, errorMessage, postJson } from "@/lib/api-client";
import { bangkokToIso, formatMoney, nextBangkokHour, todayBangkok } from "@/lib/format";
import { stateOf, vehicleOf, type ListingView, type VehicleType } from "@/lib/types";
import { useI18n } from "@/i18n/provider";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="map-loading" />,
});

export default function MapApp() {
  const { locale, t } = useI18n();
  const initial = nextBangkokHour();

  const [date, setDate] = useState(initial.date);
  const [hour, setHour] = useState(initial.hour);
  const [hours, setHours] = useState(2);
  const [vehicle, setVehicle] = useState<VehicleType>("car");

  const [listings, setListings] = useState<ListingView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [bookedTotal, setBookedTotal] = useState<number | null>(null);

  const startIso = bangkokToIso(date, hour);

  const load = useCallback(async () => {
    try {
      const data = await api<{ listings: ListingView[] }>(
        `/api/listings?start=${encodeURIComponent(startIso)}&hours=${hours}`,
      );
      setListings(data.listings);
      setError(null);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setLoaded(true);
    }
  }, [startIso, hours, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Changing the time window invalidates any previous booking message.
  useEffect(() => {
    setBookError(null);
    setBookedTotal(null);
  }, [startIso, hours, vehicle, selectedId]);

  const selected = listings.find((l) => l.id === selectedId) ?? null;
  const selectedState = selected ? stateOf(selected, vehicle) : null;
  const selectedVehicle = selected ? vehicleOf(selected, vehicle) : null;

  async function book() {
    if (!selected) return;
    setBooking(true);
    setBookError(null);
    try {
      const res = await postJson<{ id: string; totalPrice: number }>("/api/bookings", {
        listingId: selected.id,
        vehicleType: vehicle,
        start: startIso,
        hours,
      });
      await load();
      setBookedTotal(res.totalPrice);
    } catch (err) {
      setBookError(errorMessage(t, err));
      if (err instanceof ApiError && (err.code === "full" || err.code === "closed")) await load();
    } finally {
      setBooking(false);
    }
  }

  const stateLabel =
    selectedState === "closed"
      ? t.map.closed
      : selectedState === "full"
        ? t.map.full
        : selectedVehicle
          ? `${selectedVehicle.available}/${selectedVehicle.capacity} ${t.map.spaces}`
          : "";

  return (
    <div className="map-shell">
      <aside className="map-side">
        <h2>{t.map.filters}</h2>

        <div className="field">
          <label htmlFor="date">{t.map.date}</label>
          <input id="date" type="date" value={date} min={todayBangkok()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="hour">{t.map.startTime}</label>
            <select id="hour" value={hour} onChange={(e) => setHour(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="hours">{t.map.duration}</label>
            <select id="hours" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>
                  {h} {t.map.hoursUnit}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>{t.map.vehicle}</label>
          <div className="seg">
            <button type="button" className={vehicle === "car" ? "on" : ""} onClick={() => setVehicle("car")}>
              🚗 {t.common.car}
            </button>
            <button type="button" className={vehicle === "motorcycle" ? "on" : ""} onClick={() => setVehicle("motorcycle")}>
              🏍️ {t.common.motorcycle}
            </button>
          </div>
        </div>

        <div className="legend">
          <span><i style={{ background: "var(--ok)" }} />{t.map.legendOk}</span>
          <span><i style={{ background: "var(--full)" }} />{t.map.legendFull}</span>
          <span><i style={{ background: "var(--closed)" }} />{t.map.legendClosed}</span>
        </div>

        {error && <div className="alert error">{error}</div>}
        {loaded && !error && listings.length === 0 && <p className="muted">{t.map.noResults}</p>}

        {selected && selectedVehicle ? (
          <div className="card detail">
            {selected.photos[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="cover" src={selected.photos[0]} alt={selected.title} />
            )}
            <div className="spread">
              <h3>{selected.title}</h3>
              <button className="btn secondary small" onClick={() => setSelectedId(null)}>
                {t.map.close}
              </button>
            </div>
            <p className="muted">{selected.address}</p>
            {selected.description && <p>{selected.description}</p>}
            <p>
              <span className={`avail ${selectedState}`}>{stateLabel}</span>
              {" · "}
              {formatMoney(selectedVehicle.pricePerHour)}
              {t.common.perHour}
            </p>
            <p className="muted">
              {t.map.total}: {formatMoney(selectedVehicle.pricePerHour * hours)}
            </p>

            {bookError && <div className="alert error">{bookError}</div>}
            {bookedTotal !== null ? (
              <div className="alert success">
                {t.map.booked} ({formatMoney(bookedTotal)}){" "}
                <Link href={`/${locale}/bookings`}>{t.map.viewBookings}</Link>
              </div>
            ) : (
              <button className="btn block" disabled={booking || selectedState !== "ok"} onClick={book}>
                {booking ? t.map.booking : t.map.book}
              </button>
            )}
          </div>
        ) : (
          <p className="muted">{t.map.selectHint}</p>
        )}
      </aside>

      <section className="map-stage">
        <MapView listings={listings} vehicle={vehicle} selectedId={selectedId} onSelect={setSelectedId} />
      </section>
    </div>
  );
}
