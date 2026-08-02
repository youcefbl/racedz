import "server-only";

import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db";

// Auditable consent for AI-coach health-data processing (combined coach review, U-02).
//
// This is the scaffolding half of the SEC-002 work: it turns the onboarding consent checkbox from
// transient UI state into a versioned, per-purpose grant with a reconstructable trail. The policy
// half — reviewed copy, retention, withdrawal effects on stored health data, and hard enforcement
// (refusing sensitive processing without an active grant) — lands with the SEC-002 policy text and
// slots in here without another migration.

/**
 * Version of the consent wording the runner agreed to. Bump whenever the runner-facing consent
 * copy or its scope changes; grants are per-version, so a bump makes re-consent visible in the
 * audit trail instead of silently stretching an old agreement over new wording.
 */
export const COACH_CONSENT_POLICY_VERSION = "coach-consent-2026-08-v1";

export type CoachConsentClient = "web" | "native";

// Raw-query surface shared by the Prisma client and an in-flight transaction client, so the grant
// can be written atomically with the sensitive data it authorises (T0-R02).
type RawDb = Pick<ReturnType<typeof getPrisma>, "$queryRaw" | "$executeRaw">;

/**
 * Record (idempotently) that the runner granted health-data processing for AI coaching.
 *
 * Idempotent per (user, purpose, policyVersion): submitting the goal form again under the same
 * policy version affirms the existing grant rather than stacking duplicate rows. A grant after a
 * withdrawal, or under a new policy version, creates a fresh row so the trail stays append-only.
 *
 * Pass the surrounding transaction client as `db` when the grant must commit atomically with the
 * health data it covers — a stored goal without its grant is exactly the state U-02 forbids.
 */
export async function recordCoachHealthConsent(
  userId: string,
  sourceClient: CoachConsentClient,
  db: RawDb = getPrisma()
): Promise<{ granted: boolean }> {
  const existing = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "CoachConsent"
    WHERE "userId" = ${userId} AND "purpose" = 'HEALTH_COACHING_AI'
      AND "policyVersion" = ${COACH_CONSENT_POLICY_VERSION} AND "status" = 'GRANTED'
    LIMIT 1
  `;
  if (existing[0]) return { granted: false };

  await db.$executeRaw`
    INSERT INTO "CoachConsent" ("id", "userId", "purpose", "policyVersion", "status", "sourceClient", "updatedAt")
    VALUES (${randomUUID()}, ${userId}, 'HEALTH_COACHING_AI', ${COACH_CONSENT_POLICY_VERSION}, 'GRANTED', ${sourceClient}, NOW())
  `;
  return { granted: true };
}

/**
 * The runner's active grant under the CURRENT policy version, if any. Filtering by version matters
 * (T0-R04): a grant made under superseded wording must read as "re-consent required", never as an
 * active grant for wording the runner has not seen.
 */
export async function getActiveCoachHealthConsent(userId: string): Promise<{ grantedAt: Date; policyVersion: string } | null> {
  const rows = await getPrisma().$queryRaw<Array<{ grantedAt: Date; policyVersion: string }>>`
    SELECT "grantedAt", "policyVersion" FROM "CoachConsent"
    WHERE "userId" = ${userId} AND "purpose" = 'HEALTH_COACHING_AI' AND "status" = 'GRANTED'
      AND "policyVersion" = ${COACH_CONSENT_POLICY_VERSION}
    ORDER BY "grantedAt" DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Withdraw the health-processing grant. What withdrawal does to already-stored health data (and
 * whether coaching degrades to a non-sensitive path) is a SEC-002 policy decision — this records
 * the withdrawal so that decision has something to act on.
 */
export async function withdrawCoachHealthConsent(userId: string): Promise<{ withdrawn: boolean }> {
  const count = await getPrisma().$executeRaw`
    UPDATE "CoachConsent"
    SET "status" = 'WITHDRAWN', "withdrawnAt" = NOW(), "updatedAt" = NOW()
    WHERE "userId" = ${userId} AND "purpose" = 'HEALTH_COACHING_AI' AND "status" = 'GRANTED'
  `;
  return { withdrawn: count > 0 };
}
