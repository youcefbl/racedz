import { getPrisma } from "@/lib/db";
import { CLIENT_ERROR_RETENTION_DAYS, pruneClientErrors } from "@/lib/client-errors";

function getRetentionDays() {
  const rawValue = process.env.CLIENT_ERROR_RETENTION_DAYS;

  if (!rawValue) {
    return CLIENT_ERROR_RETENTION_DAYS;
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 730) {
    throw new Error("CLIENT_ERROR_RETENTION_DAYS must be an integer between 1 and 730.");
  }

  return parsed;
}

async function main() {
  const retentionDays = getRetentionDays();
  const result = await pruneClientErrors(retentionDays);

  console.info(`Pruned ${result.deleted} client error report(s) older than ${result.cutoff.toISOString()} (${retentionDays} day retention).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
