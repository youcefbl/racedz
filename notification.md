# ZidRun Notification And Email Plan

This module should support in-app notifications first, then push and email delivery as channels on top of the same notification event.

## Recommended Provider Stack

Use this stack for the MVP:

- In-app notifications: ZidRun database tables, built in the app.
- Push notifications: Firebase Cloud Messaging (FCM).
- Transactional email: Resend for MVP.
- Backup email provider: Postmark if deliverability becomes more important than low starting cost.
- Marketing or multi-channel campaigns later: Brevo or OneSignal, only after the transactional notification flow is stable.

Provider notes checked on 2026-06-18:

- Firebase Cloud Messaging: recommended for push. Firebase lists Cloud Messaging (FCM) as no-cost, and it supports web/mobile notification delivery.
  Source: https://firebase.google.com/pricing
- Resend: recommended MVP transactional email provider. Current pricing shows a free plan with 3,000 emails/month and 100 emails/day, then Pro at $20/month for 50,000 emails/month.
  Source: https://resend.com/pricing
- Postmark: recommended backup or upgrade path for transactional email deliverability. Current pricing shows a free testing plan with 100 emails/month and Basic from $15/month for 10,000 emails/month.
  Source: https://postmarkapp.com/pricing
- Brevo: good later if ZidRun needs marketing email, SMS, WhatsApp, and broader CRM-style campaigns. Free sending is up to 300 emails/day after account approval; paid plans start from 5,000 emails/month.
  Source: https://www.brevo.com/pricing/
- OneSignal: good later if ZidRun wants a managed cross-channel notification product with push, in-app, email, journeys, and segmentation. Free includes all channels with limits, unlimited mobile push sends, and 10,000 email sends/month; Growth starts at $19/month plus channel usage.
  Source: https://onesignal.com/pricing

## Recommendation

Start with internal notification records plus FCM plus Resend.

Reason:

- It keeps ownership of notification history inside ZidRun.
- It avoids vendor lock-in for the notification center.
- FCM is the simplest and cheapest push choice for web/mobile.
- Resend is developer-friendly for a Next.js MVP and has enough free quota for early testing.
- The provider boundary can stay small: one `notification` domain service creates DB rows, then dispatches selected channels.

Do not start with OneSignal as the primary provider unless the goal changes to marketing automation. ZidRun needs operational notifications first, not a marketing journey platform.

## Backend Flow

```text
ZidRun backend action
  -> create Notification record in DB
  -> create NotificationDelivery records per channel
  -> enqueue delivery jobs
  -> send push through Firebase FCM
  -> send email through Resend
  -> user sees unread item in website notification center
```

## Notification Channels

| User type | Event | Channels |
| --- | --- | --- |
| Admin | Race approval pending | In-app + Firebase push + email |
| Organizer | Race accepted/rejected | In-app + Firebase push + email |
| Organizer | Payment proof needs review | In-app + email |
| Runner | New race in user's wilaya | In-app + Firebase push |
| Runner | Race reminder | In-app + Firebase push + optional email |
| Runner | Organizer/admin announcement | In-app + Firebase push + email |
| Runner | Organizer/admin race change | In-app + Firebase push + email |
| Runner | Registration created | In-app + Firebase push + email |

## Data Model Draft

Core tables:

- `Notification`
  - `id`
  - `userId`
  - `type`
  - `title`
  - `body`
  - `href`
  - `metadata`
  - `readAt`
  - `createdAt`

- `NotificationDelivery`
  - `id`
  - `notificationId`
  - `channel`: `IN_APP`, `PUSH`, `EMAIL`
  - `status`: `PENDING`, `SENT`, `FAILED`, `SKIPPED`
  - `provider`: `firebase`, `resend`, `internal`
  - `providerMessageId`
  - `error`
  - `sentAt`
  - `createdAt`

- `PushSubscription`
  - `id`
  - `userId`
  - `provider`: `firebase`
  - `token`
  - `deviceLabel`
  - `lastSeenAt`
  - `revokedAt`
  - `createdAt`

- `NotificationPreference`
  - `id`
  - `userId`
  - `type`
  - `inAppEnabled`
  - `pushEnabled`
  - `emailEnabled`
  - `updatedAt`

## Implementation Notes

- Create the DB notification first. Provider delivery must not be the source of truth.
- Use an outbox/job pattern so a failed email or push does not fail the core business action.
- Store provider API keys only in `.env`, never in Git.
- Email templates should live in code first, with simple text and HTML variants.
- Add unsubscribe/preference controls before sending marketing-style race discovery emails.
- For race changes, send email only for material changes: date, location, category, price, registration status, or cancellation.
- For "new race in user's wilaya", throttle notifications to avoid spam. A daily digest may be better than one push per race after volume grows.

## MVP Build Order

1. Done: Add notification DB tables and domain helper.
2. Done: Add notification bell in the website header.
3. Done: Add `/account/notifications` page with unread/read states.
4. Done: Add server-side notification creation for race approval, race rejection, and organizer race status changes.
5. Done: Add Resend email adapter behind `src/lib/notifications/email-provider.ts`.
6. Done: Add Firebase FCM server-side push adapter and token registration API.
7. Done: Add notification preferences.
8. Done: Add Firebase browser SDK setup, service worker, and permission prompt.
9. Done: Add reconnect and test-push controls with foreground-message handling and provider delivery feedback.
10. Done: Notify organization members when admins unpublish or publish a race again.
11. Done: Add shared ZidRun email template and account activation emails.
12. Done: Add registration-created and race-change notifications for runners.
13. Done: Add organizer/admin race announcements with public race-detail display.
14. Next: Add payment proof review notifications.
15. Next: Add race reminder jobs.
16. Next: Add wilaya race alerts.
