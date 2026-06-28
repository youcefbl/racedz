import { CheckCircle2, XCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { verifyEmailToken } from "@/lib/email-verification";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type VerifyEmailPageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string }>;
};

export default async function VerifyEmailPage({ params, searchParams }: VerifyEmailPageProps) {
  const { token } = await params;
  const locale = getLocale((await searchParams)?.lang);
  const t = getDictionary(locale).auth;
  const result = await verifyEmailToken(token);

  return (
    <main className="bg-gray-50">
      <section className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12 sm:px-6">
        <div className="w-full rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
          {result.ok ? (
            <>
              <CheckCircle2 className="mx-auto size-12 text-green-700" aria-hidden="true" />
              <h1 className="mt-4 text-2xl font-black text-gray-950">{t.verifiedTitle}</h1>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {t.verifiedText}
              </p>
              <ButtonLink href={withLocale("/login", locale)} className="mt-6">
                {t.goToLogin}
              </ButtonLink>
            </>
          ) : (
            <>
              <XCircle className="mx-auto size-12 text-red-700" aria-hidden="true" />
              <h1 className="mt-4 text-2xl font-black text-gray-950">{t.verifyExpiredTitle}</h1>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {t.verifyExpiredText}
              </p>
              <ButtonLink href={withLocale("/register", locale)} className="mt-6">
                {t.createAccount}
              </ButtonLink>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
