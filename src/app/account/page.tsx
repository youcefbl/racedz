import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SectionPage } from "@/components/layout/section-page";

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  return (
    <SectionPage eyebrow="Account" title="Profile">
      Runner profile details and registration history.
    </SectionPage>
  );
}
