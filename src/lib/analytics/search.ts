import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { VISITOR_COOKIE } from "./constants";

// Server-side race-search logger. Called from the races page render; fully fail-soft
// so it can never break the page. Dedupes per visitor+term+filters over 30 minutes
// because the search form re-renders the server component on every live filter change.
const DEDUPE_WINDOW_MS = 30 * 60 * 1000;

export async function recordSearchQuery(input: {
  term: string;
  wilaya?: string;
  raceType?: string;
  resultCount: number;
}): Promise<void> {
  const term = input.term.trim().toLowerCase();
  if (!term || term.length > 200) return;
  const wilaya = input.wilaya?.trim() || null;
  const raceType = input.raceType?.trim() || null;

  try {
    const cookieStore = await cookies();
    const visitorId = cookieStore.get(VISITOR_COOKIE)?.value ?? null;
    let userId: string | null = null;
    try {
      userId = (await auth())?.user?.id ?? null;
    } catch {
      userId = null;
    }

    const prisma = getPrisma();

    if (visitorId) {
      const recent = await prisma.searchQuery.findFirst({
        where: { visitorId, term, wilaya, raceType, createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) } },
        select: { id: true }
      });
      if (recent) return;
    }

    await prisma.searchQuery.create({
      data: { term, wilaya, raceType, resultCount: input.resultCount, visitorId, userId }
    });
  } catch (error) {
    console.error("[search-log] failed to record search", error);
  }
}
