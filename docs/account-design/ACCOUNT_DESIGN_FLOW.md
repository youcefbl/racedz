# ZidRun Account Design Flow

This folder is the native Android visual reference for the runner Account experience. It uses the
same Runs and Coach template: a focused mobile shell, compact data summaries, clear list actions,
high-contrast themes, and privacy controls that are understandable without legal jargon.

The images are high-fidelity product references, not implementation code. Native screens should
reuse the shared Compose design tokens and preserve the information hierarchy shown here.

## Screens

| Screen | Purpose | Image |
| --- | --- | --- |
| Account Overview | Give the runner a calm home for identity, season momentum, next race, and account actions. | [01 — Account Overview](images/01-account-overview.png) |
| Profile & Preferences | Edit identity, appearance, language, notifications, and private-activity defaults. | [02 — Profile & Preferences](images/02-profile-preferences.png) |
| Privacy & Data | Explain visibility and provide review, export, and deletion controls. | [03 — Privacy & Data](images/03-privacy-data.png) |
| My Registrations | Manage event entries, tickets, and certificates from the linked Race flow. | [Race Design — My Registrations](../races-design/images/04-my-registrations.png) |

## Primary flow

```text
Account Overview
  ├─ My registrations ─────────────> Upcoming / Past → ticket or certificate
  ├─ Profile & preferences ────────> profile / theme / language / notifications
  └─ Privacy & data ───────────────> visibility / Coach memory / export / delete

Any account mutation
  └─ save → inline success/error → server-authoritative state → safe back navigation
```

## Screen behavior

### Account Overview

- Identity is clear but not overexposed: display name and broad location are enough for the home.
- Season summary uses three compact, meaningful values; it is not a generic analytics dashboard.
- The next registration is an actionable bridge to the Race experience.
- The three primary rows are stable: registrations, profile/preferences, privacy/data.
- When there is no history, the empty state points to discovering races rather than showing empty cards.
- Account switching and logout are reachable from the settings action with explicit confirmation only
  where data loss or device-session changes are possible.

### Profile & Preferences

- Identity fields show current values and use focused native editors with keyboard-safe scrolling.
- Appearance offers Light, Dark, and Race as a single mutually exclusive choice.
- Language offers English, Français, and Algerian Darija (`دارجة جزائرية`) without hiding the current
  selection behind a flag or icon.
- Push notifications and private activity are independent toggles with plain-language descriptions.
- Save is server-authoritative, retry-safe, and reports whether the change is local, pending, or saved.

### Privacy & Data

- The first panel states the current default visibility in one sentence.
- Precise-location sharing is off by default and requires a deliberate user choice.
- Coach memory has a review path with consent, stored fields, retention, and delete controls.
- Export explains what will be included and delivers it through an authenticated, expiring flow.
- Account deletion is visually distinct, requires re-authentication/confirmation, and explains the
  retention exceptions before the final action.

## Motion and interaction

- Account rows use a short 150–220 ms pressed/focus response; no decorative page-load choreography.
- The season summary can update with a small number transition after a server-confirmed change.
- Theme changes preview immediately, then persist after confirmation; reduced motion disables fades.
- Language changes apply after the selection is confirmed, preserve the current route, and restore
  scroll/focus where possible.
- Privacy toggles show a compact confirmation and never silently change historical visibility.
- Export and delete use progress, pending, success, and failure states that remain understandable
  with TalkBack and without color.

## Modes

| Mode | Use | Design rule |
| --- | --- | --- |
| Light | Everyday account management and bright outdoor use | Clean surface, navy text, teal actions, restrained green privacy status. |
| Dark | Low-light browsing and battery-conscious use | Deep navy surface, high-contrast white text, controlled green selection. |
| Race | Race-day energy and achievements | Lime selection and energetic accents; keep privacy and destructive actions legible. |

The screenshots intentionally show multiple modes: Account Overview and Privacy & Data use Light,
Profile & Preferences uses Race, and My Registrations uses Dark. The implementation must verify all
screens in all three modes.

## Languages and RTL

- English, French, and Algerian Darija are supported at the same information architecture level.
- French labels may be longer; the layout must grow vertically rather than truncate or squeeze.
- Algerian Darija uses Arabic script and keeps a natural, conversational tone for settings help text.
- Arabic RTL mirrors the navigation and control order semantically, including settings rows, segmented
  choices, chevrons, and primary actions. Numeric values and map imagery remain readable and are not
  mirrored as graphics.
- Font scale, TalkBack labels, input focus, and keyboard insets are tested in every locale.

## Native Android acceptance

- Implement with Compose/Material 3, shared semantic tokens, Navigation Compose, and lifecycle-aware
  state; keep account data behind authenticated `/api/v1/me` DTOs.
- Never store tokens in preferences or logs. Use Keystore-backed session storage and purge local
  private data on logout/account switch according to the privacy contract.
- Every save, export, delete, notification, and privacy mutation has server authorization, validation,
  request IDs, bounded payloads, retry behavior, and an auditable result.
- Private runs, GPX, health/Coach context, phone numbers, payment data, and exact location do not enter
  public profile cards, push payloads, screenshots, analytics, crash breadcrumbs, or error messages.
- Verify process death, offline edits, expired sessions, account switching, denied notification access,
  large text, RTL, and Android back behavior on the signed native build.

## Accessibility checklist

- Minimum 44 dp targets, visible focus, TalkBack labels for every icon-only action, and logical heading
  order.
- WCAG AA contrast in all three modes; status, privacy, and destructive actions are never color-only.
- Settings use familiar switches, fields, segmented choices, and confirmation patterns rather than
  invented gestures.
- Animations respect reduced-motion settings and never block the save, export, or delete flow.
