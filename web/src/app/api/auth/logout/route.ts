import { clearSessionCookie } from "@/lib/auth";
import { handle, json } from "@/lib/http";

export const POST = handle(async () => {
  await clearSessionCookie();
  return json({ ok: true });
});
