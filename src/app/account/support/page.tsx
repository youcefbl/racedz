import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SupportChat } from "@/components/support/support-chat";
import { getDictionary, getLocale } from "@/lib/i18n";
import { markNotificationsReadByType } from "@/lib/notifications";
import { getUserSupportView } from "@/lib/support";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chat with support"
};

export default async function AccountSupportPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/support");

  const locale = getLocale((await searchParams)?.lang);
  const t = getDictionary(locale).account;
  // Opening the chat clears any unread "support replied" alerts — tapping the notification
  // (which links here) or just visiting the page both mark the whole batch read.
  const [initial] = await Promise.all([
    getUserSupportView(session.user.id),
    markNotificationsReadByType(session.user.id, "SUPPORT_REPLY")
  ]);

  return (
    <div className="bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-5">
          <h1 className="text-2xl font-black text-gray-950 sm:text-3xl">{t.support}</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-gray-600">{t.supportIntro}</p>
        </div>
        <SupportChat
          initial={initial}
          dir={locale === "ar" ? "rtl" : "ltr"}
          labels={{
            placeholder: t.supportPlaceholder,
            send: t.supportSend,
            sending: t.supportSending,
            empty: t.supportEmpty,
            you: t.supportYou,
            team: t.supportTeam,
            loadError: t.supportLoadError,
            sendError: t.supportSendError,
            closedNote: t.supportClosedNote
          }}
        />
      </div>
    </div>
  );
}
