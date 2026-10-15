import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { HttpError, handle, json, readJson } from "@/lib/http";
import { createBookingSchema } from "@/lib/validation";

/** Bookings made by the current user. */
export const GET = handle(async () => {
  const session = await requireUser();
  const rows = await query<{
    id: string;
    listing_id: string;
    title: string;
    address: string;
    vehicle_type: "car" | "motorcycle";
    start_at: string;
    end_at: string;
    status: "confirmed" | "cancelled";
    total_price: string;
  }>(
    `SELECT b.id, b.listing_id, l.title, l.address, b.vehicle_type,
            b.start_at, b.end_at, b.status, b.total_price
       FROM bookings b JOIN listings l ON l.id = b.listing_id
      WHERE b.user_id = $1
      ORDER BY b.start_at DESC`,
    [session.userId],
  );

  return json({
    bookings: rows.map((r) => ({
      id: r.id,
      listingId: r.listing_id,
      title: r.title,
      address: r.address,
      vehicleType: r.vehicle_type,
      startAt: r.start_at,
      endAt: r.end_at,
      status: r.status,
      totalPrice: Number(r.total_price),
    })),
  });
});

/**
 * Create an hourly booking. The listing row is locked for the duration of the
 * transaction so two people can't take the last space at the same time.
 */
export const POST = handle(async (req: Request) => {
  const session = await requireUser();
  const body = createBookingSchema.parse(await readJson(req));

  const startAt = new Date(body.start);
  const endAt = new Date(startAt.getTime() + body.hours * 3_600_000);
  if (startAt.getTime() <= Date.now()) throw new HttpError(400, "in_the_past");

  const booking = await withTransaction(async (client) => {
    const found = await client.query<{
      status: string;
      owner_id: string;
      car_capacity: number;
      motorcycle_capacity: number;
      car_price_per_hour: string;
      moto_price_per_hour: string;
      commission_rate: string;
    }>(
      `SELECT status, owner_id, car_capacity, motorcycle_capacity,
              car_price_per_hour, moto_price_per_hour, commission_rate
         FROM listings WHERE id = $1 FOR UPDATE`,
      [body.listingId],
    );
    const listing = found.rows[0];
    if (!listing || listing.status !== "approved") throw new HttpError(404, "not_found");

    const isCar = body.vehicleType === "car";
    const capacity = isCar ? listing.car_capacity : listing.motorcycle_capacity;
    const pricePerHour = Number(isCar ? listing.car_price_per_hour : listing.moto_price_per_hour);

    const check = await client.query<{ is_open: boolean; used: number }>(
      `SELECT listing_is_open($1, $2::timestamptz, $3::timestamptz) AS is_open,
              listing_peak_usage($1, $2::timestamptz, $3::timestamptz, $4::vehicle_type) AS used`,
      [body.listingId, startAt.toISOString(), endAt.toISOString(), body.vehicleType],
    );
    if (!check.rows[0].is_open) throw new HttpError(409, "closed");
    if (check.rows[0].used >= capacity) throw new HttpError(409, "full");

    const total = Math.round(pricePerHour * body.hours * 100) / 100;
    const commission = Math.round(total * Number(listing.commission_rate) * 100) / 100;

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO bookings (listing_id, user_id, vehicle_type, start_at, end_at, total_price, commission)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        body.listingId,
        session.userId,
        body.vehicleType,
        startAt.toISOString(),
        endAt.toISOString(),
        total,
        commission,
      ],
    );
    return { id: inserted.rows[0].id, totalPrice: total };
  });

  return json(booking, 201);
});
