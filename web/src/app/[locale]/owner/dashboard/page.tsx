import { notFound } from "next/navigation";
import OwnerDashboard from "@/components/OwnerDashboard";
import { getSession } from "@/lib/auth";
import { isListingOwner } from "@/lib/users";

export default async function OwnerDashboardPage() {
  const session = await getSession();
  // Not signed in is handled by the middleware; people who never listed a space get a 404.
  if (!session || !(await isListingOwner(session.userId))) notFound();
  return <OwnerDashboard />;
}
