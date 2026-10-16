import { requireAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { todayBangkok } from "@/lib/format";
import {
  currentPeriods,
  emptyTotals,
  hourlyUsage,
  platformCounts,
  platformStats,
  usageRightNow,
} from "@/lib/stats";

function validDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Platform dashboard: users on site per hour, today/week totals and review backlog. */
export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const asked = new URL(req.url).searchParams.get("date");
  const date = validDate(asked) ? asked : todayBangkok();
  const { periods } = currentPeriods();

  const [counts, now, hourly, totals] = await Promise.all([
    platformCounts(),
    usageRightNow(),
    hourlyUsage(date),
    platformStats(periods.filter((p) => p.key === "today" || p.key === "week")),
  ]);

  return json({
    date,
    counts,
    now,
    hourly,
    totals: {
      today: totals.get("today") ?? { ...emptyTotals(), users: 0 },
      week: totals.get("week") ?? { ...emptyTotals(), users: 0 },
    },
  });
});
