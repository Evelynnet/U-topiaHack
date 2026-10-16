import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { HttpError, handle, json } from "@/lib/http";

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireUser();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "not_found");

  const rows = await query<{ id: string }>(
    `UPDATE bookings SET status = 'cancelled'
      WHERE id = $1 AND user_id = $2 AND status = 'confirmed'
        AND start_at <= now() AND end_at > now()
      RETURNING id`,
    [id, session.userId],
  );
  if (rows.length === 0) throw new HttpError(409, "cannot_cancel");
  return json({ ok: true });
});
