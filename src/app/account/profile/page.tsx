import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { getDictionary, getLocale } from "@/lib/i18n";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const session = await auth();
  const locale = getLocale((await searchParams)?.lang);
  const t = getDictionary(locale).profile;

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/profile");
  }

  const user = await getPrisma().user.findUnique({
    where: {
      id: session.user.id
    },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      arabicFullName: true,
      phone: true,
      gender: true,
      dateOfBirth: true,
      nationalId: true,
      avatarUrl: true,
      wilaya: true,
      city: true,
      commune: true
    }
  });

  if (!user) {
    redirect("/login?callbackUrl=/account/profile");
  }

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">{t.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black text-gray-950">{t.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            {t.intro}
          </p>
        </div>
        <ProfileForm user={user} locale={locale} />
      </div>
    </div>
  );
}
