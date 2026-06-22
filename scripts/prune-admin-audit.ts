import { getPrisma } from "@/lib/db";
import { ADMIN_AUDIT_RETENTION_DAYS, pruneExpiredAdminAuditLogs } from "@/lib/admin";

function getRetentionDays() {
  const rawValue = process.env.ADMIN_AUDIT_RETENTION_DAYS;

  if (!rawValue) {
    return ADMIN_AUDIT_RETENTION_DAYS;
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 366) {
    throw new Error("ADMIN_AUDIT_RETENTION_DAYS must be an integer between 1 and 366.");
  }

  return parsed;
}

async function main() {
  const result = await pruneExpiredAdminAuditLogs({
    retentionDays: getRetentionDays()
  });

  console.info(
    `Pruned ${result.deleted} admin audit log(s) older than ${result.cutoff.toISOString()} (${result.retentionDays} day retention).`
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
