import { getPrisma } from "@/lib/db";
import { PAGEVIEW_RETENTION_DAYS, prunePageViews, pruneSearchQueries } from "@/lib/analytics";

function getRetentionDays() {
  const rawValue = process.env.PAGEVIEW_RETENTION_DAYS;

  if (!rawValue) {
    return PAGEVIEW_RETENTION_DAYS;
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 730) {
    throw new Error("PAGEVIEW_RETENTION_DAYS must be an integer between 1 and 730.");
  }

  return parsed;
}

async function main() {
  const retentionDays = getRetentionDays();
  const pageViews = await prunePageViews(retentionDays);
  const searches = await pruneSearchQueries(retentionDays);

  console.info(
    `Pruned ${pageViews.deleted} page view(s) and ${searches.deleted} search log(s) older than ${pageViews.cutoff.toISOString()} (${retentionDays} day retention).`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
