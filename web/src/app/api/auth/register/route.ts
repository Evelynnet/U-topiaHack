import { hashPassword, setSessionCookie } from "@/lib/auth";
import { query } from "@/lib/db";
import { HttpError, handle, json, readJson } from "@/lib/http";
import { registerSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  const body = registerSchema.parse(await readJson(req));
  const passwordHash = await hashPassword(body.password);

  let user: { id: string; name: string; role: "user" | "admin" };
  try {
    const rows = await query<{ id: string; name: string; role: "user" | "admin" }>(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)
       RETURNING id, name, role`,
      [body.email, passwordHash, body.name],
    );
    user = rows[0];
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new HttpError(409, "email_taken");
    throw err;
  }

  await setSessionCookie({ userId: user.id, name: user.name, role: user.role });
  return json({ user: { ...user, isOwner: false } }, 201);
});
