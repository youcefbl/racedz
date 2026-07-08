import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CoachSubscribeView, type RequestView, type SubscriptionView } from "@/components/coach/coach-subscribe-view";
import { getCoachCopy } from "@/components/coach/copy";
import type { CoachEntitlement } from "@/components/coach/types";
import { getCoachSubscriptionOverview } from "@/lib/coach/subscription";
import { COACH_REQUESTABLE_PLANS, getCoachPaymentDetails } from "@/lib/coach/plans";
import { getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Coach subscription"
};

export default async function CoachSubscribePage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/coach/subscribe");

  const locale = getLocale((await searchParams)?.lang);
  const overview = await getCoachSubscriptionOverview(session.user.id);
  // Dates in requests/subscriptions are Date objects; JSON-flatten them to ISO strings for the
  // client view (which types them as strings).
  const data = JSON.parse(JSON.stringify(overview)) as {
    entitlement: CoachEntitlement;
    pendingRequest: RequestView | null;
    requests: RequestView[];
    subscriptions: SubscriptionView[];
  };

  return (
    <CoachSubscribeView
      locale={locale}
      copy={getCoachCopy(locale)}
      entitlement={data.entitlement}
      pendingRequest={data.pendingRequest}
      lastRequest={data.requests[0] ?? null}
      subscriptions={data.subscriptions}
      plans={COACH_REQUESTABLE_PLANS}
      payment={getCoachPaymentDetails()}
    />
  );
}
