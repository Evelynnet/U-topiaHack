import { notFound } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";
import { getSession } from "@/lib/auth";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (session?.role !== "admin") notFound();
  return <AdminDashboard />;
}
