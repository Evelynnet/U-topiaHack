export type VehicleType = "car" | "motorcycle";

export interface AuthUser {
  id?: string;
  name: string;
  role: "user" | "admin";
  /** True once the person has submitted at least one parking space (shows the owner dashboard). */
  isOwner?: boolean;
}

/** Usage and money for one period. Hours are vehicle-hours (3 cars for 2 h = 6). */
export interface StatTotals {
  cars: number;
  motorcycles: number;
  hours: number;
  gross: number;
  commission: number;
  net: number;
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
