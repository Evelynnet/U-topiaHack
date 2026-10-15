"use client";

import dynamic from "next/dynamic";
import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { errorMessage, postJson } from "@/lib/api-client";
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
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2 className="section-title">
        <span className="num">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

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

  const cars = Number(carCapacity) || 0;
  const motos = Number(motoCapacity) || 0;

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

    // Same rules as the server enforces, checked first for a friendlier message.
    if (files.some((f) => !PHOTO_TYPES.includes(f.type))) return setError(t.errors.unsupported_file_type);
    if (files.some((f) => f.size > MAX_PHOTO_BYTES)) return setError(t.errors.file_too_large);

    setUploading(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const file of files) {
        // The file goes straight from the browser to Vercel Blob; /api/uploads only issues the token.
        const blob = await upload(`listings/photo.${EXT[file.type]}`, file, {
          access: "public",
          handleUploadUrl: "/api/uploads",
        });
        urls.push(blob.url);
      }
      setPhotos((p) => [...p, ...urls]);
    } catch {
      setError(t.errors.upload_failed);
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

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
      // Separate "awaiting confirmation" page.
      router.push(`/${locale}/owner/submitted`);
    } catch (err) {
      setError(errorMessage(t, err));
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1>{t.listing.newTitle}</h1>
      <p className="muted">{t.listing.newSubtitle}</p>

      {error && <div className="alert error">{error}</div>}

      <form onSubmit={onSubmit}>
        <Section n={1} title={t.listing.sectionDetails}>
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
          <div className="field" style={{ maxWidth: 240 }}>
            <label htmlFor="area">{t.listing.area}</label>
            <input id="area" type="number" min="0" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} />
          </div>
        </Section>

        <Section n={2} title={t.listing.location}>
          <div className="picker">
            <LocationPicker value={position} onChange={setPosition} />
          </div>
          <div className="hint">{t.listing.locationHint}</div>
          <button type="button" className="btn secondary small" style={{ marginTop: 8 }} onClick={locateMe}>
            📍 {t.listing.useMyLocation}
          </button>
        </Section>

        <Section n={3} title={t.listing.sectionVehicles}>
          <div className="hint" style={{ marginBottom: 10 }}>{t.listing.vehiclesHint}</div>
          <div className="row">
            <div className="field">
              <label htmlFor="cars">🚗 {t.listing.carCapacity}</label>
              <input id="cars" type="number" min="0" max="500" value={carCapacity} onChange={(e) => setCarCapacity(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="motos">🏍️ {t.listing.motoCapacity}</label>
              <input id="motos" type="number" min="0" max="1000" value={motoCapacity} onChange={(e) => setMotoCapacity(e.target.value)} />
            </div>
          </div>
        </Section>

        <Section n={4} title={t.listing.sectionPrice}>
          <div className="row">
            <div className="field">
              <label htmlFor="carPrice">🚗 {t.listing.carPrice}</label>
              <input id="carPrice" type="number" min="0" step="1" value={carPrice} onChange={(e) => setCarPrice(e.target.value)} disabled={cars < 1} />
            </div>
            <div className="field">
              <label htmlFor="motoPrice">🏍️ {t.listing.motoPrice}</label>
              <input id="motoPrice" type="number" min="0" step="1" value={motoPrice} onChange={(e) => setMotoPrice(e.target.value)} disabled={motos < 1} />
            </div>
          </div>
          <div className="hint">{t.listing.priceHint}</div>
        </Section>

        <Section n={5} title={t.listing.photos}>
          <input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onPhotos} disabled={uploading || photos.length >= 10} />
          <div className="hint">{uploading ? t.listing.uploading : t.listing.photosHint}</div>
          <div className="thumbs">
            {photos.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" />
            ))}
          </div>
        </Section>

        <Section n={6} title={t.listing.schedule}>
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
        </Section>

        <button className="btn block" disabled={busy || uploading}>
          {busy ? t.listing.submitting : t.listing.submit}
        </button>
      </form>
    </div>
  );
}
