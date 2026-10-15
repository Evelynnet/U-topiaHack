"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { api, errorMessage, postJson } from "@/lib/api-client";
import { useI18n } from "@/i18n/provider";
import type { LatLng } from "./LocationPicker";

const LocationPicker = dynamic(() => import("./LocationPicker"), {
  ssr: false,
  loading: () => <div className="map-loading" />,
});

interface ScheduleRow {
  enabled: boolean;
  start: number;
  end: number;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export default function ListingForm() {
  const { locale, t } = useI18n();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [carCapacity, setCarCapacity] = useState("1");
  const [motoCapacity, setMotoCapacity] = useState("0");
  const [carPrice, setCarPrice] = useState("40");
  const [motoPrice, setMotoPrice] = useState("10");
  const [position, setPosition] = useState<LatLng | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>(
    Array.from({ length: 7 }, () => ({ enabled: true, start: 8, end: 20 })),
  );

  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function updateRow(i: number, patch: Partial<ScheduleRow>) {
    setSchedule((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function locateMe() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
      { timeout: 8000 },
    );
  }

  async function onPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 10 - photos.length);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const res = await api<{ url: string }>("/api/uploads", { method: "POST", body: form });
        urls.push(res.url);
      }
      setPhotos((p) => [...p, ...urls]);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cars = Number(carCapacity) || 0;
    const motos = Number(motoCapacity) || 0;
    const days = schedule
      .map((r, dayOfWeek) => ({ ...r, dayOfWeek }))
      .filter((r) => r.enabled && r.end > r.start);

    if (!position) return setError(t.listing.locationRequired);
    if (cars + motos < 1) return setError(t.listing.capacityRequired);
    if (days.length === 0) return setError(t.listing.scheduleRequired);

    setBusy(true);
    try {
      await postJson("/api/listings", {
        title,
        description,
        address,
        lat: position.lat,
        lng: position.lng,
        areaSqm: area ? Number(area) : undefined,
        carCapacity: cars,
        motorcycleCapacity: motos,
        carPricePerHour: Number(carPrice) || 0,
        motoPricePerHour: Number(motoPrice) || 0,
        photos,
        schedule: days.map((d) => ({ dayOfWeek: d.dayOfWeek, startHour: d.start, endHour: d.end })),
      });
      setDone(true);
      setTimeout(() => router.push(`/${locale}/owner`), 1500);
    } catch (err) {
      setError(errorMessage(t, err));
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="page">
        <div className="alert success">{t.listing.submitted}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>{t.listing.newTitle}</h1>
      <p className="muted">{t.listing.newSubtitle}</p>

      {error && <div className="alert error">{error}</div>}

      <form onSubmit={onSubmit}>
        <div className="card">
          <div className="field">
            <label htmlFor="title">{t.listing.title}</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="description">{t.listing.description}</label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
          </div>
          <div className="field">
            <label htmlFor="address">{t.listing.address}</label>
            <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required minLength={3} maxLength={300} />
          </div>
        </div>

        <div className="card">
          <div className="field">
            <label>{t.listing.location}</label>
            <div className="picker">
              <LocationPicker value={position} onChange={setPosition} />
            </div>
            <div className="hint">{t.listing.locationHint}</div>
            <button type="button" className="btn secondary small" style={{ marginTop: 8 }} onClick={locateMe}>
              📍 {t.listing.useMyLocation}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="row">
            <div className="field">
              <label htmlFor="area">{t.listing.area}</label>
              <input id="area" type="number" min="0" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="cars">{t.listing.carCapacity}</label>
              <input id="cars" type="number" min="0" max="500" value={carCapacity} onChange={(e) => setCarCapacity(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="motos">{t.listing.motoCapacity}</label>
              <input id="motos" type="number" min="0" max="1000" value={motoCapacity} onChange={(e) => setMotoCapacity(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="carPrice">{t.listing.carPrice}</label>
              <input id="carPrice" type="number" min="0" step="1" value={carPrice} onChange={(e) => setCarPrice(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="motoPrice">{t.listing.motoPrice}</label>
              <input id="motoPrice" type="number" min="0" step="1" value={motoPrice} onChange={(e) => setMotoPrice(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="field">
            <label htmlFor="photos">{t.listing.photos}</label>
            <input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onPhotos} disabled={uploading || photos.length >= 10} />
            <div className="hint">{uploading ? t.listing.uploading : t.listing.photosHint}</div>
            <div className="thumbs">
              {photos.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="" />
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <label>{t.listing.schedule}</label>
          <div className="hint" style={{ marginBottom: 10 }}>{t.listing.scheduleHint}</div>
          {schedule.map((row, i) => (
            <div className="sched-row" key={i}>
              <label className="check">
                <input type="checkbox" checked={row.enabled} onChange={(e) => updateRow(i, { enabled: e.target.checked })} />
                {t.listing.days[i]}
              </label>
              <select aria-label={t.listing.from} value={row.start} disabled={!row.enabled} onChange={(e) => updateRow(i, { start: Number(e.target.value) })}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
              <select aria-label={t.listing.to} value={row.end} disabled={!row.enabled} onChange={(e) => updateRow(i, { end: Number(e.target.value) })}>
                {HOURS.map((h) => h + 1).map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <button className="btn block" disabled={busy || uploading}>
          {busy ? t.listing.submitting : t.listing.submit}
        </button>
      </form>
    </div>
  );
}
