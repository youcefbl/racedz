import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ZidRunMark } from "@/components/layout/racedz-logo";
import { peekWebHandoffToken } from "@/lib/native-auth";
import { getDictionary, getLocale, withLocale, type Locale } from "@/lib/i18n";
import { logSecurityEvent } from "@/lib/security-log";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Continue to ZidRun",
  // A one-time auth link must never be indexed or previewed.
  robots: { index: false, follow: false }
};

/**
 * Web side of the app→browser handoff (NATPAR-002), step 1 of 2.
 *
 * Loading a handoff URL must not change auth state — a URL travels: it can be sent to a victim,
 * prefetched by a link scanner, or embedded in a page (DD6-R02). So this page only PEEKS the token
 * and asks the runner to confirm; the session is established by the POST to ./confirm.
 *
 * Rendered as a real page rather than hand-written HTML (FD1-R05) so the confirmation inherits the
 * app's theme tokens, typography, brand mark, locale dictionary, and RTL handling — the screen
 * where the account identity must be unmistakable is the last place to fork the design system.
 */
export default async function HandoffPage({
  searchParams
}: {
  searchParams?: Promise<{ token?: string; lang?: string }>;
}) {
  const params = await searchParams;
  const locale = getLocale(params?.lang);
  const t = getDictionary(locale).auth;
  const token = params?.token ?? "";

  const peek = token ? await peekWebHandoffToken(token) : null;
  if (!peek) {
    logSecurityEvent("web_handoff_rejected", { stage: "peek", reason: "invalid_or_expired" });
    redirect(withLocale("/login", locale));
  }

  return (
    <div className="bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col items-center justify-center px-4 py-12 text-center sm:px-6">
        <ZidRunMark className="h-10 w-auto" />
        <h1 className="mt-6 text-2xl font-black text-gray-950 sm:text-3xl">{t.handoffTitle}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-600">{t.handoffLead}</p>

        <dl className="mt-6 w-full rounded-2xl border border-gray-200 bg-white p-4 text-start">
          <dt className="text-xs font-bold uppercase tracking-wide text-gray-500">{t.handoffAccount}</dt>
          <dd className="mt-1 break-all text-sm font-bold text-gray-950">{maskEmail(peek.email)}</dd>
          <dt className="mt-4 text-xs font-bold uppercase tracking-wide text-gray-500">{t.handoffDestination}</dt>
          <dd className="mt-1 text-sm font-bold text-gray-950">{destinationLabel(peek.destination, locale)}</dd>
        </dl>

        {/* A plain form post, deliberately: an authentication confirmation should not depend on
            client JavaScript, and the endpoint verifies the request is same-origin. */}
        <form method="post" action="/auth/handoff/confirm" className="mt-6 w-full">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="lang" value={locale} />
          <button
            type="submit"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-teal px-5 text-base font-black text-white transition hover:bg-brand-tealDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 active:scale-95"
          >
            {t.handoffConfirm}
          </button>
        </form>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-500">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          {t.handoffSecurityNote}
        </p>

        <Link
          href={withLocale("/login", locale)}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-gray-700 underline transition hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
        >
          {t.handoffNotMe}
        </Link>
      </div>
    </div>
  );
}

/**
 * A human label for the bound destination. Showing a raw path ("/account/security") asks the runner
 * to audit a URL, which is exactly the judgement they cannot be expected to make on a security
 * screen; anything unrecognised falls back to the generic account label rather than printing the
 * path.
 */
function destinationLabel(destination: string, locale: Locale): string {
  const t = getDictionary(locale).auth;
  if (destination.startsWith("/account/security")) return t.handoffDestSecurity;
  if (destination.startsWith("/account/support")) return t.handoffDestSupport;
  if (destination.startsWith("/coach/subscribe") || destination.includes("subscription")) return t.handoffDestSubscribe;
  if (destination.includes("/gpx")) return t.handoffDestGpx;
  return t.handoffDestAccount;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}
