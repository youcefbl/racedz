import type { Metadata } from "next";
import Link from "next/link";
import { XCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";
import { isValidPasswordResetToken } from "@/lib/password-reset";
import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset password"
};

type ResetPasswordPageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string }>;
};

export default async function ResetPasswordPage({ params, searchParams }: ResetPasswordPageProps) {
  const { token } = await params;
  const locale = getLocale((await searchParams)?.lang);
  const t = getDictionary(locale).auth;
  const valid = await isValidPasswordResetToken(token);

  return (
    <div className="bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10 sm:px-6">
        <div className="w-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {valid ? (
            <>
              <h1 className="text-2xl font-black text-gray-950">{t.resetTitle}</h1>
              <p className="mt-2 text-sm leading-6 text-gray-500">{t.resetSubtitle}</p>
              <div className="mt-6">
                <ResetPasswordForm token={token} locale={locale} />
              </div>
            </>
          ) : (
            <div className="text-center">
              <XCircle className="mx-auto size-12 text-red-700" aria-hidden="true" />
              <h1 className="mt-4 text-2xl font-black text-gray-950">{t.resetInvalidTitle}</h1>
              <p className="mt-2 text-sm leading-6 text-gray-600">{t.resetInvalidText}</p>
              <ButtonLink href={withLocale("/forgot-password", locale)} className="mt-6">
                {t.forgotSubmit}
              </ButtonLink>
            </div>
          )}
          <div className="mt-6 text-center text-sm text-gray-500">
            <Link href={withLocale("/login", locale)} className="font-semibold text-brand-teal hover:underline">
              {t.backToLogin}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
