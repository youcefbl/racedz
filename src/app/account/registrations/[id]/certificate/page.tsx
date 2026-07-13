import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Award, Medal } from "lucide-react";
import { auth } from "@/auth";
import { PrintButton } from "@/components/ui/print-button";
import { getUserRegistrationForCertificate } from "@/lib/registrations";
import { formatFinishTime } from "@/lib/race-results";
import { getLocale, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finisher certificate"
};

const COPY = {
  en: {
    eyebrow: "Certificate of Achievement",
    presentedTo: "This certifies that",
    completed: "completed",
    finishTime: "Finish time",
    overall: "Overall",
    category: "Category",
    bib: "Bib",
    print: "Print / Save as PDF",
    notFinished: "This race doesn't have a finish result yet.",
    back: "Back to my races"
  },
  fr: {
    eyebrow: "Certificat de réussite",
    presentedTo: "Ceci certifie que",
    completed: "a terminé",
    finishTime: "Temps d'arrivée",
    overall: "Général",
    category: "Catégorie",
    bib: "Dossard",
    print: "Imprimer / Enregistrer en PDF",
    notFinished: "Cette course n'a pas encore de résultat d'arrivée.",
    back: "Retour à mes courses"
  },
  ar: {
    eyebrow: "شهادة إنجاز",
    presentedTo: "تشهد هذه الوثيقة أن",
    completed: "أكمل",
    finishTime: "زمن الوصول",
    overall: "الترتيب العام",
    category: "الفئة",
    bib: "رقم المتسابق",
    print: "طباعة / حفظ PDF",
    notFinished: "لا يوجد بعد نتيجة وصول لهذا السباق.",
    back: "العودة إلى سباقاتي"
  }
} as const;

function formatDate(value: Date, locale: Locale): string {
  return new Date(value).toLocaleDateString(locale === "ar" ? "ar" : locale, { year: "numeric", month: "long", day: "numeric" });
}

export default async function CertificatePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lang?: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const locale = getLocale((await searchParams)?.lang);
  if (!session?.user?.id) redirect(`/login?callbackUrl=/account/registrations/${id}/certificate`);

  const registration = await getUserRegistrationForCertificate(session.user.id, id);
  if (!registration) notFound();

  const t = COPY[locale];
  const rtl = locale === "ar";
  const result = registration.result;
  const runnerName =
    (rtl && registration.user.arabicFullName?.trim()) ||
    `${registration.user.firstName} ${registration.user.lastName}`.trim();

  if (!result || result.status !== "FINISHED") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center" dir={rtl ? "rtl" : "ltr"}>
        <Medal className="mx-auto size-10 text-gray-300" aria-hidden="true" />
        <p className="mt-3 text-base font-black text-gray-950">{t.notFinished}</p>
        <a href="/account/registrations" className="mt-4 inline-block text-sm font-bold text-brand-teal hover:underline">
          {t.back}
        </a>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 print:bg-white" dir={rtl ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-3xl px-4 py-10 print:py-0">
        {/* Certificate card */}
        <div className="relative overflow-hidden rounded-2xl border-4 border-double border-brand-teal/40 bg-white px-8 py-12 text-center shadow-sm print:border-brand-teal/60 print:shadow-none">
          {/* Corner flourishes */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -left-16 -top-16 size-40 rounded-full bg-teal-50" />
            <div className="absolute -bottom-16 -right-16 size-40 rounded-full bg-orange-50" />
          </div>

          <div className="relative">
            <Award className="mx-auto size-12 text-brand-orange" aria-hidden="true" />
            <p className="mt-4 text-sm font-black uppercase tracking-[0.2em] text-brand-teal">{t.eyebrow}</p>

            <p className="mt-8 text-sm font-semibold text-gray-500">{t.presentedTo}</p>
            <p className="mt-2 text-4xl font-black text-gray-950 sm:text-5xl">{runnerName || "Runner"}</p>

            <p className="mt-6 text-base font-semibold text-gray-600">{t.completed}</p>
            <p className="mt-1 text-2xl font-black text-gray-950">{registration.raceEvent.title}</p>
            <p className="mt-1 text-lg font-black text-brand-teal">
              {registration.raceCategory.name} · {registration.raceCategory.distanceKm} km
            </p>

            {/* Stat row */}
            <div className="mx-auto mt-8 flex max-w-md flex-wrap items-stretch justify-center gap-3">
              <Stat label={t.finishTime} value={formatFinishTime(result.finishTimeSeconds)} highlight />
              {result.overallRank ? <Stat label={t.overall} value={`#${result.overallRank}`} /> : null}
              {result.categoryRank ? <Stat label={t.category} value={`#${result.categoryRank}`} /> : null}
              {registration.bibNumber ? <Stat label={t.bib} value={registration.bibNumber} /> : null}
            </div>

            <p className="mt-8 text-sm font-semibold text-gray-500">
              {registration.raceEvent.city}, {registration.raceEvent.wilaya} · {formatDate(registration.raceEvent.startDate, locale)}
            </p>
            <p className="mt-6 text-lg font-black tracking-tight text-gray-950">
              Zid<span className="text-brand-orange">Run</span>
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-center print:hidden">
          <PrintButton label={t.print} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`min-w-24 rounded-xl border px-4 py-3 ${highlight ? "border-teal-200 bg-teal-50" : "border-gray-200 bg-gray-50"}`}>
      <p className={`text-xl font-black tabular-nums ${highlight ? "text-brand-teal" : "text-gray-950"}`}>{value}</p>
      <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}
