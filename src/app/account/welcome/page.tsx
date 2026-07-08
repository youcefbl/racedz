import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, Sparkles, UserRound } from "lucide-react";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { getDictionary, getLocale } from "@/lib/i18n";
import { finishWelcomeAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome"
};

export default async function AccountWelcomePage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/welcome");

  const user = await getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: { onboardedAt: true }
  });

  // Already onboarded (or account gone) — don't nag again.
  if (!user || user.onboardedAt) redirect("/account");

  const locale = getLocale((await searchParams)?.lang);
  const t = getDictionary(locale).account;

  return (
    <div className="bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-brand-teal text-white">
            <Sparkles className="size-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-black text-gray-950 sm:text-3xl">{t.welcomeTitle}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-600">{t.welcomeIntro}</p>
        </div>

        <div className="space-y-3">
          <WelcomeCard
            destination="/account/profile"
            icon={<UserRound className="size-5" aria-hidden="true" />}
            title={t.welcomeProfileTitle}
            text={t.welcomeProfileText}
            cta={t.welcomeProfileCta}
          />
          <WelcomeCard
            destination="/account/coach"
            icon={<Sparkles className="size-5" aria-hidden="true" />}
            title={t.welcomeCoachTitle}
            text={t.welcomeCoachText}
            cta={t.welcomeCoachCta}
          />
        </div>

        <form action={finishWelcomeAction} className="mt-5 text-center">
          <input type="hidden" name="destination" value="/account" />
          <button type="submit" className="text-sm font-bold text-gray-500 underline-offset-4 transition hover:text-gray-700 hover:underline">
            {t.welcomeSkip}
          </button>
        </form>
      </div>
    </div>
  );
}

function WelcomeCard({
  destination,
  icon,
  title,
  text,
  cta
}: {
  destination: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  cta: string;
}) {
  return (
    <form action={finishWelcomeAction} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <input type="hidden" name="destination" value={destination} />
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-black text-gray-950">{title}</p>
          <p className="mt-0.5 text-sm leading-6 text-gray-600">{text}</p>
        </div>
      </div>
      <button
        type="submit"
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-teal px-4 text-sm font-black text-white transition active:scale-[0.99]"
      >
        {cta}
        <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
      </button>
    </form>
  );
}
