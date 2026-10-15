export type VehicleType = "car" | "motorcycle";

export interface AuthUser {
  id?: string;
  name: string;
  role: "user" | "admin";
}

export interface VehicleAvailability {
  capacity: number;
  available: number;
  pricePerHour: number;
}

export interface ListingView {
  id: string;
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  isOpen: boolean;
  car: VehicleAvailability;
  motorcycle: VehicleAvailability;
  photos: string[];
}

export type ListingState = "ok" | "full" | "closed";

export function vehicleOf(listing: ListingView, vehicle: VehicleType): VehicleAvailability {
  return vehicle === "car" ? listing.car : listing.motorcycle;
}

export function stateOf(listing: ListingView, vehicle: VehicleType): ListingState {
  if (!listing.isOpen) return "closed";
  return vehicleOf(listing, vehicle).available > 0 ? "ok" : "full";
}
