import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { HttpError, handle, json, readJson } from "@/lib/http";
import { reviewListingSchema } from "@/lib/validation";

/** Approve (with the agency commission rate) or reject a pending listing. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "not_found");
  const body = reviewListingSchema.parse(await readJson(req));

  const rows =
    body.action === "approve"
      ? await query<{ id: string }>(
          `UPDATE listings
              SET status = 'approved', commission_rate = $2, reject_reason = NULL,
                  reviewed_by = $3, reviewed_at = now()
            WHERE id = $1 AND status = 'pending' RETURNING id`,
          [id, body.commissionRate, admin.userId],
        )
      : await query<{ id: string }>(
          `UPDATE listings
              SET status = 'rejected', reject_reason = $2,
                  reviewed_by = $3, reviewed_at = now()
            WHERE id = $1 AND status = 'pending' RETURNING id`,
          [id, body.reason, admin.userId],
        );

  if (rows.length === 0) throw new HttpError(409, "not_pending");
  return json({ ok: true });
});
