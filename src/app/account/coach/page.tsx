import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CoachDashboard } from "@/components/coach/coach-dashboard";
import type { CoachDashboardData } from "@/components/coach/types";
import { getCoachDashboard, getCoachProfileGaps } from "@/lib/coach/service";
import { getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Running Coach"
};

export default async function CoachPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/coach");

  const locale = getLocale((await searchParams)?.lang);
  const [dashboard, profileGaps] = await Promise.all([
    getCoachDashboard(session.user.id),
    getCoachProfileGaps(session.user.id)
  ]);
  const initialData = JSON.parse(JSON.stringify(dashboard)) as CoachDashboardData;

  return <CoachDashboard initialData={initialData} locale={locale} profileGaps={profileGaps} />;
}

