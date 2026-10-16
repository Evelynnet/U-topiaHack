import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handle, json } from "@/lib/http";

export const GET = handle(async () => {
  const session = await requireUser();
  const now = new Date().toISOString();

  const rows = await query<{
    id: string;
    listing_id: string;
    title: string;
    address: string;
    vehicle_type: "car" | "motorcycle";
    start_at: string;
    end_at: string;
    total_price: string;
    car_price_per_hour: string;
    moto_price_per_hour: string;
  }>(
    `SELECT b.id, b.listing_id, l.title, l.address, b.vehicle_type,
            b.start_at, b.end_at, b.total_price,
            l.car_price_per_hour, l.moto_price_per_hour
       FROM bookings b JOIN listings l ON l.id = b.listing_id
      WHERE b.user_id = $1
        AND b.status = 'confirmed'
        AND b.start_at <= $2::timestamptz
        AND b.end_at   >  $2::timestamptz
      ORDER BY b.start_at DESC
      LIMIT 1`,
    [session.userId, now],
  );

  if (rows.length === 0) return json({ booking: null });

  const r = rows[0];
  const pricePerHour =
    r.vehicle_type === "car"
      ? Number(r.car_price_per_hour)
      : Number(r.moto_price_per_hour);

  return json({
    booking: {
      id: r.id,
      listingId: r.listing_id,
      title: r.title,
      address: r.address,
      vehicleType: r.vehicle_type,
      startAt: r.start_at,
      endAt: r.end_at,
      totalPrice: Number(r.total_price),
      pricePerHour,
    },
  });
});
