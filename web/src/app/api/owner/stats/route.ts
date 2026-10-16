import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handle, json } from "@/lib/http";
import { currentPeriods, emptyTotals, ownerStats } from "@/lib/stats";

/** Today / this week usage and income for the signed-in owner's spaces. */
export const GET = handle(async () => {
  const session = await requireUser();
  const { today, days, periods } = currentPeriods();

  const listings = await query<{ id: string; title: string; status: "pending" | "approved" | "rejected" }>(
    `SELECT id, title, status FROM listings WHERE owner_id = $1 ORDER BY created_at DESC`,
    [session.userId],
  );
  const { byPeriod, byListing } = await ownerStats(session.userId, periods);

  return json({
    today,
    totals: {
      today: byPeriod.get("today") ?? emptyTotals(),
      week: byPeriod.get("week") ?? emptyTotals(),
    },
    listings: listings.map((l) => ({
      ...l,
      today: byListing.get("today")?.get(l.id) ?? emptyTotals(),
      week: byListing.get("week")?.get(l.id) ?? emptyTotals(),
    })),
    days: days.map((date, i) => ({ date, ...(byPeriod.get(`d${i}`) ?? emptyTotals()) })),
  });
});
