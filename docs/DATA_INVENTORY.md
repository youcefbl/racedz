# ZidRun Data Inventory (SEC-002)

> This is the field-level data classification required by `SEC-002` in
> [`EXECUTION_PLAN.md`](../EXECUTION_PLAN.md). Status, gate numbers, and release decisions live only in
> that file — this document is the reference it points to, not a second tracker. Update it whenever a
> new data-collecting field, table, or third-party processor ships (the plan's own locked rule: "No new
> data-collecting feature ... ships until its data classification, consent, retention, deletion/export,
> access, and provider-processing decisions are recorded here and tested").

Prisma model line numbers below refer to `prisma/schema.prisma` at the time of writing; re-check them
before relying on this file if the schema has moved on.

## How to read this table

- **Purpose** — why the data is collected, not just what it is.
- **Access** — who can read it in the running app (roles, or "owner only").
- **Retention** — how long it's kept and by what mechanism (automatic prune job, manual, or indefinite).
- **Export/delete** — whether a runner can get their own data out or removed, and how.
- **Processor** — any third party the data is sent to.

## Identity, authentication, and contact

| Data class | Fields / model | Purpose | Access | Retention | Export/delete | Processor |
|---|---|---|---|---|---|---|
| Core identity | `User.email/firstName/lastName/arabicFullName/phone/nationalId/dateOfBirth/gender/wilaya/city/commune` (`schema.prisma:10`) | Account identity, race-organizer eligibility (`nationalId`), localization | Owner; admin/superadmin (support, moderation) | Indefinite while account exists | Admin-only `deleteUserAction` (`src/app/admin/actions.ts:396`) cascades most relations then deletes the row; **no self-service delete/export yet** — open gap, see "Open gaps" below | None (never sent to a third party) |
| Credentials | `User.passwordHash` | Login | Server-side only (bcrypt hash, never returned to any client) | Indefinite while account exists | Deleted with the account | None |
| MFA | `User.mfaSecret/mfaBackupCodes/mfaEnabledAt` | TOTP second factor for admin/superadmin | Server-side only; backup codes stored as SHA-256 hashes, never the plaintext | Indefinite while enrolled | Cleared on disable; deleted with the account | None |
| Session integrity | `User.securityStampAt` | Revokes all JWT sessions on password/MFA/role change (see the session-revocation memory) | Server-side only | Indefinite | Deleted with the account | None |
| Verification/reset tokens | `EmailVerificationToken`, `PasswordResetToken` (`:385,:415`) | One-time email-verification / password-reset links | Server-side only, single-use | Expire quickly (short TTL) and are deleted on use; no scheduled prune job for unused expired rows yet | N/A (ephemeral) | Sent via Resend (email delivery only, no token content beyond the link) |
| Native auth handoff | `NativeAuthToken` (`:402`) | One-time token bridging a native-app sign-in into a web session | Server-side only | Short TTL, single-use | N/A | None |

## Organizations and race commerce

| Data class | Fields / model | Purpose | Access | Retention | Export/delete | Processor |
|---|---|---|---|---|---|---|
| Organization | `Organization`, `OrganizationMember`, `OrganizationInvitation` (`:90,:121,:140`) | Race-organizer accounts and roles | Members of that org; admin/superadmin | Indefinite | Cascades when the org or member is removed | None |
| Race payment config | `RaceEvent.baridiMobNumber/ccpAccount/ccpKey` (`:164`) | Organizer's own bank-transfer details shown to registrants | Public to anyone viewing the race listing (organizer-supplied, not runner PII) | Indefinite while race exists | Edited/removed by the organizer | None |
| Registration | `RaceRegistration` (`:342`): `emergencyContactName/Phone`, `tshirtSize`, `paymentMethod/Status` | Race-day safety contact, logistics, payment reconciliation | Owner; the race's organizer members; admin | Indefinite | Deleted if the registration is cancelled/the account is deleted; no standalone export | None |
| Payment proof | `RaceRegistration.paymentProofUrl` | Manual bank-transfer receipt review | Owner, race's organizer members, admin — **enforced by `/api/registrations/[id]/proof`** (SEC-007/SEC-010 fix), not a public URL | Indefinite while the registration exists | Same as registration | None (image re-encoded on upload, EXIF/GPS stripped — `src/lib/storage.ts`) |
| Dead field | `RaceRegistration.medicalCertificateUrl` (`:356`) | Unused — zero code references anywhere in `src` | N/A | N/A | **Action item:** drop in a future migration, or decide the feature and build proper access control before ever writing to it. Health-adjacent field must not go live unlabeled. | None |
| Edit history | `RaceEditHistory` (`:369`) | Audit trail of race-listing edits | Organizer/admin | Indefinite | N/A | None |

## Coach, training, health-adjacent, and GPS

| Data class | Fields / model | Purpose | Access | Retention | Export/delete | Processor |
|---|---|---|---|---|---|---|
| Goals/plans/workouts | `RunnerGoal`, `TrainingPlan`, `TrainingWorkout` (`:534,:621,:642`) | AI coach training program | Owner only | Indefinite while account exists | Deleted with the account; coach domain also has per-record owned delete (`src/lib/coach/service.ts`) | OpenAI (plan generation) |
| Runs / GPS | `RunnerRun.route` (GPS track JSON), `weather`, `averageHeartRate`, `photos` (`:575`) | Run history, maps, coaching context | Owner only, unless `isPublic=true` **and** the owner's `profilePrivate=false` (feed/leaderboard/kudos — see the SEC-004 fix in `src/lib/social.ts`) | Indefinite | Owner can delete individual runs; full export not yet self-service | OpenAI (coach context only, not raw GPS export) |
| Health-adjacent run fields | `RunnerRun.fatigueLevel/painLevel/symptoms/notes` | Coach adaptation context | Owner only | Indefinite | Same as runs | OpenAI (sent as coach context) |
| Coach memory | `CoachMemory` (`:680`) | Long-lived facts the coach remembers about the runner | Owner only | Indefinite | Deleted with the account | OpenAI |
| **Gated health memory** | `CoachMemory` kinds `INJURY_STATUS`/`RECOVERY_STATUS` | Explicitly blocked in code pending the health-data policy line (per the plan's locked decision) | N/A — not yet written | N/A | N/A | N/A |
| Sleep | `SleepLog` (`:769`) | Coach recovery context | Owner only | Indefinite | Deleted with the account | OpenAI (aggregated context only) |
| Coach interactions/usage | `CoachInteraction`, `AiUsageLog` (`:787,:818`) | Conversation history, cost/abuse tracking | Owner only (interactions); admin (aggregate usage) | Indefinite | Deleted with the account | OpenAI |
| Coach subscription | `CoachSubscription`, `CoachSubscriptionRequest.paymentProofUrl` (`:843,:870`) | Manual coach-tier billing proof | Owner, admin — served via `/api/coach/subscription/proof/[...path]` (already authenticated) | Indefinite | Deleted with the account | None |
| Voice (out) | Guided-run TTS audio (disk-cached by locale+text, not a DB model) | Cloud TTS fallback when no on-device voice exists | Not user-specific (cached by text content, not by user) | Cache, no defined eviction policy yet | N/A | OpenAI (TTS) |
| Voice (in) | Voice-note recording — a cache file on the device, never stored server-side | Speech-to-text for the coach composer, so a runner who cannot type comfortably still has the surface | Owner only, transiently: the audio is sent to the provider, transcribed, and the response returned | **Not retained.** The web client holds a `Blob` in memory; the native client writes to its own cache directory and deletes the file after transcription, successfully or not. Only the `AiUsageLog` row (model, status, no content) persists | N/A — nothing to export | OpenAI (transcription) |
| Reply playback | None — the coach reply is spoken by the **device's own** TTS engine | Reading a reply aloud | N/A | N/A | N/A | **None.** Deliberately not the cloud TTS route, which is allow-listed to cue phrases so it can never synthesize arbitrary reply text |

## Notifications, admin, and analytics

| Data class | Fields / model | Purpose | Access | Retention | Export/delete | Processor |
|---|---|---|---|---|---|---|
| Notifications | `Notification`, `NotificationDelivery`, `NotificationPreference` (`:444,:462,:494`) | In-app/push notification history and preferences | Owner only | Indefinite (no prune job yet) | Deleted with the account | Firebase Cloud Messaging (push token + payload) |
| Push token | `PushSubscription.token` (`:479`) | FCM device registration | Owner only, server-side | Indefinite while device is registered | Removed on logout/uninstall detection; deleted with the account | Firebase Cloud Messaging |
| Admin audit log | `AdminAuditLog` (`:276`) | Accountability trail for admin actions | Admin/superadmin | **31 days**, auto-pruned (`ADMIN_AUDIT_RETENTION_DAYS`, `scripts/prune-admin-audit.ts`) | Rows referencing a deleted actor are removed as part of `deleteUserAction`'s cascade — see "Open gaps" | None |
| Page-view analytics | `PageView` (`:298`) | First-party visitor analytics (`/admin/analytics`) | Admin/superadmin | **90 days** (`PAGEVIEW_RETENTION_DAYS`), auto-pruned (`scripts/prune-pageviews.ts`) | N/A (not linked to an account by identity) | None (first-party only) |
| Search queries | `SearchQuery` (`:1168`) | Search-insights admin module | Admin/superadmin | Same prune job as page views | N/A | None |
| Client error logs | `ClientErrorLog.stack/context` (`:322`) | Frontend crash triage | Admin/superadmin | **`CLIENT_ERROR_RETENTION_DAYS`** (30 days default), auto-pruned (`scripts/prune-client-errors.ts`) | N/A | None (separate from Sentry) |
| Error monitoring | Unhandled exceptions, breadcrumbs | Production error tracking | Sentry project members (owner) | Per Sentry project retention | Per Sentry account settings | **Sentry** — `beforeSend`/`beforeSendTransaction` scrubbing configured on all three inits (server/edge/client) via `src/lib/sentry-scrub.ts`: cookies dropped, auth headers redacted, request body/extra/contexts passed through the shared redactor, and request URLs/query strings stripped of single-use tokens. Verified by `npm run test:sentry-scrub` |
| Native crash reports | Stack trace, device model/OS, app version, breadcrumbs, custom keys (`native-android/.../observability/CrashReporting.kt`) | Crash and non-fatal triage for the Android app | Firebase project members (owner) | Per Crashlytics retention (90 days for crash sessions) | N/A — no account identifier is attached, so a report cannot be located by user | **Firebase Crashlytics**. Deliberately no `setUserId`, so reports are not linked to an account; custom keys are build/runtime facts only. Runner-facing switch in Privacy & data (default on, notice-and-choice); disabling stops collection immediately |
| Native screen views | `PageView` rows with `platform = "android"` (`:298`) | First-party analytics, same table as the web | Admin/superadmin | **90 days**, same prune job | N/A | None (first-party). Visitor/session ids are random per-install UUIDs minted on the device — never `ANDROID_ID` — and clear with app data |
| Broadcasts | `Broadcast`, `BroadcastRecipient` (`:1128,:1149`) | Admin-composed announcements | Admin (compose); recipient sees their own delivery | Indefinite | Deleted with the account (recipient row) | Resend (email) / FCM (push) |

## Support, social, and groups

| Data class | Fields / model | Purpose | Access | Retention | Export/delete | Processor |
|---|---|---|---|---|---|---|
| Support threads | `SupportThread`, `SupportMessage` (`:1187,:1205`) | User↔admin support conversations | Owner, admin | Indefinite | Deleted with the account | None |
| Reports | `Report` (`:1100`) | User-submitted moderation reports | Reporter (their own), admin | Indefinite | N/A | None |
| Follows / kudos | `Follow`, `RunKudos` (`:1227,:1241`) | Social graph, run likes | Public-ish per the `profilePrivate`/`isPublic` rules enforced in `src/lib/social.ts` | Indefinite | Deleted with the account | None |
| Nutrition | `NutritionEntry` (`:1329`) | Coach nutrition tracking | Owner only | Indefinite | Deleted with the account | None (logged manually, not sent to OpenAI today) |
| Groups | `Group.joinToken`, `GroupMember.role` (`:1259,:1280`) | Private/public running groups | Members only (see `src/lib/groups.ts`); `isPrivate` groups are invite/join-link only | Indefinite | Deleted with the account (membership rows); no group-deletion function yet (tracked in `EXECUTION_PLAN.md` PR-056/057) | None |

## Open gaps this inventory surfaces

These are documentation findings, not yet closed action items — tracked here so `SEC-002` isn't marked
complete from an inventory alone, per the plan's own rule.

1. **No self-service export or delete.** A runner cannot download or delete their own data today;
   `deleteUserAction` is admin-only (`src/app/admin/actions.ts:396`). Until a self-service flow exists,
   deletion/export requests must go through support and be executed manually by an admin.
2. **`RaceRegistration.medicalCertificateUrl` is dead code** — a health-adjacent field with zero
   references. Drop it in a migration, or design consent/access controls before ever using it.
3. **No prune job for expired, unused `EmailVerificationToken`/`PasswordResetToken` rows** — they stop
   being usable once expired but aren't deleted on a schedule.
4. **Admin-actor audit rows are deleted alongside the actor's account** (`deleteUserAction`'s cascade
   removes `AdminAuditLog` rows where `actorId` is the deleted user) — if an ex-admin's account is
   deleted, the record of actions they took against *other* accounts goes with it. Consider
   anonymizing (`actorId → null` + keep a name snapshot) instead of deleting, if audit continuity
   across admin turnover matters.
5. **Sentry has no `beforeSend` scrubbing configured** — tracked as the `SEC-013` logging/redaction gate,
   not duplicated here.
6. **Voice-cue TTS cache has no defined eviction policy.**
