import { RegisterForm } from "./register-form";

type RegisterAccountPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
  }>;
};

export default async function RegisterAccountPage({ searchParams }: RegisterAccountPageProps) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-sm font-bold text-brand-teal">Account</p>
        <h1 className="text-3xl font-black text-gray-950">Create account</h1>
      </div>
      <RegisterForm callbackUrl={params?.callbackUrl} />
    </div>
  );
}
