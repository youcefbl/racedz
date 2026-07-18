# ZidRun UI Roadmap---

This file is the focused source of truth for public website and product UI improvements. Keep `TODO.md` for product/backend planning, and use this file when the work is mainly visual design, UX, navigation, layout, content hierarchy, or responsive polish.

## UI Direction

ZidRun should feel:

- Clean, minimalist, and fast to scan.
- Sporty and energetic without becoming noisy.
- Trustworthy enough for payments, registrations, and organizer operations.
- Mobile-first for runners.
- Dense and operational for admin/organizer dashboards.

Use the existing three modes:

- Light
- Dark
- Race

Race mode can use stronger lime, pink, and purple accents, but text must remain readable.

## Current UI Priority

1. Public website top bar:
   - Completed first-pass redesign:
     - Improved first impression and brand presence.
     - Removed the Races/Find a Race duplication; Find a Race is now the race-discovery CTA.
     - Kept public nav simple with Organizers as the informational nav link.
     - Added visible Sign Up for unauthenticated visitors.
     - Collapsed the three-way theme control into a single dropdown.
     - Added utility/account visual separation in the top bar.
     - Made authenticated state clearer with notification + profile controls.
     - Made unauthenticated CTA hierarchy clearer: login secondary, find race primary.
     - Improved mobile menu spacing, hierarchy, and tap targets.
     - Preserved language and theme controls.

2. Public homepage:
   - Replace the current generic hero image treatment with a stronger race-discovery first screen.
   - Make search feel like the primary action.
   - Improve race cards section with stronger date/location/distance/price hierarchy.
   - Add more confidence signals without marketing filler.

3. Public race details:
   - Make registration state and user registration summary visually stronger.
   - Improve category table/cards for multi-race events.
   - Improve announcement visibility.

4. Race listing:
   - Make filters easier to scan on mobile.
   - Improve active filter visibility.
   - Make empty states more useful.

5. Organizer public page:
   - Make it more convincing for organizations without looking like a generic SaaS landing page.
   - Show concrete organizer workflows: create race, manage categories, confirm payments, export participants.

6. Dashboard polish:
   - Check admin and organizer navigation density.
   - Improve table readability on mobile.
   - Improve action button grouping for registration/payment workflows.

7. Locale and RTL polish:
   - Decide default locale strategy for Algeria-first usage:
     - Browser `Accept-Language` or client `navigator.language`.
     - Prefer FR or AR fallback over EN if no explicit choice is stored.
   - Persist selected language beyond query strings.
   - Verify Arabic switches the full layout to RTL:
     - Nav order.
     - Icon positions.
     - Button alignment.
     - Dropdown alignment.
     - Form label/input rhythm.

## Design Rules

- Use real app surfaces and race content over decorative filler.
- Keep cards for repeated items, modals, and contained tools only.
- Do not put cards inside cards.
- Keep dashboard UI calm; keep public discovery more energetic.
- Use icon buttons where the action is familiar.
- Keep text inside buttons short and non-wrapping.
- Every UI change must be checked in light, dark, and race modes.
- Every public page must work well on mobile.

## Done

- Public top bar reduced to visitor-facing Races and Organizers links.
- Public top bar first-pass redesign completed with stronger brand, nav active state, CTA hierarchy, visible signup, theme dropdown, utility divider, and mobile menu.
- Authenticated users see profile controls instead of login.
- Three theme modes exist.
- Language switcher exists.
- Race detail pages show a runner's existing registration status/details instead of the register CTA when already registered.
- Race cards and detail pages preserve portrait race posters with a full-image foreground and restrained blurred backdrop.
- Short pages keep the footer at the viewport bottom without overlaying page content.
- Auto-cancel registration controls use theme tokens in light, dark, and race modes.
- Organizer navigation and core workflows support French and Arabic, preserve the selected locale, and switch to RTL for Arabic.
- Race posters and image-upload previews open in an accessible lightbox with zoom, reset, backdrop close, and Escape support.
- Improved mobile/tablet responsiveness for the public header, race detail sidebars, action buttons, and admin race-history tables.
