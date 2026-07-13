import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NutritionView } from "@/components/coach/nutrition-view";
import { getRecentNutrition } from "@/lib/coach/nutrition";
import { getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fuel & hydration"
};

export default async function NutritionPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/nutrition");

  const locale = getLocale((await searchParams)?.lang);
  const days = await getRecentNutrition(session.user.id, 7);
  const initialDays = JSON.parse(JSON.stringify(days));

  return <NutritionView initialDays={initialDays} locale={locale} />;
}
