import { CheckCircle2, XCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { verifyEmailToken } from "@/lib/email-verification";

export const dynamic = "force-dynamic";

type VerifyEmailPageProps = {
  params: Promise<{ token: string }>;
};

export default async function VerifyEmailPage({ params }: VerifyEmailPageProps) {
  const { token } = await params;
  const result = await verifyEmailToken(token);

  return (
    <main className="bg-gray-50">
      <section className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12 sm:px-6">
        <div className="w-full rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
          {result.ok ? (
            <>
              <CheckCircle2 className="mx-auto size-12 text-green-700" aria-hidden="true" />
              <h1 className="mt-4 text-2xl font-black text-gray-950">Account activated</h1>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Your email is verified. You can now log in and register for races on RaceDZ.
              </p>
              <ButtonLink href="/login" className="mt-6">
                Go to login
              </ButtonLink>
            </>
          ) : (
            <>
              <XCircle className="mx-auto size-12 text-red-700" aria-hidden="true" />
              <h1 className="mt-4 text-2xl font-black text-gray-950">Verification link expired</h1>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                This activation link is invalid, expired, or already used. Create a new account or ask support for a new verification email.
              </p>
              <ButtonLink href="/register" className="mt-6">
                Create account
              </ButtonLink>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
