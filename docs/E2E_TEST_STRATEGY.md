# ZidRun E2E Test Strategy

ZidRun uses Playwright for browser journeys, responsive checks, and visual regression coverage.

## Running the suite

```bash
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:visual
```

The runner derives a dedicated `<development-database>_e2e` database by default, resets it,
applies every migration, and seeds deterministic fixtures before Playwright starts. Set
`RACEDZ_E2E_DATABASE_URL` to use another database. As a destructive-operation safeguard, the
runner refuses to reset databases whose names do not end in `_e2e` or `_ci`.

Bulk load-test fixtures are disabled in E2E runs. To refresh reviewed visual baselines, run
`npm run test:e2e:visual -- --update-snapshots` and inspect the changed PNG files before committing.

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

## Browser installation

```bash
npm install -D @playwright/test
npx playwright install chromium
```

