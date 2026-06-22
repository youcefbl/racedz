"use client";

import { useSearchParams } from "next/navigation";
import { getLocale } from "@/lib/i18n";
import { translateOrganizer } from "@/lib/organizer-i18n";

export function useOrganizerTranslation() {
  const searchParams = useSearchParams();
  const locale = getLocale(searchParams.get("lang"));

  return {
    locale,
    t: (text: string) => translateOrganizer(locale, text)
  };
}
