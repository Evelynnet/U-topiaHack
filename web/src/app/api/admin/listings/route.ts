import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { handle, json } from "@/lib/http";

/** Listings awaiting review (or filtered by ?status=approved|rejected|pending). */
export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const raw = new URL(req.url).searchParams.get("status") ?? "pending";
  const status = ["pending", "approved", "rejected"].includes(raw) ? raw : "pending";

  const rows = await query<{
    id: string;
    title: string;
    description: string;
    address: string;
    lat: number;
    lng: number;
    area_sqm: string | null;
    car_capacity: number;
    motorcycle_capacity: number;
    car_price_per_hour: string;
    moto_price_per_hour: string;
    commission_rate: string;
    ai_review: unknown;
    created_at: string;
    owner_name: string;
    owner_email: string;
    photos: string[];
  }>(
    `SELECT l.id, l.title, l.description, l.address,
            ST_Y(l.location::geometry) AS lat, ST_X(l.location::geometry) AS lng,
            l.area_sqm, l.car_capacity, l.motorcycle_capacity,
            l.car_price_per_hour, l.moto_price_per_hour, l.commission_rate,
            l.ai_review, l.created_at,
            u.name AS owner_name, u.email AS owner_email,
            COALESCE((SELECT array_agg(p.url ORDER BY p.sort_order)
                      FROM listing_photos p WHERE p.listing_id = l.id), '{}') AS photos
       FROM listings l JOIN users u ON u.id = l.owner_id
      WHERE l.status = $1::listing_status
      ORDER BY l.created_at ASC`,
    [status],
  );

  return json({
    listings: rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      areaSqm: r.area_sqm === null ? null : Number(r.area_sqm),
      carCapacity: r.car_capacity,
      motorcycleCapacity: r.motorcycle_capacity,
      carPricePerHour: Number(r.car_price_per_hour),
      motoPricePerHour: Number(r.moto_price_per_hour),
      commissionRate: Number(r.commission_rate),
      aiReview: r.ai_review,
      createdAt: r.created_at,
      ownerName: r.owner_name,
      ownerEmail: r.owner_email,
      photos: r.photos,
    })),
  });
});
