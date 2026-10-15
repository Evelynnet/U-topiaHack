import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/http";

export const GET = handle(async () => {
  const session = await requireUser();
  return json({ user: { id: session.userId, name: session.name, role: session.role } });
});
