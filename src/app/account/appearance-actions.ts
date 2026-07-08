"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import {
  APPEARANCE_COOKIE_MAX_AGE,
  LOCALE_COOKIE,
  THEME_COOKIE,
  normalizeLocale,
  normalizeTheme
} from "@/lib/appearance";

// Persist the runner's language/theme choice so it follows them to other devices. Writes the
// User columns (source of truth for cross-device sync) and mirrors into cookies the server and
// the anti-flash boot script read. Cookies are non-httpOnly on purpose: the boot script needs
// to read racedz-theme client-side before hydration.
export async function saveAppearanceAction(input: { language?: string; theme?: string }) {
  const language = normalizeLocale(input.language);
  const theme = normalizeTheme(input.theme);
  if (!language && !theme) return;

  const cookieStore = await cookies();
  const cookieOptions = {
    path: "/",
    maxAge: APPEARANCE_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    httpOnly: false
  };
  if (language) cookieStore.set(LOCALE_COOKIE, language, cookieOptions);
  if (theme) cookieStore.set(THEME_COOKIE, theme, cookieOptions);

  const session = await auth();
  if (!session?.user?.id) return;

  await getPrisma().user.update({
    where: { id: session.user.id },
    data: {
      ...(language ? { language } : {}),
      ...(theme ? { theme } : {})
    }
  });
}
