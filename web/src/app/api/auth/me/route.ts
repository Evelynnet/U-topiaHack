import { requireUser } from "@/lib/auth";
import { isListingOwner } from "@/lib/users";
import { handle, json } from "@/lib/http";

export const GET = handle(async () => {
  const session = await requireUser();
  const isOwner = await isListingOwner(session.userId);
  return json({ user: { id: session.userId, name: session.name, role: session.role, isOwner } });
});
