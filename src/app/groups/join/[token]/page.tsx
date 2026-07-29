import { notFound } from "next/navigation";
import { Globe, Lock, Users } from "lucide-react";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { getGroupPreviewByToken } from "@/lib/groups";
import { getLocale } from "@/lib/i18n";
import { JoinGroupForm } from "./join-group-form";

export const dynamic = "force-dynamic";

const copy = {
  en: { joinTitle: (name: string) => `Join "${name}"?`, members: "members", private: "Private", public: "Public" },
  fr: { joinTitle: (name: string) => `Rejoindre « ${name} » ?`, members: "membres", private: "Privé", public: "Public" },
  ar: { joinTitle: (name: string) => `الانضمام إلى "${name}"؟`, members: "أعضاء", private: "خاصة", public: "عامة" }
} as const;

export default async function GroupJoinPage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const locale = getLocale((await searchParams)?.lang);
  const t = copy[locale];

  const group = await getGroupPreviewByToken(token);
  if (!group) notFound();

  const session = await auth();

  return (
    <div className="bg-gray-50">
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-lg place-items-center px-4 py-10 sm:px-6">
        <section className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            {group.pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.pictureUrl} alt="" width={56} height={56} className="size-14 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-brand-teal">
                <Users className="size-6" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black text-gray-950">{t.joinTitle(group.name)}</h1>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-gray-500">
                <Badge variant={group.isPrivate ? "default" : "teal"}>
                  {group.isPrivate ? (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="size-3" aria-hidden="true" /> {t.private}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Globe className="size-3" aria-hidden="true" /> {t.public}
                    </span>
                  )}
                </Badge>
                {group.memberCount} {t.members}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <JoinGroupForm token={token} loggedIn={Boolean(session?.user)} locale={locale} />
          </div>
        </section>
      </div>
    </div>
  );
}
