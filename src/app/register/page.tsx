import { RegisterForm } from "./register-form";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { BadgeCheck, CalendarDays, MailCheck } from "lucide-react";

type RegisterAccountPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
  }>;
};

export default async function RegisterAccountPage({ searchParams }: RegisterAccountPageProps) {
  const params = await searchParams;
  const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_460px] lg:px-8">
        <section className="space-y-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">Runner account</p>
            <h1 className="mt-2 max-w-2xl text-4xl font-black leading-tight text-gray-950 sm:text-5xl">
              Create your RaceDZ profile once, then register faster.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-gray-600">
              Your profile pre-fills race forms, keeps registration history in one place, and helps organizers verify participant details.
            </p>
          </div>
          <div className="grid gap-3">
            <SignupPoint icon={BadgeCheck} title="Fast signup" text="Just your name and email to start — add race details later." />
            <SignupPoint icon={CalendarDays} title="Race-ready when you are" text="Your details prefill race forms when you register." />
            <SignupPoint icon={MailCheck} title="Registration updates" text="Receive race confirmations and changes." />
          </div>
        </section>

        <section>
          {googleEnabled ? (
            <div className="mb-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <GoogleSignInButton callbackUrl={params?.callbackUrl} label="Sign up with Google" />
              <div className="mt-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-bold uppercase tracking-normal text-gray-400">or use email</span>
                <span className="h-px flex-1 bg-gray-200" />
              </div>
            </div>
          ) : null}
          <RegisterForm callbackUrl={params?.callbackUrl} />
        </section>
      </div>
    </div>
  );
}

function SignupPoint({
  icon: Icon,
  title,
  text
}: {
  icon: typeof BadgeCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <Icon className="mt-0.5 size-5 shrink-0 text-brand-orange" aria-hidden="true" />
      <div>
        <h2 className="text-sm font-black text-gray-950">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-gray-600">{text}</p>
      </div>
    </div>
  );
}
