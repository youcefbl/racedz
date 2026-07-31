# ZidRun Race Design Flow

This folder is the native Android visual reference for race discovery, registration, and entry
management. It extends the Runs and Coach redesign language: mobile-first Compose/Material 3
surfaces, strong outdoor readability, thumb-reachable actions, restrained athletic color, and
trust-first handling of registration and payment information.

The images are high-fidelity product references, not implementation code. Native screens should
match the information hierarchy and interaction intent while using the shared Android design tokens.

## Screens

| Screen | Purpose | Image |
| --- | --- | --- |
| Races Overview | Discover upcoming Algerian races with location, distance, date, and route previews. | [01 — Races Overview](images/01-races-overview.png) |
| Race Details | Understand an event quickly, choose a distance, inspect the route, and start registration. | [02 — Race Details](images/02-race-details.png) |
| Race Registration | Complete a focused, retry-safe registration form with clear privacy and payment-proof handling. | [03 — Race Registration](images/03-race-registration.png) |
| My Registrations | Review confirmed, past, ticket, and certificate states from Account. | [04 — My Registrations](images/04-my-registrations.png) |

## Primary flow

```text
Races Overview
  ├─ search / location / filters ───────> filtered race list
  ├─ featured or list race ─────────────> Race Details
  └─ Account → My registrations ────────> ticket / certificate / past entry

Race Details
  ├─ choose 5K / 10K / 21K ─────────────> selected category summary
  ├─ route, cutoff, hydration, organizer -> confidence to register
  └─ Register now ──────────────────────> Registration 1/3 → review → submitted
                                           └─ success → My registrations → ticket
```

## Screen behavior

### Races Overview

- The top bar keeps search available without taking over the page.
- Location is explicit and editable; it must never silently expose precise home location.
- Featured race uses one strong image/map block, followed by compact route-preview rows.
- Filters are progressive: location, date, distance, race type, and registration state.
- Loading uses skeletons; empty results explain how to broaden the search; network failure keeps
  the last cached list with a clear retry action.
- Cards open the same Race Details route whether entered from featured content, search, or a push.

### Race Details

- The route/map is informative but not the only source of event information.
- Registration state is explicit: registration open, waitlist, closed, sold out, or completed.
- Distance selection is a single obvious control. Capacity, price, cutoff, start time, and age
  rules update with the selected category.
- The sticky action is always specific: `Register now`, `Join waitlist`, or `Registration closed`.
- Back navigation preserves the user's scroll position and selected filters.

### Race Registration

- The flow is a short, visible sequence: details → review → submitted.
- Fields are prefilled from Account but remain editable where policy allows.
- Payment proof is private, size/type constrained, retry-safe, and never a public static URL.
- The review step repeats race, category, runner, price/status, and organizer-sharing scope.
- Duplicate taps return the existing registration rather than creating another one.
- Expired session, capacity conflict, upload failure, and network retry have inline recovery paths.

### My Registrations

- Upcoming and Past are mutually exclusive, high-contrast segments.
- The upcoming card prioritizes date, category, bib, status, and ticket access.
- Past entries expose certificate/download only when the server says it is available.
- Offline cached entries are labeled with freshness; ticket actions require a valid authorized
  response and do not expose private registration media through public URLs.

## Motion and interaction

- Search/filter chips slide into the toolbar in 150–220 ms; reduced motion uses an instant state swap.
- Opening a race subtly expands the selected route thumbnail into the detail map; no long page-load
  choreography.
- Category selection updates price/capacity/metrics with a short crossfade and preserves focus.
- Registration progress advances with a compact progress transition and accessible announcement.
- Upload proof shows queued, uploading, retry, and complete states; never rely on color alone.
- A successful registration uses a restrained confirmation pulse and offers `Open ticket` immediately.
- Haptics are optional feedback for category selection and successful submission, disabled when the
  user or device requests reduced motion/feedback.

## Modes

All native screens use the same semantic tokens in three modes:

| Mode | Use | Design rule |
| --- | --- | --- |
| Light | Discovery, registration, payments, bright outdoor conditions | White/near-white surface, navy text, teal primary action, orange as a small race cue. |
| Dark | Evening browsing and low-light use | Deep navy surface, high-contrast text, teal/green status, no gray-on-black body copy. |
| Race | Race day, achievements, energetic moments | Lime and purple accents over a dark base; preserve contrast and keep primary information calm. |

Race registration and private-data surfaces default to the clearest high-contrast treatment, even when
the user prefers Race mode. Theme changes never change permission, privacy, or registration semantics.

## Languages and RTL

- English uses concise, direct race language.
- French uses the same hierarchy with natural local phrasing; never translate by shrinking text.
- Algerian Darija uses Arabic script and familiar local wording where appropriate, with standard
  race/registration terms retained when they are clearer.
- Arabic is a true RTL layout: navigation order, progress, chevrons, route metadata, form labels,
  and action placement mirror semantically. Map orientation and numeric pace/distance conventions do
  not mirror.
- All labels must survive longer French strings and Arabic shaping without clipping. Native tests
  include 1.3× font scale, narrow Android screens, and keyboard-visible registration forms.

## Native Android acceptance

- Implement with Compose/Material 3 and the shared `core/design` tokens; do not reproduce the web
  DOM or use public web upload URLs as a private-media shortcut.
- Every screen has loading, error, empty, offline, expired-session, and permission-denied states.
- Navigation is safe with Android back, deep links, process death, and account switching.
- Race lists and registration are backed by versioned `/api/v1` DTOs, server authorization, pagination,
  idempotency keys, and bounded request bodies.
- Registration must remain correct under duplicate taps, capacity changes, 401/403/409/429/5xx,
  payment-proof retry, and interrupted uploads.
- Compare the signed native build against the Capacitor reference using the same race fixtures and
  device matrix before considering parity complete.

## Accessibility and privacy checklist

- Touch targets are at least 44 dp; focus order follows the visual flow; labels are announced by
  TalkBack; status is conveyed by text/icon and not color alone.
- Body text and controls meet WCAG AA in light, dark, and Race modes.
- No exact home location, private GPX, payment proof, phone number, or organizer-only data appears in
  public cards, logs, notification payloads, screenshots, analytics, or error messages.
- Export, deletion, registration cancellation, and private-media access follow the same server-side
  authorization and retention rules as the web and Capacitor clients.
