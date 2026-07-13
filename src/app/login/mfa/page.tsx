import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { readMfaTicket } from "@/lib/mfa-ticket";
import { getDictionary, getLocale } from "@/lib/i18n";
import { MfaChallengeForm } from "./mfa-form";

type MfaPageProps = {
  searchParams?: Promise<{ t?: string; lang?: string }>;
};

export default async function MfaPage({ searchParams }: MfaPageProps) {
  const params = await searchParams;
  const locale = getLocale(params?.lang);
  const ticket = typeof params?.t === "string" ? params.t : "";

  // Missing / expired / tampered ticket → back to the start, no detail.
  if (!readMfaTicket(ticket)) {
    redirect(params?.lang ? `/login?lang=${encodeURIComponent(params.lang)}` : "/login");
  }

  const t = getDictionary(locale).auth;

  return (
    <div className="bg-gray-50">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-8 sm:px-6">
        <section className="w-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col items-center text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-teal-50 text-brand-teal">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
            <h1 className="mt-3 text-2xl font-black text-gray-950">{t.mfaPageTitle}</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500">{t.mfaPageSubtitle}</p>
          </div>
          <MfaChallengeForm ticket={ticket} locale={locale} />
        </section>
      </div>
    </div>
  );
}
