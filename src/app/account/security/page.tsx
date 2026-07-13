import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { MfaPanel } from "./mfa-panel";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/security");
  }

  const user = await getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: { mfaEnabled: true }
  });

  if (!user) {
    redirect("/login?callbackUrl=/account/security");
  }

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">Account</p>
          <h1 className="mt-2 text-3xl font-black text-gray-950">Security</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Protect your account with two-factor authentication (2FA). When it&apos;s on, sign-in requires a one-time
            code from your authenticator app in addition to your password.
          </p>
        </div>
        <MfaPanel enabled={user.mfaEnabled} />
      </div>
    </div>
  );
}
