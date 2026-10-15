"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { useI18n } from "@/i18n/provider";
import { stateOf, vehicleOf, type ListingView, type VehicleType } from "@/lib/types";

const BANGKOK: [number, number] = [13.7563, 100.5018];
const FOCUS_ZOOM = 17;

interface Props {
  listings: ListingView[];
  vehicle: VehicleType;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function pinIcon(label: string, state: string, selected: boolean) {
  return L.divIcon({
    className: "pin-wrap",
    html: `<div class="pin ${state}${selected ? " selected" : ""}">${label}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

/** Fits the map to the pins the first time some arrive. */
function FitOnce({ listings }: { listings: ListingView[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || listings.length === 0) return;
    done.current = true;
    const bounds = L.latLngBounds(listings.map((l) => [l.lat, l.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
  }, [listings, map]);
  return null;
}

/** Zooms in on the selected space; when it's deselected, returns to the view the person had before. */
function FocusSelected({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  const saved = useRef<{ center: L.LatLng; zoom: number } | null>(null);
  const lat = target?.lat ?? null;
  const lng = target?.lng ?? null;

  useEffect(() => {
    if (lat !== null && lng !== null) {
      if (!saved.current) saved.current = { center: map.getCenter(), zoom: map.getZoom() };
      map.flyTo([lat, lng], FOCUS_ZOOM, { duration: 0.8 });
    } else if (saved.current) {
      map.flyTo(saved.current.center, saved.current.zoom, { duration: 0.8 });
      saved.current = null;
    }
  }, [lat, lng, map]);
  return null;
}

function LocateButton({ label }: { label: string }) {
  const map = useMap();
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Keep clicks on the button from dragging/zooming the map underneath it.
    if (ref.current) L.DomEvent.disableClickPropagation(ref.current);
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      className="map-locate"
      title={label}
      aria-label={label}
      onClick={() =>
        navigator.geolocation?.getCurrentPosition(
          (pos) => map.flyTo([pos.coords.latitude, pos.coords.longitude], 15),
          () => undefined,
          { timeout: 8000 },
        )
      }
    >
      📍
    </button>
  );
}

export default function MapView({ listings, vehicle, selectedId, onSelect }: Props) {
  const { t } = useI18n();
  const selected = listings.find((l) => l.id === selectedId) ?? null;

  return (
    <MapContainer center={BANGKOK} zoom={12} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitOnce listings={listings} />
      <FocusSelected target={selected ? { lat: selected.lat, lng: selected.lng } : null} />
      <LocateButton label={t.map.nearMe} />
      {listings.map((l) => {
        const state = stateOf(l, vehicle);
        const label = state === "ok" ? String(vehicleOf(l, vehicle).available) : state === "full" ? "0" : "–";
        const isSelected = l.id === selectedId;
        return (
          <Marker
            key={`${l.id}-${state}-${label}-${isSelected}`}
            position={[l.lat, l.lng]}
            icon={pinIcon(label, state, isSelected)}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(l.id) }}
          />
        );
      })}
    </MapContainer>
  );
}
