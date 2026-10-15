import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handle, json } from "@/lib/http";

export const GET = handle(async () => {
  const session = await requireUser();
  const rows = await query<{
    id: string;
    title: string;
    address: string;
    status: "pending" | "approved" | "rejected";
    reject_reason: string | null;
    car_capacity: number;
    motorcycle_capacity: number;
    commission_rate: string;
    created_at: string;
  }>(
    `SELECT id, title, address, status, reject_reason, car_capacity, motorcycle_capacity,
            commission_rate, created_at
       FROM listings WHERE owner_id = $1 ORDER BY created_at DESC`,
    [session.userId],
  );

  return json({
    listings: rows.map((r) => ({
      id: r.id,
      title: r.title,
      address: r.address,
      status: r.status,
      rejectReason: r.reject_reason,
      carCapacity: r.car_capacity,
      motorcycleCapacity: r.motorcycle_capacity,
      commissionRate: Number(r.commission_rate),
      createdAt: r.created_at,
    })),
  });
});
