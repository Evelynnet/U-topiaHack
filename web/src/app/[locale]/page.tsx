import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();
  redirect(session ? `/${locale}/map` : `/${locale}/login`);
}
