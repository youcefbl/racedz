import Link from "next/link";
import { RegisterForm } from "./register-form";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { PanelBrandMark } from "@/components/layout/panel-brand-mark";
import { ZidRunMark } from "@/components/layout/racedz-logo";
import { ArrowRight, BadgeCheck, BrainCircuit, CalendarDays, MailCheck } from "lucide-react";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";

type RegisterAccountPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    lang?: string;
  }>;
};

export default async function RegisterAccountPage({ searchParams }: RegisterAccountPageProps) {
  const params = await searchParams;
  const locale = getLocale(params?.lang);
  const dict = getDictionary(locale);
  const t = dict.auth;
  const trialBadge = dict.pages.coachLanding.trialBadge;
  const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_460px] lg:px-8">
        <section className="relative isolate order-2 flex flex-col justify-center gap-7 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-teal via-[#0c5650] to-[#0a3a36] p-8 text-white shadow-soft rz-hide-native sm:p-10 lg:order-1">
          <PanelBrandMark className="-end-16 -top-20 w-80 sm:w-[26rem]" />
          <div className="relative space-y-4">
            <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-brand-orange">
              <ZidRunMark className="size-5" animated />
              {t.registerEyebrow}
            </p>
            <h1 className="text-balance text-3xl font-black leading-tight sm:text-4xl">{t.registerHeadline}</h1>
            <p className="max-w-md text-base leading-7 text-teal-50">{t.registerSub}</p>
          </div>

          <Link
            href={withLocale("/coach", locale)}
            className="group relative flex items-start gap-3 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur transition hover:border-white/30 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-brand-orange">
              <BrainCircuit className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-black">{t.coachPromoTitle}</span>
                <span className="rounded-full bg-brand-orange px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-white">
                  {trialBadge}
                </span>
              </span>
              <span className="mt-1 block text-sm leading-6 text-teal-50">{t.coachPromoText}</span>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-white">
                {t.coachPromoCta}
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden="true" />
              </span>
            </span>
          </Link>

          <ul className="relative grid gap-3">
            <SignupPoint icon={BadgeCheck} title={t.registerFeat1Title} text={t.registerFeat1Text} />
            <SignupPoint icon={CalendarDays} title={t.registerFeat2Title} text={t.registerFeat2Text} />
            <SignupPoint icon={MailCheck} title={t.registerFeat3Title} text={t.registerFeat3Text} />
          </ul>
        </section>

        <section className="order-1 lg:order-2">
          {googleEnabled ? (
            <div className="mb-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <GoogleSignInButton callbackUrl={params?.callbackUrl} webClientId={process.env.AUTH_GOOGLE_ID} label={t.signUpWithGoogle} pendingLabel={t.openingGoogle} errorLabel={t.googleSignInError} />
              <div className="mt-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-bold uppercase tracking-normal text-gray-500">{t.orUseEmail}</span>
                <span className="h-px flex-1 bg-gray-200" />
              </div>
            </div>
          ) : null}
          <RegisterForm callbackUrl={params?.callbackUrl} locale={locale} />
        </section>
      </div>
    </div>
  );
}

function SignupPoint({
  icon: Icon,
  title,
  text
}: {
  icon: typeof BadgeCheck;
  title: string;
  text: string;
}) {
  return (
    <li className="flex gap-3 rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
      <Icon className="mt-0.5 size-5 shrink-0 text-brand-orange" aria-hidden="true" />
      <div>
        <h2 className="text-sm font-black text-white">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-teal-50">{text}</p>
      </div>
    </li>
  );
}
