"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { stateOf, vehicleOf, type ListingView, type VehicleType } from "@/lib/types";

const BANGKOK: [number, number] = [13.7563, 100.5018];

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

/** Centers on the person's location once, if they allow it. */
function LocateOnce() {
  const map = useMap();
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 14),
      () => undefined,
      { timeout: 5000 },
    );
  }, [map]);
  return null;
}

function FlyTo({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lng !== null) map.flyTo([lat, lng], Math.max(map.getZoom(), 15));
  }, [lat, lng, map]);
  return null;
}

export default function MapView({ listings, vehicle, selectedId, onSelect }: Props) {
  const selected = listings.find((l) => l.id === selectedId) ?? null;

  return (
    <MapContainer center={BANGKOK} zoom={12} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocateOnce />
      <FlyTo lat={selected?.lat ?? null} lng={selected?.lng ?? null} />
      {listings
        .filter((l) => vehicleOf(l, vehicle).capacity > 0)
        .map((l) => {
          const state = stateOf(l, vehicle);
          const label = state === "ok" ? String(vehicleOf(l, vehicle).available) : state === "full" ? "0" : "–";
          return (
            <Marker
              key={`${l.id}-${state}-${label}-${l.id === selectedId}`}
              position={[l.lat, l.lng]}
              icon={pinIcon(label, state, l.id === selectedId)}
              eventHandlers={{ click: () => onSelect(l.id) }}
            />
          );
        })}
    </MapContainer>
  );
}
