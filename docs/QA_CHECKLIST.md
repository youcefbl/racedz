# ZidRun Manual QA Checklist

Use this checklist before a commit, release handoff, or large follow-up change. Keep the app on the canonical local URL: `http://127.0.0.1:3003`.

## Prerequisites

- PostgreSQL is running: `docker compose up -d postgres`
- Migrations are current: `npx prisma migrate status`
- Demo data exists: `npm run prisma:seed`
- Dev server is running: `npm run dev`
- Browser cache is not serving an old build. If assets 404, stop dev, run `npm run build`, then restart `npm run dev`.

Demo accounts:

| Role | Email | Password |
| --- | --- | --- |
| Superadmin | `admin@zidrun.com` | `racedz-demo-password` |
| Organizer | `organizer@zidrun.com` | `racedz-demo-password` |
| Runner | `runner@example.com` | `racedz-demo-password` |

## Public Website

- Open `/` and verify the header, theme switcher, language switcher, race CTA, and footer render.
- Open `/races` and verify search/filter controls render without layout overflow.
- Open a public race detail page and verify:
  - Race image area renders.
  - Date, location, organizer, registration status, capacity, categories, price, rules, and contact are visible.
  - Category-specific race type badges are visible for multi-race events.
  - Announcements appear when a race has published announcements.
- Switch light, dark, and race modes. Confirm cards, dropdowns, inputs, text, and focus states remain readable.
- Switch `?lang=fr` and `?lang=ar` on public pages. Confirm no obvious broken navigation or layout collapse.

## Auth And Account

- Log out if currently signed in.
- Visit `/account`, `/organizer`, and `/admin`; each should redirect to `/login` with a safe callback URL.
- Register a new runner account:
  - The account should be created.
  - A branded verification email should be sent through Resend when configured.
  - Login should be blocked until the verification link is opened.
- Open `/verify-email/<token>` from the email and confirm the account activates.
- Log in as the activated runner and confirm redirect to `/account`.
- Use the profile menu:
  - Menu opens and closes on outside click.
  - Menu closes with Escape.
  - Sign out clears authenticated header UI.

## Runner Registration

- Log in as `runner@example.com`.
- Open a race with registration open.
- Submit a registration using a category that is not already registered for the runner.
- Confirm:
  - Duplicate registration for the same category is blocked.
  - `/account/registrations` shows the new registration.
  - In-app notification is created.
  - Registration email is attempted through Resend when configured.
  - Push delivery is attempted when a browser push token exists.

## Organizer Onboarding And Members

- Log in as a runner without organizer access and open `/organizer`; user should land on `/organizer/request`.
- Submit an organization request with logo upload.
- Log in as admin and approve the organization.
- Return as the requester and verify `/organizer` is accessible.
- Open `/organizer/members`.
- Invite a teammate:
  - Pending invite appears.
  - Copy-link fallback is available.
  - Branded invite email delivery is attempted.
- Accept the invite from `/invite/<token>` as the invited account.
- Verify organization member role updates and member removal protections:
  - Non-owner cannot manage owner.
  - User cannot remove or downgrade their own access.
  - Organization keeps at least one owner.

## Organizer Race Management

- Log in as `organizer@zidrun.com`.
- Create a race from `/organizer/events/new`:
  - Add multiple categories with different race types, distances, prices, capacities, and start times.
  - Upload a local race image.
  - Submit race; status should be `PENDING_REVIEW`.
  - Admins should receive review notification/email attempts.
- Open the organizer race detail:
  - Category race types and distances render.
  - Registration controls stay locked until publication.
- Edit a draft, pending, or rejected race:
  - Description is required.
  - Category fields are separated and do not overflow.
  - Edit history is recorded.
- After admin publication:
  - Open registration only when the start date, registration deadline, category count, and capacity rules allow it.
  - Close, mark full, and cancel registration states as appropriate.
- Publish an announcement:
  - It appears on organizer race detail.
  - It appears on public race detail.
  - Registered runners receive notification/email/push attempts.

## Admin And Superadmin

- Log in as `admin@zidrun.com`.
- Confirm `/admin` dashboard stats render.
- Verify list pages support filters and pagination:
  - `/admin/users`
  - `/admin/organizations`
  - `/admin/races`
  - `/admin/registrations`
- Organization approvals:
  - Approve pending organization and confirm requester can access organizer area.
  - Reject organization with reason and confirm reason is visible in admin list.
- Race approvals:
  - Publish a pending race.
  - Reject a pending race.
  - Unpublish a published race.
  - Publish again from `DRAFT`.
  - Confirm organizer members receive notification/email/push attempts.
- Admin race edit:
  - Change material details.
  - Confirm audit log entry is created.
  - Confirm active registrants receive race-change notification/email/push attempts.
- Audit log:
  - Filter by actor name/email.
  - Filter by target type.
  - Filter by action.
  - Reset filters.
- Superadmin-only checks:
  - Create platform race from `/admin/races/new`.
  - View organizer race edit history.
  - Confirm last-superadmin role safeguard blocks removing the final superadmin.

## Uploads

- Upload avatar from profile.
- Upload organization logo from organizer request/settings.
- Upload race image from organizer and admin race forms.
- Confirm:
  - JPG, PNG, WebP, and GIF are accepted.
  - Invalid MIME type is rejected.
  - Files over 5 MB are rejected.
  - Uploaded URLs use `/uploads/<scope>/<YYYY-MM>/...`.
  - Uploaded user files are not tracked by Git.

## Notifications And Email

- Open the bell dropdown in light, dark, and race modes; it should not stay white in dark/race mode.
- Opening the dropdown should mark unread notifications as read.
- Open `/account/notification-settings`:
  - Toggle email/push preferences.
  - Enable or reconnect browser push.
  - Send test push and read the provider feedback.
- Confirm Resend failures do not block core actions.
- Confirm Firebase failures create delivery records with useful error text.

## Role Redirects

- Runner:
  - `/account` allowed.
  - `/organizer` redirects to request page unless approved member.
  - `/admin` redirects away.
- Organizer:
  - `/organizer` allowed.
  - `/admin` redirects away unless also admin/superadmin.
- Admin/superadmin:
  - `/admin` allowed.
  - `/organizer/request` remains reachable but organizer management still requires approved organization membership where appropriate.

## Final Quality Gate

Run these before handing off meaningful code changes:

```bash
npm run lint
npm run typecheck
npm run build
npm run smoke
```

`npm run smoke` expects `npm run dev` to already be running on `http://127.0.0.1:3003`.
