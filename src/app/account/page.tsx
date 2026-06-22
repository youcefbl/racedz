import { redirect } from "next/navigation";
import { auth } from "@/auth";

// /account is just an entry point — send runners straight to their registrations.
export default async function AccountPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/registrations");
  }

  redirect("/account/registrations");
}
