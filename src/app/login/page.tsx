import { redirect } from "next/navigation";
import { CalendarCheck2, KeyRound, Sparkles, UserRound } from "lucide-react";
import { auth } from "@/auth";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { ButtonLink } from "@/components/ui/button";
import type { UserRole } from "@/types/race";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    registered?: string;
    emailDelivery?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const params = await searchParams;

  if (session?.user) {
    redirect(getPostLoginUrl(session.user.role, params?.callbackUrl));
  }

  const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_420px] lg:items-center lg:px-8">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-brand-teal shadow-sm">
            <Sparkles className="size-4 text-brand-orange" aria-hidden="true" />
            RaceDZ account
          </div>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-black leading-tight text-gray-950 sm:text-5xl">
              Login once. Run your races or organize your events.
            </h1>
            <p className="max-w-xl text-base leading-7 text-gray-600">
              One secure email/password login for runners and race organizations.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <LoginFeature icon={UserRound} title="Runners" text="Register and track entries." />
            <LoginFeature icon={KeyRound} title="Organizers" text="Manage events and lists." />
            <LoginFeature icon={CalendarCheck2} title="Race days" text="Keep entries ready." />
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          {params?.registered === "1" ? (
            <div className="mb-5 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-brand-teal">
              {params.emailDelivery === "failed"
                ? "Account created, but the activation email could not be delivered. Contact support to activate or resend verification."
                : "Account created. Check your email and activate your account before logging in."}
            </div>
          ) : null}
          <div className="mb-5">
            <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">Welcome back</p>
            <h2 className="mt-2 text-2xl font-black text-gray-950">Sign in</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Use a demo account or your own RaceDZ credentials.
            </p>
          </div>
          {googleEnabled ? (
            <>
              <GoogleSignInButton callbackUrl={params?.callbackUrl} />
              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-bold uppercase tracking-normal text-gray-400">or</span>
                <span className="h-px flex-1 bg-gray-200" />
              </div>
            </>
          ) : null}
          <LoginForm callbackUrl={params?.callbackUrl} />
          <div className="mt-5 rounded-lg bg-gray-50 p-4">
            <p className="text-sm font-bold text-gray-950">Demo accounts</p>
            <div className="mt-3 grid gap-2 text-xs text-gray-600">
              <DemoAccount role="Runner" email="runner@example.com" />
              <DemoAccount role="Organizer" email="organizer@racedz.dz" />
            </div>
            <p className="mt-3 text-xs font-semibold text-gray-500">Password: racedz-demo-password</p>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-500">New runner?</span>
            <ButtonLink href={params?.callbackUrl ? `/register?callbackUrl=${encodeURIComponent(params.callbackUrl)}` : "/register"} variant="outline" size="sm">
              Create account
            </ButtonLink>
          </div>
        </section>
      </div>
    </div>
  );
}

function LoginFeature({
  icon: Icon,
  title,
  text
}: {
  icon: typeof UserRound;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <Icon className="mb-3 size-5 text-brand-orange" aria-hidden="true" />
      <h2 className="text-sm font-black text-gray-950">{title}</h2>
      <p className="mt-1 text-sm leading-5 text-gray-600">{text}</p>
    </div>
  );
}

function DemoAccount({ role, email }: { role: string; email: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2">
      <span className="font-semibold text-gray-950">{role}</span>
      <span>{email}</span>
    </div>
  );
}

function getPostLoginUrl(role: UserRole | undefined, callbackUrl?: string) {
  const safeCallbackUrl = getSafeCallbackUrlForRole(role, callbackUrl);

  if (safeCallbackUrl) {
    return safeCallbackUrl;
  }

  switch (role) {
    case "SUPERADMIN":
    case "ADMIN":
      return "/admin";
    case "ORGANIZER":
      return "/organizer";
    case "RUNNER":
    default:
      return "/account";
  }
}

function getSafeCallbackUrlForRole(role: UserRole | undefined, callbackUrl?: string) {
  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return null;
  }

  if (callbackUrl.startsWith("/admin")) {
    return role === "ADMIN" || role === "SUPERADMIN" ? callbackUrl : null;
  }

  if (callbackUrl.startsWith("/organizer")) {
    return role === "ORGANIZER" || role === "ADMIN" || role === "SUPERADMIN" ? callbackUrl : null;
  }

  return callbackUrl;
}
