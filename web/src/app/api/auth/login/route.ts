import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { query } from "@/lib/db";
import { HttpError, handle, json, readJson } from "@/lib/http";
import { loginSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  const body = loginSchema.parse(await readJson(req));
  const rows = await query<{
    id: string;
    name: string;
    role: "user" | "admin";
    password_hash: string;
  }>(`SELECT id, name, role, password_hash FROM users WHERE email = $1`, [body.email]);

  const user = rows[0];
  // Same error for unknown email and wrong password.
  if (!user || !(await verifyPassword(body.password, user.password_hash))) {
    throw new HttpError(401, "invalid_credentials");
  }

  await setSessionCookie({ userId: user.id, name: user.name, role: user.role });
  return json({ user: { id: user.id, name: user.name, role: user.role } });
});
