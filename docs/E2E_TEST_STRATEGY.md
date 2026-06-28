# ZidRun E2E Test Strategy

Use Playwright for browser-level tests once the signup, organizer, race creation, approval, and registration flows are stable enough to automate.

## Recommended Strategy

- Run e2e tests against a dedicated test database, not local development data.
- Reset the test database before the suite.
- Apply Prisma migrations.
- Seed deterministic base data:
  - one superadmin
  - one admin
  - one verified runner
  - one approved organizer and organization
  - one published race with open registration
- Use unique emails per test run for newly created users.
- Keep `npm run smoke` as the fast fetch-only route check.
- Add Playwright for full browser journeys.

## First Browser Journeys

1. Runner account creation:
   - Open `/register`.
   - Submit a valid runner profile.
   - Confirm redirect to `/login?registered=1`.
   - Verify the created user exists in the database.

2. Organizer request:
   - Log in as a verified runner.
   - Open `/organizer/request`.
   - Submit organization details.
   - Confirm pending organization exists.

3. Admin organization approval:
   - Log in as admin.
   - Open `/admin/organizations`.
   - Approve the pending organization.
   - Confirm the requester is upgraded to organizer access.

4. Organizer race creation:
   - Log in as organizer.
   - Open `/organizer/events/new`.
   - Create a race with at least one category.
   - Confirm the race is pending admin review.

5. Admin race approval:
   - Log in as admin.
   - Open `/admin/races`.
   - Publish the pending race.
   - Confirm it appears on public race pages.

6. Runner race registration:
   - Log in as runner.
   - Open the published race detail page.
   - Submit registration.
   - Confirm registration appears in `/account/registrations`.

## Test Data Rules

- Do not depend on real `.env` secrets.
- Disable real Resend/Firebase delivery in test mode, or use provider stubs.
- Keep payment as manual status only.
- Use deterministic dates far enough in the future that registration stays open.
- Avoid testing deployment infrastructure in browser e2e; keep that for deployment smoke checks later.

## Future Package Changes

Add when ready:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Recommended scripts:

```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

