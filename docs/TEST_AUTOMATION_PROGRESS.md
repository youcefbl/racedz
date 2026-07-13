# ZidRun Test Automation Progress

Updated: 2026-07-13

## Completed

- Playwright starts the local app automatically on the canonical `127.0.0.1:3003` URL.
- Auth journeys cover registration, verification, login, logout, password reset, and route guards.
- Coach E2E coverage creates a goal, handles plan/run flows, and accepts the expected AI provider-failure path.
- Visual regression coverage checks the home, races, and login pages across:
  - Desktop `1440x900` and mobile `390x844` viewports.
  - Light, dark, and race themes.
  - Arabic RTL layout and horizontal overflow.
- Structural UI checks detect missing accessible names, undersized mobile controls, touch-target issues, and horizontal clipping.
- 18 reviewed screenshot baselines are stored under `tests/visual.e2e.spec.ts-snapshots/`.
- CI now runs lint, typecheck, focused domain checks, build, browser E2E, and production smoke checks.
- Playwright failure screenshots and traces are uploaded as CI artifacts.
- Production standalone builds now include `public/` and `.next/static/` assets and run on port `3003`.
- Testing found and fixed undersized password toggles and the past-races control.

## Verified Locally

Using the isolated PostgreSQL database `racedz_e2e`:

- `npm run lint`: passed with existing warnings only.
- `npm run typecheck`: passed.
- `npm run test:coach`: passed.
- `npm run test:workout`: passed.
- `npm run test:mfa`: passed.
- `npm run build`: passed.
- `RACEDZ_BASE_URL=http://127.0.0.1:3003 npm run smoke`: passed `12/12`.
- `npm run test:e2e:visual`: passed `26/26`.
- Coach browser journey: passed after the final test assertion fix.

## Remaining Work

### High priority

- Add a repeatable local test reset command that creates/migrates/seeds a fresh E2E database before each run. CI currently starts from a fresh PostgreSQL service; local runs require an isolated database supplied through `DATABASE_URL`.
- Expand browser coverage for profile completion, race discovery and registration, payment-proof upload, organizer lifecycle, admin moderation, notifications, invitations, and rankings.
- Run the complete E2E suite after any changes to shared auth, registration, organizer, admin, or database logic.

### UI and device coverage

- Keep visual baselines updated only after reviewing intentional UI changes with `npm run test:e2e:visual -- --update-snapshots`.
- Add `@axe-core/playwright` checks for full WCAG-oriented assertions; current checks cover common structural accessibility regressions.
- Test the Capacitor Android app on an emulator and at least one physical device. Playwright currently covers mobile web viewports, not native Android behavior, GPS, push notifications, or keyboard/status-bar integration.
- Add performance budgets for page load, JavaScript size, and image weight.

### Product and infrastructure

- Enable OpenAI billing/quota before requiring the live AI assertion with `RACEDZ_REQUIRE_LIVE_AI=1`.
- Add deterministic provider stubs for AI and email when expanding organizer/admin E2E flows.
- Reduce or explicitly suppress the existing non-blocking ESLint warnings, especially bundled skill files and the unused blog value.

## Commands

```bash
# Full local quality gate against the isolated test database
DATABASE_URL=postgresql://racedz:racedz@localhost:5432/racedz_e2e npm run test:all

# Visual/UI regression checks
DATABASE_URL=postgresql://racedz:racedz@localhost:5432/racedz_e2e npm run test:e2e:visual

# Review and intentionally update screenshots
npm run test:e2e:visual -- --update-snapshots

# Production asset and route smoke checks
RACEDZ_BASE_URL=http://127.0.0.1:3003 npm run start
RACEDZ_BASE_URL=http://127.0.0.1:3003 npm run smoke
```
