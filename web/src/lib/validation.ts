import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(128),
});

const hourAligned = (v: string) => {
  const t = Date.parse(v);
  return !Number.isNaN(t) && t % 3_600_000 === 0;
};

export const listingQuerySchema = z.object({
  start: z.string().refine(hourAligned, "start must be on the hour (ISO 8601)"),
  hours: z.coerce.number().int().min(1).max(72),
});

export const scheduleEntrySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
  })
  .refine((s) => s.endHour > s.startHour, "endHour must be after startHour");

/** Only accept photo URLs that point at our Vercel Blob (public) store. */
const blobUrl = z.string().max(500).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}, "photo must be a Vercel Blob URL");

export const createListingSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(2000).default(""),
    address: z.string().trim().min(3).max(300),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    areaSqm: z.number().positive().max(100000).optional(),
    carCapacity: z.number().int().min(0).max(500),
    motorcycleCapacity: z.number().int().min(0).max(1000),
    carPricePerHour: z.number().min(0).max(100000),
    motoPricePerHour: z.number().min(0).max(100000),
    photos: z.array(blobUrl).max(10).default([]),
    schedule: z.array(scheduleEntrySchema).min(1).max(21),
  })
  .refine((l) => l.carCapacity + l.motorcycleCapacity > 0, "capacity must be > 0");

export const createBookingSchema = z.object({
  listingId: z.string().uuid(),
  vehicleType: z.enum(["car", "motorcycle"]),
  start: z.string().refine(hourAligned, "start must be on the hour (ISO 8601)"),
  hours: z.number().int().min(1).max(72),
});

export const reviewListingSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    commissionRate: z.number().min(0).max(1).default(0.15),
  }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().min(1).max(500),
  }),
]);
