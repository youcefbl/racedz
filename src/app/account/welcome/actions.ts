"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";

// Runner acted on (or skipped) the first-login welcome. Stamp onboardedAt so the welcome
// never shows again, then send them where they chose to go.
export async function finishWelcomeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account");

  const raw = formData.get("destination");
  const allowed = new Set(["/account", "/account/profile", "/account/coach"]);
  const destination = typeof raw === "string" && allowed.has(raw) ? raw : "/account";

  await getPrisma().user.update({
    where: { id: session.user.id },
    data: { onboardedAt: new Date() }
  });

  redirect(destination);
}
