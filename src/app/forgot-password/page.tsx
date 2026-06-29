import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password"
};

type ForgotPasswordPageProps = {
  searchParams?: Promise<{ lang?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const locale = getLocale((await searchParams)?.lang);
  const t = getDictionary(locale).auth;

  return (
    <div className="bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10 sm:px-6">
        <div className="w-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-gray-950">{t.forgotTitle}</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">{t.forgotSubtitle}</p>
          <div className="mt-6">
            <ForgotPasswordForm locale={locale} />
          </div>
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
