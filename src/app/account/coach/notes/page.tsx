import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessageSquareHeart } from "lucide-react";
import { auth } from "@/auth";
import { getHumanCoachNotes } from "@/lib/coach-admin";
import { getLocale, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Coach messages"
};

const COPY = {
  en: { title: "Messages from your coach", intro: "Personal notes from your human coach.", empty: "No messages from your coach yet." },
  fr: { title: "Messages de votre coach", intro: "Notes personnelles de votre coach humain.", empty: "Aucun message de votre coach pour l'instant." },
  ar: { title: "رسائل من مدربك", intro: "ملاحظات شخصية من مدربك.", empty: "لا توجد رسائل من مدربك بعد." }
} as const;

function formatDate(value: Date, locale: Locale): string {
  return new Date(value).toLocaleDateString(locale === "ar" ? "ar" : locale, { year: "numeric", month: "short", day: "numeric" });
}

export default async function CoachNotesPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/coach/notes");

  const locale = getLocale((await searchParams)?.lang);
  const t = COPY[locale];
  const rtl = locale === "ar";
  const notes = await getHumanCoachNotes(session.user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6" dir={rtl ? "rtl" : "ltr"}>
      <div className="mb-4 flex items-center gap-2">
        <MessageSquareHeart className="size-6 text-brand-orange" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-black text-gray-950">{t.title}</h1>
          <p className="text-sm font-semibold text-gray-500">{t.intro}</p>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center">
          <MessageSquareHeart className="mx-auto size-8 text-gray-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-gray-500">{t.empty}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="whitespace-pre-line text-sm leading-6 text-gray-800">{note.message}</p>
              <p className="mt-2 text-xs font-semibold text-gray-400">{formatDate(note.createdAt, locale)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
