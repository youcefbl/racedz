import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, CalendarDays, MapPin, Medal, ReceiptText, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { auth } from "@/auth";
import { formatDateTime, formatDzd } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n";
import { parsePagination } from "@/lib/pagination";
import { getUserRegistrations } from "@/lib/registrations";
import { formatFinishTime } from "@/lib/race-results";
import type { PaymentStatus, RegistrationStatus } from "@/types/race";
import { PaymentPanel } from "./payment-panel";

export const dynamic = "force-dynamic";

type AccountRegistrationsPageProps = {
  searchParams?: Promise<{
    registered?: string;
    lang?: string;
    page?: string;
  }>;
};

const registrationBadgeVariant: Record<RegistrationStatus, "blue" | "green" | "red" | "orange" | "default"> = {
  PENDING: "orange",
  CONFIRMED: "green",
  CANCELLED: "default",
  REJECTED: "red",
  WAITING_LIST: "blue"
};

const paymentBadgeVariant: Record<PaymentStatus, "blue" | "green" | "red" | "orange" | "default"> = {
  NOT_REQUIRED: "green",
  PENDING: "orange",
  PAID: "green",
  FAILED: "red",
  REFUNDED: "blue",
  MANUAL_REVIEW: "blue"
};

export default async function AccountRegistrationsPage({ searchParams }: AccountRegistrationsPageProps) {
  const session = await auth();
  const params = await searchParams;
  const locale = getLocale(params?.lang);
  const t = getDictionary(locale).registrations;
  const statusLabels = getDictionary(locale).status;
  const payLabels = getDictionary(locale).pay;
  const resultStatusLabels: Record<string, string> = {
    FINISHED: t.resultFinished,
    DNF: t.resultDnf,
    DNS: t.resultDns,
    DSQ: t.resultDsq
  };

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/registrations");
  }

  const pagination = parsePagination({ page: params?.page });
  const { items: registrations, page, totalPages } = await getUserRegistrations(session.user.id, pagination);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-950">{t.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              {t.intro}
            </p>
          </div>
          <ButtonLink href="/races" variant="secondary">
            {t.findAnother}
          </ButtonLink>
        </div>

        {params?.registered ? (
          <div className="mb-5 rounded-lg border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-700">
            {t.savedBanner}
          </div>
        ) : null}

        {registrations.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={t.emptyTitle}
            description={t.emptyText}
            action={<ButtonLink href="/races">{t.browse}</ButtonLink>}
          />
        ) : (
          <div className="grid gap-4">
            {registrations.map((registration) => (
              <article key={registration.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="space-y-3">
                    <div>
                      <Link
                        href={`/races/${registration.raceEvent.slug}`}
                        className="text-xl font-black leading-snug text-gray-950 transition hover:text-brand-teal"
                      >
                        {registration.raceEvent.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant={registrationBadgeVariant[registration.status as RegistrationStatus]}>
                          {statusLabels[registration.status as RegistrationStatus]}
                        </Badge>
                        <Badge variant={paymentBadgeVariant[registration.paymentStatus as PaymentStatus]}>
                          {statusLabels[registration.paymentStatus as PaymentStatus]}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                      <p className="flex items-center gap-2">
                        <CalendarDays className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                        {formatDateTime(registration.raceEvent.startDate)}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                        {registration.raceEvent.city}, {registration.raceEvent.wilaya}
                      </p>
                      <p className="flex items-center gap-2">
                        <Route className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                        {registration.raceCategory.name} · {registration.raceCategory.distanceKm}K
                      </p>
                      <p className="flex items-center gap-2">
                        <ReceiptText className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                        {formatDzd(registration.raceCategory.priceDzd ?? undefined)}
                      </p>
                    </div>
                    {registration.result ? (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-teal-100 bg-teal-50 px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-sm font-black text-brand-teal">
                          <Medal className="size-4 shrink-0" aria-hidden="true" />
                          {t.resultLabel}
                        </span>
                        {registration.result.status === "FINISHED" ? (
                          <span className="text-sm font-bold text-gray-800">
                            {t.finishTime}: <span className="tabular-nums">{formatFinishTime(registration.result.finishTimeSeconds)}</span>
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-gray-800">{resultStatusLabels[registration.result.status]}</span>
                        )}
                        {registration.result.overallRank ? (
                          <span className="text-sm font-semibold text-gray-600">
                            {t.overallRank}: #{registration.result.overallRank}
                          </span>
                        ) : null}
                        {registration.result.categoryRank ? (
                          <span className="text-sm font-semibold text-gray-600">
                            {t.categoryRank}: #{registration.result.categoryRank}
                          </span>
                        ) : null}
                        {registration.result.status === "FINISHED" ? (
                          <Link
                            href={`/account/registrations/${registration.id}/certificate`}
                            className="ms-auto inline-flex items-center gap-1 text-sm font-black text-brand-teal hover:underline"
                          >
                            <Award className="size-4" aria-hidden="true" />
                            {t.certificate}
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:w-44 lg:grid-cols-1">
                    <ButtonLink href={`/races/${registration.raceEvent.slug}`} variant="outline" size="sm">
                      {t.raceDetails}
                    </ButtonLink>
                    <ButtonLink href={`/races/${registration.raceEvent.slug}/register`} variant="secondary" size="sm">
                      {t.addDistance}
                    </ButtonLink>
                  </div>
                </div>
                {["PENDING", "FAILED", "MANUAL_REVIEW"].includes(registration.paymentStatus) ? (
                  <PaymentPanel
                    registrationId={registration.id}
                    amount={formatDzd(registration.raceCategory.priceDzd ?? undefined)}
                    race={{
                      baridiMobNumber: registration.raceEvent.baridiMobNumber,
                      ccpAccount: registration.raceEvent.ccpAccount,
                      ccpKey: registration.raceEvent.ccpKey,
                      paymentNote: registration.raceEvent.paymentNote
                    }}
                    underReview={registration.paymentStatus === "MANUAL_REVIEW"}
                    labels={payLabels}
                  />
                ) : null}
              </article>
            ))}
          </div>
        )}

        <Pagination basePath="/account/registrations" searchParams={params} page={page} totalPages={totalPages} locale={locale} />
      </div>
    </div>
  );
}
