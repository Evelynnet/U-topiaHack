import { getReviewer } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { handle, json, readJson } from "@/lib/http";
import { createListingSchema, listingQuerySchema } from "@/lib/validation";

interface ListingRow {
  id: string;
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  car_capacity: number;
  motorcycle_capacity: number;
  car_price_per_hour: string;
  moto_price_per_hour: string;
  is_open: boolean;
  car_available: number;
  moto_available: number;
  photos: string[];
}

/**
 * Approved listings with live availability for the requested time window.
 * Public on purpose: the home page shows the map to guests too.
 */
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const { start, hours } = listingQuerySchema.parse({
    start: url.searchParams.get("start"),
    hours: url.searchParams.get("hours") ?? "1",
  });
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + hours * 3_600_000);

  const rows = await query<ListingRow>(
    `SELECT
        l.id, l.title, l.description, l.address,
        ST_Y(l.location::geometry) AS lat,
        ST_X(l.location::geometry) AS lng,
        l.car_capacity, l.motorcycle_capacity,
        l.car_price_per_hour, l.moto_price_per_hour,
        listing_is_open(l.id, $1::timestamptz, $2::timestamptz) AS is_open,
        GREATEST(l.car_capacity
          - listing_peak_usage(l.id, $1::timestamptz, $2::timestamptz, 'car'), 0) AS car_available,
        GREATEST(l.motorcycle_capacity
          - listing_peak_usage(l.id, $1::timestamptz, $2::timestamptz, 'motorcycle'), 0) AS moto_available,
        COALESCE((SELECT array_agg(p.url ORDER BY p.sort_order)
                  FROM listing_photos p WHERE p.listing_id = l.id), '{}') AS photos
       FROM listings l
      WHERE l.status = 'approved'`,
    [startDate.toISOString(), endDate.toISOString()],
  );

  return json({
    listings: rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      isOpen: r.is_open,
      car: {
        capacity: r.car_capacity,
        available: r.is_open ? r.car_available : 0,
        pricePerHour: Number(r.car_price_per_hour),
      },
      motorcycle: {
        capacity: r.motorcycle_capacity,
        available: r.is_open ? r.moto_available : 0,
        pricePerHour: Number(r.moto_price_per_hour),
      },
      photos: r.photos,
    })),
  });
});

/** An owner submits a new listing; it stays "pending" until an admin approves it. */
export const POST = handle(async (req: Request) => {
  const session = await requireUser();
  const body = createListingSchema.parse(await readJson(req));

  const listingId = await withTransaction(async (client) => {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO listings
         (owner_id, title, description, address, location, area_sqm,
          car_capacity, motorcycle_capacity, car_price_per_hour, moto_price_per_hour)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography, $7,
               $8, $9, $10, $11)
       RETURNING id`,
      [
        session.userId,
        body.title,
        body.description,
        body.address,
        body.lat,
        body.lng,
        body.areaSqm ?? null,
        body.carCapacity,
        body.motorcycleCapacity,
        body.carPricePerHour,
        body.motoPricePerHour,
      ],
    );
    const id = inserted.rows[0].id;

    for (const [i, photoUrl] of body.photos.entries()) {
      await client.query(
        `INSERT INTO listing_photos (listing_id, url, sort_order) VALUES ($1, $2, $3)`,
        [id, photoUrl, i],
      );
    }
    for (const s of body.schedule) {
      await client.query(
        `INSERT INTO listing_availability (listing_id, day_of_week, start_hour, end_hour)
         VALUES ($1, $2, $3, $4)`,
        [id, s.dayOfWeek, s.startHour, s.endHour],
      );
    }
    return id;
  });

  // Optional AI review. Must never block or fail the submission.
  try {
    const review = await getReviewer().review({
      title: body.title,
      description: body.description,
      areaSqm: body.areaSqm,
      carCapacity: body.carCapacity,
      motorcycleCapacity: body.motorcycleCapacity,
      photoUrls: body.photos,
    });
    if (review) {
      await query(`UPDATE listings SET ai_review = $2 WHERE id = $1`, [
        listingId,
        JSON.stringify(review),
      ]);
    }
  } catch (err) {
    console.error("AI review failed", err);
  }

  return json({ id: listingId, status: "pending" }, 201);
});
