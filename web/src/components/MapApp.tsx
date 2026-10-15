"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, api, errorMessage, postJson } from "@/lib/api-client";
import { bangkokToIso, formatDateTime, formatMoney, nextBangkokHour, todayBangkok } from "@/lib/format";
import { stateOf, vehicleOf, type ListingView, type VehicleType } from "@/lib/types";
import { useI18n } from "@/i18n/provider";
import { useAuth } from "./AuthProvider";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="map-loading" />,
});

interface BookedInfo {
  id: string;
  totalPrice: number;
  title: string;
  address: string;
  vehicle: VehicleType;
  startIso: string;
  hours: number;
}

const STATE_RANK = { ok: 0, full: 1, closed: 2 } as const;

export default function MapApp() {
  const { locale, t } = useI18n();
  const { requireLogin, openLogin } = useAuth();
  const initial = useMemo(() => nextBangkokHour(), []);

  const [date, setDate] = useState(initial.date);
  const [hour, setHour] = useState(initial.hour);
  const [hours, setHours] = useState(2);
  const [vehicle, setVehicle] = useState<VehicleType>("car");
  const [query, setQuery] = useState("");

  const [listings, setListings] = useState<ListingView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [booked, setBooked] = useState<BookedInfo | null>(null);

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

  // Changing the time window, vehicle or space clears any old booking error.
  useEffect(() => {
    setBookError(null);
  }, [startIso, hours, vehicle, selectedId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listings
      .filter((l) => vehicleOf(l, vehicle).capacity > 0)
      .filter((l) => !q || l.title.toLowerCase().includes(q) || l.address.toLowerCase().includes(q))
      .sort((a, b) => {
        const byState = STATE_RANK[stateOf(a, vehicle)] - STATE_RANK[stateOf(b, vehicle)];
        return byState || vehicleOf(b, vehicle).available - vehicleOf(a, vehicle).available;
      });
  }, [listings, vehicle, query]);

  const selected = listings.find((l) => l.id === selectedId) ?? null;
  const selectedState = selected ? stateOf(selected, vehicle) : null;
  const selectedVehicle = selected ? vehicleOf(selected, vehicle) : null;

  // Keep the chosen space on the map even if the search/vehicle filter would hide it.
  const mapListings = useMemo(
    () => (selected && !visible.includes(selected) ? [...visible, selected] : visible),
    [visible, selected],
  );

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    setBooked(null);
  }, []);

  const labelFor = (l: ListingView) => {
    const state = stateOf(l, vehicle);
    if (state === "closed") return t.map.closed;
    if (state === "full") return t.map.full;
    const v = vehicleOf(l, vehicle);
    return `${v.available}/${v.capacity} ${t.map.spaces}`;
  };

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
      setBooked({
        id: res.id,
        totalPrice: res.totalPrice,
        title: selected.title,
        address: selected.address,
        vehicle,
        startIso,
        hours,
      });
      void load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Session expired while the page was open: sign in again, then finish the booking.
        openLogin({ reason: t.auth.loginRequiredBook, onSuccess: () => void book() });
      } else {
        setBookError(errorMessage(t, err));
        if (err instanceof ApiError && (err.code === "full" || err.code === "closed")) void load();
      }
    } finally {
      setBooking(false);
    }
  }

  function onBookClick() {
    // Guests get the login pop-up; the booking continues automatically after they sign in.
    if (requireLogin(t.auth.loginRequiredBook, () => void book())) void book();
  }

  return (
    <div className="map-shell">
      <aside className="map-side">
        {booked ? (
          // ---- Step 5: awaiting confirmation -> payment (placeholder) ----
          <div className="side-body">
            <div className="alert success">✓ {t.bookings.flowTitle}</div>
            <p className="muted">{t.bookings.flowSubtitle}</p>

            <div className="card">
              <h3>{booked.title}</h3>
              <p className="muted" style={{ marginBottom: 6 }}>{booked.address}</p>
              <p style={{ marginBottom: 4 }}>
                {booked.vehicle === "car" ? "🚗" : "🏍️"} {formatDateTime(booked.startIso, locale)} →{" "}
                {formatDateTime(new Date(new Date(booked.startIso).getTime() + booked.hours * 3_600_000).toISOString(), locale)}
              </p>
              <p style={{ marginBottom: 0 }}>
                <strong>{t.map.total}: {formatMoney(booked.totalPrice)}</strong>
              </p>
            </div>

            <ol className="steps">
              <li className="current">
                <span className="dot">1</span>
                <div>
                  <strong>{t.bookings.stepAwaiting}</strong>
                  <div className="muted small">{t.bookings.stepAwaitingDesc}</div>
                </div>
              </li>
              <li>
                <span className="dot">2</span>
                <div>
                  <strong>{t.bookings.stepPayment}</strong>
                  <div className="muted small">{t.bookings.stepPaymentDesc}</div>
                </div>
              </li>
            </ol>

            <div className="alert info">{t.bookings.placeholder}</div>
            <div className="stack">
              <button className="btn block" disabled>
                {t.bookings.payNow}
              </button>
              <Link className="btn secondary block" href={`/${locale}/bookings`}>
                {t.bookings.viewBookings}
              </Link>
              <button className="btn secondary block" onClick={() => select(null)}>
                {t.bookings.backToMap}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="side-head">
              <input
                className="search"
                type="search"
                placeholder={t.map.searchPlaceholder}
                aria-label={t.map.searchPlaceholder}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (selectedId) select(null); // typing a search goes back to the list
                }}
              />

              <div className="filters-row">
                <div>
                  <label htmlFor="date">{t.map.date}</label>
                  <input id="date" type="date" value={date} min={todayBangkok()} onChange={(e) => e.target.value && setDate(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="hour">{t.map.startTime}</label>
                  <select id="hour" value={hour} onChange={(e) => setHour(Number(e.target.value))}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </div>
                <div>
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

              <div className="seg" style={{ marginTop: 10 }}>
                <button type="button" className={vehicle === "car" ? "on" : ""} onClick={() => setVehicle("car")}>
                  🚗 {t.common.car}
                </button>
                <button type="button" className={vehicle === "motorcycle" ? "on" : ""} onClick={() => setVehicle("motorcycle")}>
                  🏍️ {t.common.motorcycle}
                </button>
              </div>

              <div className="legend">
                <span><i style={{ background: "var(--ok)" }} />{t.map.legendOk}</span>
                <span><i style={{ background: "var(--full)" }} />{t.map.legendFull}</span>
                <span><i style={{ background: "var(--closed)" }} />{t.map.legendClosed}</span>
              </div>
            </div>

            <div className="side-body">
              {error && <div className="alert error">{error}</div>}

              {selected && selectedVehicle ? (
                // ---- Step 4: details of the chosen space (the map zooms in on it) ----
                <div className="detail">
                  <button type="button" className="back-link" onClick={() => select(null)}>
                    ← {t.map.backToList}
                  </button>

                  <div className="photo-strip">
                    {selected.photos.length > 0 ? (
                      selected.photos.slice(0, 3).map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={url} src={url} alt={selected.title} />
                      ))
                    ) : (
                      <div className="no-photo">🅿️ {t.map.noPhoto}</div>
                    )}
                  </div>

                  <h2>{selected.title}</h2>
                  <p className="muted">{selected.address}</p>
                  {selected.description && <p>{selected.description}</p>}

                  <div className="facts">
                    <div>
                      <span className="muted small">{t.map.price}</span>
                      <strong>
                        {formatMoney(selectedVehicle.pricePerHour)}
                        {t.common.perHour}
                      </strong>
                    </div>
                    <div>
                      <span className="muted small">{t.map.availability}</span>
                      <strong className={`avail ${selectedState}`}>{labelFor(selected)}</strong>
                    </div>
                    <div>
                      <span className="muted small">
                        {t.map.total} ({hours} {t.map.hoursUnit})
                      </span>
                      <strong>{formatMoney(selectedVehicle.pricePerHour * hours)}</strong>
                    </div>
                  </div>

                  {bookError && <div className="alert error">{bookError}</div>}
                  <button className="btn block" disabled={booking || selectedState !== "ok"} onClick={onBookClick}>
                    {booking ? t.map.booking : t.map.book}
                  </button>
                </div>
              ) : (
                // ---- Steps 1/3: searchable list of spaces ----
                <>
                  {loaded && !error && (
                    <p className="muted small">
                      {visible.length} {t.map.placesUnit}
                    </p>
                  )}
                  {loaded && !error && listings.length === 0 && <p className="muted">{t.map.noResults}</p>}
                  {loaded && listings.length > 0 && visible.length === 0 && <p className="muted">{t.map.noMatch}</p>}

                  {visible.map((l) => {
                    const state = stateOf(l, vehicle);
                    return (
                      <button type="button" key={l.id} className="list-item" onClick={() => select(l.id)}>
                        <span className="thumb">
                          {l.photos[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.photos[0]} alt="" />
                          ) : (
                            "🅿️"
                          )}
                        </span>
                        <span className="info">
                          <strong>{l.title}</strong>
                          <span className="muted small addr">{l.address}</span>
                          <span className="small">
                            <span className={`avail ${state}`}>{labelFor(l)}</span>
                            {" · "}
                            {formatMoney(vehicleOf(l, vehicle).pricePerHour)}
                            {t.common.perHour}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </>
        )}
      </aside>

      <section className="map-stage">
        <MapView listings={mapListings} vehicle={vehicle} selectedId={selectedId} onSelect={select} />
      </section>
    </div>
  );
}
