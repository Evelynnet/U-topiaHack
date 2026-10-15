import { notFound } from "next/navigation";
import AdminReview from "@/components/AdminReview";
import { getSession } from "@/lib/auth";

export default async function AdminPage() {
  const session = await getSession();
  if (session?.role !== "admin") notFound();
  return <AdminReview />;
}
